import { useEffect, useRef, useState } from 'react';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

export interface SelectionItem {
  id: string;
  page: number;
  query: string;
  sentence: string;
}

export function usePdfSelections(fileUrl: string) {
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [items, setItems] = useState<SelectionItem[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(true);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

  useEffect(() => {
    let cancelled = false;

    async function loadPdfText() {
      setIsLoadingText(true);
      setPageTexts({});

      try {
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const texts: Record<number, string> = {};

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
            .join(' ');

          texts[pageNumber] = normalizeText(pageText);
        }

        if (!cancelled) {
          setPageTexts(texts);
        }
      } catch (error) {
        console.error('Failed to load PDF text:', error);
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

  const getPageNumberFromSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const selectionRect = range.getBoundingClientRect();
    const container = viewerContainerRef.current;
    if (!container) return null;

    const pages = Array.from(container.querySelectorAll<HTMLElement>('.rpv-core__inner-page'));
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
      let node = selection.anchorNode;
      while (node && node !== container) {
        if (node instanceof HTMLElement && node.classList.contains('rpv-core__inner-page')) {
          const ariaLabel = node.getAttribute('aria-label');
          if (ariaLabel) {
            const match = ariaLabel.match(/Page\s+(\d+)/i);
            if (match) return parseInt(match[1], 10);
          }
        }
        node = node.parentNode;
      }

      return null;
    }

    const pageLabel = pageMatch.getAttribute('aria-label');
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

  const highlightQuery = (sentence: string, query: string) => {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = sentence.split(regex);

    return parts;
  };

  return {
    items,
    isLoadingText,
    viewerContainerRef,
    handleTextSelection,
    removeItem,
    highlightQuery,
  };
}
