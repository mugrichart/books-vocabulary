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
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
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
          if (!res.ok) throw new Error("Failed to upload");
          const data = await res.json();
          pdfUrl = data.pdfUrl;
          coverUrl = data.coverUrl;
        }
      }
      addBook(bookTitle, bookAuthor, parseInt(bookPages) || 100, pdfUrl, coverUrl);
      setBookTitle(""); setBookAuthor(""); setBookPages(""); setPdfFile(null); setIsBookOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error processing PDF.");
    } finally { setIsUploading(false); }
  };

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map((book) => (
          <Card key={book.id} className="border-zinc-800 bg-zinc-950/20">
            <CardHeader className="flex flex-row gap-4 items-start pt-6 pb-4">
              <div className="w-16 h-24 rounded bg-zinc-800 overflow-hidden">
                {book.coverUrl && <img src={book.coverUrl} className="w-full h-full object-cover" />}
              </div>
              <div>
                <h3 className="font-bold text-zinc-100">{book.title}</h3>
                <p className="text-xs text-zinc-400">{book.author}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={book.progress} />
              <div className="flex gap-2">
                {/* Fix 2: Applied button styles directly to the Next.js Link instead of using Button asChild */}
                <Link 
                  href={`/books/${book.id}`}
                  className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-zinc-200 h-9 px-3 transition-colors"
                >
                  Read
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}