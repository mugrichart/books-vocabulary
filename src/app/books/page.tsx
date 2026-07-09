"use client";

import { useState } from "react";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BookOpen, BookPlus, ChevronRight, Hash, Trash2 } from "lucide-react";

export default function BooksPage() {
  const { books, addBook, updateBookProgress, deleteBook, isLoading } = useVocabulary();

  // Book Form State
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookPages, setBookPages] = useState("");
  const [isBookOpen, setIsBookOpen] = useState(false);

  // Progress Update State
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [progressPage, setProgressPage] = useState("");
  const [isProgressOpen, setIsProgressOpen] = useState(false);

  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle || !bookAuthor || !bookPages) return;
    addBook(bookTitle, bookAuthor, parseInt(bookPages) || 100);
    setBookTitle("");
    setBookAuthor("");
    setBookPages("");
    setIsBookOpen(false);
  };

  const handleUpdateProgress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId || !progressPage) return;
    updateBookProgress(selectedBookId, parseInt(progressPage) || 0);
    setProgressPage("");
    setSelectedBookId(null);
    setIsProgressOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">My Reading Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your books, update progress, and view how many vocabulary terms you have captured.
          </p>
        </div>

        {/* Add Book Dialog */}
        <Dialog open={isBookOpen} onOpenChange={setIsBookOpen}>
          <DialogTrigger render={<Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-md shadow-violet-500/20" />}>
            <BookPlus className="h-4 w-4" />
            Add Book
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddBook}>
              <DialogHeader>
                <DialogTitle>Add New Book</DialogTitle>
                <DialogDescription>
                  Enter details to register a new book in your library tracker.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Book Title</label>
                  <Input
                    required
                    placeholder="e.g. The Hobbit"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Author Name</label>
                  <Input
                    required
                    placeholder="e.g. J.R.R. Tolkien"
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Total Pages</label>
                  <Input
                    required
                    type="number"
                    placeholder="e.g. 310"
                    value={bookPages}
                    onChange={(e) => setBookPages(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white">Save Book</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid of Books */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map((book) => (
          <Card key={book.id} className="border-zinc-800 bg-zinc-950/20 hover:bg-zinc-950/40 transition-all flex flex-col justify-between overflow-hidden relative group">
            {/* Top gradient border for that extra visual flare */}
            <div className={`absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r ${book.coverColor}`} />
            
            <CardHeader className="flex flex-row gap-4 items-start pt-6 pb-4">
              <div className={`w-16 h-24 rounded-lg bg-gradient-to-br ${book.coverColor} shadow-md flex-shrink-0 flex flex-col items-center justify-center p-2 text-center text-white/90 relative group-hover:scale-105 transition-transform duration-300`}>
                <BookOpen className="h-6 w-6 mb-1 opacity-70" />
                <span className="text-[8px] font-bold uppercase tracking-wider line-clamp-2 leading-none">
                  {book.title}
                </span>
              </div>
              <div className="space-y-1.5 min-w-0 flex-1">
                <h3 className="font-bold text-base truncate text-zinc-100">{book.title}</h3>
                <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {book.wordCount} words
                  </span>
                  <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {book.totalPages} pages
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Reading Progress</span>
                  <span className="font-medium text-zinc-300">{book.progress}% ({book.currentPage}/{book.totalPages} p.)</span>
                </div>
                <Progress value={book.progress} className="h-1.5 bg-zinc-900" />
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-900/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs border-zinc-800 hover:bg-zinc-900 gap-1.5"
                  onClick={() => {
                    setSelectedBookId(book.id);
                    setProgressPage(book.currentPage.toString());
                    setIsProgressOpen(true);
                  }}
                >
                  Update Page
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-zinc-800 hover:bg-red-950/20 hover:text-red-400 text-muted-foreground"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${book.title}"? This will delete all its vocabulary words.`)) {
                      deleteBook(book.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {books.length === 0 && (
          <Card className="col-span-full border-dashed border-zinc-800 bg-zinc-950/10 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-base font-bold text-zinc-300">Your library is currently empty</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Add books that you are reading so you can assign vocabulary terms to them.
            </p>
            <Button
              className="mt-2 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => setIsBookOpen(true)}
            >
              Add Book Now
            </Button>
          </Card>
        )}
      </div>

      {/* Progress Update Dialog */}
      <Dialog open={isProgressOpen} onOpenChange={setIsProgressOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <form onSubmit={handleUpdateProgress}>
            <DialogHeader>
              <DialogTitle>Update Reading Progress</DialogTitle>
              <DialogDescription>
                Enter the page number you are currently on.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Current Page</label>
                <Input
                  required
                  type="number"
                  placeholder="e.g. 150"
                  value={progressPage}
                  onChange={(e) => setProgressPage(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white">Save Progress</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
