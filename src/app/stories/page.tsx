"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Loader2, PenSquare, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStories } from "@/hooks/use-stories";
import { useVocabulary } from "@/hooks/use-vocabulary";

export default function StoriesPage() {
  const router = useRouter();
  const { stories, isLoading, createStory, deleteStory } = useStories();
  const { books, isLoading: booksLoading } = useVocabulary();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bookId, setBookId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const book = books.find((entry) => entry.id === bookId);
    if (!title.trim() || !book) return;

    setIsSubmitting(true);
    try {
      const story = await createStory({
        title: title.trim(),
        bookId: book.id,
        bookTitle: book.title,
      });

      setIsCreateOpen(false);
      setTitle("");
      setBookId("");
      router.push(`/stories/${story.id}`);
      router.refresh();
    } catch (error) {
      console.error("Failed to create story:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteStory(storyId: string) {
    const confirmDelete = window.confirm("Delete this story and all its chapters/scenes?");
    if (!confirmDelete) return;

    setDeletingStoryId(storyId);
    try {
      await deleteStory(storyId);
    } catch (error) {
      console.error("Failed to delete story:", error);
    } finally {
      setDeletingStoryId(null);
    }
  }

  if (isLoading || booksLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm ring-1 ring-slate-200">
              <Sparkles className="h-3.5 w-3.5" /> Story Lab
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">Create with your captures</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Build original stories from the vocabulary you collected while reading. Start with an outline, then draft scene by scene.
              </p>
            </div>
          </div>

          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
            <Plus className="h-4 w-4" /> New story
          </Button>
        </div>

        {stories.length === 0 ? (
          <Card className="rounded-[28px] border-border bg-card p-10 shadow-xl">
            <div className="mx-auto max-w-xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
                <PenSquare className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-foreground">No stories yet</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pick an inspiration book, outline your idea, then draft scenes using batches of captured words.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="mt-6 gap-2 bg-slate-900 text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" /> Create your first story
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {stories.map((story) => (
              <Link key={story.id} href={`/stories/${story.id}`}>
                <Card className="h-full rounded-[28px] border-border bg-card p-6 shadow-xl transition hover:-translate-y-1 hover:border-border/80 hover:shadow-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <PenSquare className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        {story.sceneCount} scene{story.sceneCount === 1 ? "" : "s"}
                      </div>
                      <button
                        type="button"
                        aria-label="Delete story"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleDeleteStory(story.id);
                        }}
                        disabled={deletingStoryId === story.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-60"
                      >
                        {deletingStoryId === story.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">{story.title}</h2>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      <span>{story.bookTitle}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{story.chapterCount} chapter{story.chapterCount === 1 ? "" : "s"}</span>
                    <span>{new Date(story.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create Story</DialogTitle>
              <DialogDescription>
                Choose a title and the book whose captures will feed your writing batches.
              </DialogDescription>
            </DialogHeader>

            <Input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Story title"
            />

            <label className="block space-y-2 text-sm text-slate-600">
              <span className="font-medium">Inspiration book</span>
              <select
                required
                value={bookId}
                onChange={(event) => setBookId(event.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
              >
                <option value="" disabled>Select a book</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>{book.title}</option>
                ))}
              </select>
            </label>

            {books.length === 0 && (
              <p className="text-sm text-slate-500">
                You need at least one book before creating a story. Add one from <Link href="/books" className="font-medium text-slate-900 underline">Books</Link>.
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || books.length === 0}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create story"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}