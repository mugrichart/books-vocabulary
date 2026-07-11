import SelectionSidebar from './SelectionSidebar';
import HeaderSidebar from './HeaderSidebar';
import { type CaptureItem } from './usePdfSelections';

interface Props {
  mode: 'capture' | 'practice';
  items: CaptureItem[];
  activeItemId: string | null;
  isLoadingText: boolean;
  onRemoveItem: (id: string) => void;
  onResetPractice: () => void;
  highlightQuery: (sentence: string, query: string) => string[];
  title: string;
  onBack: () => void;
}

export default function LeftSidebar({
  mode,
  items,
  activeItemId,
  isLoadingText,
  onRemoveItem,
  onResetPractice,
  highlightQuery,
  title,
  onBack,
}: Props) {
  if (mode === 'practice') {
    return (
      <aside className="flex flex-col h-screen w-[340px] min-w-[280px] border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-4">Practice Mode</h2>
        <div className="flex-1 overflow-y-auto space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`p-3 border rounded-lg ${
                item.id === activeItemId
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-slate-200 dark:border-zinc-800'
              }`}
            >
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                {item.checked ? 'Done' : item.id === activeItemId ? 'Current' : 'Next'}: {item.word}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Page {item.pageIndex + 1}</p>
            </div>
          ))}
          {items.length > 0 && !activeItemId && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              All captured words are checked.
            </div>
          )}
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onResetPractice}
            className="w-full mt-4 rounded-lg border border-violet-500/40 bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Play Again
          </button>
        )}
      </aside>
    );
  }

  return (
    <SelectionSidebar
      items={items}
      isLoadingText={isLoadingText}
      onRemoveItem={onRemoveItem}
      highlightQuery={highlightQuery}
    />
  );
}
