"use client";
"use no memo";

import { memo } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { highlightPlugin } from '@react-pdf-viewer/highlight';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

import type { HighlightArea } from '@react-pdf-viewer/highlight';

interface Props {
  fileUrl: string;
  onCapture: (selectedText: string, areas: HighlightArea[]) => Promise<void>;
}

function CapturePDFViewer({ fileUrl, onCapture }: Props) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: (renderProps) => {
      if (
        !renderProps.selectedText ||
        !renderProps.selectionRegion ||
        !Array.isArray(renderProps.highlightAreas) ||
        renderProps.highlightAreas.length === 0
      ) {
        return <span className="hidden" />;
      }

      return (
        <div 
          className="absolute z-50 bg-slate-800 text-white px-3 py-1.5 rounded-md shadow-xl flex gap-2 text-sm font-medium"
          style={{
            left: `${renderProps.selectionRegion.left}%`,
            top: `${renderProps.selectionRegion.top + renderProps.selectionRegion.height}%`,
            transform: 'translate(0, 8px)',
          }}
        >
          <button 
            onClick={async () => {
              await onCapture(renderProps.selectedText, renderProps.highlightAreas);
              renderProps.toggle();
            }}
            className="hover:text-violet-400 transition-colors"
          >
            Capture <span className="font-semibold">{renderProps.selectedText}</span>
          </button>
        </div>
      );
    },
  });

  return (
    <div className="relative flex-1 overflow-hidden h-screen">
      <Worker workerUrl={pdfjsWorker}>
        <Viewer 
          fileUrl={fileUrl} 
          defaultScale={1.5}
          plugins={[defaultLayoutPluginInstance, highlightPluginInstance]} 
        />
      </Worker>
    </div>
  );
}

export default memo(CapturePDFViewer);
