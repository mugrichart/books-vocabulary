import React, { useState, useEffect } from 'react';


type Mode = 'capture' | 'practice';

export interface PracticeData {
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
  /** Data supplied after attempts are exhausted */
  practiceData?: PracticeData;
  /** Current attempt count (0–3) */
  attempts: number;
  /** Callback when an option is chosen */
  onOptionSelect?: (selected: string) => void;
  /** Callback when the user clicks "Next" to advance to the next word */
  onNext?: () => void;
}

export default function RightSidebar({ mode, setMode, practiceData, attempts, onOptionSelect, onNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  // Reset selection when practiceData changes (new word)
  useEffect(() => {
    setSelected(null);
  }, [practiceData]);

  const handleSelect = (opt: string) => {
    if (selected !== null) return; // ignore clicks after first selection
    setSelected(opt);
    onOptionSelect?.(opt);
  };

  return (
    <aside className="flex flex-col w-72 min-w-[280px] border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
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
      </div>

      {/* Middle section: attempts counter + options + explanation */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Attempt counter — visible during practice when options haven't appeared yet */}
        {mode === 'practice' && !practiceData && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
              Typing attempts
            </p>
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
          </div>
        )}

        {practiceData && (
          <div className="space-y-3">
            {/* Options — always visible once practiceData arrives */}
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
          </div>
        )}

        {/* Empty state when no practice data and no attempts yet */}
        {!practiceData && mode === 'practice' && attempts === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-slate-400 dark:text-zinc-500 text-center leading-relaxed">
            Type in the overlay on the PDF<br />to guess the word…
          </div>
        )}
      </div>
    </aside>
  );
}
