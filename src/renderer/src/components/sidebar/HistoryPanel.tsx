import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { HistoryEntry } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const navigateActive = useBrowserStore((s) => s.navigateActive);

  useEffect(() => {
    const t = setTimeout(() => {
      void api.history.list(query).then((h) => setEntries(h as HistoryEntry[]));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  // Group by day
  const grouped = groupByDay(entries);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-1 py-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history…"
          className="flex-1 glass-control px-2.5 py-1.5 text-[12px] outline-none text-[var(--color-text-primary)]"
        />
        <button
          onClick={() => void api.history.clear().then(() => setEntries([]))}
          className="text-[11px] px-2 py-1.5 rounded-md text-red-500 hover:bg-red-500/10"
        >
          Clear
        </button>
      </div>
      {[...grouped.entries()].map(([day, items]) => (
        <div key={day}>
          <div className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{day}</div>
          {items.map((h) => (
            <button
              key={h.id}
              onClick={() => navigateActive(h.url)}
              className="w-full text-left px-2 py-1.5 rounded-glass-sm hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors duration-150"
            >
              <div className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{h.title || h.url}</div>
              <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
                {new Date(h.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {h.url}
              </div>
            </button>
          ))}
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-ui-body px-2 py-6 text-center opacity-60">No history found.</p>
      )}
    </div>
  );
}

function groupByDay(entries: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const map = new Map<string, HistoryEntry[]>();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  for (const e of entries) {
    const d = new Date(e.visitedAt).toDateString();
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : new Date(e.visitedAt).toLocaleDateString();
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  }
  return map;
}
