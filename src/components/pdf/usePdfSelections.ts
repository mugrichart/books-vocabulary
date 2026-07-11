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

  // Called when capturing a selection
  const captureSelection = useCallback(async (selectedText: string, highlightAreas: HighlightArea[]) => {
    if (!selectedText || highlightAreas.length === 0) return;

    const pageIndex = highlightAreas[0].pageIndex;
    const pageNumber = pageIndex + 1;

    const sentences = findSentences(pageNumber, selectedText);
    const sentence = sentences.length > 0 ? sentences[0].sentence : selectedText;

    try {
      const response = await fetch(`/api/capture/${bookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: selectedText,
          sentence,
          pageIndex,
          coordinates: highlightAreas,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save capture to server');
      }

      const data = await response.json();
      if (data.success && data.capture) {
        // Prepend new capture and limit local list to last 30
        const updated = [data.capture, ...itemsRef.current];
        if (mode === 'capture') {
          setCaptureItems(updated.slice(0, 30));
        } else {
          setCaptureItems(updated);
        }
      }
    } catch (error) {
      console.error('Error capturing selection:', error);
      throw error;
    }
  }, [bookId, findSentences, mode, setCaptureItems]);

  const removeItem = useCallback(async (id: string) => {
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
    removeItem, 
    markItemChecked,
    resetPractice,
    highlightQuery 
  };
}
