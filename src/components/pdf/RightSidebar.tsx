import React from 'react';
import { FileText, ClipboardList } from 'lucide-react';

type Mode = 'capture' | 'practice';

interface Props {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export default function RightSidebar({ mode, setMode }: Props) {
  return (
    <aside className="flex flex-col w-16 min-w-[64px] items-center border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setMode('capture')}
          className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
            mode === 'capture' ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <FileText className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setMode('practice')}
          className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
            mode === 'practice' ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <ClipboardList className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
