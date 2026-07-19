import { useCallback, useEffect, useRef, useState } from 'react';
import type { HighlightArea } from '@react-pdf-viewer/highlight';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

const PRACTICE_BATCH_SIZE = 10;

const getPracticeCursorStorageKey = (bookId: string) => `practice-cursor:${bookId}`;

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
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingText, setIsLoadingText] = useState(true);
  const [practiceCursor, setPracticeCursor] = useState(0);
  const prefetchedBatchRef = useRef<{ start: number; captures: CaptureItem[]; total: number } | null>(null);
  const prefetchInFlightRef = useRef<number | null>(null);
  const itemsRef = useRef<CaptureItem[]>([]);

  const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

  const setCaptureItems = useCallback((captures: CaptureItem[]) => {
    itemsRef.current = captures;
    setItems(captures);
  }, []);

  const persistPracticeCursor = useCallback((cursor: number) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getPracticeCursorStorageKey(bookId), String(Math.max(0, cursor)));
  }, [bookId]);

  const getStoredPracticeCursor = useCallback(() => {
    if (typeof window === 'undefined') return 0;

    const key = getPracticeCursorStorageKey(bookId);
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      window.localStorage.setItem(key, '0');
      return 0;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      window.localStorage.setItem(key, '0');
      return 0;
    }

    return parsed;
  }, [bookId]);

  const mapPracticeBatchWithCursorOffset = useCallback((captures: CaptureItem[], cursorOffset: number) => {
    return captures.map((capture, index) => ({
      ...capture,
      checked: index < cursorOffset,
    }));
  }, []);

  const fetchPracticeBatch = useCallback(async (skip: number) => {
    const url = new URL(`/api/capture/${bookId}`, window.location.origin);
    url.searchParams.set('mode', 'highlight');
    url.searchParams.set('skip', String(skip));
    url.searchParams.set('limit', String(PRACTICE_BATCH_SIZE));

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to fetch practice captures');
    }

    const data = await res.json();
    const captures = Array.isArray(data?.captures) ? (data.captures as CaptureItem[]) : [];
    const total = typeof data?.total === 'number' ? data.total : captures.length;
    return { captures, total };
  }, [bookId]);

  const loadPracticeBatchForCursor = useCallback(async (cursor: number) => {
    const nonNegativeCursor = Math.max(0, cursor);
    const batchStart = Math.floor(nonNegativeCursor / PRACTICE_BATCH_SIZE) * PRACTICE_BATCH_SIZE;

    let fetched: { captures: CaptureItem[]; total: number };
    const prefetched = prefetchedBatchRef.current;
    if (prefetched && prefetched.start === batchStart) {
      fetched = {
        captures: prefetched.captures,
        total: prefetched.total,
      };
      prefetchedBatchRef.current = null;
    } else {
      fetched = await fetchPracticeBatch(batchStart);
    }

    const safeTotal = Math.max(0, fetched.total);
    setTotalCount(safeTotal);

    const boundedCursor = Math.min(nonNegativeCursor, safeTotal);
    if (boundedCursor !== nonNegativeCursor) {
      setPracticeCursor(boundedCursor);
      persistPracticeCursor(boundedCursor);
    }

    const boundedBatchStart = Math.floor(boundedCursor / PRACTICE_BATCH_SIZE) * PRACTICE_BATCH_SIZE;
    const boundedOffset = Math.max(0, boundedCursor - boundedBatchStart);

    if (boundedBatchStart !== batchStart) {
      const corrected = await fetchPracticeBatch(boundedBatchStart);
      setTotalCount(Math.max(0, corrected.total));
      setCaptureItems(mapPracticeBatchWithCursorOffset(corrected.captures, boundedOffset));
      return;
    }

    setCaptureItems(mapPracticeBatchWithCursorOffset(fetched.captures, boundedOffset));
  }, [fetchPracticeBatch, mapPracticeBatchWithCursorOffset, persistPracticeCursor, setCaptureItems]);

  // Load existing captures based on the mode (practice gets unchecked, capture gets last 30)
  const loadCaptures = useCallback(async () => {
    try {
      if (mode === 'practice') {
        const storedCursor = getStoredPracticeCursor();
        setPracticeCursor(storedCursor);
        prefetchedBatchRef.current = null;
        prefetchInFlightRef.current = null;
        await loadPracticeBatchForCursor(storedCursor);
      } else {
        const url = new URL(`/api/capture/${bookId}`, window.location.origin);
        url.searchParams.set('mode', 'highlight');
        url.searchParams.set('sort', 'recent');
        url.searchParams.set('limit', '30'); // Limit left sidebar to last 30 captures

        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setCaptureItems(Array.isArray(data?.captures) ? data.captures : []);
          setTotalCount(typeof data?.total === 'number' ? data.total : (Array.isArray(data?.captures) ? data.captures.length : 0));
        }
      }
    } catch (err) {
      console.error("Failed to load captures:", err);
    }
  }, [bookId, getStoredPracticeCursor, loadPracticeBatchForCursor, mode, setCaptureItems]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        if (typeof data.total === 'number') {
          setTotalCount(data.total);
        }
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
    setTotalCount((prev) => prev + 1);

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
      setTotalCount((prev) => Math.max(0, prev - 1));
      return;
    }

    try {
      const response = await fetch(`/api/capture/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = itemsRef.current.filter(item => item.id !== id);
        setCaptureItems(updated);
        if (typeof data.total === 'number') {
          setTotalCount(data.total);
        } else {
          setTotalCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  }, [bookId, setCaptureItems]);

  const markItemChecked = useCallback(async (id: string) => {
    if (mode === 'practice') {
      const currentCursor = practiceCursor;
      const nextCursor = Math.min(currentCursor + 1, Math.max(0, totalCount));
      const currentBatchStart = Math.floor(currentCursor / PRACTICE_BATCH_SIZE) * PRACTICE_BATCH_SIZE;
      const nextBatchStart = Math.floor(nextCursor / PRACTICE_BATCH_SIZE) * PRACTICE_BATCH_SIZE;

      setPracticeCursor(nextCursor);
      persistPracticeCursor(nextCursor);

      if (nextBatchStart === currentBatchStart) {
        const nextOffset = nextCursor - nextBatchStart;
        setCaptureItems(mapPracticeBatchWithCursorOffset(itemsRef.current, nextOffset));
      } else {
        const prefetched = prefetchedBatchRef.current;
        if (prefetched && prefetched.start === nextBatchStart) {
          const nextOffset = nextCursor - nextBatchStart;
          setCaptureItems(mapPracticeBatchWithCursorOffset(prefetched.captures, nextOffset));
          prefetchedBatchRef.current = null;
        } else {
          loadPracticeBatchForCursor(nextCursor);
        }
      }
      return;
    }

    try {
      const response = await fetch(`/api/capture/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', id, checked: true }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = itemsRef.current.map((item) =>
          item.id === id ? { ...item, checked: true } : item
        );
        setCaptureItems(updated);
        if (typeof data.total === 'number') {
          setTotalCount(data.total);
        }
      }
    } catch (err) {
      console.error('Failed to mark item checked:', err);
    }
  }, [bookId, loadPracticeBatchForCursor, mapPracticeBatchWithCursorOffset, mode, persistPracticeCursor, practiceCursor, setCaptureItems, totalCount]);

  const jumpToPracticeCursor = useCallback(async (nextCursor: number) => {
    const cursor = Math.max(0, nextCursor);
    setPracticeCursor(cursor);
    persistPracticeCursor(cursor);
    await loadPracticeBatchForCursor(cursor);
  }, [loadPracticeBatchForCursor, persistPracticeCursor]);

  const resetPractice = useCallback(async () => {
    if (mode === 'practice') {
      prefetchedBatchRef.current = null;
      prefetchInFlightRef.current = null;
      await jumpToPracticeCursor(0);
      return;
    }

    try {
      const response = await fetch(`/api/capture/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = itemsRef.current.map((item) => ({ ...item, checked: false }));
        setCaptureItems(updated);
        if (typeof data.total === 'number') {
          setTotalCount(data.total);
        }
      }
    } catch (err) {
      console.error('Failed to reset practice:', err);
    }
  }, [bookId, jumpToPracticeCursor, mode, setCaptureItems]);

  useEffect(() => {
    if (mode !== 'practice') return;
    if (totalCount <= 0) return;

    const currentBatchStart = Math.floor(practiceCursor / PRACTICE_BATCH_SIZE) * PRACTICE_BATCH_SIZE;
    const offset = practiceCursor - currentBatchStart;

    if (offset !== PRACTICE_BATCH_SIZE - 1) return;

    const nextBatchStart = currentBatchStart + PRACTICE_BATCH_SIZE;
    if (nextBatchStart >= totalCount) return;

    const existingPrefetch = prefetchedBatchRef.current;
    if (existingPrefetch && existingPrefetch.start === nextBatchStart) return;
    if (prefetchInFlightRef.current === nextBatchStart) return;

    prefetchInFlightRef.current = nextBatchStart;
    fetchPracticeBatch(nextBatchStart)
      .then(({ captures, total }) => {
        setTotalCount(Math.max(0, total));
        prefetchedBatchRef.current = { start: nextBatchStart, captures, total };
      })
      .catch((error) => {
        console.error('Failed to prefetch practice batch:', error);
      })
      .finally(() => {
        if (prefetchInFlightRef.current === nextBatchStart) {
          prefetchInFlightRef.current = null;
        }
      });
  }, [fetchPracticeBatch, mode, practiceCursor, totalCount]);

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
    totalCount,
    practiceCursor,
    practiceBatchSize: PRACTICE_BATCH_SIZE,
    isLoadingText, 
    captureSelection, 
    retryCapture,
    removeItem, 
    markItemChecked,
    jumpToPracticeCursor,
    resetPractice,
    fetchLastCapturePage,
    highlightQuery 
  };
}
