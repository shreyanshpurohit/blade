import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HistoryEntry } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { api } from '../../lib/api';
import { Icon } from '../common/Icon';

interface HistoryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  anchorPos?: { x: number; y: number } | null;
}

export function HistoryPopup({ isOpen, onClose, anchorRect, anchorPos }: HistoryPopupProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { createTab, openSettings, clearBrowsingData } = useBrowserStore();

  const fetchHistory = (query = '') => {
    setLoading(true);
    void api.history.list(query).then((items) => {
      if (Array.isArray(items)) {
        setHistory(items.slice(0, 30));
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchHistory(search);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, [isOpen, search]);

  if (!isOpen) return null;

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    void api.history.remove(id).then(() => {
      setHistory((prev) => prev.filter((item) => item.id !== id));
    });
  };

  const rightPos = anchorPos
    ? Math.max(16, window.innerWidth - anchorPos.x)
    : anchorRect
    ? Math.max(16, window.innerWidth - anchorRect.right)
    : 20;
  const topPos = anchorPos ? anchorPos.y + 8 : anchorRect ? anchorRect.bottom + 8 : 56;

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 select-none pointer-events-auto"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute w-[340px] max-h-[580px] glass-panel border border-white/15 rounded-2xl p-3 shadow-2xl flex flex-col gap-2.5 animate-menu-in"
        style={{
          right: `${rightPos}px`,
          top: `${topPos}px`,
          background: 'color-mix(in srgb, var(--color-surface-solid, #1e1914) 96%, var(--app-bg))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header & Search ── */}
        <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/80">
              <Icon name="clock" size={13} strokeWidth={2} />
            </div>
            <span className="text-[13px] font-semibold text-white">History</span>
          </div>
          <button
            onClick={() => {
              openSettings('history');
              onClose();
            }}
            className="text-[11px] text-[var(--theme-primary)] hover:underline font-medium"
          >
            Show full history (Ctrl+H)
          </button>
        </div>

        {/* ── Search Input ── */}
        <div className="relative flex items-center">
          <div className="absolute left-3 text-white/40 pointer-events-none flex items-center">
            <Icon name="search" size={12} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recent history..."
            className="w-full h-8 pl-8 pr-7 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12]
              border border-white/[0.08] focus:border-[var(--theme-primary)]
              text-[11.5px] font-medium outline-none text-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 w-4 h-4 rounded-full flex items-center justify-center text-white/40 hover:text-white"
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </div>

        {/* ── History List ── */}
        <div className="flex-1 overflow-y-auto max-h-[360px] space-y-0.5 pr-0.5 custom-scrollbar">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                createTab(item.url);
                onClose();
              }}
              className="group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer
                hover:bg-white/[0.08] transition-colors text-[11.5px]"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-white/40">
                  <Icon name="globe" size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white/90 truncate font-medium">{item.title || item.url}</div>
                  <div className="text-[10px] text-white/40 truncate">
                    {(() => {
                      try {
                        return new URL(item.url).hostname;
                      } catch {
                        return item.url;
                      }
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-[10px] text-white/35 group-hover:hidden font-mono">
                  {formatTime(item.visitedAt)}
                </span>
                <button
                  onClick={(e) => handleDelete(e, item.id)}
                  title="Remove from history"
                  className="hidden group-hover:flex w-5 h-5 rounded-full items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/10 transition-all"
                >
                  <Icon name="x" size={11} />
                </button>
              </div>
            </div>
          ))}

          {!loading && history.length === 0 && (
            <div className="py-8 text-center text-white/40 text-[12px]">
              {search ? 'No matching history found' : 'No recent history'}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
          <button
            onClick={() => {
              void clearBrowsingData();
              onClose();
            }}
            className="text-red-400/80 hover:text-red-300 transition-colors flex items-center gap-1"
          >
            <Icon name="trash" size={11} />
            <span>Clear browsing data...</span>
          </button>
          <button
            onClick={() => {
              openSettings('history');
              onClose();
            }}
            className="text-white/50 hover:text-white transition-colors"
          >
            Manage history
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
