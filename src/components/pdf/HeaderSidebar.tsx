import React from 'react';

interface Props {
  title: string;
  onBack: () => void;
}

export default function HeaderSidebar({ title, onBack }: Props) {
  return (
    <aside className="flex flex-col w-64 min-w-[200px] h-full border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-zinc-100">
        {title}
      </h2>
    </aside>
  );
}
