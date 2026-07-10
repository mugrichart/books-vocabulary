import dynamic from 'next/dynamic';
import { type HighlightArea } from '@react-pdf-viewer/highlight';
import { type CaptureItem } from './usePdfSelections';

// Use dynamic imports to prevent global worker conflicts
const CapturePDFViewer = dynamic(() => import('./CapturePDFViewer'), { ssr: false });
const PracticePDFViewer = dynamic(() => import('./PracticePDFViewer'), { ssr: false });

interface Props {
  mode: 'capture' | 'practice';
  fileUrl: string;
  activePracticeItem: CaptureItem | null;
  onCapture: (text: string, areas: HighlightArea[]) => Promise<void>;
  onPracticeCorrect: (id: string) => void;
}

export default function PDFDocumentSurface({
  mode,
  fileUrl,
  activePracticeItem,
  onCapture,
  onPracticeCorrect,
}: Props) {
  if (mode === 'practice') {
     return (
       <PracticePDFViewer
         fileUrl={fileUrl}
         activeItem={activePracticeItem}
         onCorrect={onPracticeCorrect}
       />
     );
  }

  return (
    <CapturePDFViewer
      fileUrl={fileUrl}
      onCapture={onCapture}
    />
  );
}
