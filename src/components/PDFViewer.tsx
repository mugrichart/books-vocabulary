"use client";

import React, { useState, useCallback } from 'react';
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
    isLoadingText,
    captureSelection,
    removeItem,
    markItemChecked,
    resetPractice,
    highlightQuery,
  } = usePdfSelections(fileUrl, bookId, mode);

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
        onResetPractice={() => {
          resetPractice();
          setPracticeData(undefined);
          setAttempts(0);
        }}
        highlightQuery={highlightQuery}
        title={bookId}
        onBack={() => router.back()}
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
