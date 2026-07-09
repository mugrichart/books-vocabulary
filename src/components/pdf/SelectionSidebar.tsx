import { type ReactNode } from 'react';

export interface SelectionItem {
  id: string;
  page: number;
  query: string;
  sentence: string;
}

interface Props {
  items: SelectionItem[];
  isLoadingText: boolean;
  onRemoveItem: (id: string) => void;
  highlightQuery: (sentence: string, query: string) => string[];
}

export default function SelectionSidebar({
  items,
  isLoadingText,
  onRemoveItem,
  highlightQuery,
}: Props) {
  return (
    <aside className="w-[340px] min-w-[280px] overflow-y-auto border-r border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Selected words & expressions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select a word or phrase in the PDF to capture its sentence and keep it in the sidebar.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {items.length}
        </span>
      </div>

      {isLoadingText ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Loading PDF text for sentence extraction...
        </div>
      ) : null}

      {items.length === 0 && !isLoadingText ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          No selection yet. Highlight a word or phrase inside the PDF viewer to add it here.
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Page {item.page}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.query}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveItem(item.id)}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label={`Remove selection ${item.query}`}
              >
                ×
              </button>
            </div>
            <p className="text-sm leading-6 text-slate-700">
              {highlightQuery(item.sentence, item.query).map((part, index) =>
                index % 2 === 1 ? (
                  <mark key={`${item.id}-${index}`} className="rounded bg-yellow-200 px-0.5">
                    {part}
                  </mark>
                ) : (
                  <span key={`${item.id}-${index}`}>{part}</span>
                ),
              )}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}
