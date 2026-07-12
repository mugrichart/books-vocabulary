"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import LeftSidebar from './pdf/LeftSidebar';
import RightSidebar from './pdf/RightSidebar';
import PDFDocumentSurface from './pdf/PDFDocumentSurface';
import { usePdfSelections } from './pdf/usePdfSelections';

interface Props {
  fileUrl: string;
  bookId: string;
}

interface PracticeData {
  correct: string;
  options: string[];
  explanation: string;
}

export default function PDFViewer({ fileUrl, bookId }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'practice' | 'capture'>('capture');
  const {
    items,
    totalCount,
    isLoadingText,
    captureSelection,
    retryCapture,
    removeItem,
    markItemChecked,
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
  // Track attempt count for display in the sidebar
  const [attempts, setAttempts] = useState(0);

  // Called from PracticePDFViewer → PDFDocumentSurface when 3 attempts are used
  const handleAttemptsExhausted = useCallback((data: { options: string[]; explanation: string }) => {
    if (!activePracticeItem) return;
    setPracticeData({
      correct: activePracticeItem.word,
      options: data.options,
      explanation: data.explanation,
    });
  }, [activePracticeItem]);

  // Called from PracticePDFViewer each time the attempt count changes
  const handleAttemptChange = useCallback((count: number) => {
    setAttempts(count);
  }, []);

  // Called from RightSidebar when user picks an option
  const handleOptionSelect = useCallback((_selected: string) => {
    // Don't auto-advance — let the user read the explanation and click Next.
    // The Next button handles marking checked + advancing.
  }, []);

  // Called from RightSidebar "Next" button
  const handleNext = useCallback(() => {
    // Mark current word as checked (regardless of correct/wrong) so we advance
    if (activePracticeItem) {
      markItemChecked(activePracticeItem.id);
    }
    // Clear practice data for the next word
    setPracticeData(undefined);
    setAttempts(0);
  }, [activePracticeItem, markItemChecked]);

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
          setAttempts(0);
        }}
        highlightQuery={highlightQuery}
        title={bookId}
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
          onPracticeCorrect={markItemChecked}
          onAttemptsExhausted={handleAttemptsExhausted}
          onAttemptChange={handleAttemptChange}
          captureInitialPage={captureInitialPage}
          captureViewerKey={captureViewerKey}
        />
      </div>

      {/* Right Sidebar */}
      <RightSidebar
        mode={mode}
        setMode={setMode}
        practiceData={practiceData}
        attempts={attempts}
        onOptionSelect={handleOptionSelect}
        onNext={handleNext}
      />
    </div>
  );
}
