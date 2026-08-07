import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import type { WindowState, TabState } from '@shared/types';

type SubmenuId = 'passwords' | 'history' | 'bookmarks' | 'extensions' | 'save_share' | 'more_tools' | 'help' | null;

export function AppMenuStandalone() {
  const [state, setState] = useState<WindowState | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId>(null);
  const [clearing, setClearing] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    // Initial fetch of state
    void api.app.getState().then((s) => {
      const ws = s as WindowState;
      setState(ws);
      const active = ws.tabs.find((t) => t.id === ws.activeTabId);
      if (active?.url && active.url.startsWith('http')) {
        void api.bookmarks.getByUrl(active.url).then((b) => setBookmarked(!!b));
      }
    });

    const unsubscribe = api.onStateChanged((s) => {
      const ws = s as WindowState;
      setState(ws);
      const active = ws.tabs.find((t) => t.id === ws.activeTabId);
      if (active?.url && active.url.startsWith('http')) {
        void api.bookmarks.getByUrl(active.url).then((b) => setBookmarked(!!b));
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSubmenu) {
          setActiveSubmenu(null);
        } else {
          window.close();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSubmenu]);

  const activeTab: TabState | undefined = state?.tabs.find((t) => t.id === state?.activeTabId);
  const zoomFactor = activeTab?.zoomFactor ?? 1.0;
  const zoomPct = Math.round(zoomFactor * 100);
  const sidebarOpen = state?.sidebarOpen ?? false;
  const bookmarksBarVisible = state?.bookmarksBarVisible ?? true;

  const handleAction = (fn: () => void | Promise<unknown>) => {
    void Promise.resolve(fn()).then(() => {
      window.close();
    });
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      await api.app.clearBrowsingData();
    } finally {
      setClearing(false);
      window.close();
    }
  };

  return (
    <div className="h-screen w-screen p-2 overflow-y-auto no-scrollbar flex flex-col justify-start bg-transparent select-none">
      <div
        className="w-full glass-panel bg-neutral-900/95 dark:bg-[#0e0f14]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-2xl text-neutral-200 animate-menu-in"
        style={{
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* 1. Window & Tab Group */}
        <MenuItem
          icon="plus"
          label="New tab"
          shortcut="Ctrl+T"
          onClick={() => handleAction(() => api.tabs.create())}
        />
        <MenuItem
          icon="window"
          label="New window"
          shortcut="Ctrl+N"
          onClick={() => handleAction(() => api.app.newWindow())}
        />
        <MenuItem
          icon="eye-slash"
          label="New private window"
          shortcut="Ctrl+Shift+N"
          onClick={() => handleAction(() => api.app.newIncognitoWindow())}
        />
        <MenuItem
          icon="bolt"
          label="New private window with Tor"
          shortcut="Shift+Alt+N"
          onClick={() => handleAction(() => api.app.newIncognitoWindow())}
        />

        <Divider />

        {/* 2. AI & Shields */}
        <MenuItem
          icon="sparkles"
          label="Leo AI Assistant"
          onClick={() => handleAction(() => api.app.setSidebar(true, 'ai'))}
        />
        <MenuItem
          icon="wallet"
          label="Lumen Wallet"
          onClick={() => handleAction(() => api.app.setSidebar(true, 'shields'))}
        />

        <Divider />

        {/* 3. Sidebar Toggle with Pills */}
        <div className="px-3 py-2 flex items-center justify-between text-[13px] rounded-lg hover:bg-white/[0.06] transition-colors">
          <div className="flex items-center gap-2.5">
            <Icon name="sidebar" size={15} className="text-neutral-400" />
            <span className="font-medium text-neutral-200">Sidebar</span>
          </div>
          <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 text-[11px] font-medium">
            <button
              onClick={() => api.app.setSidebar(true)}
              className={`px-2 py-0.5 rounded-md transition-all ${
                sidebarOpen
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              On
            </button>
            <button
              onClick={() => api.app.setSidebar(false)}
              className={`px-2 py-0.5 rounded-md transition-all ${
                !sidebarOpen
                  ? 'bg-neutral-700 text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Off
            </button>
          </div>
        </div>

        {/* 4. Navigation & Tool Submenus */}
        <MenuItemWithSubmenu
          id="passwords"
          activeSubmenu={activeSubmenu}
          setActiveSubmenu={setActiveSubmenu}
          icon="key"
          label="Passwords and autofill"
        >
          <MenuItem
            icon="key"
            label="Password Manager"
            onClick={() => handleAction(() => api.app.openSettings())}
          />
          <MenuItem
            icon="check"
            label="Payment methods"
            onClick={() => handleAction(() => api.app.openSettings())}
          />
          <MenuItem
            icon="doc"
            label="Addresses and more"
            onClick={() => handleAction(() => api.app.openSettings())}
          />
        </MenuItemWithSubmenu>

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
            label="History Manager"
            shortcut="Ctrl+H"
            onClick={() => handleAction(() => api.app.setSidebar(true, 'history'))}
          />
          <MenuItem
            icon="arrow-clockwise"
            label="Recently Closed Tabs"
            onClick={() => handleAction(() => api.tabs.create())}
          />
          <MenuItem
            icon="trash"
            label="Clear History"
            onClick={() => handleAction(() => handleClearData())}
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
            icon={bookmarked ? 'bookmark-fill' : 'bookmark'}
            label={bookmarked ? 'Edit bookmark for tab' : 'Bookmark this tab'}
            shortcut="Ctrl+D"
            onClick={() => {
              if (activeTab?.url) {
                void api.bookmarks.toggle(activeTab.title, activeTab.url);
              }
              window.close();
            }}
          />
          <MenuItem
            icon="sidebar"
            label={bookmarksBarVisible ? 'Hide bookmarks bar' : 'Show bookmarks bar'}
            shortcut="Ctrl+Shift+B"
            onClick={() => {
              void api.app.setBookmarksBar(!bookmarksBarVisible);
              window.close();
            }}
          />
          <MenuItem
            icon="folder"
            label="Bookmarks manager"
            shortcut="Ctrl+Shift+O"
            onClick={() => handleAction(() => api.app.setSidebar(true, 'bookmarks'))}
          />
        </MenuItemWithSubmenu>

        <MenuItem
          icon="download"
          label="Downloads"
          shortcut="Ctrl+J"
          onClick={() => handleAction(() => api.app.setSidebar(true, 'downloads'))}
        />

        <MenuItemWithSubmenu
          id="extensions"
          activeSubmenu={activeSubmenu}
          setActiveSubmenu={setActiveSubmenu}
          icon="puzzle"
          label="Extensions"
        >
          <MenuItem
            icon="puzzle"
            label="Manage extensions"
            onClick={() => handleAction(() => api.app.setSidebar(true, 'extensions'))}
          />
          <MenuItem
            icon="external"
            label="Chrome Web Store"
            onClick={() => handleAction(() => api.tabs.create('https://chromewebstore.google.com'))}
          />
        </MenuItemWithSubmenu>

        <MenuItem
          icon="trash"
          label={clearing ? 'Clearing data...' : 'Delete browsing data...'}
          shortcut="Ctrl+Shift+Del"
          onClick={() => handleAction(() => handleClearData())}
        />

        <Divider />

        {/* 5. Interactive Zoom & Fullscreen Row */}
        <div className="px-3 py-1.5 flex items-center justify-between text-[13px] rounded-lg hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-2.5">
            <Icon name="search" size={15} className="text-neutral-400" />
            <span className="font-medium text-neutral-200">Zoom</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 px-1 py-0.5 rounded-lg border border-white/10">
            <button
              title="Zoom out (Ctrl -)"
              onClick={(e) => {
                e.stopPropagation();
                if (activeTab?.id) void api.tabs.zoomOut(activeTab.id);
              }}
              className="w-6 h-6 grid place-items-center rounded hover:bg-white/15 text-neutral-300 hover:text-white transition-colors active:scale-95"
            >
              <Icon name="minus" size={13} />
            </button>
            <button
              title="Click to reset zoom (Ctrl 0)"
              onClick={(e) => {
                e.stopPropagation();
                if (activeTab?.id) void api.tabs.zoomReset(activeTab.id);
              }}
              className="min-w-[44px] px-1 h-6 grid place-items-center rounded text-[12px] font-semibold text-neutral-200 hover:bg-white/15 hover:text-white transition-colors"
            >
              {zoomPct}%
            </button>
            <button
              title="Zoom in (Ctrl +)"
              onClick={(e) => {
                e.stopPropagation();
                if (activeTab?.id) void api.tabs.zoomIn(activeTab.id);
              }}
              className="w-6 h-6 grid place-items-center rounded hover:bg-white/15 text-neutral-300 hover:text-white transition-colors active:scale-95"
            >
              <Icon name="plus" size={13} />
            </button>
            <div className="w-[1px] h-4 bg-white/10 my-auto" />
            <button
              title="Toggle fullscreen (F11)"
              onClick={(e) => {
                e.stopPropagation();
                void api.app.toggleFullscreen();
                window.close();
              }}
              className="w-6 h-6 grid place-items-center rounded hover:bg-white/15 text-neutral-300 hover:text-white transition-colors active:scale-95"
            >
              <Icon name="fullscreen" size={13} />
            </button>
          </div>
        </div>

        <Divider />

        {/* 6. Page Tools */}
        <MenuItem
          icon="printer"
          label="Print..."
          shortcut="Ctrl+P"
          onClick={() => handleAction(() => {
            if (activeTab?.id) void api.tabs.print(activeTab.id);
          })}
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
            onClick={() => {
              if (activeTab?.url) navigator.clipboard.writeText(activeTab.url);
              window.close();
            }}
          />
          <MenuItem
            icon="doc"
            label="Save page as..."
            shortcut="Ctrl+S"
            onClick={() => handleAction(() => {
              if (activeTab?.id) void api.tabs.print(activeTab.id);
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
              if (activeTab?.id) void api.tabs.toggleDevTools(activeTab.id, 'right');
            })}
          />
          <MenuItem
            icon="code"
            label="Developer settings"
            onClick={() => handleAction(() => api.app.openSettings('developer'))}
          />
          <MenuItem
            icon="doc"
            label="View page source"
            shortcut="Ctrl+U"
            onClick={() => handleAction(() => {
              if (activeTab?.id) void api.tabs.viewSource(activeTab.id);
            })}
          />
          <MenuItem
            icon="shield-check"
            label="Lumen Shields Stats"
            onClick={() => handleAction(() => api.app.setSidebar(true, 'shields'))}
          />
        </MenuItemWithSubmenu>

        <Divider />

        {/* 7. Help & System */}
        <MenuItemWithSubmenu
          id="help"
          activeSubmenu={activeSubmenu}
          setActiveSubmenu={setActiveSubmenu}
          icon="info"
          label="Help"
        >
          <MenuItem
            icon="info"
            label="About Lumen Browser"
            onClick={() => handleAction(() => api.app.openSettings('about'))}
          />
          <MenuItem
            icon="keyboard"
            label="Keyboard shortcuts"
            onClick={() => handleAction(() => api.app.openSettings('shortcuts'))}
          />
          <MenuItem
            icon="external"
            label="Report an issue"
            onClick={() => handleAction(() => api.tabs.create('https://github.com'))}
          />
        </MenuItemWithSubmenu>

        <MenuItem
          icon="sliders"
          label="Settings"
          shortcut="Ctrl+,"
          onClick={() => handleAction(() => api.app.openSettings())}
        />
        <MenuItem
          icon="x"
          label="Exit"
          shortcut="Ctrl+Shift+Q"
          onClick={() => handleAction(() => api.app.exit())}
        />
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-3 py-1.5 flex items-center justify-between text-[13px] rounded-lg hover:bg-white/[0.08] active:bg-white/[0.12] text-neutral-300 hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name={icon} size={15} className="shrink-0 text-neutral-400" />
        <span className="truncate font-normal">{label}</span>
      </div>
      {shortcut && (
        <span className="text-[11px] font-medium text-neutral-500 tracking-wider ml-2 shrink-0">
          {shortcut}
        </span>
      )}
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
  id: NonNullable<SubmenuId>;
  activeSubmenu: SubmenuId;
  setActiveSubmenu: (id: SubmenuId) => void;
  icon: IconName;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  const isOpen = activeSubmenu === id;

  return (
    <div
      className="relative"
      onMouseEnter={() => setActiveSubmenu(id)}
      onMouseLeave={() => setActiveSubmenu(null)}
    >
      <button
        onClick={() => setActiveSubmenu(isOpen ? null : id)}
        className={`w-full px-3 py-1.5 flex items-center justify-between text-[13px] rounded-lg text-neutral-300 hover:text-white transition-colors ${
          isOpen ? 'bg-white/[0.1] text-white' : 'hover:bg-white/[0.08]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon name={icon} size={15} className="shrink-0 text-neutral-400" />
          <span className="truncate font-normal">{label}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {shortcut && (
            <span className="text-[11px] font-medium text-neutral-500 tracking-wider">
              {shortcut}
            </span>
          )}
          <Icon name="chevron-right" size={11} className="text-neutral-500" />
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute right-[calc(100%+6px)] top-0 z-50 w-[240px] glass-panel bg-neutral-900/95 dark:bg-[#0e0f14]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-black/80 text-neutral-200 animate-menu-in"
          style={{
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.12)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-white/[0.08]" />;
}
