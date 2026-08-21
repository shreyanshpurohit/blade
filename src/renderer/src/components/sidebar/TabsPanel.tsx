import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HistoryEntry, TabState } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { api } from '../../lib/api';

export function TabsPanel() {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const {
    activateTab,
    closeTab,
    togglePin,
    toggleMute,
    hibernate,
    createTab,
    reopenClosedTab,
  } = useBrowserStore();

  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuTab, setMenuTab] = useState<TabState | null>(null);
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
  const [showRecentlyClosed, setShowRecentlyClosed] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Fetch recently visited / closed tabs for Chrome-style Tab Search
  useEffect(() => {
    let active = true;
    void api.history.list('').then((entries) => {
      if (active && Array.isArray(entries)) {
        // Filter out URLs that are currently open
        const openUrls = new Set(tabs.map((t) => t.url));
        const closed = entries.filter((e) => !openUrls.has(e.url) && e.url.startsWith('http')).slice(0, 5);
        setRecentHistory(closed);
      }
    });
    return () => {
      active = false;
    };
  }, [tabs]);

  const q = filter.trim().toLowerCase();
  const filtered = tabs.filter(
    (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.url.toLowerCase().includes(q),
  );

  const filteredHistory = recentHistory.filter(
    (h) =>
      !q ||
      h.title.toLowerCase().includes(q) ||
      h.url.toLowerCase().includes(q),
  );

  const pinned = filtered.filter((t) => t.pinned);
  const activeTabs = filtered.filter((t) => !t.pinned && !t.hibernated);
  const hibernatedTabs = filtered.filter((t) => !t.pinned && t.hibernated);
  const audibleTab = tabs.find((t) => t.audible);

  // Keyboard navigation across tabs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        activateTab(filtered[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      if (filter) {
        setFilter('');
      } else {
        searchInputRef.current?.blur();
      }
    }
  };

  const handleActivate = (id: string) => {
    activateTab(id);
  };

  const openCtx = (e: React.MouseEvent, tab: TabState) => {
    e.preventDefault();
    e.stopPropagation();
    void api.tabs.showContextMenu(tab.id, { x: e.clientX, y: e.clientY });
  };

  const closeCtx = () => {
    setMenuOpen(false);
    setMenuTab(null);
  };

  const closeOtherTabs = (currentTabId: string) => {
    tabs.forEach((t) => {
      if (t.id !== currentTabId && !t.pinned) {
        closeTab(t.id);
      }
    });
    closeCtx();
  };

  const closeTabsBelow = (currentTabId: string) => {
    const idx = tabs.findIndex((t) => t.id === currentTabId);
    if (idx !== -1) {
      tabs.slice(idx + 1).forEach((t) => {
        if (!t.pinned) closeTab(t.id);
      });
    }
    closeCtx();
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  return (
    <div className="flex flex-col h-full -mx-3 -mt-3 select-none">
      {/* ── Chrome-Style Tab Search Omnibox Header ── */}
      <div className="p-3 pb-2 border-b border-white/[0.06] flex flex-col gap-2">
        <div className="relative flex items-center">
          <div className="absolute left-3 text-[var(--color-text-secondary)] pointer-events-none flex items-center">
            <Icon name="search" size={14} strokeWidth={2} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tabs..."
            className="w-full h-9 pl-9 pr-8 bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12]
              border border-white/[0.08] focus:border-white/20 rounded-full
              text-[12px] font-medium outline-none text-[var(--color-text-primary)]
              placeholder:text-[var(--color-text-secondary)]/60 transition-all duration-150"
          />
          {filter ? (
            <button
              onClick={() => {
                setFilter('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 w-4 h-4 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10"
              title="Clear search"
            >
              <Icon name="x" size={12} strokeWidth={2} />
            </button>
          ) : (
            <span className="absolute right-3 text-[10px] font-semibold text-[var(--color-text-secondary)]/40 tracking-wider">
              {tabs.length}
            </span>
          )}
        </div>

        {/* Action strip: New Tab & Audio Quick-jump */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <button
            onClick={() => createTab()}
            className="flex-1 flex items-center justify-center gap-1.5 h-7 px-3 rounded-full
              bg-white/[0.05] hover:bg-white/[0.10] active:bg-white/[0.14]
              border border-white/[0.06] text-[var(--color-text-primary)]
              text-[11px] font-medium transition-all duration-150"
            title="New Tab (Ctrl+T)"
          >
            <Icon name="plus" size={12} strokeWidth={2.2} />
            <span>New tab</span>
          </button>

          {audibleTab && (
            <button
              onClick={() => activateTab(audibleTab.id)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-full
                bg-[var(--theme-primary-soft)] border border-white/10
                text-[var(--theme-primary)] hover:bg-[var(--theme-primary-soft)]/80
                text-[11px] font-medium transition-all duration-150 shrink-0 animate-pulse"
              title={`Switch to tab playing audio: ${audibleTab.title}`}
            >
              <Icon name={audibleTab.muted ? 'speaker-slash' : 'speaker'} size={12} strokeWidth={2} />
              <span className="max-w-[70px] truncate">Playing</span>
            </button>
          )}

          <button
            onClick={() => reopenClosedTab()}
            className="flex items-center justify-center w-7 h-7 rounded-full
              bg-white/[0.05] hover:bg-white/[0.10] active:bg-white/[0.14]
              border border-white/[0.06] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
              transition-all duration-150 shrink-0"
            title="Reopen closed tab (Ctrl+Shift+T)"
          >
            <Icon name="arrow-clockwise" size={12} strokeWidth={2} />
          </button>

          <button
            onClick={() => useBrowserStore.getState().toggleVerticalTabs()}
            className="flex items-center justify-center w-7 h-7 rounded-full
              bg-white/[0.05] hover:bg-white/[0.10] active:bg-white/[0.14]
              border border-white/[0.06] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
              transition-all duration-150 shrink-0"
            title="Switch to horizontal tabs"
          >
            <Icon name="layout-grid" size={12} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── Tabs List (Chrome Material 3 Style) ── */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
        {/* Pinned Tabs Section */}
        {pinned.length > 0 && (
          <Section title="Pinned Tabs" count={pinned.length} icon="pin">
            {pinned.map((t) => (
              <ChromeTabItem
                key={t.id}
                tab={t}
                isActive={t.id === activeTabId}
                domain={getDomain(t.url)}
                onActivate={handleActivate}
                onClose={closeTab}
                onToggleMute={toggleMute}
                onContextMenu={openCtx}
              />
            ))}
          </Section>
        )}

        {/* Open Tabs Section */}
        {activeTabs.length > 0 && (
          <Section title="Open Tabs" count={activeTabs.length} icon="layers">
            {activeTabs.map((t) => (
              <ChromeTabItem
                key={t.id}
                tab={t}
                isActive={t.id === activeTabId}
                domain={getDomain(t.url)}
                onActivate={handleActivate}
                onClose={closeTab}
                onToggleMute={toggleMute}
                onContextMenu={openCtx}
              />
            ))}
          </Section>
        )}

        {/* Hibernated / Memory Saver Tabs Section */}
        {hibernatedTabs.length > 0 && (
          <Section title="Memory Saver (Sleeping)" count={hibernatedTabs.length} icon="moon">
            {hibernatedTabs.map((t) => (
              <ChromeTabItem
                key={t.id}
                tab={t}
                isActive={t.id === activeTabId}
                domain={getDomain(t.url)}
                onActivate={handleActivate}
                onClose={closeTab}
                onToggleMute={toggleMute}
                onContextMenu={openCtx}
                isHibernated
              />
            ))}
          </Section>
        )}

        {/* Recently Closed Tabs Section (Chrome Tab Search Feature) */}
        {filteredHistory.length > 0 && (
          <div className="pt-1">
            <div
              onClick={() => setShowRecentlyClosed(!showRecentlyClosed)}
              className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider
                text-[var(--color-text-secondary)]/70 hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Icon name="clock" size={12} strokeWidth={2} />
                <span>Recently Closed</span>
              </div>
              <Icon
                name={showRecentlyClosed ? 'chevron-down' : 'chevron-right'}
                size={12}
                strokeWidth={2}
                className="opacity-60"
              />
            </div>

            {showRecentlyClosed && (
              <div className="flex flex-col gap-0.5 mt-1">
                {filteredHistory.map((item) => (
                  <div
                    key={`${item.id}-${item.url}`}
                    onClick={() => createTab(item.url)}
                    className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer
                      hover:bg-white/[0.06] transition-all duration-150"
                  >
                    <div className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0 text-[var(--color-text-secondary)]">
                      <Icon name="globe" size={12} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                        {item.title || item.url}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]/50 truncate">
                        {getDomain(item.url)}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--theme-primary)] font-medium shrink-0 px-2 py-0.5 rounded bg-white/[0.06]">
                      Reopen
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty Search State */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center text-[var(--color-text-secondary)]/60 mb-2">
              <Icon name="search" size={18} strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">No matching tabs</p>
            <p className="text-[11px] text-[var(--color-text-secondary)]/60 mt-0.5">
              Press enter or click below to search the web
            </p>
            <button
              onClick={() => createTab(filter)}
              className="mt-3 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-[12px] font-medium text-[var(--color-text-primary)] transition-all"
            >
              Open "{filter}" in new tab
            </button>
          </div>
        )}
      </div>

      {/* ── Chrome-Style Context Menu Portal ── */}
      {menuOpen && menuTab && createPortal((
        <div
          className="fixed inset-0 z-50 select-none"
          onClick={closeCtx}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeCtx();
          }}
        >
          <div
            className="absolute glass-panel p-1.5 min-w-[190px] z-50 rounded-2xl shadow-2xl border border-white/15 animate-menu-in"
            style={{ left: menuPos.x, top: menuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <CtxItem
              label={menuTab.pinned ? 'Unpin tab' : 'Pin tab'}
              icon="pin"
              onClick={() => {
                togglePin(menuTab.id);
                closeCtx();
              }}
            />
            <CtxItem
              label="Duplicate tab"
              icon="copy"
              onClick={() => {
                createTab(menuTab.url);
                closeCtx();
              }}
            />
            <CtxItem
              label={menuTab.muted ? 'Unmute tab' : 'Mute tab'}
              icon={menuTab.muted ? 'speaker' : 'speaker-slash'}
              onClick={() => {
                toggleMute(menuTab.id);
                closeCtx();
              }}
            />
            <CtxItem
              label={menuTab.hibernated ? 'Wake tab' : 'Hibernate tab'}
              icon="moon"
              onClick={() => {
                hibernate(menuTab.id);
                closeCtx();
              }}
            />
            <div className="my-1 h-px bg-white/[0.08] mx-1.5" />
            <CtxItem
              label="Close tab"
              icon="x"
              onClick={() => {
                closeTab(menuTab.id);
                closeCtx();
              }}
            />
            <CtxItem
              label="Close other tabs"
              icon="trash"
              onClick={() => closeOtherTabs(menuTab.id)}
            />
            <CtxItem
              label="Close tabs to the right"
              icon="chevron-right"
              onClick={() => closeTabsBelow(menuTab.id)}
            />
            <div className="my-1 h-px bg-white/[0.08] mx-1.5" />
            <CtxItem
              label="Switch to horizontal tabs"
              icon="layout-grid"
              onClick={() => {
                useBrowserStore.getState().toggleVerticalTabs();
                closeCtx();
              }}
            />
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

/* ── Section Header (Chrome Style) ── */
function Section({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]/70">
        <Icon name={icon as any} size={11} strokeWidth={2} className="opacity-70" />
        <span>{title}</span>
        <span className="text-[10px] text-[var(--color-text-secondary)]/50 ml-auto font-normal">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 mt-0.5">{children}</div>
    </div>
  );
}

/* ── Chrome Tab Item ── */
function ChromeTabItem({
  tab,
  isActive,
  domain,
  onActivate,
  onClose,
  onToggleMute,
  onContextMenu,
  isHibernated,
}: {
  tab: TabState;
  isActive: boolean;
  domain: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onToggleMute: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, tab: TabState) => void;
  isHibernated?: boolean;
}) {
  const isSettings = tab.url.startsWith('lumen://settings');
  const isNewTab = tab.url === 'lumen://newtab' || tab.url === 'about:newtab';

  return (
    <div
      onClick={() => onActivate(tab.id)}
      onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
      onContextMenu={(e) => onContextMenu(e, tab)}
      className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer
        transition-all duration-150 select-none
        ${
          isActive
            ? 'bg-white/[0.14] text-[var(--color-text-primary)] shadow-sm'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.07]'
        }
        ${isHibernated ? 'opacity-60 hover:opacity-90' : ''}
      `}
    >
      {/* Active Tab Left Pill Indicator */}
      {isActive && (
        <div className="absolute left-0.5 top-2.5 bottom-2.5 w-1 rounded-full bg-[var(--theme-primary,white)]" />
      )}

      {/* Favicon Container */}
      <div
        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 overflow-hidden transition-all ${
          isActive
            ? 'bg-white/[0.12] text-[var(--color-text-primary)]'
            : 'bg-white/[0.06] text-[var(--color-text-secondary)]'
        }`}
      >
        {tab.isLoading ? (
          <div className="w-3.5 h-3.5 border-[1.5px] border-[var(--color-text-secondary)] border-t-transparent animate-spin rounded-full" />
        ) : isSettings ? (
          <Icon name="sliders" size={13} strokeWidth={1.8} />
        ) : isNewTab ? (
          <Icon name="plus" size={13} strokeWidth={1.8} />
        ) : tab.favicon ? (
          <img
            src={tab.favicon}
            alt=""
            className="w-4 h-4 rounded-sm object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <Icon name="globe" size={13} strokeWidth={1.8} />
        )}
      </div>

      {/* Tab Title & Domain Meta */}
      <div className="flex-1 min-w-0 pr-1">
        <div
          className={`text-[12.5px] font-medium leading-snug truncate ${
            isActive
              ? 'text-[var(--color-text-primary)] font-semibold'
              : 'text-[var(--color-text-primary)]/90 group-hover:text-[var(--color-text-primary)]'
          }`}
        >
          {tab.title || 'New Tab'}
        </div>
        <div className="text-[10.5px] text-[var(--color-text-secondary)]/70 truncate flex items-center gap-1.5 mt-0.5">
          <span>{domain}</span>
          {tab.pinned && (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-[var(--theme-primary)]">
              • Pinned
            </span>
          )}
          {isHibernated && (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] text-amber-300/80">
              • Sleeping
            </span>
          )}
          {tab.audible && (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] text-emerald-400">
              • {tab.muted ? 'Muted' : 'Audio'}
            </span>
          )}
        </div>
      </div>

      {/* Audio / Mute Quick Button */}
      {tab.audible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute(tab.id);
          }}
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            tab.muted
              ? 'text-red-400 hover:bg-white/15'
              : 'text-emerald-400 hover:bg-white/15'
          }`}
          title={tab.muted ? 'Unmute tab' : 'Mute tab'}
        >
          <Icon name={tab.muted ? 'speaker-slash' : 'speaker'} size={12} strokeWidth={2} />
        </button>
      )}

      {/* Chrome Circular Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
          isActive
            ? 'opacity-70 hover:opacity-100 hover:bg-white/20 text-[var(--color-text-primary)]'
            : 'opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-white/20 text-[var(--color-text-primary)]'
        }`}
        title="Close tab"
      >
        <Icon name="x" size={12} strokeWidth={2.2} />
      </button>
    </div>
  );
}

/* ── Context Menu Item ── */
function CtxItem({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-1.5 text-[12px] font-medium rounded-xl transition-colors
        flex items-center gap-2.5
        ${
          danger
            ? 'text-[var(--color-destructive)] hover:bg-red-500/15'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10'
        }`}
    >
      <Icon name={icon as any} size={13} strokeWidth={1.8} className="shrink-0 opacity-80" />
      <span>{label}</span>
    </button>
  );
}
