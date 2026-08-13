import React, { useState, useRef, useEffect } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

interface AppMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
  standalone?: boolean;
  customPos?: { x: number; y: number };
}

type SubmenuId = 'history' | 'bookmarks' | 'save_share' | 'more_tools' | 'help' | null;

export function AppMenu({ isOpen, onClose, anchorRef, standalone = false, customPos }: AppMenuProps) {
  const {
    activeTab,
    createTab,
    newWindow,
    newIncognitoWindow,
    sidebarOpen,
    setSidebar,
    bookmarksBarVisible,
    setBookmarksBarVisible,
    zoomIn,
    zoomOut,
    toggleFullscreen,
    print,
    savePage,
    toggleDevTools,
    viewSource,
    openSettings,
    clearBrowsingData,
    exit,
    toggleBookmarkActive,
    activeBookmarked,
  } = useBrowserStore();

  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId>(null);
  const [clearing, setClearing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tab = activeTab();
  const zoomFactor = tab?.zoomFactor ?? 1.0;
  const zoomPct = Math.round(zoomFactor * 100);

  // Close on outside click or Esc
  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenu(null);
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        if (!anchorRef?.current || !anchorRef.current.contains(e.target as Node)) {
          onClose();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSubmenu) {
          setActiveSubmenu(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, activeSubmenu, onClose, anchorRef]);

  if (!isOpen) return null;

  const handleAction = (fn: () => void) => {
    fn();
    onClose();
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      await clearBrowsingData();
    } finally {
      setClearing(false);
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className={
        standalone
          ? "absolute app-menu-surface backdrop-blur-2xl border border-white/[0.12] rounded-2xl p-2 text-white select-none flex flex-col"
          : "absolute right-6 top-14 z-50 w-[295px] app-menu-surface backdrop-blur-2xl border border-white/[0.12] rounded-2xl p-2 shadow-2xl text-white select-none animate-menu-in flex flex-col"
      }
      style={
        standalone && customPos
          ? {
              top: `${Math.max(0, customPos.y + 4)}px`,
              left: `${Math.max(0, customPos.x - 310)}px`,
              width: '310px',
            }
          : undefined
      }
    >

      {/* 1. Window & Tab Group */}
      <MenuItem
        icon="plus"
        label="New tab"
        shortcut="Ctrl+T"
        onClick={() => handleAction(() => createTab())}
      />
      <MenuItem
        icon="window"
        label="New window"
        shortcut="Ctrl+N"
        onClick={() => handleAction(() => newWindow())}
      />
      <MenuItem
        icon="eye-slash"
        label="New private window"
        shortcut="Ctrl+Shift+N"
        onClick={() => handleAction(() => newIncognitoWindow())}
      />

      <Divider />

      {/* 2. Sidebar Toggle with Pills */}
      <div className="px-3 py-2 flex items-center justify-between text-[13px] rounded-lg hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon name="sidebar" size={15} className="text-white/50" />
          <span className="font-medium text-white">Sidebar</span>
        </div>
        <div className="flex items-center bg-[var(--glass-control-bg)] p-0.5 rounded-lg border border-white/[0.12] text-[11px] font-medium">
          <button
            onClick={() => setSidebar(true)}
            className={`px-2 py-0.5 rounded-md transition-all ${
              sidebarOpen
                ? 'bg-[var(--theme-primary)] text-[var(--color-surface-solid)] shadow-sm font-semibold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            On
          </button>
          <button
            onClick={() => setSidebar(false)}
            className={`px-2 py-0.5 rounded-md transition-all ${
              !sidebarOpen
                ? 'bg-white/[0.15] text-white shadow-sm font-semibold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Off
          </button>
        </div>
      </div>

      {/* 3. Navigation & Tool Submenus */}
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
          onClick={() => handleAction(() => setSidebar(true, 'history'))}
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
          icon={activeBookmarked ? 'bookmark-fill' : 'bookmark'}
          label={activeBookmarked ? 'Edit bookmark for tab' : 'Bookmark this tab'}
          shortcut="Ctrl+D"
          onClick={() => handleAction(() => void toggleBookmarkActive())}
        />
        <MenuItem
          icon="sidebar"
          label={bookmarksBarVisible ? 'Hide bookmarks bar' : 'Show bookmarks bar'}
          shortcut="Ctrl+Shift+B"
          onClick={() => setBookmarksBarVisible(!bookmarksBarVisible)}
        />
        <MenuItem
          icon="folder"
          label="Bookmarks manager"
          shortcut="Ctrl+Shift+O"
          onClick={() => handleAction(() => setSidebar(true, 'bookmarks'))}
        />
      </MenuItemWithSubmenu>

      <MenuItem
        icon="download"
        label="Downloads"
        shortcut="Ctrl+J"
        onClick={() => handleAction(() => openSettings('downloads'))}
      />

      <MenuItem
        icon="trash"
        label={clearing ? 'Clearing data...' : 'Delete browsing data...'}
        shortcut="Ctrl+Shift+Del"
        onClick={() => handleAction(() => handleClearData())}
      />

      <Divider />

      {/* 5. Interactive Zoom & Fullscreen Row */}
      <div className="px-3 py-1.5 flex items-center justify-between text-[13px] rounded-lg hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon name="search" size={15} className="text-white/50" />
          <span className="font-medium text-white">Zoom</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[var(--glass-control-bg)] px-1 py-0.5 rounded-lg border border-white/[0.12]">
          <button
            title="Zoom out (Ctrl -)"
            onClick={(e) => {
              e.stopPropagation();
              zoomOut();
            }}
            className="w-6 h-6 grid place-items-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors active:scale-95"
          >
            <Icon name="minus" size={13} />
          </button>
          <span
            aria-label={`Current zoom ${zoomPct}%`}
            className="min-w-[50px] px-1 h-6 grid place-items-center rounded text-center text-[12px] font-semibold text-white"
          >
            {zoomPct}%
          </span>
          <button
            title="Zoom in (Ctrl +)"
            onClick={(e) => {
              e.stopPropagation();
              zoomIn();
            }}
            className="w-6 h-6 grid place-items-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors active:scale-95"
          >
            <Icon name="plus" size={13} />
          </button>
          <div className="w-[1px] h-4 bg-white/10 my-auto" />
          <button
            title="Toggle fullscreen (F11)"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="w-6 h-6 grid place-items-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors active:scale-95"
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
        onClick={() => handleAction(() => print())}
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
            if (tab?.url) navigator.clipboard.writeText(tab.url);
            onClose();
          }}
        />
        <MenuItem
          icon="doc"
          label="Save page as..."
          shortcut="Ctrl+S"
          onClick={() => handleAction(() => savePage())}
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
          onClick={() => handleAction(() => toggleDevTools('right'))}
        />
        <MenuItem
          icon="code"
          label="Developer settings"
          onClick={() => handleAction(() => openSettings('developer'))}
        />
        <MenuItem
          icon="doc"
          label="View page source"
          shortcut="Ctrl+U"
          onClick={() => handleAction(() => viewSource())}
        />
        <MenuItem
          icon="shield-check"
          label="Lumen Shields Stats"
          onClick={() => handleAction(() => setSidebar(true, 'shields'))}
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
          onClick={() => handleAction(() => openSettings('about'))}
        />
        <MenuItem
          icon="keyboard"
          label="Keyboard shortcuts"
          onClick={() => handleAction(() => openSettings('shortcuts'))}
        />
        <MenuItem
          icon="external"
          label="Report an issue"
          onClick={() => handleAction(() => createTab('https://github.com'))}
        />
      </MenuItemWithSubmenu>

      <MenuItem
        icon="gear"
        label="Settings"
        shortcut="Ctrl+,"
        onClick={() => handleAction(() => openSettings())}
      />
      <MenuItem
        icon="x"
        label="Exit"
        shortcut="Ctrl+Shift+Q"
        onClick={() => handleAction(() => exit())}
      />
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
      className="w-full px-3 py-2 flex items-center justify-between text-[13px] font-medium rounded-xl hover:bg-white/10 hover:text-white transition-colors text-white/80 disabled:opacity-30 disabled:pointer-events-none text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name={icon} size={15} strokeWidth={1.8} className="shrink-0 text-white/60" />
        <span className="truncate">{label}</span>
      </div>
      {shortcut && (
        <span className="text-[11px] font-mono font-medium text-white/40 tracking-wider ml-2 shrink-0">
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
        className={`w-full px-3 py-2 flex items-center justify-between text-[13px] font-medium rounded-xl transition-all ${
          isOpen
            ? 'bg-white/15 text-white'
            : 'hover:bg-white/10 text-white/80'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon name={icon} size={15} strokeWidth={1.8} className="shrink-0 text-white/60" />
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {shortcut && (
            <span className="text-[11px] font-mono font-medium text-white/40 tracking-wider">
              {shortcut}
            </span>
          )}
          <Icon name="chevron-right" size={12} strokeWidth={2} className="text-white/50" />
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute right-[calc(100%+6px)] top-0 z-50 w-[240px] app-menu-surface backdrop-blur-2xl border border-white/[0.12] rounded-2xl p-2 shadow-2xl text-white animate-menu-in"
        >
          {/* Bridge gap so hover doesn't drop */}
          <div className="absolute -right-[12px] top-0 bottom-0 w-[12px] bg-transparent" />
          {children}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-white/10" />;
}
