"use client";

import { useState } from "react";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BookOpen, MoreVertical, Plus, Search, Trash2 } from "lucide-react";

export default function VocabularyPage() {
  const { books, words, addWord, updateWordMastery, deleteWord, isLoading } = useVocabulary();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [selectedBookFilter, setSelectedBookFilter] = useState("all");
  const [selectedMasteryFilter, setSelectedMasteryFilter] = useState("all");

  // Word Form State
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [translation, setTranslation] = useState("");
  const [context, setContext] = useState("");
  const [wordBookId, setWordBookId] = useState("");
  const [isWordOpen, setIsWordOpen] = useState(false);

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

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  // Filter words
  const filteredWords = words.filter((w) => {
    const matchesSearch =
      w.word.toLowerCase().includes(search.toLowerCase()) ||
      w.definition.toLowerCase().includes(search.toLowerCase()) ||
      w.translation.toLowerCase().includes(search.toLowerCase()) ||
      w.contextSentence.toLowerCase().includes(search.toLowerCase());

    const matchesBook = selectedBookFilter === "all" || w.bookId === selectedBookFilter;
    const matchesMastery = selectedMasteryFilter === "all" || w.masteryLevel === selectedMasteryFilter;

    return matchesSearch && matchesBook && matchesMastery;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">Vocabulary Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and query words you have collected. Move words between stages as you learn.
          </p>
        </div>

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

      {/* Filters and Search toolbar */}
      <div className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl bg-zinc-950/20 border border-zinc-800/80">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search words, definitions, translations..."
            className="pl-9 bg-zinc-950/40 border-zinc-800 focus-visible:ring-violet-500/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Book filter */}
          <Select onValueChange={(val) => setSelectedBookFilter(val || "all")} value={selectedBookFilter}>
            <SelectTrigger className="w-[180px] bg-zinc-950/40 border-zinc-800">
              <SelectValue placeholder="All Books" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Books</SelectItem>
              {books.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mastery filter */}
          <Select onValueChange={(val) => setSelectedMasteryFilter(val || "all")} value={selectedMasteryFilter}>
            <SelectTrigger className="w-[150px] bg-zinc-950/40 border-zinc-800">
              <SelectValue placeholder="All Mastery Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="learning">Learning</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="mastered">Mastered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Vocabulary list display */}
      <div className="space-y-4">
        {filteredWords.map((w) => {
          const book = books.find((b) => b.id === w.bookId);
          return (
            <Card key={w.id} className="border-zinc-800 bg-zinc-950/20 hover:border-zinc-700/50 transition-all">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-zinc-100 tracking-tight">{w.word}</h3>
                    {w.translation && (
                      <span className="text-sm text-muted-foreground font-medium">
                        — {w.translation}
                      </span>
                    )}
                    <Badge
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border-0 ${
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

                  <p className="text-sm text-zinc-300 leading-relaxed max-w-2xl">{w.definition}</p>

                  {w.contextSentence && (
                    <blockquote className="text-xs text-muted-foreground border-l-2 border-zinc-800 pl-3 italic py-0.5">
                      &ldquo;{w.contextSentence}&rdquo;
                    </blockquote>
                  )}

                  {book && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1">
                      <BookOpen className="h-3.5 w-3.5 text-violet-500/50" />
                      <span>Found in:</span>
                      <span className="font-semibold text-zinc-400">{book.title}</span>
                      <span>by {book.author}</span>
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col justify-end items-center sm:items-end gap-2 border-t sm:border-t-0 border-zinc-900/50 pt-3 sm:pt-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 border-zinc-800 hover:bg-zinc-900 gap-1" />}>
                      Change Mastery
                      <MoreVertical className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-zinc-800">
                      <DropdownMenuItem onClick={() => updateWordMastery(w.id, "learning")} className="text-violet-400">
                        Set to: Learning
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateWordMastery(w.id, "reviewing")} className="text-amber-400">
                        Set to: Reviewing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateWordMastery(w.id, "mastered")} className="text-emerald-400">
                        Set to: Mastered
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-zinc-800 hover:bg-red-950/20 hover:text-red-400 text-muted-foreground"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete the word "${w.word}"?`)) {
                        deleteWord(w.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredWords.length === 0 && (
          <Card className="border-dashed border-zinc-800 bg-zinc-950/10 p-12 text-center flex flex-col items-center justify-center space-y-3">
            <Search className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-base font-bold text-zinc-300">No words match your search criteria</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Adjust your search keywords or clear filters to see your vocabulary list.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
