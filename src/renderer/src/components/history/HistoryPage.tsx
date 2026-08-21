import { useEffect, useState, useMemo } from 'react';
import { api } from '../../lib/api';
import { Icon } from '../common/Icon';
import type { HistoryEntry } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    fetchHistory();
  }, [query, timeFilter]);

  const fetchHistory = async () => {
    const list = await api.history.list(query, 500);
    const now = Date.now();
    let filtered = list;
    if (timeFilter === 'today') {
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      filtered = list.filter((e: HistoryEntry) => e.visitedAt >= startOfDay);
    } else if (timeFilter === 'week') {
      const startOfWeek = now - 7 * 24 * 60 * 60 * 1000;
      filtered = list.filter((e: HistoryEntry) => e.visitedAt >= startOfWeek);
    } else if (timeFilter === 'month') {
      const startOfMonth = now - 30 * 24 * 60 * 60 * 1000;
      filtered = list.filter((e: HistoryEntry) => e.visitedAt >= startOfMonth);
    }
    setEntries(filtered);
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all history?')) {
      await api.history.clear();
      fetchHistory();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await api.history.remove(id);
    setEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const groupedEntries = useMemo(() => {
    const groups: { [date: string]: HistoryEntry[] } = {};
    entries.forEach(entry => {
      const date = new Date(entry.visitedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateString = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (date.toDateString() === today.toDateString()) {
        dateString = 'Today - ' + dateString;
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateString = 'Yesterday - ' + dateString;
      }

      if (!groups[dateString]) {
        groups[dateString] = [];
      }
      groups[dateString].push(entry);
    });
    return groups;
  }, [entries]);

  const handleEntryClick = (url: string) => {
    useBrowserStore.getState().navigateActive(url);
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden text-[var(--color-text-primary)]">
      <div className="flex-none px-8 py-6 max-w-4xl w-full mx-auto flex items-center justify-between mt-12">
        <h1 className="text-3xl font-semibold">History</h1>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-text-secondary)]">
              <Icon name="search" size={16} />
            </div>
            <input
              type="text"
              className="pl-9 pr-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-sm focus:outline-none focus:border-white/[0.2] transition-colors w-64"
              placeholder="Search history"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            onClick={handleClearAll}
            className="px-4 py-1.5 text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-full transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="flex-none px-8 pb-4 max-w-4xl w-full mx-auto flex gap-6 border-b border-white/[0.06] text-sm font-medium">
        {(['all', 'today', 'week', 'month'] as const).map(f => (
          <button
            key={f}
            onClick={() => setTimeFilter(f)}
            className={`pb-4 border-b-2 transition-colors ${
              timeFilter === f
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {f === 'all' ? 'All time' : f === 'today' ? 'Today' : f === 'week' ? 'Last 7 days' : 'Last 30 days'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto px-8 py-6">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--color-text-secondary)]">
              <Icon name="clock" size={48} className="mb-4 opacity-50" />
              <p className="text-lg">No history found</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedEntries).map(([date, group]) => (
                <div key={date} className="glass-panel rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                  <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between sticky top-0 backdrop-blur-xl z-10">
                    <h2 className="font-medium text-sm text-[var(--color-text-secondary)]">{date}</h2>
                    <span className="text-xs text-[var(--color-text-secondary)]">{group.length} items</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {group.map((entry) => {
                      const domain = entry.domain || new URL(entry.url).hostname;
                      const initial = domain.charAt(0).toUpperCase();
                      const time = new Date(entry.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      
                      return (
                        <div
                          key={entry.id}
                          className="group flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
                          onClick={() => handleEntryClick(entry.url)}
                        >
                          <div className="flex-none w-16 text-xs text-[var(--color-text-secondary)] text-right">
                            {time}
                          </div>
                          
                          <div className="flex-none w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-semibold text-sm">
                            {initial}
                          </div>
                          
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{entry.title || entry.url}</span>
                              {entry.visitCount > 1 && (
                                <span className="flex-none px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-[var(--color-text-secondary)]">
                                  {entry.visitCount}x
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--color-text-secondary)] truncate">
                              {domain} • {entry.url}
                            </span>
                          </div>
                          
                          <button
                            onClick={(e) => handleDelete(e, entry.id)}
                            className="flex-none p-2 rounded-full hover:bg-white/10 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove from history"
                          >
                            <Icon name="x" size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
