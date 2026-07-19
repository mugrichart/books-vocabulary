"use client";

import { useState, useEffect, useRef } from "react";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Check, Eye, GraduationCap, RefreshCw, X, ArrowRight } from "lucide-react";
import type { VocabularyWord } from "@/hooks/use-vocabulary";

/**
 * The root cause of the "all caught up" false positive:
 *
 * Previously `activeReviewSet` was computed live on every render from the
 * `words` state array. As the user answered cards, `updateWordMastery` updated
 * `words` in state, which shrank `activeReviewSet` mid-session. This caused
 * `currentIndex + 1 >= activeReviewSet.length` to become true far too early —
 * after only the first "batch" worth of answers — ending the session prematurely.
 *
 * Fix: snapshot the word IDs for the current batch into `sessionWordIds` state
 * the moment a session begins. The active set for this batch is always derived
 * from that stable snapshot. When the snapshot is exhausted, we check whether
 * any non-mastered words remain in the live `words` state:
 *   • If yes → start the next batch automatically (continuous learning loop).
 *   • If no  → show the real "all caught up" / session-complete screen.
 */

export default function ReviewPage() {
  const { books, words, updateWordMastery, isLoading } = useVocabulary();

  // Stable snapshot of word IDs for the current batch. Null = not yet initialised.
  const [sessionWordIds, setSessionWordIds] = useState<string[] | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });
  // "batch_done"  → current batch exhausted, more words remain
  // "all_done"    → truly nothing left to review
  const [finishState, setFinishState] = useState<"none" | "batch_done" | "all_done">("none");
  const [batchCount, setBatchCount] = useState(1);

  // Initialise the first batch once words have loaded
  const initialised = useRef(false);
  useEffect(() => {
    if (isLoading || initialised.current) return;
    const nonMastered = words.filter((w) => w.masteryLevel !== "mastered");
    const source = nonMastered.length > 0 ? nonMastered : words;
    if (source.length > 0) {
      setSessionWordIds(source.map((w) => w.id));
      initialised.current = true;
    }
  }, [isLoading, words]);

  // Derive the current batch from the stable snapshot + live word data
  // (we need live data so mastery-level badges etc. stay current).
  const batchWords: VocabularyWord[] = sessionWordIds
    ? (sessionWordIds
        .map((id) => words.find((w) => w.id === id))
        .filter(Boolean) as VocabularyWord[])
    : [];

  const handleResponse = (gotIt: boolean) => {
    const currentWord = batchWords[currentIndex];
    if (!currentWord) return;

    if (gotIt) {
      const nextLevel =
        currentWord.masteryLevel === "learning" ? "reviewing" : "mastered";
      updateWordMastery(currentWord.id, nextLevel);
      setSessionScore((prev) => ({
        ...prev,
        correct: prev.correct + 1,
        total: prev.total + 1,
      }));
    } else {
      updateWordMastery(currentWord.id, "learning");
      setSessionScore((prev) => ({ ...prev, total: prev.total + 1 }));
    }

    setIsFlipped(false);

    setTimeout(() => {
      if (currentIndex + 1 < batchWords.length) {
        // More cards in this batch — keep going
        setCurrentIndex((prev) => prev + 1);
      } else {
        // This batch is done. Check live state for remaining non-mastered words
        // that were NOT part of this batch (i.e. words we haven't seen yet).
        const seenIds = new Set(sessionWordIds ?? []);
        const remaining = words.filter(
          (w) => w.masteryLevel !== "mastered" && !seenIds.has(w.id)
        );
        if (remaining.length > 0) {
          setFinishState("batch_done");
        } else {
          setFinishState("all_done");
        }
      }
    }, 200);
  };

  /** Load the next batch of unseen non-mastered words */
  const startNextBatch = () => {
    const seenIds = new Set(sessionWordIds ?? []);
    const remaining = words.filter(
      (w) => w.masteryLevel !== "mastered" && !seenIds.has(w.id)
    );
    if (remaining.length === 0) {
      setFinishState("all_done");
      return;
    }
    setSessionWordIds(remaining.map((w) => w.id));
    setCurrentIndex(0);
    setIsFlipped(false);
    setFinishState("none");
    setBatchCount((prev) => prev + 1);
  };

  /** Restart from scratch */
  const restartSession = () => {
    const nonMastered = words.filter((w) => w.masteryLevel !== "mastered");
    const source = nonMastered.length > 0 ? nonMastered : words;
    setSessionWordIds(source.map((w) => w.id));
    setCurrentIndex(0);
    setIsFlipped(false);
    setFinishState("none");
    setSessionScore({ correct: 0, total: 0 });
    setBatchCount(1);
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading || sessionWordIds === null) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  // ── Truly nothing to review ──────────────────────────────────────────────
  if (batchWords.length === 0 && finishState === "none") {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4 animate-in fade-in duration-500">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">All Caught Up!</h1>
        <p className="text-sm text-muted-foreground">
          You have no active vocabulary words in your learning queue. Add more words to your list to begin practicing!
        </p>
      </div>
    );
  }

  // ── Batch-done / All-done screen ────────────────────────────────────────
  if (finishState !== "none") {
    const isAllDone = finishState === "all_done";
    return (
      <div className="max-w-lg mx-auto space-y-6 py-4 animate-in fade-in duration-500">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">LexiPractice</h1>
          <p className="text-sm text-muted-foreground">
            Review definitions, trigger recall, and self-grade your performance.
          </p>
        </div>
        <Card className="border-zinc-800 bg-zinc-950/20 p-8 text-center space-y-6">
          <div
            className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl ${
              isAllDone
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-violet-500/10 text-violet-400"
            }`}
          >
            <GraduationCap className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-zinc-100">
              {isAllDone ? "You're All Caught Up! 🎉" : `Batch ${batchCount} Complete!`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAllDone
                ? "You've reviewed every word in your queue. Great work!"
                : "You've finished this batch. Ready for the next one?"}
            </p>
            <div className="text-3xl font-extrabold text-violet-400 mt-2">
              {sessionScore.correct} / {sessionScore.total}
            </div>
            <p className="text-xs text-muted-foreground">Words correctly recalled this session</p>
          </div>
          <div className="flex flex-col gap-3">
            {!isAllDone && (
              <Button
                onClick={startNextBatch}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Continue — Next Batch
              </Button>
            )}
            <Button
              onClick={restartSession}
              variant="outline"
              className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isAllDone ? "Practice Again" : "Start Over from Beginning"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Active card session ──────────────────────────────────────────────────
  const currentWord = batchWords[currentIndex];
  const associatedBook = currentWord ? books.find((b) => b.id === currentWord.bookId) : null;
  const progressPercentage = Math.round((currentIndex / batchWords.length) * 100);

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4 animate-in fade-in duration-500">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">LexiPractice</h1>
        <p className="text-sm text-muted-foreground">
          Review definitions, trigger recall, and self-grade your performance.
        </p>
      </div>

      <div className="space-y-6">
        {/* Progress Tracker */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>
              Batch {batchCount} — Progress: {progressPercentage}%
            </span>
            <span>
              Card {currentIndex + 1} of {batchWords.length}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-1 bg-zinc-900" />
        </div>

        {/* Flashcard container with flip effect */}
        <div className="perspective-1000 h-[280px] w-full relative">
          <div
            className={`w-full h-full duration-500 transform-style-3d relative cursor-pointer ${
              isFlipped ? "rotate-y-180" : ""
            }`}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Front Side */}
            <div className="absolute w-full h-full backface-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 flex flex-col justify-between shadow-lg">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full">
                  {currentWord.masteryLevel}
                </span>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100">
                  {currentWord.word}
                </h2>
                {currentWord.translation && (
                  <p className="text-sm text-muted-foreground italic">
                    click card to reveal meaning
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
                {associatedBook ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <BookOpen className="h-4 w-4 text-violet-500/60" />
                    <span>{associatedBook.title}</span>
                  </div>
                ) : (
                  <div />
                )}
                <span className="text-xs text-violet-400 flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> Reveal definition
                </span>
              </div>
            </div>

            {/* Back Side */}
            <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 flex flex-col justify-between shadow-lg">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Definition
                  </h3>
                  <p className="text-base text-zinc-100 mt-1">{currentWord.definition}</p>
                </div>
                {currentWord.translation && (
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Translation
                    </h3>
                    <p className="text-sm text-zinc-300 mt-0.5">{currentWord.translation}</p>
                  </div>
                )}
                {currentWord.contextSentence && (
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Example Usage
                    </h3>
                    <p className="text-xs text-muted-foreground italic mt-0.5 leading-relaxed">
                      &ldquo;{currentWord.contextSentence}&rdquo;
                    </p>
                  </div>
                )}
              </div>
              <div className="text-center text-[10px] text-muted-foreground border-t border-zinc-900 pt-3">
                Click card to view front side again
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => handleResponse(false)}
            variant="outline"
            className="py-6 border-red-900/30 bg-red-950/10 hover:bg-red-950/30 text-red-400 hover:text-red-300 font-bold text-sm transition-all"
          >
            <X className="mr-2 h-4 w-4" /> Forgot
          </Button>
          <Button
            onClick={() => handleResponse(true)}
            className="py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/10 transition-all"
          >
            <Check className="mr-2 h-4 w-4" /> Got it!
          </Button>
        </div>
      </div>
    </div>
  );
}
