"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import LeftSidebar from './pdf/LeftSidebar';
import RightSidebar, { type PracticeData } from './pdf/RightSidebar';
import PDFDocumentSurface from './pdf/PDFDocumentSurface';
import { type CaptureItem, usePdfSelections } from './pdf/usePdfSelections';

interface Props {
  fileUrl: string;
  bookId: string;
  bookTitle: string;
}

interface PassiveExplanation {
  correct: string;
  explanation: string;
}

export default function PDFViewer({ fileUrl, bookId, bookTitle }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'practice' | 'capture'>('capture');
  const {
    items,
    totalCount,
    practiceCursor,
    practiceBatchSize,
    isLoadingText,
    captureSelection,
    retryCapture,
    removeItem,
    markItemChecked,
    jumpToPracticeCursor,
    resetPractice,
    fetchLastCapturePage,
    highlightQuery,
  } = usePdfSelections(fileUrl, bookId, mode);

  // Back button handler
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // --- Capture-mode page tracking ---
  // We only want to auto-scroll in capture mode in two specific cases:
  //   1. On initial page load
  //   2. When the user switches back from practice to capture mode
  // We always fetch fresh from the server to avoid stale data.
  const [captureInitialPage, setCaptureInitialPage] = useState(0);
  const [captureViewerKey, setCaptureViewerKey] = useState(0);
  const hasScrolledOnLoadRef = useRef(false);
  const prevModeRef = useRef(mode);

  // Case 1: on mount, fetch the most recently captured item's page
  useEffect(() => {
    if (hasScrolledOnLoadRef.current) return;
    hasScrolledOnLoadRef.current = true;
    fetchLastCapturePage().then((page) => {
      if (page !== null) {
        setCaptureInitialPage(page);
        setCaptureViewerKey((k) => k + 1);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Case 2: when switching practice → capture, fetch fresh from server
  useEffect(() => {
    if (prevModeRef.current === 'practice' && mode === 'capture') {
      fetchLastCapturePage().then((page) => {
        if (page !== null) {
          setCaptureInitialPage(page);
          setCaptureViewerKey((k) => k + 1);
        }
      });
    }
    prevModeRef.current = mode;
  }, [mode, fetchLastCapturePage]);

  const activePracticeItem = items.find((item) => !item.checked) ?? null;

  // Holds mock practice data after attempts are exhausted
  const [practiceData, setPracticeData] = useState<PracticeData | undefined>(undefined);
  // Holds previous-word explanation while current-word attempts continue
  const [passiveExplanation, setPassiveExplanation] = useState<PassiveExplanation | undefined>(undefined);
  // Track attempt count for display in the sidebar
  const [attempts, setAttempts] = useState(0);
  const [speakModeEnabled, setSpeakModeEnabled] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [isSpeechListening, setIsSpeechListening] = useState(false);
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const [speechClearNonce, setSpeechClearNonce] = useState(0);

  useEffect(() => {
    const isSmallDevice = window.matchMedia('(max-width: 1024px)').matches;
    setSpeakModeEnabled(isSmallDevice);
  }, []);

  useEffect(() => {
    if (!speakModeEnabled) {
      setSpeechTranscript('');
      setIsSpeechActive(false);
      setIsSpeechListening(false);
    }
  }, [speakModeEnabled]);

  const launchDomConfetti = useCallback((intensity: number) => {
    const colors = ['#8b5cf6', '#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#eab308'];
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    document.body.appendChild(container);

    const burstCount = Math.min(3, Math.max(1, intensity));

    for (let burst = 0; burst < burstCount; burst += 1) {
      window.setTimeout(() => {
        const particleCount = 120 + burst * 35;
        for (let i = 0; i < particleCount; i += 1) {
          const piece = document.createElement('span');
          const size = 6 + Math.random() * 7;
          piece.style.position = 'absolute';
          piece.style.width = `${size}px`;
          piece.style.height = `${size * 0.6}px`;
          piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
          piece.style.left = `${20 + Math.random() * 60}%`;
          piece.style.top = `${20 + Math.random() * 40}%`;
          piece.style.borderRadius = '1px';
          container.appendChild(piece);

          const driftX = (Math.random() - 0.5) * (480 + burst * 80);
          const driftY = 320 + Math.random() * 320;
          const spinTurns = 1 + Math.random() * 4;
          const duration = 1400 + Math.random() * 1100;

          piece.animate(
            [
              {
                transform: `translate3d(0, 0, 0) rotate(0turn)`,
                opacity: 1,
              },
              {
                transform: `translate3d(${driftX}px, ${driftY}px, 0) rotate(${spinTurns}turn)`,
                opacity: 0,
              },
            ],
            {
              duration,
              easing: 'cubic-bezier(0.12, 0.85, 0.23, 1)',
              fill: 'forwards',
            }
          );
        }
      }, burst * 420);
    }

    window.setTimeout(() => {
      container.remove();
    }, 3200 + burstCount * 280);
  }, []);

  const playCelebration = useCallback(async (intensity: number) => {
    launchDomConfetti(intensity);

    try {
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      const now = audioContext.currentTime;
      const fanfare = [
        { freq: 523.25, duration: 0.18, start: 0 },
        { freq: 659.25, duration: 0.2, start: 0.11 },
        { freq: 783.99, duration: 0.26, start: 0.21 },
        { freq: 1046.5, duration: 0.35, start: 0.36 },
      ];
      const repeats = Math.min(3, Math.max(1, intensity));

      for (let repeat = 0; repeat < repeats; repeat += 1) {
        const repeatOffset = repeat * 0.58;
        fanfare.forEach(({ freq, duration, start }) => {
          const noteStart = now + repeatOffset + start;
          const noteEnd = noteStart + duration;

          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const shimmer = audioContext.createOscillator();
          const shimmerGain = audioContext.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, noteStart);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.03, noteEnd);

          shimmer.type = 'triangle';
          shimmer.frequency.setValueAtTime(freq * 2, noteStart);

          gain.gain.setValueAtTime(0.0001, noteStart);
          gain.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

          shimmerGain.gain.setValueAtTime(0.0001, noteStart);
          shimmerGain.gain.exponentialRampToValueAtTime(0.07, noteStart + 0.02);
          shimmerGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

          osc.connect(gain);
          shimmer.connect(shimmerGain);
          gain.connect(audioContext.destination);
          shimmerGain.connect(audioContext.destination);

          osc.start(noteStart);
          shimmer.start(noteStart);
          osc.stop(noteEnd + 0.02);
          shimmer.stop(noteEnd + 0.02);
        });
      }

      const audioLifetime = repeats * 0.58 + 1;
      window.setTimeout(() => {
        void audioContext.close();
      }, Math.ceil(audioLifetime * 1000));
    } catch (error) {
      console.error('Celebration audio failed:', error);
    }
  }, [launchDomConfetti]);

  const previousCursorRef = useRef(practiceCursor);
  const completedFullBatchStreakRef = useRef(0);
  useEffect(() => {
    if (mode !== 'practice') {
      previousCursorRef.current = practiceCursor;
      completedFullBatchStreakRef.current = 0;
      return;
    }

    const previousCursor = previousCursorRef.current;
    const cursorIncreased = practiceCursor > previousCursor;
    const completedBatch = practiceCursor > 0 && practiceCursor % practiceBatchSize === 0;
    const completedFinalPartialBatch = totalCount > 0 && practiceCursor === totalCount;

    if (cursorIncreased && (completedBatch || completedFinalPartialBatch)) {
      if (completedBatch) {
        completedFullBatchStreakRef.current += 1;
      } else {
        completedFullBatchStreakRef.current = 0;
      }

      const streak = completedFullBatchStreakRef.current;
      const intensity = streak >= 3 ? 3 : streak >= 2 ? 2 : 1;
      playCelebration(intensity);
    }

    previousCursorRef.current = practiceCursor;
  }, [mode, playCelebration, practiceBatchSize, practiceCursor, totalCount]);

  // Called from PracticePDFViewer → PDFDocumentSurface when 3 attempts are used
  const handleAttemptsExhausted = useCallback((data: { options: string[]; explanation: string }) => {
    if (!activePracticeItem) return;
    setPassiveExplanation(undefined);
    setPracticeData({
      kind: 'attempts',
      correct: activePracticeItem.word,
      options: data.options,
      explanation: data.explanation,
    });
  }, [activePracticeItem]);

  // Called from PracticePDFViewer when user types the word correctly.
  // We auto-advance as before and keep an ambient explanation in the sidebar.
  const handlePracticeCorrect = useCallback((item: CaptureItem) => {
    setPassiveExplanation({
      correct: item.word,
      explanation: item.explanation || `General meaning: "${item.word}" generally refers to …`,
    });
    setAttempts(0);
    markItemChecked(item.id);
  }, [markItemChecked]);

  // Called from PracticePDFViewer each time the attempt count changes
  const handleAttemptChange = useCallback((count: number) => {
    setAttempts(count);
  }, []);

  const handleClearSpeechTranscript = useCallback(() => {
    setSpeechTranscript('');
    setSpeechClearNonce((prev) => prev + 1);
  }, []);

  // Called from RightSidebar when user picks an option
  const handleOptionSelect = useCallback(() => {
    // Don't auto-advance — let the user read the explanation and click Next.
    // The Next button handles marking checked + advancing.
  }, []);

  // Called from RightSidebar "Next" button
  const handleNext = useCallback(() => {
    // Move cursor forward by one item in practice mode
    if (activePracticeItem) {
      markItemChecked(activePracticeItem.id);
    }
    // Clear practice data for the next word
    setPracticeData(undefined);
    setAttempts(0);
  }, [activePracticeItem, markItemChecked]);

  // Called from RightSidebar hint button — skip attempts and reveal explanation immediately
  const handleRevealHint = useCallback(() => {
    if (!activePracticeItem) return;
    setPassiveExplanation(undefined);
    setPracticeData({
      kind: 'hint',
      correct: activePracticeItem.word,
      options: activePracticeItem.options,
      explanation: activePracticeItem.explanation,
    });
  }, [activePracticeItem]);

  const handleBatchSelect = useCallback((cursor: number) => {
    setPracticeData(undefined);
    setPassiveExplanation(undefined);
    setAttempts(0);
    jumpToPracticeCursor(cursor);
  }, [jumpToPracticeCursor]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar */}
      <LeftSidebar
        mode={mode}
        items={items}
        activeItemId={activePracticeItem?.id ?? null}
        isLoadingText={isLoadingText}
        onRemoveItem={removeItem}
        onRetryItem={retryCapture}
        onResetPractice={() => {
          resetPractice();
          setPracticeData(undefined);
          setPassiveExplanation(undefined);
          setAttempts(0);
        }}
        highlightQuery={highlightQuery}
        title={bookTitle}
        totalCount={totalCount}
        onBack={handleBack}
      />

      {/* Main PDF Area */}
      <div className="flex-1 overflow-hidden">
        <PDFDocumentSurface
          mode={mode}
          fileUrl={fileUrl}
          allItems={items}
          activePracticeItem={activePracticeItem}
          onCapture={captureSelection}
          onPracticeCorrect={handlePracticeCorrect}
          onAttemptsExhausted={handleAttemptsExhausted}
          onAttemptChange={handleAttemptChange}
          onSpeechTranscriptChange={setSpeechTranscript}
          onSpeechListeningChange={setIsSpeechListening}
          onSpeechActivityChange={setIsSpeechActive}
          speechClearNonce={speechClearNonce}
          speakModeEnabled={speakModeEnabled}
          captureInitialPage={captureInitialPage}
          captureViewerKey={captureViewerKey}
        />
      </div>

      {/* Right Sidebar */}
      <RightSidebar
        mode={mode}
        setMode={setMode}
        practiceData={practiceData}
        passiveExplanation={passiveExplanation}
        attempts={attempts}
        hasActiveWord={activePracticeItem !== null}
        cursor={practiceCursor}
        batchSize={practiceBatchSize}
        totalCaptures={totalCount}
        onBatchSelect={handleBatchSelect}
        onOptionSelect={handleOptionSelect}
        onNext={handleNext}
        onRevealHint={handleRevealHint}
        speakModeEnabled={speakModeEnabled}
        onSpeakModeChange={setSpeakModeEnabled}
        speechTranscript={speechTranscript}
        isSpeechListening={isSpeechListening}
        isSpeechActive={isSpeechActive}
        onClearSpeechTranscript={handleClearSpeechTranscript}
        currentPracticeWord={activePracticeItem?.word}
        currentPracticeSentence={activePracticeItem?.sentence}
      />
    </div>
  );
}
