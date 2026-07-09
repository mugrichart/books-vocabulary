"use client";

import SelectionSidebar from "./pdf/SelectionSidebar";
import PDFDocumentSurface from "./pdf/PDFDocumentSurface";
import { usePdfSelections } from "./pdf/usePdfSelections";

interface Props {
  fileUrl: string;
}

export default function PDFViewer({ fileUrl }: Props) {
  const { items, isLoadingText, viewerContainerRef, handleTextSelection, removeItem, highlightQuery } =
    usePdfSelections(fileUrl);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SelectionSidebar
        items={items}
        isLoadingText={isLoadingText}
        onRemoveItem={removeItem}
        highlightQuery={highlightQuery}
      />
      <PDFDocumentSurface
        fileUrl={fileUrl}
        viewerContainerRef={viewerContainerRef}
        onTextSelection={handleTextSelection}
      />
    </div>
  );
}
