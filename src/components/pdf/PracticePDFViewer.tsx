"use client";
"use no memo";

import { useEffect, useRef } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';

import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { highlightPlugin } from '@react-pdf-viewer/highlight';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Required Styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

import { CaptureItem } from './usePdfSelections';

interface Props {
    fileUrl: string;
    activeItem: CaptureItem | null;
    onCorrect: (id: string) => void;
}

export default function PracticePDFViewer({
    fileUrl,
    activeItem,
    onCorrect,
}: Props) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();


  const normalizeAnswer = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

  const handleAnswerChange = (value: string) => {
    if (activeItem && normalizeAnswer(value) === normalizeAnswer(activeItem.word)) {
      onCorrect(activeItem.id);
    }
  };

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: () => <span className="hidden" />,
    renderHighlights: (renderProps) => {
      if (!activeItem) return <span className="hidden" />;

      const currentAreas = activeItem.coordinates.filter(
        (area) => area.pageIndex === renderProps.pageIndex
      );

      return (
        <>
          {currentAreas.map((area, index) => (
            <input
              key={`${activeItem.id}-${index}`}
              autoFocus={index === 0}
              aria-label={`Type the hidden word from page ${area.pageIndex + 1}`}
              defaultValue=""
              onChange={(event) => handleAnswerChange(event.target.value)}
              className="absolute z-10 rounded-[2px] border border-violet-500 bg-white px-px font-semibold text-zinc-950 shadow-sm outline-none ring-1 ring-violet-500/20 focus:ring-violet-500/40 dark:bg-zinc-950 dark:text-zinc-100"
              style={{
                boxSizing: 'border-box',
                fontSize: `${Math.max(8, Math.min(16, area.height * 6))}px`,
                height: `${area.height}%`,
                left: `${area.left}%`,
                lineHeight: 1,
                top: `${area.top}%`,
                width: `${area.width}%`,
              }}
            />
          ))}
        </>
      );
    },
  });

  // Only jump to the highlight when moving to a different page
  const prevPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (activeItem) {
      const firstArea = activeItem.coordinates[0];
      if (firstArea && firstArea.pageIndex !== prevPageRef.current) {
        highlightPluginInstance.jumpToHighlightArea(firstArea);
        prevPageRef.current = firstArea.pageIndex;
      }
    }
  }, [activeItem, highlightPluginInstance]);

  return (
    <Worker workerUrl={pdfjsWorker}>
      <Viewer
        fileUrl={fileUrl}
          defaultScale={1.5}
        plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
        // initialPage is kept as fallback
        initialPage={activeItem?.pageIndex ?? 0}
      />
    </Worker>
  );
}
