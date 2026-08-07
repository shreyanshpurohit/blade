import { useState } from 'react';
import type { TabState } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';

export function TabsPanel() {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const { activateTab, closeTab, togglePin, toggleMute, hibernate, createTab, setSidebar } =
    useBrowserStore();

  const [filter, setFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [menuTab, setMenuTab] = useState<TabState | null>(null);

  const q = filter.toLowerCase();
  const filtered = tabs.filter(
    (t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q),
  );

  const pinned = filtered.filter((t) => t.pinned);
  const active = filtered.filter((t) => !t.pinned && !t.hibernated);
  const hibernated = filtered.filter((t) => !t.pinned && t.hibernated);

  const handleActivate = (id: string) => {
    activateTab(id);
  };

  const openCtx = (e: React.MouseEvent, tab: TabState) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuTab(tab);
    setMenuOpen(true);
  };

  const closeCtx = () => {
    setMenuOpen(false);
    setMenuTab(null);
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  return (
    <div className="flex flex-col gap-2 -mx-3 -mt-3">
      {/* Search */}
      <div className="px-3 pt-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search tabs…"
          className="w-full glass-control px-2.5 py-1.5 text-[12px] outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
        />
      </div>

      {/* Tab count */}
      <div className="px-4 text-[11px] text-[var(--color-text-secondary)] font-medium">
        {tabs.length} tab{tabs.length !== 1 ? 's' : ''} open
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {pinned.length > 0 && (
          <Section title="Pinned" count={pinned.length} icon="pin">
            {pinned.map((t) => (
              <TabItem
                key={t.id}
                tab={t}
                isActive={t.id === activeTabId}
                domain={getDomain(t.url)}
                onActivate={handleActivate}
                onClose={closeTab}
                onContextMenu={openCtx}
              />
            ))}
          </Section>
        )}

        {active.length > 0 && (
          <Section title="Tabs" count={active.length} icon="layers">
            {active.map((t) => (
              <TabItem
                key={t.id}
                tab={t}
                isActive={t.id === activeTabId}
                domain={getDomain(t.url)}
                onActivate={handleActivate}
                onClose={closeTab}
                onContextMenu={openCtx}
              />
            ))}
          </Section>
        )}

        {hibernated.length > 0 && (
          <Section title="Hibernated" count={hibernated.length} icon="moon">
            {hibernated.map((t) => (
              <TabItem
                key={t.id}
                tab={t}
                isActive={t.id === activeTabId}
                domain={getDomain(t.url)}
                onActivate={handleActivate}
                onClose={closeTab}
                onContextMenu={openCtx}
                dimmed
              />
            ))}
          </Section>
        )}

        {filtered.length === 0 && (
          <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-8 opacity-60">
            No matching tabs
          </p>
        )}
      </div>

      {/* New Tab button */}
      <div className="px-3 pb-3 pt-1">
        <button
          onClick={() => createTab()}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg
            bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.06]
            text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
            text-[12px] font-medium transition-all duration-200"
        >
          <Icon name="plus" size={14} strokeWidth={2} />
          New Tab
        </button>
      </div>

      {/* Context menu */}
      {menuOpen && menuTab && (
        <div className="fixed inset-0 z-50" onClick={closeCtx} onContextMenu={(e) => { e.preventDefault(); closeCtx(); }}>
          <div
            className="absolute glass-panel p-1.5 min-w-[180px] z-50 animate-menu-in"
            style={{ left: menuPos.x, top: menuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <CtxItem
              label={menuTab.pinned ? 'Unpin Tab' : 'Pin Tab'}
              icon={menuTab.pinned ? 'pin' : 'pin'}
              onClick={() => { togglePin(menuTab.id); closeCtx(); }}
            />
            <CtxItem
              label="Duplicate Tab"
              icon="copy"
              onClick={() => { createTab(menuTab.url); closeCtx(); }}
            />
            {menuTab.audible && (
              <CtxItem
                label={menuTab.muted ? 'Unmute Tab' : 'Mute Tab'}
                icon={menuTab.muted ? 'speaker' : 'speaker-slash'}
                onClick={() => { toggleMute(menuTab.id); closeCtx(); }}
              />
            )}
            <CtxItem
              label="Hibernate Tab"
              icon="moon"
              onClick={() => { hibernate(menuTab.id); closeCtx(); }}
            />
            <div className="my-1 h-px bg-white/[0.08] mx-2" />
            <CtxItem
              label="Close Tab"
              icon="x"
              onClick={() => { closeTab(menuTab.id); closeCtx(); }}
              danger
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section Header ── */
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
    <div className="mb-1">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Icon name={icon} size={12} strokeWidth={2} className="text-[var(--color-text-secondary)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {title}
        </span>
        <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60">
          {count}
        </span>
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

/* ── Tab Item ── */
function TabItem({
  tab,
  isActive,
  domain,
  onActivate,
  onClose,
  onContextMenu,
  dimmed,
}: {
  tab: TabState;
  isActive: boolean;
  domain: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, tab: TabState) => void;
  dimmed?: boolean;
}) {
  const isSettings = tab.url.startsWith('lumen://settings');
  const isNewTab = tab.url === 'lumen://newtab' || tab.url === 'about:newtab';

  return (
    <div
      onClick={() => onActivate(tab.id)}
      onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
      onContextMenu={(e) => onContextMenu(e, tab)}
      className={`group flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-all duration-150
        ${isActive
          ? 'bg-white/[0.10] border-l-2 border-[var(--color-accent,#e8c06a)]'
          : 'border-l-2 border-transparent hover:bg-white/[0.05]'
        }
        ${dimmed ? 'opacity-50' : ''}
      `}
    >
      {/* Favicon */}
      <div className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
        {tab.isLoading ? (
          <div className="w-3 h-3 border-[1.5px] border-[var(--color-text-secondary)] border-t-transparent animate-spin rounded-full" />
        ) : isSettings ? (
          <Icon name="sliders" size={12} strokeWidth={1.8} className="text-[var(--color-text-secondary)]" />
        ) : isNewTab ? (
          <Icon name="plus" size={12} strokeWidth={1.8} className="text-[var(--color-text-secondary)]" />
        ) : tab.favicon ? (
          <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
        ) : (
          <Icon name="globe" size={12} strokeWidth={1.8} className="text-[var(--color-text-secondary)]" />
        )}
      </div>

      {/* Title & URL */}
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-medium truncate ${
          isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
        }`}>
          {tab.title || 'New Tab'}
        </div>
        <div className="text-[10px] text-[var(--color-text-secondary)] truncate opacity-60">
          {domain}
        </div>
      </div>

      {/* Status indicators */}
      {tab.audible && (
        <Icon
          name={tab.muted ? 'speaker-slash' : 'speaker'}
          size={11}
          className="text-[var(--color-text-secondary)] shrink-0"
        />
      )}

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all hover:bg-white/15
          ${isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'}
        `}
      >
        <Icon name="x" size={10} strokeWidth={2} />
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
      className={`w-full text-left px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors
        flex items-center gap-2.5 hover:bg-white/10
        ${danger ? 'text-[var(--color-destructive)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
    >
      <Icon name={icon} size={13} strokeWidth={1.8} className="shrink-0" />
      {label}
    </button>
  );
}
