import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HistoryEntry } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { api } from '../../lib/api';

interface TabSearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

export function TabSearchPopup({ isOpen, onClose, anchorRect }: TabSearchPopupProps) {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const isVerticalTabs = useBrowserStore((s) => s.sidebarOpen && s.sidebarPanel === 'tabs');
  const {
    activateTab,
    closeTab,
    createTab,
    reopenClosedTab,
    toggleVerticalTabs,
    openSettings,
    newIncognitoWindow,
  } = useBrowserStore();

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    let active = true;
    void api.history.list('').then((entries) => {
      if (active && Array.isArray(entries)) {
        const openUrls = new Set(tabs.map((t) => t.url));
        const closed = entries.filter((e) => !openUrls.has(e.url) && e.url.startsWith('http')).slice(0, 5);
        setRecentHistory(closed);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, tabs]);

  if (!isOpen) return null;

  const q = search.trim().toLowerCase();
  const filteredTabs = tabs.filter(
    (t) => !q || t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q),
  );
  const filteredHistory = recentHistory.filter(
    (h) => !q || h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q),
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(0, filteredTabs.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTabs[selectedIndex]) {
        activateTab(filteredTabs[selectedIndex].id);
        onClose();
      } else if (q) {
        createTab(search);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const rightPos = anchorRect ? Math.max(16, window.innerWidth - anchorRect.right) : 24;
  const topPos = anchorRect ? anchorRect.bottom + 8 : 60;

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
        className="absolute w-[340px] max-h-[480px] glass-panel border border-white/15 rounded-2xl p-2.5 shadow-2xl flex flex-col gap-2 animate-menu-in"
        style={{
          right: `${rightPos}px`,
          top: `${topPos}px`,
          background: 'color-mix(in srgb, var(--color-surface-solid, #1e1914) 96%, var(--app-bg))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="relative flex items-center">
          <div className="absolute left-3 text-[var(--color-text-secondary)] pointer-events-none flex items-center">
            <Icon name="search" size={14} strokeWidth={2} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search open tabs & history..."
            className="w-full h-9 pl-9 pr-8 bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12]
              border border-white/[0.08] focus:border-white/20 rounded-full
              text-[12px] font-medium outline-none text-[var(--color-text-primary)]
              placeholder:text-[var(--color-text-secondary)]/60 transition-all"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 w-4 h-4 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10"
            >
              <Icon name="x" size={12} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Quick Mode Switcher Strip */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Icon name="sidebar" size={14} strokeWidth={1.8} className="text-[var(--theme-primary)]" />
            <span className="text-[12px] font-medium text-[var(--color-text-primary)]">
              Vertical Tabs
            </span>
          </div>
          <button
            onClick={() => {
              toggleVerticalTabs();
              onClose();
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              isVerticalTabs
                ? 'bg-[var(--theme-primary)] text-black shadow-sm'
                : 'bg-white/[0.08] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.12]'
            }`}
          >
            {isVerticalTabs ? 'Enabled' : 'Turn On'}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {/* Open Tabs */}
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-[10.5px] uppercase font-semibold text-[var(--color-text-secondary)]/60 tracking-wider">
              <span>Open Tabs</span>
              <span>{filteredTabs.length}</span>
            </div>
            <div className="space-y-0.5 mt-0.5">
              {filteredTabs.map((tab, idx) => {
                const isActive = tab.id === activeTabId;
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={tab.id}
                    onClick={() => {
                      activateTab(tab.id);
                      onClose();
                    }}
                    className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${
                      isSelected || isActive
                        ? 'bg-white/[0.14] text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                      {tab.favicon ? (
                        <img
                          src={tab.favicon}
                          alt=""
                          className="w-3.5 h-3.5 object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Icon name="globe" size={12} strokeWidth={1.8} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium leading-tight truncate">
                        {tab.title || 'New Tab'}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]/60 truncate">
                        {tab.url.replace(/^https?:\/\//, '')}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-white/20 text-[var(--color-text-primary)] transition-all"
                      title="Close tab"
                    >
                      <Icon name="x" size={11} strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recently Closed Tabs */}
          {filteredHistory.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10.5px] uppercase font-semibold text-[var(--color-text-secondary)]/60 tracking-wider">
                Recently Closed
              </div>
              <div className="space-y-0.5 mt-0.5">
                {filteredHistory.map((item) => (
                  <div
                    key={`${item.id}-${item.url}`}
                    onClick={() => {
                      createTab(item.url);
                      onClose();
                    }}
                    className="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-white/[0.06] transition-all"
                  >
                    <div className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0 text-[var(--color-text-secondary)]">
                      <Icon name="globe" size={12} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                        {item.title || item.url}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]/50 truncate">
                        {item.url.replace(/^https?:\/\//, '')}
                      </div>
                    </div>
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--theme-primary)] font-medium shrink-0 px-1.5 py-0.5 rounded bg-white/[0.06]">
                      Reopen
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-white/[0.08] grid grid-cols-3 gap-1 text-[11px]">
          <button
            onClick={() => {
              createTab();
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-colors"
          >
            <Icon name="plus" size={12} />
            <span>New Tab</span>
          </button>

          <button
            onClick={() => {
              newIncognitoWindow();
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-colors"
          >
            <Icon name="eye-slash" size={12} />
            <span>Private</span>
          </button>

          <button
            onClick={() => {
              openSettings();
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06] transition-colors"
          >
            <Icon name="gear" size={12} />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
