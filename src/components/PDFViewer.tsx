"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SelectionSidebar from "./pdf/SelectionSidebar";
import LeftSidebar from "./pdf/LeftSidebar";
import RightSidebar from "./pdf/RightSidebar";

import PDFDocumentSurface from "./pdf/PDFDocumentSurface";
import { usePdfSelections } from "./pdf/usePdfSelections";


interface Props {
  fileUrl: string;
  bookId: string;
}

export default function PDFViewer({ fileUrl, bookId }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"practice" | "highlight">("highlight");
  const { 
    items, 
    isLoadingText, 
    captureSelection, 
    removeItem, 
    markItemChecked,
    resetPractice,
    highlightQuery 
  } = usePdfSelections(fileUrl, bookId);

  const activePracticeItem = items.find((item) => !item.checked) ?? null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar */}
      <LeftSidebar
        mode={mode}
        items={items}
        activeItemId={activePracticeItem?.id ?? null}
        isLoadingText={isLoadingText}
        onRemoveItem={removeItem}
        onResetPractice={resetPractice}
        highlightQuery={highlightQuery}
        title={bookId}
        onBack={() => router.back()}
      />

      {/* Main PDF Area */}
      <div className="flex-1 overflow-hidden">
        <PDFDocumentSurface
          mode={mode}
          fileUrl={fileUrl}
          activePracticeItem={activePracticeItem}
          onCapture={captureSelection}
          onPracticeCorrect={markItemChecked}
        />
      </div>

      {/* Right Sidebar with mode toggle */}
      <RightSidebar mode={mode} setMode={setMode} />
    </div>
  );
}
