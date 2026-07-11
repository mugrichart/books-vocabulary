"use client";

import { useState } from "react";
import Link from "next/link";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BookOpen, BookPlus, ChevronRight, Hash, Trash2, FileText, Loader2 } from "lucide-react";

export default function BooksPage() {
  const { books, addBook, updateBookProgress, deleteBook, isLoading } = useVocabulary();

  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookPages, setBookPages] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [progressPage, setProgressPage] = useState("");
  const [isProgressOpen, setIsProgressOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      if (!bookTitle) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setBookTitle(cleanName);
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
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
          const coverBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
          const formData = new FormData();
          formData.append("pdf", pdfFile);
          if (coverBlob) formData.append("cover", coverBlob, "cover.png");
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to upload to S3");
          }
          const data = await res.json();
          pdfUrl = data.pdfUrl;
          coverUrl = data.coverUrl;
        }
      }
      addBook(bookTitle, bookAuthor, parseInt(bookPages) || 100, pdfUrl, coverUrl);
      setBookTitle(""); setBookAuthor(""); setBookPages(""); setPdfFile(null); setIsBookOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Error: " + (err.message || "Failed to process PDF."));
    } finally { setIsUploading(false); }
  };

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">My Reading Library</h1>
        </div>
        
        {/* Fix 1: Removed DialogTrigger entirely. Triggering the modal explicitly via standard onClick */}
        <Button 
          onClick={() => setIsBookOpen(true)} 
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
        >
          <BookPlus className="h-4 w-4" /> Add Book
        </Button>

        <Dialog open={isBookOpen} onOpenChange={setIsBookOpen}>
          <DialogContent>
            <form onSubmit={handleAddBook}>
              <DialogHeader><DialogTitle>Add New Book</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <Input type="file" accept="application/pdf" onChange={handleFileChange} />
                <Input required placeholder="Title" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
                <Input required placeholder="Author" value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} />
                <Input required type="number" placeholder="Total Pages" value={bookPages} onChange={(e) => setBookPages(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isUploading}>{isUploading ? <Loader2 className="animate-spin" /> : "Save Book"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {books.map((book) => (
          <div key={book.id} className="relative group rounded-xl overflow-hidden cursor-pointer bg-zinc-950 border border-zinc-800 shadow-lg aspect-[3/4] transition-all hover:ring-2 hover:ring-violet-500 flex items-center justify-center">
            {/* Cover image */}
            {book.coverUrl ? (
              <img src={book.coverUrl} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" alt={book.title} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-500 p-4 text-center">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-xs font-medium line-clamp-3">{book.title}</span>
              </div>
            )}
            
            {/* Always visible tiny progress bar at the very bottom, disappears on hover to make room for full overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800 group-hover:opacity-0 transition-opacity duration-300">
              <div className="h-full bg-violet-500" style={{ width: `${book.progress}%` }} />
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 sm:p-4">
              <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                <h3 className="font-bold text-sm sm:text-base text-zinc-100 leading-tight mb-1 line-clamp-2">{book.title}</h3>
                <p className="text-xs text-zinc-400 mb-3 line-clamp-1">{book.author}</p>
                
                <div className="mb-3">
                  <Progress value={book.progress} className="h-1.5" />
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/books/${book.id}`}
                    className="flex-1 inline-flex items-center justify-center rounded-md text-xs sm:text-sm font-semibold bg-white text-black hover:bg-zinc-200 h-8 transition-colors"
                  >
                    Read
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      deleteBook(book.id);
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-red-600/90 text-white hover:bg-red-600 h-8 px-3 transition-colors"
                    aria-label="Delete book"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    <span className="text-xs sm:text-sm font-medium">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}