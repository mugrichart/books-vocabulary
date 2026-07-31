"use client";
"use no memo";

import { Fragment, useEffect, useRef, useCallback } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';

import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { highlightPlugin } from '@react-pdf-viewer/highlight';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Required Styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

import { CaptureItem } from './usePdfSelections';

interface Props {
    fileUrl: string;
    /** All captured items — used to render placeholder boxes on each page */
    allItems: CaptureItem[];
    activeItem: CaptureItem | null;
  onCorrect: (item: CaptureItem) => void;
    /** Called after 3 failed typing attempts — passes mock options + explanation upward */
    onAttemptsExhausted?: (data: { options: string[]; explanation: string }) => void;
    /** Reports the current attempt count upward so the sidebar can display it */
    onAttemptChange?: (count: number) => void;
    /** If true, user answers by speaking instead of typing */
    speakModeEnabled: boolean;
    /** Emits current speech transcript for sidebar display */
    onSpeechTranscriptChange?: (value: string) => void;
    /** Emits whether speech recognizer is actively listening */
    onSpeechListeningChange?: (value: boolean) => void;
    /** Emits speaking activity to animate sidebar bars */
    onSpeechActivityChange?: (value: boolean) => void;
    /** Increment to clear current transcript manually */
    speechClearNonce: number;
}

interface SpeechRecognitionResultAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultAlternative;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResult;
    length: number;
  };
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type WindowWithSpeech = Window & {
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  SpeechRecognition?: SpeechRecognitionCtor;
};

export default function PracticePDFViewer({
    fileUrl,
    allItems,
    activeItem,
    onCorrect,
    onAttemptsExhausted,
    onAttemptChange,
    speakModeEnabled,
    onSpeechTranscriptChange,
    onSpeechListeningChange,
    onSpeechActivityChange,
    speechClearNonce,
}: Props) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  // --- Attempt tracking state ---
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);
  const hasFiredRef = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speakModeEnabledRef = useRef(speakModeEnabled);
  const activeItemRef = useRef<CaptureItem | null>(activeItem);
  const onCorrectRef = useRef(onCorrect);
  const clearTranscriptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechActivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    speakModeEnabledRef.current = speakModeEnabled;
  }, [speakModeEnabled]);

  useEffect(() => {
    activeItemRef.current = activeItem;
  }, [activeItem]);

  useEffect(() => {
    onCorrectRef.current = onCorrect;
  }, [onCorrect]);

  // Reset everything when the active word changes
  useEffect(() => {
    attemptsRef.current = 0;
    hasFiredRef.current = false;
    onAttemptChange?.(0);
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, [activeItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizeAnswer = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizeSpoken = (value: string) =>
    normalizeAnswer(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const clearTranscript = useCallback(() => {
    transcriptRef.current = '';
    onSpeechTranscriptChange?.('');
  }, [onSpeechTranscriptChange]);

  const scheduleTranscriptClear = useCallback(() => {
    if (clearTranscriptTimerRef.current) {
      clearTimeout(clearTranscriptTimerRef.current);
    }
    clearTranscriptTimerRef.current = setTimeout(() => {
      clearTranscript();
    }, 2000);
  }, [clearTranscript]);

  const flagSpeechActivity = useCallback(() => {
    onSpeechActivityChange?.(true);
    if (speechActivityTimerRef.current) {
      clearTimeout(speechActivityTimerRef.current);
    }
    speechActivityTimerRef.current = setTimeout(() => {
      onSpeechActivityChange?.(false);
    }, 260);
  }, [onSpeechActivityChange]);

  useEffect(() => {
    if (clearTranscriptTimerRef.current) {
      clearTimeout(clearTranscriptTimerRef.current);
      clearTranscriptTimerRef.current = null;
    }
    clearTranscript();
    onSpeechActivityChange?.(false);
  }, [activeItem?.id, clearTranscript, onSpeechActivityChange]);

  useEffect(() => {
    clearTranscript();
  }, [clearTranscript, speechClearNonce]);

  useEffect(() => {
    const browserWindow = window as WindowWithSpeech;
    const SpeechRecognitionCtor = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor || !speakModeEnabled || !activeItem) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      onSpeechListeningChange?.(false);
      onSpeechActivityChange?.(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const latestActiveItem = activeItemRef.current;
      if (!latestActiveItem) return;

      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          transcript += ` ${event.results[i][0]?.transcript ?? ''}`;
        }
      }

      flagSpeechActivity();

      const mergedTranscript = `${transcriptRef.current} ${transcript}`.trim();
      transcriptRef.current = mergedTranscript;
      onSpeechTranscriptChange?.(mergedTranscript);

      const normalizedTranscript = normalizeSpoken(mergedTranscript);
      const normalizedTarget = normalizeSpoken(latestActiveItem.word);

      if (normalizedTranscript && normalizedTarget && normalizedTranscript.includes(normalizedTarget)) {
        if (clearTranscriptTimerRef.current) {
          clearTimeout(clearTranscriptTimerRef.current);
          clearTranscriptTimerRef.current = null;
        }
        clearTranscript();
        onCorrectRef.current(latestActiveItem);
      } else {
        scheduleTranscriptClear();
      }
    };

    recognition.onend = () => {
      onSpeechListeningChange?.(false);
      if (speakModeEnabledRef.current && activeItemRef.current) {
        try {
          recognition.start();
          onSpeechListeningChange?.(true);
        } catch {
          // Some browsers throw if start is called while already starting.
        }
      }
    };

    recognition.onerror = () => {
      // Ignore recoverable errors; onend restart handles transient failures.
      onSpeechListeningChange?.(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      onSpeechListeningChange?.(true);
    } catch {
      recognitionRef.current = null;
      onSpeechListeningChange?.(false);
    }

    return () => {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.stop();
      recognitionRef.current = null;
      onSpeechListeningChange?.(false);
      onSpeechActivityChange?.(false);
    };
  }, [
    activeItem,
    clearTranscript,
    flagSpeechActivity,
    onSpeechActivityChange,
    onSpeechListeningChange,
    onSpeechTranscriptChange,
    scheduleTranscriptClear,
    speakModeEnabled,
  ]);

  useEffect(() => {
    return () => {
      if (clearTranscriptTimerRef.current) {
        clearTimeout(clearTranscriptTimerRef.current);
      }
      if (speechActivityTimerRef.current) {
        clearTimeout(speechActivityTimerRef.current);
      }
    };
  }, []);

  const handleAnswerChange = useCallback((value: string) => {
    // Check for correct answer
    if (activeItem && normalizeAnswer(value) === normalizeAnswer(activeItem.word)) {
      onCorrect(activeItem);
      return;
    }

    // If already exhausted, ignore further typing
    if (attemptsRef.current >= 3) return;

    // Clear previous pause timer
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

    // Only start counting if the user has typed something
    if (value.trim() === '') return;

    // Register an attempt after a 2‑second pause
    pauseTimerRef.current = setTimeout(() => {
      attemptsRef.current += 1;
      onAttemptChange?.(attemptsRef.current);

      // Fire onAttemptsExhausted directly when the 3rd attempt is registered.
      // Done here instead of a useEffect to avoid a race condition between
      // the reset effect and the exhaustion effect on word transitions.
      if (attemptsRef.current >= 3 && activeItem && !hasFiredRef.current) {
        hasFiredRef.current = true;
        const correct = activeItem.word;
        const options = (activeItem.options && activeItem.options.length > 0)
          ? activeItem.options
          : [correct, 'Option A', 'Option B', 'Option C'].sort(() => Math.random() - 0.5);
        const explanation = activeItem.explanation ||
          `General meaning: "${correct}" generally refers to …\n\nIn context: Within the sentence, "${correct}" is used to convey …`;
        onAttemptsExhausted?.({ options, explanation });
      }
    }, 2000);
  }, [activeItem, onCorrect, onAttemptChange, onAttemptsExhausted]);

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: () => <span className="hidden" />,
    renderHighlights: (renderProps) => {
      const currentActive = activeItem;
      const currentAllItems = allItems;

      // Gather all unchecked items that have coordinates on this page
      const pageItems: { item: CaptureItem; areas: typeof currentAllItems[0]['coordinates'] }[] = [];
      for (const item of currentAllItems) {
        // Skip checked (cleared) items — no box needed
        if (item.checked) continue;

        const areasOnPage = item.coordinates.filter(
          (area) => area.pageIndex === renderProps.pageIndex
        );
        if (areasOnPage.length > 0) {
          pageItems.push({ item, areas: areasOnPage });
        }
      }

      if (pageItems.length === 0) return <span className="hidden" />;

      return (
        <>
          {pageItems.flatMap(({ item, areas }) => {
            const isActive = currentActive?.id === item.id;

            return areas.map((area, index) => {
              if (isActive) {
                // Active word: always-editable input.
                // handleAnswerChange silently ignores input after 3 attempts,
                // so we never need readOnly/disabled — no grey-out, no focus issues.
                return (
                  <Fragment key={`${item.id}-${index}`}>
                    {index === 0 && (
                      <div
                        aria-hidden="true"
                        className="absolute left-1 z-20 animate-pulse select-none text-violet-500"
                        style={{
                          top: `${area.top + area.height / 2}%`,
                          transform: 'translateY(-50%)',
                          textShadow: '0 0 8px rgba(139, 92, 246, 0.6)',
                        }}
                      >
                        <span className="text-lg leading-none">➜</span>
                      </div>
                    )}

                    <input
                      autoFocus={index === 0}
                      aria-label={`Type the hidden word from page ${area.pageIndex + 1}`}
                      defaultValue=""
                      onChange={(event) => handleAnswerChange(event.target.value)}
                      className="absolute z-10 bg-white px-px font-semibold text-zinc-950 outline-none border-none ring-0 focus:ring-0 focus:outline-none"
                      style={{
                        boxSizing: 'border-box',
                        fontSize: `${Math.max(8, Math.min(16, area.height * 6))}px`,
                        height: `${area.height}%`,
                        left: `${area.left}%`,
                        lineHeight: 1,
                        top: `${area.top}%`,
                        width: `${area.width}%`,
                      }}
                    />
                  </Fragment>
                );
              }

              // Non-active unchecked items: fully opaque box that hides the word underneath
              return (
                <div
                  key={`${item.id}-${index}`}
                  className="absolute z-[5] bg-white"
                  style={{
                    boxSizing: 'border-box',
                    height: `${area.height}%`,
                    left: `${area.left}%`,
                    top: `${area.top}%`,
                    width: `${area.width}%`,
                  }}
                />
              );
            });
          })}
        </>
      );
    },
  });

  // Only jump to the highlight when moving to a different page
  const prevPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (activeItem) {
      const firstArea = activeItem.coordinates[0];
      if (firstArea && firstArea.pageIndex !== prevPageRef.current) {
        highlightPluginInstance.jumpToHighlightArea(firstArea);
        prevPageRef.current = firstArea.pageIndex;
      }
    }
  }, [activeItem, highlightPluginInstance]);

  return (
    <Worker workerUrl={pdfjsWorker}>
      <Viewer
        fileUrl={fileUrl}
          defaultScale={1.5}
        plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
        initialPage={activeItem?.pageIndex ?? 0}
      />
    </Worker>
  );
}
