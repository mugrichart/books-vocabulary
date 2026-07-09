"use client";

import { useEffect, useRef, useState } from "react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

interface SelectionItem {
  id: string;
  page: number;
  query: string;
  sentence: string;
}

interface Props {
  fileUrl: string;
}

export default function PDFViewer({ fileUrl }: Props) {
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [items, setItems] = useState<SelectionItem[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(true);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();

  useEffect(() => {
    let cancelled = false;

    async function loadPdfText() {
      setIsLoadingText(true);
      setPageTexts({});

      try {
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const texts: Record<number, string> = {};

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => (typeof item.str === "string" ? item.str : ""))
            .join(" ");

          texts[pageNumber] = normalizeText(pageText);
        }

        if (!cancelled) {
          setPageTexts(texts);
        }
      } catch (error) {
        console.error("Failed to load PDF text:", error);
      } finally {
        if (!cancelled) {
          setIsLoadingText(false);
        }
      }
    }

    loadPdfText();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  const getPageNumberFromSelection = (): number | null => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const selectionRect = range.getBoundingClientRect();
    const container = viewerContainerRef.current;
    if (!container) return null;

    const pages = Array.from(container.querySelectorAll<HTMLElement>(".rpv-core__inner-page"));
    const pageMatch = pages.find((page) => {
      const pageRect = page.getBoundingClientRect();
      const intersects =
        selectionRect.top <= pageRect.bottom &&
        selectionRect.bottom >= pageRect.top &&
        selectionRect.left <= pageRect.right &&
        selectionRect.right >= pageRect.left;
      return intersects;
    });

    if (!pageMatch) {
      // fallback: find ancestor page wrapper by class name
      let node = selection.anchorNode;
      while (node && node !== container) {
        if (node instanceof HTMLElement && node.classList.contains("rpv-core__inner-page")) {
          const ariaLabel = node.getAttribute("aria-label");
          if (ariaLabel) {
            const match = ariaLabel.match(/Page\s+(\d+)/i);
            if (match) return parseInt(match[1], 10);
          }
        }
        node = node.parentNode;
      }

      return null;
    }

    const pageLabel = pageMatch.getAttribute("aria-label");
    if (!pageLabel) return null;
    const labelMatch = pageLabel.match(/Page\s+(\d+)/i);
    return labelMatch ? parseInt(labelMatch[1], 10) : null;
  };

  const findSentences = (pageNumber: number, query: string) => {
    const pageText = pageTexts[pageNumber];
    if (!pageText) return [];

    const normalizedQuery = normalizeText(query).toLowerCase();
    if (!normalizedQuery) return [];

    const sentenceCandidates = pageText
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘'\u2018\u201C])/g)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    return sentenceCandidates
      .map((sentence, index) => ({ sentence, index }))
      .filter(({ sentence }) => sentence.toLowerCase().includes(normalizedQuery));
  };

  const highlightQuery = (sentence: string, query: string) => {
    const escapedQuery = query.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    const parts = sentence.split(regex);

    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <mark key={index} className="rounded bg-yellow-200 px-0.5">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = normalizeText(selection.toString());
    if (!selectedText) return;

    const pageNumber = getPageNumberFromSelection();
    if (!pageNumber) return;

    const sentences = findSentences(pageNumber, selectedText);
    if (sentences.length === 0) return;

    const newItems = sentences
      .map(({ sentence, index }) => ({
        id: `${pageNumber}-${index}-${selectedText}`,
        page: pageNumber,
        query: selectedText,
        sentence,
      }))
      .filter((item) => !items.some((existing) => existing.id === item.id));

    if (newItems.length === 0) return;

    setItems((current) => [...current, ...newItems]);
    selection.removeAllRanges();
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="w-[340px] min-w-[280px] border-r border-slate-200 bg-white p-4 overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Selected words & expressions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a word or phrase in the PDF to capture its sentence and keep it in the sidebar.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {items.length}
          </span>
        </div>

        {isLoadingText ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            Loading PDF text for sentence extraction...
          </div>
        ) : null}

        {items.length === 0 && !isLoadingText ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            No selection yet. Highlight a word or phrase inside the PDF viewer to add it here.
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Page {item.page}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.query}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  aria-label={`Remove selection ${item.query}`}
                >
                  ×
                </button>
              </div>
              <p className="text-sm leading-6 text-slate-700">{highlightQuery(item.sentence, item.query)}</p>
            </div>
          ))}
        </div>
      </aside>

      <div className="relative flex-1 overflow-hidden" ref={viewerContainerRef} onMouseUp={handleTextSelection}>
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <Viewer fileUrl={fileUrl} plugins={[defaultLayoutPluginInstance]} />
        </Worker>
      </div>
    </div>
  );
}
