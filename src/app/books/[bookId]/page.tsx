"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PDFViewer from "@/components/PDFViewer";
import { useVocabulary } from "@/hooks/use-vocabulary";

export default function ReadPage() {
  const params = useParams<{ bookId: string }>();
  const { books, isLoading } = useVocabulary();
  const book = books.find((item) => item.id === params.bookId);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!book) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">Book not found</h1>
        <p className="text-sm text-muted-foreground">
          This book is not in your local library anymore.
        </p>
        <Link
          href="/books"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Back to library
        </Link>
      </main>
    );
  }

  if (!book.pdfUrl) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">No PDF attached</h1>
        <p className="text-sm text-muted-foreground">
          Add this book again with a PDF file to use the reader workspace.
        </p>
        <Link
          href="/books"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Back to library
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{book.title}</h1>
        <p className="text-sm text-muted-foreground">{book.author}</p>
      </div>
      <PDFViewer fileUrl={book.pdfUrl} bookId={book.id} />
    </main>
  );
}
