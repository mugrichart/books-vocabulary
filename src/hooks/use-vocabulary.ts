"use client";

import { useEffect, useState, useCallback } from "react";

export interface Book {
  id: string;
  title: string;
  author: string;
  coverColor: string; // Tailwind gradient class
  progress: number; // 0 - 100
  totalPages: number;
  currentPage: number;
  wordCount: number;
  pdfUrl?: string;
  coverUrl?: string;
}

export interface VocabularyWord {
  id: string;
  word: string;
  definition: string;
  translation: string;
  contextSentence: string;
  bookId: string; // associated book
  masteryLevel: "learning" | "reviewing" | "mastered"; // progress tracking
  createdAt: string;
}

export function useVocabulary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all books and words on mount
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [booksRes, wordsRes] = await Promise.all([
        fetch("/api/books"),
        fetch("/api/words"),
      ]);

      if (booksRes.ok && wordsRes.ok) {
        const booksData = await booksRes.json();
        const wordsData = await wordsRes.json();
        setBooks(booksData.books || []);
        setWords(wordsData.words || []);
      }
    } catch (err) {
      console.error("Failed to load vocabulary data from API:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addBook = async (
    title: string,
    author: string,
    totalPages: number,
    pdfUrl?: string,
    coverUrl?: string
  ) => {
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, totalPages, pdfUrl, coverUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.book) {
          setBooks((prev) => [data.book, ...prev]);
        }
      }
    } catch (err) {
      console.error("Failed to add book:", err);
    }
  };

  const updateBookProgress = async (bookId: string, currentPage: number) => {
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPage }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBooks((prev) =>
            prev.map((b) =>
              b.id === bookId
                ? { ...b, currentPage: data.currentPage, progress: data.progress }
                : b
            )
          );
        }
      }
    } catch (err) {
      console.error("Failed to update book progress:", err);
    }
  };

  const deleteBook = async (bookId: string) => {
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
        setWords((prev) => prev.filter((w) => w.bookId !== bookId));
      }
    } catch (err) {
      console.error("Failed to delete book:", err);
    }
  };

  const addWord = async (
    word: string,
    definition: string,
    translation: string,
    contextSentence: string,
    bookId: string
  ) => {
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, definition, translation, contextSentence, bookId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.word) {
          setWords((prev) => [data.word, ...prev]);
          // Increment word count locally
          setBooks((prev) =>
            prev.map((b) => (b.id === bookId ? { ...b, wordCount: b.wordCount + 1 } : b))
          );
        }
      }
    } catch (err) {
      console.error("Failed to add word:", err);
    }
  };

  const updateWordMastery = async (
    wordId: string,
    level: "learning" | "reviewing" | "mastered"
  ) => {
    try {
      const res = await fetch(`/api/words/${wordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masteryLevel: level }),
      });

      if (res.ok) {
        setWords((prev) =>
          prev.map((w) => (w.id === wordId ? { ...w, masteryLevel: level } : w))
        );
      }
    } catch (err) {
      console.error("Failed to update word mastery:", err);
    }
  };

  const deleteWord = async (wordId: string) => {
    try {
      const wordToDelete = words.find((w) => w.id === wordId);
      if (!wordToDelete) return;

      const res = await fetch(`/api/words/${wordId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setWords((prev) => prev.filter((w) => w.id !== wordId));
        // Decrement book's word count locally
        setBooks((prev) =>
          prev.map((b) =>
            b.id === wordToDelete.bookId
              ? { ...b, wordCount: Math.max(0, b.wordCount - 1) }
              : b
          )
        );
      }
    } catch (err) {
      console.error("Failed to delete word:", err);
    }
  };

  return {
    books,
    words,
    isLoading,
    addBook,
    updateBookProgress,
    deleteBook,
    addWord,
    updateWordMastery,
    deleteWord,
  };
}
