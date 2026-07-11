"use client";
"use no memo";

import { useEffect, useRef, useState, useCallback } from 'react';
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
    onCorrect: (id: string) => void;
    /** Called after 3 failed typing attempts — passes mock options + explanation upward */
    onAttemptsExhausted?: (data: { options: string[]; explanation: string }) => void;
    /** Reports the current attempt count upward so the sidebar can display it */
    onAttemptChange?: (count: number) => void;
}

export default function PracticePDFViewer({
    fileUrl,
    allItems,
    activeItem,
    onCorrect,
    onAttemptsExhausted,
    onAttemptChange,
}: Props) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  // --- Attempt tracking state ---
  const [attempts, setAttempts] = useState(0);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);
  const hasFiredRef = useRef(false);

  // Reset everything when the active word changes
  useEffect(() => {
    setAttempts(0);
    attemptsRef.current = 0;
    hasFiredRef.current = false;
    onAttemptChange?.(0);
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, [activeItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizeAnswer = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

  const handleAnswerChange = useCallback((value: string) => {
    // Check for correct answer
    if (activeItem && normalizeAnswer(value) === normalizeAnswer(activeItem.word)) {
      onCorrect(activeItem.id);
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
      setAttempts(attemptsRef.current);
      onAttemptChange?.(attemptsRef.current);

      // Fire onAttemptsExhausted directly when the 3rd attempt is registered.
      // Done here instead of a useEffect to avoid a race condition between
      // the reset effect and the exhaustion effect on word transitions.
      if (attemptsRef.current >= 3 && activeItem && !hasFiredRef.current) {
        hasFiredRef.current = true;
        const correct = activeItem.word;
        const mockOptions = [correct, 'Option A', 'Option B', 'Option C']
          .sort(() => Math.random() - 0.5);
        const explanation =
          `General meaning: "${correct}" generally refers to …\n\nIn context: Within the sentence, "${correct}" is used to convey …`;
        onAttemptsExhausted?.({ options: mockOptions, explanation });
      }
    }, 2000);
  }, [activeItem, onCorrect, onAttemptChange, onAttemptsExhausted]);

  // Stable ref for allItems so the highlight plugin closure always has fresh data
  const allItemsRef = useRef(allItems);
  allItemsRef.current = allItems;

  const activeItemRef = useRef(activeItem);
  activeItemRef.current = activeItem;

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: () => <span className="hidden" />,
    renderHighlights: (renderProps) => {
      const currentActive = activeItemRef.current;
      const currentAllItems = allItemsRef.current;

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
                  <input
                    key={`${item.id}-${index}`}
                    autoFocus={index === 0}
                    aria-label={`Type the hidden word from page ${area.pageIndex + 1}`}
                    defaultValue=""
                    onChange={(event) => handleAnswerChange(event.target.value)}
                    className="absolute z-10 rounded-[2px] border-2 border-violet-500 bg-white px-px font-semibold text-zinc-950 shadow-sm outline-none ring-1 ring-violet-500/20 focus:ring-violet-500/40 dark:bg-zinc-950 dark:text-zinc-100"
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
                );
              }

              // Non-active unchecked items: fully opaque box that hides the word underneath
              return (
                <div
                  key={`${item.id}-${index}`}
                  className="absolute z-[5] rounded-[2px] border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-950"
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
