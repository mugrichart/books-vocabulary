"use client";

import { useState } from "react";
import LeftSidebar from "./pdf/LeftSidebar";
import PDFDocumentSurface from "./pdf/PDFDocumentSurface";
import { usePdfSelections } from "./pdf/usePdfSelections";
import { FileText, ClipboardList } from "lucide-react";

interface Props {
  fileUrl: string;
  bookId: string;
}

export default function PDFViewer({ fileUrl, bookId }: Props) {
  const [mode, setMode] = useState<'capture' | 'practice'>('capture');
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
    <div className="flex flex-col h-[82vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 shadow-xl">
      {/* Mode Selector Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Reader Workspace
          </span>
        </div>
        
        {/* Mode Switch Segmented Control */}
        <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('capture')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              mode === 'capture'
                ? "bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm font-semibold"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Capture Mode
          </button>
          <button
            type="button"
            onClick={() => setMode('practice')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              mode === 'practice'
                ? "bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm font-semibold"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Practice Mode
          </button>
        </div>

        <div className="w-16" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          mode={mode}
          items={items}
          activeItemId={activePracticeItem?.id ?? null}
          isLoadingText={isLoadingText}
          onRemoveItem={removeItem}
          onResetPractice={resetPractice}
          highlightQuery={highlightQuery}
        />
        <PDFDocumentSurface
          mode={mode}
          fileUrl={fileUrl}
          activePracticeItem={activePracticeItem}
          onCapture={captureSelection}
          onPracticeCorrect={markItemChecked}
        />
      </div>
    </div>
  );
}
