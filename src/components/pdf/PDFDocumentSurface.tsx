import dynamic from 'next/dynamic';
import { type HighlightArea } from '@react-pdf-viewer/highlight';
import { type CaptureItem } from './usePdfSelections';

// Use dynamic imports to prevent global worker conflicts
const CapturePDFViewer = dynamic(() => import('./CapturePDFViewer'), { ssr: false });
const PracticePDFViewer = dynamic(() => import('./PracticePDFViewer'), { ssr: false });

interface Props {
  mode: 'capture' | 'practice';
  fileUrl: string;
  /** All captured items — rendered as placeholder boxes on each page */
  allItems: CaptureItem[];
  activePracticeItem: CaptureItem | null;
  onCapture: (text: string, areas: HighlightArea[]) => Promise<void>;
  onPracticeCorrect: (id: string) => void;
  onAttemptsExhausted?: (data: { options: string[]; explanation: string }) => void;
  onAttemptChange?: (count: number) => void;
  /** Page to open CapturePDFViewer on (changes trigger remount) */
  captureInitialPage: number;
  /** Bumped whenever CapturePDFViewer should remount to jump to captureInitialPage */
  captureViewerKey: number;
}

export default function PDFDocumentSurface({
  mode,
  fileUrl,
  allItems,
  activePracticeItem,
  onCapture,
  onPracticeCorrect,
  onAttemptsExhausted,
  onAttemptChange,
  captureInitialPage,
  captureViewerKey,
}: Props) {
  if (mode === 'practice') {
     return (
       <PracticePDFViewer
         fileUrl={fileUrl}
         allItems={allItems}
         activeItem={activePracticeItem}
         onCorrect={onPracticeCorrect}
         onAttemptsExhausted={onAttemptsExhausted}
         onAttemptChange={onAttemptChange}
       />
     );
  }

  return (
    <CapturePDFViewer
      key={captureViewerKey}
      fileUrl={fileUrl}
      onCapture={onCapture}
      initialPage={captureInitialPage}
    />
  );
}
