"use client";

import { useEffect, useState } from "react";

export interface Book {
  id: string;
  title: string;
  author: string;
  coverColor: string; // Tailwind gradient class
  progress: number; // 0 - 100
  totalPages: number;
  currentPage: number;
  wordCount: number;
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

const DEFAULT_BOOKS: Book[] = [
  {
    id: "book-1",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    coverColor: "from-emerald-600 to-teal-800",
    progress: 75,
    totalPages: 310,
    currentPage: 232,
    wordCount: 8,
  },
  {
    id: "book-2",
    title: "1984",
    author: "George Orwell",
    coverColor: "from-rose-700 to-red-900",
    progress: 40,
    totalPages: 328,
    currentPage: 131,
    wordCount: 6,
  },
  {
    id: "book-3",
    title: "Atomic Habits",
    author: "James Clear",
    coverColor: "from-blue-600 to-indigo-800",
    progress: 95,
    totalPages: 270,
    currentPage: 256,
    wordCount: 5,
  },
];

const DEFAULT_WORDS: VocabularyWord[] = [
  {
    id: "word-1",
    word: "Quintessential",
    definition: "Representing the most perfect or typical example of a quality or class.",
    translation: "Typowy / kwintesencjonalny",
    contextSentence: "Bilbo Baggins was the quintessential Hobbit, loving comfort and peace above all else.",
    bookId: "book-1",
    masteryLevel: "mastered",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "word-2",
    word: "Obfuscate",
    definition: "To render obscure, unclear, or unintelligible.",
    translation: "Zaciemniać / gmatwać",
    contextSentence: "The government tried to obfuscate the truth using propaganda and Newspeak.",
    bookId: "book-2",
    masteryLevel: "learning",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "word-3",
    word: "Incremental",
    definition: "Relating to or denoting an increase or addition, especially one of a series on a fixed scale.",
    translation: "Przyrostowy",
    contextSentence: "Atomic habits focus on making incremental changes that compile into massive results.",
    bookId: "book-3",
    masteryLevel: "reviewing",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "word-4",
    word: "Meticulous",
    definition: "Showing great attention to detail; very careful and precise.",
    translation: "Drobiazgowy / skrupulatny",
    contextSentence: "The Elves kept meticulous records of their history and the songs of old.",
    bookId: "book-1",
    masteryLevel: "reviewing",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "word-5",
    word: "Surveillance",
    definition: "Close observation, especially of a suspected spy or criminal.",
    translation: "Inwigilacja / nadzór",
    contextSentence: "Big Brother maintained constant surveillance over every citizen of Oceania.",
    bookId: "book-2",
    masteryLevel: "learning",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function useVocabulary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedBooks = localStorage.getItem("lexiflow_books");
      const storedWords = localStorage.getItem("lexiflow_words");

      if (storedBooks) {
        setBooks(JSON.parse(storedBooks));
      } else {
        setBooks(DEFAULT_BOOKS);
        localStorage.setItem("lexiflow_books", JSON.stringify(DEFAULT_BOOKS));
      }

      if (storedWords) {
        setWords(JSON.parse(storedWords));
      } else {
        setWords(DEFAULT_WORDS);
        localStorage.setItem("lexiflow_words", JSON.stringify(DEFAULT_WORDS));
      }
      setIsLoading(false);
    }
  }, []);

  const saveBooks = (newBooks: Book[]) => {
    setBooks(newBooks);
    localStorage.setItem("lexiflow_books", JSON.stringify(newBooks));
  };

  const saveWords = (newWords: VocabularyWord[]) => {
    setWords(newWords);
    localStorage.setItem("lexiflow_words", JSON.stringify(newWords));
  };

  const addBook = (title: string, author: string, totalPages: number) => {
    const coverColors = [
      "from-violet-600 to-purple-800",
      "from-teal-600 to-emerald-800",
      "from-rose-600 to-red-800",
      "from-blue-600 to-indigo-800",
      "from-amber-600 to-orange-800",
      "from-fuchsia-600 to-pink-800",
    ];
    const randomColor = coverColors[Math.floor(Math.random() * coverColors.length)];

    const newBook: Book = {
      id: `book-${Date.now()}`,
      title,
      author,
      coverColor: randomColor,
      progress: 0,
      totalPages,
      currentPage: 0,
      wordCount: 0,
    };

    saveBooks([...books, newBook]);
  };

  const updateBookProgress = (bookId: string, currentPage: number) => {
    const updatedBooks = books.map((b) => {
      if (b.id === bookId) {
        const pages = Math.min(currentPage, b.totalPages);
        const progress = Math.round((pages / b.totalPages) * 100);
        return {
          ...b,
          currentPage: pages,
          progress,
        };
      }
      return b;
    });
    saveBooks(updatedBooks);
  };

  const deleteBook = (bookId: string) => {
    saveBooks(books.filter((b) => b.id !== bookId));
    saveWords(words.filter((w) => w.bookId !== bookId));
  };

  const addWord = (
    word: string,
    definition: string,
    translation: string,
    contextSentence: string,
    bookId: string
  ) => {
    const newWord: VocabularyWord = {
      id: `word-${Date.now()}`,
      word,
      definition,
      translation,
      contextSentence,
      bookId,
      masteryLevel: "learning",
      createdAt: new Date().toISOString(),
    };

    const updatedWords = [newWord, ...words];
    saveWords(updatedWords);

    // Update book word count
    const updatedBooks = books.map((b) => {
      if (b.id === bookId) {
        return { ...b, wordCount: b.wordCount + 1 };
      }
      return b;
    });
    saveBooks(updatedBooks);
  };

  const updateWordMastery = (wordId: string, level: "learning" | "reviewing" | "mastered") => {
    const updatedWords = words.map((w) => {
      if (w.id === wordId) {
        return { ...w, masteryLevel: level };
      }
      return w;
    });
    saveWords(updatedWords);
  };

  const deleteWord = (wordId: string) => {
    const wordToDelete = words.find((w) => w.id === wordId);
    if (!wordToDelete) return;

    saveWords(words.filter((w) => w.id !== wordId));

    // Update book word count
    const updatedBooks = books.map((b) => {
      if (b.id === wordToDelete.bookId) {
        return { ...b, wordCount: Math.max(0, b.wordCount - 1) };
      }
      return b;
    });
    saveBooks(updatedBooks);
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
