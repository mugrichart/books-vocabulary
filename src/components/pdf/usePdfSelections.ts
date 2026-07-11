import { useCallback, useEffect, useRef, useState } from 'react';
import type { HighlightArea } from '@react-pdf-viewer/highlight';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

export interface CaptureItem {
  id: string;
  pageIndex: number;
  word: string;
  sentence: string;
  coordinates: HighlightArea[];
  checked: boolean;
  options: string[];
  explanation: string;
  status?: 'loading' | 'error' | 'success';
}

export function usePdfSelections(fileUrl: string, bookId: string, mode: 'capture' | 'practice') {
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(true);
  const itemsRef = useRef<CaptureItem[]>([]);

  const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

  const setCaptureItems = useCallback((captures: CaptureItem[]) => {
    itemsRef.current = captures;
    setItems(captures);
  }, []);

  // Load existing captures based on the mode (practice gets unchecked, capture gets last 30)
  const loadCaptures = useCallback(async () => {
    try {
      const url = new URL(`/api/capture/${bookId}`, window.location.origin);
      if (mode === 'practice') {
        url.searchParams.set('mode', 'practice');
        url.searchParams.set('limit', '20'); // Avoid fetching hundreds
      } else {
        url.searchParams.set('mode', 'highlight');
        url.searchParams.set('sort', 'recent');
        url.searchParams.set('limit', '30'); // Limit left sidebar to last 30 captures
      }

      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCaptureItems(Array.isArray(data?.captures) ? data.captures : []);
      }
    } catch (err) {
      console.error("Failed to load captures:", err);
    }
  }, [bookId, mode, setCaptureItems]);

  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  // Background text extractor
  useEffect(() => {
    let cancelled = false;
    async function loadPdfText() {
      setIsLoadingText(true);
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
            .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
            .join(' ');

          texts[pageNumber] = normalizeText(pageText);
        }

        if (!cancelled) setPageTexts(texts);
      } catch (error) {
        console.error('Failed to load PDF text:', error);
      } finally {
        if (!cancelled) setIsLoadingText(false);
      }
    }
    loadPdfText();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Keep sentence finder logic
  const findSentences = useCallback((pageNumber: number, query: string) => {
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
  }, [pageTexts]);

  // Helper function to perform the POST request asynchronously
  const saveCaptureItem = useCallback(async (
    tempId: string,
    word: string,
    sentence: string,
    pageIndex: number,
    coordinates: HighlightArea[]
  ) => {
    try {
      const response = await fetch(`/api/capture/${bookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          sentence,
          pageIndex,
          coordinates,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save capture to server');
      }

      const data = await response.json();
      if (data.success && data.capture) {
        // Find and replace the temporary item with the returned success item
        const updated = itemsRef.current.map((item) =>
          item.id === tempId ? { ...data.capture, status: 'success' as const } : item
        );
        setCaptureItems(mode === 'capture' ? updated.slice(0, 30) : updated);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (error) {
      console.error('Failed saving capture asynchronously:', error);
      // Mark item status as error
      const updated = itemsRef.current.map((item) =>
        item.id === tempId ? { ...item, status: 'error' as const } : item
      );
      setCaptureItems(updated);
    }
  }, [bookId, mode, setCaptureItems]);

  // Called when capturing a selection (runs asynchronously/non-blocking)
  const captureSelection = useCallback(async (selectedText: string, highlightAreas: HighlightArea[]) => {
    if (!selectedText || highlightAreas.length === 0) return;

    const pageIndex = highlightAreas[0].pageIndex;
    const pageNumber = pageIndex + 1;

    const sentences = findSentences(pageNumber, selectedText);
    const sentence = sentences.length > 0 ? sentences[0].sentence : selectedText;

    const tempId = crypto.randomUUID();

    // Create a local loading placeholder
    const placeholderItem: CaptureItem = {
      id: tempId,
      pageIndex,
      word: selectedText,
      sentence,
      coordinates: highlightAreas,
      checked: false,
      options: [],
      explanation: '',
      status: 'loading',
    };

    // Prepend placeholder immediately to state so it appears at the top
    const updated = [placeholderItem, ...itemsRef.current];
    setCaptureItems(mode === 'capture' ? updated.slice(0, 30) : updated);

    // Trigger POST saving request asynchronously (without awaiting it)
    saveCaptureItem(tempId, selectedText, sentence, pageIndex, highlightAreas);
  }, [findSentences, mode, setCaptureItems, saveCaptureItem]);

  // Retry saving a failed item
  const retryCapture = useCallback(async (id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;

    // Set item status back to loading
    const updated = itemsRef.current.map((i) =>
      i.id === id ? { ...i, status: 'loading' as const } : i
    );
    setCaptureItems(updated);

    // Trigger save again
    saveCaptureItem(id, item.word, item.sentence, item.pageIndex, item.coordinates);
  }, [setCaptureItems, saveCaptureItem]);

  const removeItem = useCallback(async (id: string) => {
    // If it's a loading/failed item that hasn't been saved to DB yet, just remove it locally
    const item = itemsRef.current.find(i => i.id === id);
    if (item && (item.status === 'loading' || item.status === 'error')) {
      const updated = itemsRef.current.filter(i => i.id !== id);
      setCaptureItems(updated);
      return;
    }

    try {
      const response = await fetch(`/api/capture/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });

      if (response.ok) {
        const updated = itemsRef.current.filter(item => item.id !== id);
        setCaptureItems(updated);
      }
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  }, [bookId, setCaptureItems]);

  const markItemChecked = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/capture/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', id, checked: true }),
      });

      if (response.ok) {
        const updated = itemsRef.current.map((item) =>
          item.id === id ? { ...item, checked: true } : item
        );
        setCaptureItems(updated);
      }
    } catch (err) {
      console.error('Failed to mark item checked:', err);
    }
  }, [bookId, setCaptureItems]);

  const resetPractice = useCallback(async () => {
    try {
      const response = await fetch(`/api/capture/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (response.ok) {
        const updated = itemsRef.current.map((item) => ({ ...item, checked: false }));
        setCaptureItems(updated);
      }
    } catch (err) {
      console.error('Failed to reset practice:', err);
    }
  }, [bookId, setCaptureItems]);

  /**
   * Fetches only the single most recently created capture and returns its pageIndex.
   * Used by PDFViewer to determine where to scroll on load/mode-switch.
   * Always reads fresh data from the server — never stale.
   */
  const fetchLastCapturePage = useCallback(async (): Promise<number | null> => {
    try {
      const url = new URL(`/api/capture/${bookId}`, window.location.origin);
      url.searchParams.set('mode', 'highlight');
      url.searchParams.set('sort', 'recent');
      url.searchParams.set('limit', '1');
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const captures = data?.captures;
        if (Array.isArray(captures) && captures.length > 0) {
          return captures[0].pageIndex as number;
        }
      }
    } catch (err) {
      console.error('Failed to fetch last capture page:', err);
    }
    return null;
  }, [bookId]);

  const highlightQuery = (sentence: string, query: string) => {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = sentence.split(regex);
    return parts;
  };

  return { 
    items, 
    isLoadingText, 
    captureSelection, 
    retryCapture,
    removeItem, 
    markItemChecked,
    resetPractice,
    fetchLastCapturePage,
    highlightQuery 
  };
}
