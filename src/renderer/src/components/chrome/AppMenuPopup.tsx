import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { api } from '../../lib/api';

interface AppMenuPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  anchorPos?: { x: number; y: number } | null;
}

type SubmenuId = 'history' | 'bookmarks' | 'save_share' | 'more_tools' | 'help' | null;

export function AppMenuPopup({ isOpen, onClose, anchorRect, anchorPos }: AppMenuPopupProps) {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const activeTab = useBrowserStore((s) => s.activeTab());
  const bookmarksBarVisible = useBrowserStore((s) => s.bookmarksBarVisible);
  const activeBookmarked = useBrowserStore((s) => s.activeBookmarked);

  const [search, setSearch] = useState('');
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [zoomPercent, setZoomPercent] = useState(() => Math.round((activeTab?.zoomFactor ?? 1) * 100));

  useEffect(() => {
    if (activeTab?.zoomFactor !== undefined) {
      setZoomPercent(Math.round(activeTab.zoomFactor * 100));
    }
  }, [activeTab?.zoomFactor]);

  if (!isOpen) return null;

  const rawX = anchorPos && anchorPos.x > 0 ? anchorPos.x : anchorRect ? anchorRect.right : window.innerWidth - 20;
  const rawY = anchorPos && anchorPos.y > 0 ? anchorPos.y : anchorRect ? anchorRect.bottom : 56;

  const rightPos = Math.max(12, window.innerWidth - rawX);
  const topPos = Math.max(8, rawY + 6);

  const q = search.trim().toLowerCase();
  const filteredTabs = q
    ? tabs.filter((t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
    : [];

  const handleAction = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
    onClose();
  };

  const handleZoomIn = async () => {
    try {
      const next = (await api.tabs.zoomIn(activeTabId ?? undefined)) as number;
      if (typeof next === 'number') setZoomPercent(Math.round(next * 100));
    } catch {
      useBrowserStore.getState().zoomIn();
    }
  };

  const handleZoomOut = async () => {
    try {
      const next = (await api.tabs.zoomOut(activeTabId ?? undefined)) as number;
      if (typeof next === 'number') setZoomPercent(Math.round(next * 100));
    } catch {
      useBrowserStore.getState().zoomOut();
    }
  };

  const handleZoomReset = async () => {
    try {
      const next = (await api.tabs.zoomReset(activeTabId ?? undefined)) as number;
      if (typeof next === 'number') setZoomPercent(Math.round(next * 100));
    } catch {
      useBrowserStore.getState().zoomReset();
    }
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
        ref={menuRef}
        className="absolute w-[270px] max-h-[580px] overflow-y-auto custom-scrollbar glass-panel border border-white/15 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-0.5 animate-menu-in text-[11.5px]"
        style={{
          right: `${rightPos}px`,
          top: `${topPos}px`,
          background: 'color-mix(in srgb, var(--color-surface-solid, #141414) 96%, var(--app-bg))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tab Search Bar */}
        <div className="relative flex items-center px-0.5 pt-0.5 pb-1">
          <div className="absolute left-3 text-[var(--color-text-secondary)] pointer-events-none flex items-center">
            <Icon name="search" size={12} strokeWidth={2} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search open tabs..."
            className="w-full h-7 pl-7 pr-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12]
              border border-white/[0.08] focus:border-[var(--theme-primary)]
              text-[11px] font-medium outline-none text-[var(--color-text-primary)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 w-4 h-4 rounded-full flex items-center justify-center text-white/50 hover:text-white"
            >
              <Icon name="x" size={10} />
            </button>
          )}
        </div>

        {/* Tab Search Results */}
        {q && (
          <div className="px-1 py-1 max-h-[140px] overflow-y-auto space-y-0.5 border-b border-white/[0.08]">
            <div className="text-[9.5px] uppercase font-semibold text-white/40 px-2 py-0.5">Matching Tabs ({filteredTabs.length})</div>
            {filteredTabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => {
                  void api.tabs.activate(tab.id);
                  onClose();
                }}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-[11px] ${
                  tab.id === activeTabId
                    ? 'bg-white/[0.14] text-[var(--color-text-primary)] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center">
                  {tab.favicon ? (
                    <img src={tab.favicon} alt="" className="w-3.5 h-3.5 object-contain" />
                  ) : (
                    <Icon name="globe" size={11} />
                  )}
                </div>
                <span className="truncate flex-1">{tab.title || 'New Tab'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void api.tabs.close(tab.id);
                  }}
                  className="p-0.5 text-white/40 hover:text-white"
                >
                  <Icon name="x" size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Section 1: Window & Tab Creation ── */}
        <div className="flex flex-col space-y-0.5">
          <MenuItem
            icon="plus"
            label="New tab"
            shortcut="Ctrl+T"
            onClick={() => handleAction(() => void api.tabs.create('blade://newtab'))}
          />
          <MenuItem
            icon="window"
            label="New window"
            shortcut="Ctrl+N"
            onClick={() => handleAction(() => void api.app.newWindow())}
          />
          <MenuItem
            icon="eye-slash"
            label="New private window"
            shortcut="Ctrl+Shift+N"
            onClick={() => handleAction(() => void api.app.newIncognitoWindow())}
          />
        </div>

        <div className="my-0.5 h-px bg-white/[0.08] mx-1.5" />

        {/* ── Section 2: Browser Features & Navigation ── */}
        <div className="flex flex-col space-y-0.5">
          <MenuItem
            icon="key"
            label="Passwords and autofill"
            onClick={() => handleAction(() => void api.app.openSettings('passwords'))}
          />

          <MenuItemWithSubmenu
            id="history"
            activeSubmenu={activeSubmenu}
            setActiveSubmenu={setActiveSubmenu}
            icon="clock"
            label="History"
            shortcut="Ctrl+H"
          >
            <MenuItem
              icon="clock"
              label="History panel"
              shortcut="Ctrl+H"
              onClick={() => handleAction(() => void api.app.setSidebar(true, 'history'))}
            />
            <MenuItem
              icon="settings"
              label="History settings"
              onClick={() => handleAction(() => void api.app.openSettings('history'))}
            />
          </MenuItemWithSubmenu>

          <MenuItemWithSubmenu
            id="bookmarks"
            activeSubmenu={activeSubmenu}
            setActiveSubmenu={setActiveSubmenu}
            icon="bookmark"
            label="Bookmarks and lists"
          >
            <MenuItem
              icon={activeBookmarked ? 'bookmark-fill' : 'bookmark'}
              label={activeBookmarked ? 'Edit bookmark for tab' : 'Bookmark this tab'}
              shortcut="Ctrl+D"
              onClick={() => handleAction(() => void api.bookmarks.toggle(activeTab?.title || '', activeTab?.url || ''))}
            />
            <MenuItem
              icon="folder"
              label="Bookmarks manager"
              shortcut="Ctrl+Shift+O"
              onClick={() => handleAction(() => void api.app.setSidebar(true, 'bookmarks'))}
            />
            <MenuItem
              icon="sidebar"
              label={bookmarksBarVisible ? 'Hide bookmarks bar' : 'Show bookmarks bar'}
              shortcut="Ctrl+Shift+B"
              onClick={() => handleAction(() => void api.settings.set('bookmarksBarVisible', String(!bookmarksBarVisible)))}
            />
          </MenuItemWithSubmenu>

          <MenuItem
            icon="download"
            label="Downloads"
            shortcut="Ctrl+J"
            onClick={() => handleAction(() => void api.app.openSettings('downloads'))}
          />

          <MenuItem
            icon="shield"
            label="Shields & Privacy"
            onClick={() => handleAction(() => void api.app.openSettings('privacy'))}
          />

          <MenuItem
            icon="trash"
            label="Delete browsing data..."
            shortcut="Ctrl+Shift+Del"
            onClick={() => handleAction(() => void api.app.openSettings('privacy'))}
          />
        </div>

        <div className="my-0.5 h-px bg-white/[0.08] mx-1.5" />

        {/* ── Section 3: Zoom & Viewport ── */}
        <div className="flex items-center justify-between px-2.5 py-1 text-[11.5px] text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2">
            <Icon name="search" size={13} strokeWidth={1.8} className="opacity-75" />
            <span>Zoom</span>
          </div>
          <div className="flex items-center gap-1 bg-white/[0.06] rounded-lg p-0.5 border border-white/[0.06]">
            <button
              onClick={handleZoomOut}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 hover:text-white"
              title="Zoom Out (Ctrl -)"
            >
              <Icon name="minus" size={10} strokeWidth={2} />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-1 text-[10.5px] font-semibold text-white hover:underline min-w-[34px] text-center"
              title="Reset Zoom (Ctrl 0)"
            >
              {zoomPercent}%
            </button>
            <button
              onClick={handleZoomIn}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 hover:text-white"
              title="Zoom In (Ctrl +)"
            >
              <Icon name="plus" size={10} strokeWidth={2} />
            </button>
            <button
              onClick={() => void api.app.toggleFullscreen()}
              className="w-5 h-5 rounded ml-0.5 flex items-center justify-center hover:bg-white/10 hover:text-white"
              title="Fullscreen (F11)"
            >
              <Icon name="fullscreen" size={10} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="my-0.5 h-px bg-white/[0.08] mx-1.5" />

        {/* ── Section 4: Page Actions & Tools ── */}
        <div className="flex flex-col space-y-0.5">
          <MenuItem
            icon="printer"
            label="Print..."
            shortcut="Ctrl+P"
            onClick={() => handleAction(() => {
              if (activeTabId) void api.tabs.print(activeTabId);
            })}
          />
          <MenuItem
            icon="search"
            label="Find in page"
            shortcut="Ctrl+F"
            onClick={() => handleAction(() => void api.app.openFindBar())}
          />

          <MenuItemWithSubmenu
            id="save_share"
            activeSubmenu={activeSubmenu}
            setActiveSubmenu={setActiveSubmenu}
            icon="share"
            label="Save and share"
          >
            <MenuItem
              icon="copy"
              label="Copy page link"
              onClick={() => handleAction(() => {
                if (activeTab?.url) void navigator.clipboard.writeText(activeTab.url);
              })}
            />
            <MenuItem
              icon="doc"
              label="Save page as..."
              shortcut="Ctrl+S"
              onClick={() => handleAction(() => {
                if (activeTabId) void api.tabs.savePage(activeTabId);
              })}
            />
          </MenuItemWithSubmenu>

          <MenuItemWithSubmenu
            id="more_tools"
            activeSubmenu={activeSubmenu}
            setActiveSubmenu={setActiveSubmenu}
            icon="wrench"
            label="More tools"
          >
            <MenuItem
              icon="terminal"
              label="Developer tools"
              shortcut="Ctrl+Shift+I"
              onClick={() => handleAction(() => {
                if (activeTabId) void api.tabs.toggleDevTools(activeTabId, 'right');
              })}
            />
            <MenuItem
              icon="doc"
              label="View page source"
              shortcut="Ctrl+U"
              onClick={() => handleAction(() => {
                if (activeTabId) void api.tabs.viewSource(activeTabId);
              })}
            />
            <MenuItem
              icon="settings"
              label="Developer settings"
              onClick={() => handleAction(() => void api.app.openSettings('developer'))}
            />
          </MenuItemWithSubmenu>
        </div>

        <div className="my-0.5 h-px bg-white/[0.08] mx-1.5" />

        {/* ── Section 5: Settings & Exit ── */}
        <div className="flex flex-col space-y-0.5">
          <MenuItem
            icon="gear"
            label="Settings"
            shortcut="Ctrl+,"
            onClick={() => handleAction(() => void api.app.openSettings())}
          />
          <MenuItem
            icon="x"
            label="Exit"
            danger
            onClick={() => handleAction(() => void api.app.exit())}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  hasSubmenu,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  shortcut?: string;
  hasSubmenu?: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-500/15'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.07]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon name={icon as IconName} size={13} strokeWidth={1.8} className="shrink-0 opacity-75" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-1.5">
        {shortcut && (
          <span className="text-[9.5px] text-[var(--color-text-secondary)]/50 tracking-wider font-mono">
            {shortcut}
          </span>
        )}
        {hasSubmenu && (
          <Icon name="chevron-right" size={10} className="opacity-40" />
        )}
      </div>
    </button>
  );
}

function MenuItemWithSubmenu({
  id,
  activeSubmenu,
  setActiveSubmenu,
  icon,
  label,
  shortcut,
  children,
}: {
  id: SubmenuId;
  activeSubmenu: SubmenuId;
  setActiveSubmenu: React.Dispatch<React.SetStateAction<SubmenuId>>;
  icon: IconName;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  const isOpen = activeSubmenu === id;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setActiveSubmenu((curr) => (curr === id ? null : id))}
        className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-colors ${
          isOpen
            ? 'bg-white/[0.10] text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.07]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={icon} size={13} strokeWidth={1.8} className="shrink-0 opacity-75" />
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {shortcut && (
            <span className="text-[9.5px] text-[var(--color-text-secondary)]/50 tracking-wider font-mono">
              {shortcut}
            </span>
          )}
          <Icon
            name="chevron-right"
            size={10}
            className={`transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-90 text-white' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="pl-3.5 pr-1 py-1 my-0.5 flex flex-col gap-0.5 border-l-2 border-white/10 ml-3.5 animate-menu-in">
          {children}
        </div>
      )}
    </div>
  );
}
