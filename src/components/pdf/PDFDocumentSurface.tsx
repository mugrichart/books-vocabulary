import { type RefObject } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface Props {
  fileUrl: string;
  viewerContainerRef: RefObject<HTMLDivElement | null>;
  onTextSelection: () => void;
}

export default function PDFDocumentSurface({ fileUrl, viewerContainerRef, onTextSelection }: Props) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  return (
    <div className="relative flex-1 overflow-hidden" ref={viewerContainerRef} onMouseUp={onTextSelection}>
      <Worker workerUrl={pdfjsWorker}>
        <Viewer fileUrl={fileUrl} plugins={[defaultLayoutPluginInstance]} />
      </Worker>
    </div>
  );
}
