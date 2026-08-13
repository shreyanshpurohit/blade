import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { HistoryEntry } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { SidebarContextMenu } from './SidebarContextMenu';

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [context, setContext] = useState<{ x: number; y: number; entry: HistoryEntry } | null>(null);
  const navigateActive = useBrowserStore((s) => s.navigateActive);
  const createTab = useBrowserStore((s) => s.createTab);

  useEffect(() => {
    const t = setTimeout(() => {
      void api.history.list(query).then((h) => setEntries(h as HistoryEntry[]));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  // Group by day
  const grouped = groupByDay(entries);

  const removeEntry = (id: number) => {
    void api.history.remove(id).then(() => {
      setEntries((current) => current.filter((entry) => entry.id !== id));
    });
  };

  return (
    <div className="flex flex-col gap-2 history-panel">
      <div className="flex items-center gap-2 px-1 py-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history…"
          className="flex-1 glass-control px-2.5 py-1.5 text-[12px] outline-none text-[var(--color-text-primary)]"
        />
        <button
          onClick={() => void api.history.clear().then(() => setEntries([]))}
          className="history-clear text-[11px] px-2 py-1.5 rounded-lg border transition-colors"
        >
          Clear
        </button>
      </div>
      {[...grouped.entries()].map(([day, items]) => (
        <div key={day} className="history-day">
          <div className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{day}</div>
          <div className="flex flex-col gap-1">
            {items.map((h) => (
              <div
                key={h.id}
                className="history-entry group flex items-center gap-2 px-2 py-2 rounded-xl transition-colors"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContext({ x: event.clientX, y: event.clientY, entry: h });
                }}
              >
                <button
                  onClick={() => navigateActive(h.url)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span className="history-favicon shrink-0 grid place-items-center w-7 h-7 rounded-lg">
                    <Icon name="globe" size={14} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-[var(--color-text-primary)] truncate">{h.title || h.url}</span>
                    <span className="block text-[10px] text-[var(--color-text-secondary)] truncate">
                      {new Date(h.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {h.domain || getDomain(h.url)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  title="Remove from history"
                  aria-label={`Remove ${h.title || h.url} from history`}
                  onClick={() => removeEntry(h.id)}
                  className="history-entry-remove shrink-0 grid place-items-center w-7 h-7 rounded-lg text-[var(--color-text-secondary)] transition-all"
                >
                  <Icon name="x" size={13} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-ui-body px-2 py-6 text-center opacity-60">No history found.</p>
      )}
      {context && (
        <SidebarContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            { label: 'Open in new tab', icon: 'plus', onClick: () => createTab(context.entry.url) },
            { label: 'Open here', icon: 'external', onClick: () => navigateActive(context.entry.url) },
            { label: 'Remove from history', icon: 'trash', danger: true, onClick: () => removeEntry(context.entry.id) },
          ]}
        />
      )}
    </div>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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
