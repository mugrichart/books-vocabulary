import { useCallback, useEffect, useRef, useState } from 'react';
import type { HighlightArea } from '@react-pdf-viewer/highlight';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Updated interface to include coordinates and practice status
export interface CaptureItem {
  id: string;
  pageIndex: number; // 0-indexed from the plugin
  word: string;
  sentence: string;
  coordinates: HighlightArea[];
  checked: boolean; // Practice mode status
}

export function usePdfSelections(fileUrl: string, bookId: string) {
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [isLoadingText, setIsLoadingText] = useState(true);
  const itemsRef = useRef<CaptureItem[]>([]);

  const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

  const saveCaptures = useCallback(async (captures: CaptureItem[]) => {
    const response = await fetch(`/api/capture/${bookId}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captures }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save captures for ${bookId}`);
    }
  }, [bookId]);

  const setCaptureItems = useCallback((captures: CaptureItem[]) => {
    itemsRef.current = captures;
    setItems(captures);
  }, []);

  // Load existing captures on mount
  useEffect(() => {
    async function loadExistingCaptures() {
      try {
        const res = await fetch(`/api/capture/${bookId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setCaptureItems(Array.isArray(data?.captures) ? data.captures : []);
        }
      } catch (err) {
        console.error("No existing captures found or failed to load.", err);
      }
    }
    loadExistingCaptures();
  }, [bookId, setCaptureItems]);

  // Background text extractor (Kept intact to find the sentence context)
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

  // Keep your sentence finder logic
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

  // NEW: Called by the highlight plugin
  const captureSelection = useCallback(async (selectedText: string, highlightAreas: HighlightArea[]) => {
    if (!selectedText || highlightAreas.length === 0) return;

    const pageIndex = highlightAreas[0].pageIndex;
    const pageNumber = pageIndex + 1; // PDF.js text extraction is 1-indexed

    const sentences = findSentences(pageNumber, selectedText);
    const sentence = sentences.length > 0 ? sentences[0].sentence : selectedText;

    const newItem: CaptureItem = {
      id: crypto.randomUUID(), // Generate unique ID
      pageIndex,
      word: selectedText,
      sentence,
      coordinates: highlightAreas,
      checked: false,
    };

    const updatedItems = [...itemsRef.current, newItem];
    setCaptureItems(updatedItems);

    try {
      await saveCaptures(updatedItems);
    } catch (error) {
      setCaptureItems(itemsRef.current.filter((item) => item.id !== newItem.id));
      throw error;
    }
  }, [findSentences, saveCaptures, setCaptureItems]);

  const removeItem = useCallback(async (id: string) => {
      const updated = itemsRef.current.filter(item => item.id !== id);

      setCaptureItems(updated);

      await saveCaptures(updated);
  }, [saveCaptures, setCaptureItems]);

  const markItemChecked = useCallback(async (id: string) => {
    const updated = itemsRef.current.map((item) =>
      item.id === id ? { ...item, checked: true } : item
    );

    setCaptureItems(updated);
    await saveCaptures(updated);
  }, [saveCaptures, setCaptureItems]);

  const resetPractice = useCallback(async () => {
    const updated = itemsRef.current.map((item) => ({ ...item, checked: false }));

    setCaptureItems(updated);
    await saveCaptures(updated);
  }, [saveCaptures, setCaptureItems]);

  const highlightQuery = (sentence: string, query: string) => {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = sentence.split(regex);
    return parts;
  };

  // Ensure these are returned so the components can access them!
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
