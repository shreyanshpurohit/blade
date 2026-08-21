import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { api } from '../../lib/api';

interface AppMenuPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  anchorPos?: { x: number; y: number } | null;
}

export function AppMenuPopup({ isOpen, onClose, anchorRect, anchorPos }: AppMenuPopupProps) {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const activeTab = useBrowserStore((s) => s.activeTab());

  const {
    activateTab,
    closeTab,
    createTab,
    openSettings,
    newWindow,
    newIncognitoWindow,
    clearBrowsingData,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleFullscreen,
    print,
    savePage,
    toggleDevTools,
    setFindBarOpen,
    exit,
  } = useBrowserStore();

  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const q = search.trim().toLowerCase();
  const filteredTabs = q
    ? tabs.filter((t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
    : [];

  const rawX = anchorPos && anchorPos.x > 0 ? anchorPos.x : anchorRect ? anchorRect.right : window.innerWidth - 20;
  const rawY = anchorPos && anchorPos.y > 0 ? anchorPos.y : anchorRect ? anchorRect.bottom : 56;

  const rightPos = Math.max(12, window.innerWidth - rawX);
  const topPos = Math.max(8, rawY + 6);

  const [zoomPercent, setZoomPercent] = useState(() => Math.round((activeTab?.zoomFactor ?? 1) * 100));

  useEffect(() => {
    if (activeTab?.zoomFactor !== undefined) {
      setZoomPercent(Math.round(activeTab.zoomFactor * 100));
    }
  }, [activeTab?.zoomFactor]);

  const handleZoomIn = async () => {
    try {
      const next = (await api.tabs.zoomIn()) as number;
      if (typeof next === 'number') setZoomPercent(Math.round(next * 100));
    } catch {
      zoomIn();
    }
  };

  const handleZoomOut = async () => {
    try {
      const next = (await api.tabs.zoomOut()) as number;
      if (typeof next === 'number') setZoomPercent(Math.round(next * 100));
    } catch {
      zoomOut();
    }
  };

  const handleZoomReset = async () => {
    try {
      const next = (await api.tabs.zoomReset()) as number;
      if (typeof next === 'number') setZoomPercent(Math.round(next * 100));
    } catch {
      zoomReset();
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
        className="absolute w-[265px] max-h-[560px] overflow-y-auto custom-scrollbar glass-panel border border-white/15 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-0.5 animate-menu-in text-[11.5px]"
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
                  activateTab(tab.id);
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
                    closeTab(tab.id);
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
            onClick={() => {
              createTab();
              onClose();
            }}
          />
          <MenuItem
            icon="window"
            label="New window"
            shortcut="Ctrl+N"
            onClick={() => {
              newWindow();
              onClose();
            }}
          />
          <MenuItem
            icon="eye-slash"
            label="New private window"
            shortcut="Ctrl+Shift+N"
            onClick={() => {
              newIncognitoWindow();
              onClose();
            }}
          />
          <MenuItem
            icon="shield"
            label="New private window with Tor"
            shortcut="Shift+Alt+N"
            onClick={() => {
              newIncognitoWindow();
              onClose();
            }}
          />
        </div>

        <div className="my-0.5 h-px bg-white/[0.08] mx-1.5" />

        {/* ── Section 2: Browser Features & Tools ── */}
        <div className="flex flex-col space-y-0.5">
          <MenuItem
            icon="key"
            label="Passwords and autofill"
            hasSubmenu
            onClick={() => {
              openSettings('privacy');
              onClose();
            }}
          />
          <MenuItem
            icon="clock"
            label="History"
            shortcut="Ctrl+H"
            hasSubmenu
            onClick={() => {
              void api.app.showPopup({ type: 'history', x: rawX, y: rawY });
              onClose();
            }}
          />
          <MenuItem
            icon="bookmark"
            label="Bookmarks and lists"
            shortcut="Ctrl+Shift+O"
            hasSubmenu
            onClick={() => {
              void api.app.showPopup({ type: 'bookmarks', x: rawX, y: rawY });
              onClose();
            }}
          />
          <MenuItem
            icon="download"
            label="Downloads"
            shortcut="Ctrl+J"
            onClick={() => {
              void api.app.showPopup({ type: 'downloads', x: rawX, y: rawY });
              onClose();
            }}
          />
          <MenuItem
            icon="shield"
            label="Shields & Privacy"
            hasSubmenu
            onClick={() => {
              void api.app.showPopup({ type: 'shields', x: rawX, y: rawY });
              onClose();
            }}
          />
          <MenuItem
            icon="trash"
            label="Delete browsing data..."
            shortcut="Ctrl+Shift+Del"
            onClick={() => {
              void clearBrowsingData();
              onClose();
            }}
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
              title="Zoom Out"
            >
              <Icon name="minus" size={10} strokeWidth={2} />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-1 text-[10.5px] font-semibold text-white hover:underline min-w-[34px] text-center"
              title="Reset Zoom"
            >
              {zoomPercent}%
            </button>
            <button
              onClick={handleZoomIn}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 hover:text-white"
              title="Zoom In"
            >
              <Icon name="plus" size={10} strokeWidth={2} />
            </button>
            <button
              onClick={() => toggleFullscreen()}
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
            onClick={() => {
              print();
              onClose();
            }}
          />
          <MenuItem
            icon="search"
            label="Find in page"
            shortcut="Ctrl+F"
            onClick={() => {
              onClose();
              void api.app.openFindBar();
            }}
          />
          <MenuItem
            icon="doc"
            label="Save page as..."
            shortcut="Ctrl+S"
            onClick={() => {
              savePage();
              onClose();
            }}
          />
          <MenuItem
            icon="terminal"
            label="Developer Tools"
            shortcut="F12"
            onClick={() => {
              toggleDevTools();
              onClose();
            }}
          />
        </div>

        <div className="my-0.5 h-px bg-white/[0.08] mx-1.5" />

        {/* ── Section 5: Settings & Exit ── */}
        <div className="flex flex-col space-y-0.5">
          <MenuItem
            icon="gear"
            label="Settings"
            shortcut="Ctrl+,"
            onClick={() => {
              openSettings();
              onClose();
            }}
          />
          <MenuItem
            icon="x"
            label="Exit"
            danger
            onClick={() => {
              exit();
              onClose();
            }}
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
        <Icon name={icon as any} size={13} strokeWidth={1.8} className="shrink-0 opacity-75" />
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
