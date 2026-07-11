"use client";

import { useState } from "react";
import Link from "next/link";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, BookPlus, GraduationCap, Plus, Sparkles, TrendingUp, Trophy, FileText, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { books, words, addWord, addBook, isLoading } = useVocabulary();

  // Word Form State
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [translation, setTranslation] = useState("");
  const [context, setContext] = useState("");
  const [wordBookId, setWordBookId] = useState("");
  const [isWordOpen, setIsWordOpen] = useState(false);

  // Book Form State
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookPages, setBookPages] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      
      // Auto-populate title if empty
      if (!bookTitle) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setBookTitle(cleanName);
      }
    }
  };

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word || !definition || !wordBookId) return;
    addWord(word, definition, translation, context, wordBookId);
    setWord("");
    setDefinition("");
    setTranslation("");
    setContext("");
    setWordBookId("");
    setIsWordOpen(false);
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle || !bookAuthor || !bookPages) return;

    setIsUploading(true);

    try {
      let pdfUrl = "";
      let coverUrl = "";

      if (pdfFile) {
        // Extract cover image from the PDF on the client side
        const arrayBuffer = await pdfFile.arrayBuffer();
        
        // Dynamically import pdf.js to prevent SSR issues
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
          throw new Error("Canvas context initialization failed");
        }

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const coverBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/png");
        });

        // Prepare file upload payload
        const formData = new FormData();
        formData.append("pdf", pdfFile);
        if (coverBlob) {
          formData.append("cover", coverBlob, "cover.png");
        }

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
  const masteredWords = words.filter((w) => w.masteryLevel === "mastered").length;
  const learningWords = words.filter((w) => w.masteryLevel === "learning").length;
  const reviewingWords = words.filter((w) => w.masteryLevel === "reviewing").length;
  const averageProgress = books.length
    ? Math.round(books.reduce((acc, curr) => acc + curr.progress, 0) / books.length)
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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

            {/* Add Word Dialog */}
            <Dialog open={isWordOpen} onOpenChange={setIsWordOpen}>
              <DialogTrigger render={<Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-md shadow-violet-500/20" />}>
                <Plus className="h-4 w-4" />
                Add Word
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px]">
                <form onSubmit={handleAddWord}>
                  <DialogHeader>
                    <DialogTitle>Add New Vocabulary Word</DialogTitle>
                    <DialogDescription>
                      Log a new term you encountered while reading.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Word</label>
                        <Input
                          required
                          placeholder="e.g. Ephemeral"
                          value={word}
                          onChange={(e) => setWord(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Translation (Optional)</label>
                        <Input
                          placeholder="e.g. Ulotny"
                          value={translation}
                          onChange={(e) => setTranslation(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Definition</label>
                      <Input
                        required
                        placeholder="e.g. Lasting for a very short time"
                        value={definition}
                        onChange={(e) => setDefinition(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Context Sentence</label>
                      <Input
                        placeholder="e.g. Fame is ephemeral, but character endures."
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Select Book</label>
                      <Select required onValueChange={(val) => setWordBookId(val || "")} value={wordBookId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose source book..." />
                        </SelectTrigger>
                        <SelectContent>
                          {books.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.title} ({b.author})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white">Save Word</Button>
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
              {totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0}% success rate
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
            <h2 className="text-lg font-bold tracking-tight">Active Reading Material</h2>
            <Link href="/books" className="text-xs text-violet-400 hover:text-violet-300 font-medium">
              Manage Library &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {books.slice(0, 4).map((book) => (
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
                    <span>Progress: {book.progress}%</span>
                    <span>{book.currentPage}/{book.totalPages} p.</span>
                  </div>
                  <Progress value={book.progress} className="h-1 bg-zinc-900" />
                </div>
              </Card>
            ))}
            {books.length === 0 && (
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

          <div className="space-y-3">
            {words.slice(0, 5).map((w) => {
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
