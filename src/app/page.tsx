"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BookOpen, BookPlus, GraduationCap, Sparkles, TrendingUp, Trophy, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { books, words, addBook, isLoading } = useVocabulary();

  // Book Form State
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookPages, setBookPages] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const pdfPreviewUrlRef = useRef<string | null>(null);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [practiceStatsByBook, setPracticeStatsByBook] = useState<Record<string, { level: number; captures: number }>>({});
  const [recentBookIds, setRecentBookIds] = useState<string[]>([]);

  const RECENT_BOOKS_STORAGE_KEY = "recent-book-ids";

  const readRecentBookIds = () => {
    if (typeof window === "undefined") return [] as string[];
    const raw = window.localStorage.getItem(RECENT_BOOKS_STORAGE_KEY);
    if (!raw) return [] as string[];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch {
      return [] as string[];
    }
  };

  const parsePracticeLevel = (bookId: string) => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(`practice-cursor:${bookId}`);
    const parsed = Number.parseInt(raw ?? "0", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const getFirstPagePreview = async (file: File) => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas context initialization failed");
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL("image/png");
  };

  useEffect(() => {
    let isCancelled = false;

    const loadPracticeStats = async () => {
      if (books.length === 0) {
        setPracticeStatsByBook({});
        return;
      }

      const entries = await Promise.all(
        books.map(async (book) => {
          const level = parsePracticeLevel(book.id);
          let captures = 0;

          try {
            const res = await fetch(`/api/capture/${book.id}?mode=highlight&limit=1`, {
              cache: "no-store",
            });

            if (res.ok) {
              const data = await res.json();
              captures = typeof data?.total === "number" ? Math.max(0, data.total) : 0;
            }
          } catch (error) {
            console.error(`Failed to load captures count for book ${book.id}:`, error);
          }

          return [book.id, { level, captures }] as const;
        })
      );

      if (!isCancelled) {
        setPracticeStatsByBook(Object.fromEntries(entries));
      }
    };

    loadPracticeStats();
    return () => {
      isCancelled = true;
    };
  }, [books]);

  useEffect(() => {
    const refreshRecentBooks = () => {
      setRecentBookIds(readRecentBookIds());
    };

    refreshRecentBooks();
    window.addEventListener("focus", refreshRecentBooks);
    window.addEventListener("storage", refreshRecentBooks);

    return () => {
      window.removeEventListener("focus", refreshRecentBooks);
      window.removeEventListener("storage", refreshRecentBooks);
    };
  }, []);

  const dashboardBooks = useMemo(() => {
    const ordered = recentBookIds
      .map((recentBookId) => books.find((book) => book.id === recentBookId))
      .filter((book): book is NonNullable<typeof book> => Boolean(book));

    if (ordered.length === 0) {
      return books.slice(0, 4);
    }

    return ordered.slice(0, 4);
  }, [books, recentBookIds]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      pdfPreviewUrlRef.current = previewUrl;
      setPdfPreviewUrl(previewUrl);
      
      // Auto-populate title if empty
      if (!bookTitle) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setBookTitle(cleanName);
      }

      try {
        setPdfPreviewUrl(await getFirstPagePreview(file));
      } catch (error) {
        console.error("Failed generating PDF preview:", error);
      }
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle || !bookAuthor || !bookPages) return;

    setIsUploading(true);

    try {
      let pdfUrl = "";
      let coverUrl = "";

      if (pdfFile) {
        const formData = new FormData();
        formData.append("pdf", pdfFile);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to upload to S3");
        }

        const data = await res.json();
        pdfUrl = data.pdfUrl;
        coverUrl = data.coverUrl;
      }

      addBook(bookTitle, bookAuthor, parseInt(bookPages) || 100, pdfUrl, coverUrl);
      
      setBookTitle("");
      setBookAuthor("");
      setBookPages("");
      setPdfFile(null);
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
        pdfPreviewUrlRef.current = null;
      }
      setPdfPreviewUrl(null);
      setIsBookOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Error: " + (err.message || "Failed to process PDF upload."));
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  // Calculate statistics
  const totalWords = words.length;
  const masteredWords = Object.values(practiceStatsByBook).reduce((sum, stat) => sum + stat.level, 0);
  const learningWords = words.filter((w) => w.masteryLevel === "learning").length;
  const reviewingWords = words.filter((w) => w.masteryLevel === "reviewing").length;
  const averageProgress = books.length
    ? Math.round(books.reduce((acc, curr) => acc + curr.progress, 0) / books.length)
    : 0;
  const masteredPercent = totalWords > 0 ? Math.round((masteredWords * 100) / totalWords) : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-900/40 via-indigo-900/30 to-background border border-violet-500/10 p-6 md:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 -mb-16 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome to LexiFlow
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Elevate Your Reading & Vocabulary
            </h1>
            <p className="max-w-xl text-muted-foreground text-sm md:text-base">
              Add words you encounter while reading, track your books, and build lasting vocabulary retention through personalized flashcards.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Add Book Dialog */}
            <Dialog open={isBookOpen} onOpenChange={setIsBookOpen}>
              <DialogTrigger render={<Button variant="outline" className="gap-2 border-zinc-700/50 hover:bg-zinc-800" />}>
                <BookPlus className="h-4 w-4" />
                Add Book
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleAddBook}>
                  <DialogHeader>
                    <DialogTitle>Add New Book</DialogTitle>
                    <DialogDescription>
                      Create a new book, or upload a PDF to automatically generate its cover.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Upload PDF (Optional)</label>
                      <Input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                      />
                    </div>
                    {pdfPreviewUrl && (
                      <div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
                          <img
                            src={pdfPreviewUrl}
                            alt="PDF first page preview"
                            className="max-h-60 w-full rounded-md object-contain"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Book Title</label>
                      <Input
                        required
                        placeholder="e.g. Dune"
                        value={bookTitle}
                        onChange={(e) => setBookTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Author Name</label>
                      <Input
                        required
                        placeholder="e.g. Frank Herbert"
                        value={bookAuthor}
                        onChange={(e) => setBookAuthor(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Total Pages</label>
                      <Input
                        required
                        type="number"
                        placeholder="e.g. 600"
                        value={bookPages}
                        onChange={(e) => setBookPages(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isUploading} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Save Book"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-950/40 backdrop-blur-md transition-all hover:border-violet-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Words</span>
            <div className="rounded-lg bg-violet-500/10 p-2 text-violet-400">
              <GraduationCap className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWords}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Across all reading material</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/40 backdrop-blur-md transition-all hover:border-violet-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mastered</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
              <Trophy className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{masteredWords}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {masteredPercent}% success rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/40 backdrop-blur-md transition-all hover:border-violet-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Learning</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{learningWords + reviewingWords}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {learningWords} new, {reviewingWords} in review
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/40 backdrop-blur-md transition-all hover:border-violet-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reading Progress</span>
            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
              <BookOpen className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageProgress}%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Average completion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Books and Latest Words Section */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Books Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Books</h2>
            <Link href="/books" className="text-xs text-violet-400 hover:text-violet-300 font-medium">
              Manage Library &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dashboardBooks.map((book) => {
              const bookPracticeStats = practiceStatsByBook[book.id] ?? { level: 0, captures: 0 };
              const safeCaptures = Math.max(0, bookPracticeStats.captures);
              const boundedLevel = safeCaptures > 0 ? Math.min(bookPracticeStats.level, safeCaptures) : 0;
              const practicePercent = safeCaptures > 0 ? Math.round((boundedLevel * 100) / safeCaptures) : 0;

              return (
              <Card key={book.id} className="border-zinc-800 bg-zinc-950/20 hover:bg-zinc-950/40 transition-all overflow-hidden flex flex-col justify-between relative group">
                <div className="p-4 flex gap-4">
                  {/* Miniature Cover */}
                  <div className="w-12 h-16 rounded-md shadow-md flex-shrink-0 overflow-hidden relative">
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${book.coverColor} flex items-center justify-center`}>
                        <BookOpen className="h-5 w-5 text-white/80" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-bold text-sm truncate text-zinc-100">{book.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full inline-block">
                        {book.wordCount} words logged
                      </p>
                      {book.pdfUrl && (
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                          PDF
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-4 pt-1 space-y-1.5 border-t border-zinc-900/50">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Practice: {boundedLevel}/{safeCaptures}</span>
                    <span>{practicePercent}%</span>
                  </div>
                  <Progress value={practicePercent} className="h-1 bg-zinc-900" />
                  {book.pdfUrl ? (
                    <Link
                      href={`/books/${book.id}`}
                      className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md bg-violet-600 text-xs font-semibold text-white transition hover:bg-violet-700"
                    >
                      Read
                    </Link>
                  ) : (
                    <span className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md border border-zinc-800 text-xs text-zinc-500">
                      No PDF attached
                    </span>
                  )}
                </div>
              </Card>
            )})}
            {dashboardBooks.length === 0 && (
              <Card className="col-span-2 border-zinc-800 bg-zinc-950/20 p-8 text-center flex flex-col items-center justify-center space-y-2">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-zinc-400">No books added yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Create your first book tracker to start adding terms.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Latest Words Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Recent Additions</h2>
            <Link href="/vocabulary" className="text-xs text-violet-400 hover:text-violet-300 font-medium">
              View All &rarr;
            </Link>
          </div>

          <div className="max-h-[520px] overflow-y-auto space-y-3 pr-1">
            {words.slice(0, 40).map((w) => {
              const book = books.find((b) => b.id === w.bookId);
              return (
                <div
                  key={w.id}
                  className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/20 hover:bg-zinc-950/40 transition-all flex flex-col justify-between gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-100">{w.word}</h4>
                      {w.translation && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">{w.translation}</p>
                      )}
                    </div>
                    <Badge
                      className={`text-[9px] px-1.5 py-0 rounded font-medium border-0 ${
                        w.masteryLevel === "mastered"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : w.masteryLevel === "reviewing"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-violet-500/10 text-violet-400"
                      }`}
                    >
                      {w.masteryLevel}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {w.definition}
                  </p>
                  {book && (
                    <div className="text-[10px] text-muted-foreground border-t border-zinc-900/50 pt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500/40" />
                      From: <span className="font-medium text-zinc-400">{book.title}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {words.length === 0 && (
              <Card className="border-zinc-800 bg-zinc-950/20 p-8 text-center flex flex-col items-center justify-center space-y-2">
                <GraduationCap className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-zinc-400">Vocabulary list is empty</p>
                <p className="text-xs text-muted-foreground">
                  Try adding a word you recently learned.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
