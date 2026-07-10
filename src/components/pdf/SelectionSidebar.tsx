import { type CaptureItem } from './usePdfSelections';

interface Props {
  items: CaptureItem[];
  isLoadingText: boolean;
  onRemoveItem: (id: string) => void;
  // highlightQuery is no longer strictly needed if you want to simplify,
  // but keeping it here for your existing UI logic:
  highlightQuery: (sentence: string, query: string) => string[];
}

export default function SelectionSidebar({
  items,
  isLoadingText,
  onRemoveItem,
  highlightQuery,
}: Props) {
  return (
    <aside className="w-[340px] min-w-[280px] overflow-y-auto border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
            Selected words
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Highlighted expressions ready for practice.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-zinc-400">
          {items.length}
        </span>
      </div>

      {/* Loading & Empty States */}
      {isLoadingText && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-4 text-sm text-slate-500">
          Extracting context...
        </div>
      )}

      {!isLoadingText && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 p-4 text-sm text-slate-600 dark:text-zinc-400">
          Highlight a word in the PDF to capture it.
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                {/* pageIndex is 0-based, add 1 for display */}
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">
                  Page {item.pageIndex + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {item.word}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveItem(item.id)}
                className="rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-slate-500 hover:text-red-500 transition"
                aria-label={`Remove ${item.word}`}
              >
                ×
              </button>
            </div>
            <p className="text-sm leading-6 text-slate-700 dark:text-zinc-300">
              {highlightQuery(item.sentence, item.word).map((part, index) =>
                index % 2 === 1 ? (
                  <mark key={`${item.id}-${index}`} className="rounded bg-yellow-200 dark:bg-yellow-900/50 px-0.5 text-inherit">
                    {part}
                  </mark>
                ) : (
                  <span key={`${item.id}-${index}`}>{part}</span>
                )
              )}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}