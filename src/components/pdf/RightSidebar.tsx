import React, { useState, useEffect } from 'react';
import { Lightbulb, MoreVertical, Mic, Volume2, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


type Mode = 'capture' | 'practice';

export interface PracticeData {
  /** How this panel content was triggered */
  kind: 'attempts' | 'hint';
  /** The correct answer */
  correct: string;
  /** Array of options (shuffled) */
  options: string[];
  /** Explanation string shown after selection */
  explanation: string;
}

interface Props {
  mode: Mode;
  setMode: (mode: Mode) => void;
  /** Data supplied after attempts are exhausted OR after hint is revealed */
  practiceData?: PracticeData;
  /** Passive explanation from the previously completed word */
  passiveExplanation?: { correct: string; explanation: string };
  /** Current attempt count (0–3) */
  attempts: number;
  /** Whether there is an active word being practiced */
  hasActiveWord: boolean;
  /** Cursor for current practice position */
  cursor: number;
  /** Practice batch size */
  batchSize: number;
  /** Total captured words for the current book */
  totalCaptures: number;
  /** Jump directly to a batch start cursor */
  onBatchSelect?: (cursor: number) => void;
  /** Callback when an option is chosen */
  onOptionSelect?: (selected: string) => void;
  /** Callback when the user clicks "Next" to advance to the next word */
  onNext?: () => void;
  /** Callback when the user reveals the hint, skipping attempts */
  onRevealHint?: () => void;
  /** Whether spoken-answer mode is enabled */
  speakModeEnabled: boolean;
  /** Toggles spoken-answer mode */
  onSpeakModeChange: (enabled: boolean) => void;
  /** Current recognized speech transcript */
  speechTranscript: string;
  /** Whether recognizer is currently listening */
  isSpeechListening: boolean;
  /** Whether user is currently speaking */
  isSpeechActive: boolean;
  /** Manually clear current transcript */
  onClearSpeechTranscript: () => void;
  /** Current active practice word */
  currentPracticeWord?: string;
  /** Current active practice sentence */
  currentPracticeSentence?: string;
}

export default function RightSidebar({ mode, setMode, practiceData, passiveExplanation, attempts, hasActiveWord, cursor, batchSize, totalCaptures, onBatchSelect, onOptionSelect, onNext, onRevealHint, speakModeEnabled, onSpeakModeChange, speechTranscript, isSpeechListening, isSpeechActive, onClearSpeechTranscript, currentPracticeWord, currentPracticeSentence }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const speakText = (text: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  const totalBatches = totalCaptures > 0 ? Math.ceil(totalCaptures / batchSize) : 0;
  const currentBatchIndex = totalBatches > 0
    ? Math.min(totalBatches - 1, Math.floor(cursor / batchSize))
    : 0;

  const getBatchFillRatio = (batchIndex: number) => {
    if (batchIndex < currentBatchIndex) return 1;
    if (batchIndex > currentBatchIndex) return 0;

    const batchStart = batchIndex * batchSize;
    const isLastBatch = batchIndex === totalBatches - 1;
    const lastBatchSize = totalCaptures - batchStart;
    const effectiveBatchSize = isLastBatch ? Math.max(1, lastBatchSize) : batchSize;
    const progressInBatch = Math.max(0, Math.min(cursor - batchStart, effectiveBatchSize));

    return progressInBatch / effectiveBatchSize;
  };

  // Reset selection and hint state when practiceData changes (new word)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(null);
  }, [practiceData]);

  const handleSelect = (opt: string) => {
    if (selected !== null) return; // ignore clicks after first selection
    setSelected(opt);
    onOptionSelect?.(opt);
  };

  const handleHint = () => {
    onRevealHint?.();
  };

  return (
    <aside className="flex flex-col w-72 min-w-70 border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      {/* Top section: mode toggle */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setMode('capture')}
          className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
            mode === 'capture' ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          Capture
        </button>
        <button
          type="button"
          onClick={() => setMode('practice')}
          className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
            mode === 'practice' ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          Practice
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More practice options"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-48">
            <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Practice Options</div>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={speakModeEnabled}
              onCheckedChange={(checked) => onSpeakModeChange(Boolean(checked))}
            >
              <Mic className="mr-1 h-4 w-4" />
              Speak answers
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Middle section: attempts counter + options + explanation */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Attempt counter + hint button — visible during practice when options haven't appeared yet */}
        {mode === 'practice' && !practiceData && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Typing attempts
              </p>
              {hasActiveWord && (
                <button
                  type="button"
                  onClick={handleHint}
                  title="Reveal explanation (skip attempts)"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Hint
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                    i < attempts
                      ? 'bg-violet-500'
                      : 'bg-slate-200 dark:bg-zinc-700'
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              {attempts < 3
                ? `${3 - attempts} attempt${3 - attempts !== 1 ? 's' : ''} remaining`
                : 'Loading options…'}
            </p>

            {passiveExplanation && (
              <div className="mt-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-900 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Previous Word Refresher
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-2">
                  {passiveExplanation.correct}
                </p>
                <div className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                  {passiveExplanation.explanation}
                </div>
              </div>
            )}
          </div>
        )}

        {practiceData && (
          <div className="space-y-3">
            {/* Hint-only view: explanation revealed without going through options */}
            {practiceData.kind === 'hint' && selected === null ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                    Hint revealed
                  </p>
                </div>
                <div className="rounded-lg border border-amber-300/40 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-950/20 p-4">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-2">
                    {practiceData.correct}
                  </p>
                  <div className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                    {practiceData.explanation}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onNext}
                  className="w-full mt-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  Got it → Next Word
                </button>
              </>
            ) : practiceData.kind === 'attempts' ? (
              <>
                {/* Options — always visible once practiceData arrives via attempts */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                    Choose the correct word
                  </p>
                  {practiceData.options.map((opt) => {
                    let optionClasses =
                      'w-full text-left p-3 border rounded-lg text-sm font-medium transition-all duration-200';

                    if (selected !== null) {
                      // After selection: green the correct option, red the wrong chosen one
                      if (opt === practiceData.correct) {
                        optionClasses +=
                          ' border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
                      } else if (opt === selected) {
                        optionClasses +=
                          ' border-red-500 bg-red-500/15 text-red-700 dark:text-red-300';
                      } else {
                        optionClasses +=
                          ' border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 opacity-60';
                      }
                    } else {
                      // Before selection
                      optionClasses +=
                        ' border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:border-violet-400 hover:bg-violet-500/5 cursor-pointer';
                    }

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelect(opt)}
                        disabled={selected !== null}
                        className={optionClasses}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation — appears after selecting an option */}
                {selected !== null && (
                  <>
                    <div className="mt-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-4 space-y-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {selected === practiceData.correct ? '✅ Correct!' : '❌ Incorrect'}
                      </p>
                      <div className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                        {practiceData.explanation}
                      </div>
                    </div>

                    {/* Next button */}
                    <button
                      type="button"
                      onClick={onNext}
                      className="w-full mt-3 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    >
                      Next Word →
                    </button>
                  </>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Empty state when no practice data and no attempts yet */}
        {!practiceData && mode === 'practice' && attempts === 0 && (
          <div className="space-y-2">
            {speakModeEnabled ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-zinc-200">Speak the hidden word or phrase</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${isSpeechListening ? 'bg-emerald-500' : 'bg-zinc-500'}`}
                      aria-hidden="true"
                    />
                    {speechTranscript && (
                      <button
                        type="button"
                        onClick={onClearSpeechTranscript}
                        className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        title="Clear transcript"
                        aria-label="Clear transcript"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-2 flex h-4 items-end gap-1" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((bar) => (
                    <span
                      key={bar}
                      className={`w-1 rounded-sm bg-violet-500/80 transition-all duration-150 ${isSpeechActive ? 'animate-pulse' : ''}`}
                      style={{ height: isSpeechActive ? `${8 + ((bar % 3) + 1) * 3}px` : '5px' }}
                    />
                  ))}
                </div>

                <div className="min-h-10 rounded border border-dashed border-slate-300 bg-white/70 px-2 py-1.5 text-[11px] text-slate-700 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200">
                  {speechTranscript || 'Listening… (or type directly in the PDF box)'}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => currentPracticeWord && speakText(currentPracticeWord)}
                    disabled={!currentPracticeWord}
                    className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    Play word
                  </button>
                  <button
                    type="button"
                    onClick={() => currentPracticeSentence && speakText(currentPracticeSentence)}
                    disabled={!currentPracticeSentence}
                    className="inline-flex items-center justify-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    Play sentence
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 dark:text-zinc-400">
                  Transcript auto-clears after ~2s pause if there is no match.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-slate-400 dark:text-zinc-500 text-center leading-relaxed">
                <><span>Type in the overlay on the PDF</span><br /><span>to guess the word…</span></>
              </div>
            )}
          </div>
        )}
      </div>

      {mode === 'practice' && totalBatches > 0 && (
        <div className="border-t border-slate-200 dark:border-zinc-800 px-3 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Batch Progress
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: totalBatches }, (_, batchIndex) => {
              const fillRatio = getBatchFillRatio(batchIndex);
              const isPastOrCurrent = batchIndex <= currentBatchIndex;
              const radius = 14;
              const circumference = 2 * Math.PI * radius;
              const clampedFill = Math.max(0, Math.min(1, fillRatio));
              const dashOffset = circumference * (1 - clampedFill);

              return (
                <button
                  key={batchIndex}
                  type="button"
                  disabled={!isPastOrCurrent}
                  onClick={() => onBatchSelect?.(batchIndex * batchSize)}
                  title={`Batch ${batchIndex + 1}`}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    isPastOrCurrent
                      ? 'hover:bg-violet-500/10'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
                    <circle
                      cx="16"
                      cy="16"
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-slate-300 dark:text-zinc-700"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r={radius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      className={isPastOrCurrent ? 'text-violet-500' : 'text-slate-400 dark:text-zinc-600'}
                    />
                  </svg>
                  <span className={`relative z-10 text-[10px] font-semibold ${isPastOrCurrent ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-zinc-500'}`}>
                    {batchIndex + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
