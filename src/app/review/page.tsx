"use client";

import { useState } from "react";
import { useVocabulary } from "@/hooks/use-vocabulary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Check, Eye, GraduationCap, RefreshCw, X } from "lucide-react";

export default function ReviewPage() {
  const { books, words, updateWordMastery, isLoading } = useVocabulary();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  // We want to practice words that are in "learning" or "reviewing" first.
  // If there are none, we can practice any words.
  const practiceWords = words.filter((w) => w.masteryLevel !== "mastered");
  const fallbackWords = words;
  const activeReviewSet = practiceWords.length > 0 ? practiceWords : fallbackWords;

  const handleResponse = (gotIt: boolean) => {
    const currentWord = activeReviewSet[currentIndex];
    if (!currentWord) return;

    if (gotIt) {
      // Progress the level
      const nextLevel = currentWord.masteryLevel === "learning" ? "reviewing" : "mastered";
      updateWordMastery(currentWord.id, nextLevel);
      setSessionScore((prev) => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
    } else {
      // Regress or keep at learning
      updateWordMastery(currentWord.id, "learning");
      setSessionScore((prev) => ({ ...prev, total: prev.total + 1 }));
    }

    setIsFlipped(false);

    // Wait slightly for flip animation to reset before changing word
    setTimeout(() => {
      if (currentIndex + 1 < activeReviewSet.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsSessionFinished(true);
      }
    }, 200);
  };

  const restartSession = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsSessionFinished(false);
    setSessionScore({ correct: 0, total: 0 });
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (activeReviewSet.length === 0) {
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

  const currentWord = activeReviewSet[currentIndex];
  const associatedBook = currentWord ? books.find((b) => b.id === currentWord.bookId) : null;
  const progressPercentage = Math.round((currentIndex / activeReviewSet.length) * 100);

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4 animate-in fade-in duration-500">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">LexiPractice</h1>
        <p className="text-sm text-muted-foreground">
          Review definitions, trigger recall, and self-grade your performance.
        </p>
      </div>

      {isSessionFinished ? (
        <Card className="border-zinc-800 bg-zinc-950/20 p-8 text-center space-y-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
            <GraduationCap className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-zinc-100">Practice Completed!</h2>
            <p className="text-sm text-muted-foreground">
              You reviewed {activeReviewSet.length} cards this session.
            </p>
            <div className="text-3xl font-extrabold text-violet-400 mt-2">
              {sessionScore.correct} / {sessionScore.total}
            </div>
            <p className="text-xs text-muted-foreground">Words correctly recalled</p>
          </div>
          <Button onClick={restartSession} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            <RefreshCw className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Progress Tracker */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>Progress: {progressPercentage}%</span>
              <span>
                Card {currentIndex + 1} of {activeReviewSet.length}
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
                  <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100">{currentWord.word}</h2>
                  {currentWord.translation && (
                    <p className="text-sm text-muted-foreground italic">click card to reveal meaning</p>
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
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Definition</h3>
                    <p className="text-base text-zinc-100 mt-1">{currentWord.definition}</p>
                  </div>
                  {currentWord.translation && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Translation</h3>
                      <p className="text-sm text-zinc-300 mt-0.5">{currentWord.translation}</p>
                    </div>
                  )}
                  {currentWord.contextSentence && (
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Example Usage</h3>
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
      )}
    </div>
  );
}
