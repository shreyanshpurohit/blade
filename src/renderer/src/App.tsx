import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBrowserStore } from './store/browserStore';
import { api } from './lib/api';
import { TrafficLights, TrafficLightsSpacer } from './components/chrome/TrafficLights';
import { BookmarksBar } from './components/chrome/BookmarksBar';
import { TabBar } from './components/tabbar/TabBar';
import { VerticalTabBar } from './components/tabbar/VerticalTabBar';
import { AddressBar } from './components/addressbar/AddressBar';
import { SettingsPage } from './components/settings/SettingsPage';
import { NewTab } from './components/newtab/NewTab';
import { BookmarksPopup } from './components/chrome/BookmarksPopup';
import { DownloadPopup } from './components/chrome/DownloadPopup';
import { AppMenuPopup } from './components/chrome/AppMenuPopup';
import { ShieldsPopup } from './components/chrome/ShieldsPopup';
import { HistoryPopup } from './components/chrome/HistoryPopup';
import { SuggestionsPopup } from './components/chrome/SuggestionsPopup';
import { FindBar } from './components/chrome/FindBar';
import { applyAppearanceMode } from './lib/theme';
import type { DownloadItem, Suggestion } from '@shared/types';
import { Icon } from './components/common/Icon';

export function App() {
  if (window.location.hash.startsWith('#/suggestions')) {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    return <SuggestionsPopup initialQuery={params.get('q') || ''} />;
  }
  if (
    window.location.hash.startsWith('#/popup') ||
    window.location.hash.startsWith('#/app-menu') ||
    window.location.hash.startsWith('#/download-popup')
  ) {
    return <StandalonePopupOverlay />;
  }
  return <ChromeShell />;
}

function StandalonePopupOverlay() {
  const init = useBrowserStore((s) => s.init);
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const initialType = params.get('type') || '';
  const initialX = parseInt(params.get('x') || '0', 10);
  const initialY = parseInt(params.get('y') || '0', 10);

  const [popupState, setPopupState] = useState<{
    isOpen: boolean;
    type: string;
    x: number;
    y: number;
  }>({
    isOpen: Boolean(initialType),
    type: initialType,
    x: initialX || window.innerWidth - 20,
    y: initialY || 56,
  });

  useEffect(() => {
    void init();
    const unsubOpen = api.onPopupOpen((data) => {
      if (data && data.type) {
        setPopupState({
          isOpen: true,
          type: data.type,
          x: data.x,
          y: data.y,
        });
      }
    });
    const unsubClose = api.onPopupClose(() => {
      setPopupState({ isOpen: false, type: '', x: 0, y: 0 });
    });
    return () => {
      unsubOpen();
      unsubClose();
    };
  }, [init]);

  const close = () => {
    setPopupState({ isOpen: false, type: '', x: 0, y: 0 });
    void api.app.closePopup();
  };

  if (!popupState.isOpen || !popupState.type) return null;

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-transparent select-none pointer-events-auto"
      onClick={close}
      onContextMenu={(e) => {
        e.preventDefault();
        close();
      }}
    >
      {popupState.type === 'shields' && (
        <ShieldsPopup
          isOpen={true}
          onClose={close}
          anchorPos={{ x: popupState.x, y: popupState.y }}
        />
      )}
      {popupState.type === 'history' && (
        <HistoryPopup
          isOpen={true}
          onClose={close}
          anchorPos={{ x: popupState.x, y: popupState.y }}
        />
      )}
      {popupState.type === 'bookmarks' && (
        <BookmarksPopup
          isOpen={true}
          onClose={close}
          anchorPos={{ x: popupState.x, y: popupState.y }}
        />
      )}
      {popupState.type === 'downloads' && (
        <DownloadPopup
          isOpen={true}
          onClose={close}
          anchorPos={{ x: popupState.x, y: popupState.y }}
        />
      )}
      {popupState.type === 'menu' && (
        <AppMenuPopup
          isOpen={true}
          onClose={close}
          anchorPos={{ x: popupState.x, y: popupState.y }}
        />
      )}
    </div>
  );
}

function ChromeShell() {
  const init = useBrowserStore((s) => s.init);
  const initialized = useBrowserStore((s) => s.initialized);
  const theme = useBrowserStore((s) => s.theme);
  const incognito = useBrowserStore((s) => s.incognito);
  const bookmarksBarVisible = useBrowserStore((s) => s.bookmarksBarVisible);
  const activeTab = useBrowserStore((s) => s.activeTab());
  const sidebarOpen = useBrowserStore((s) => s.sidebarOpen);
  const sidebarPinned = useBrowserStore((s) => s.sidebarPinned);
  const sidebarPanel = useBrowserStore((s) => s.sidebarPanel);
  const fullscreen = useBrowserStore((s) => s.fullscreen);
  const findBarOpen = useBrowserStore((s) => s.findBarOpen);

  const isSettings = activeTab?.url
    ? activeTab.url.startsWith('blade://settings') ||
      activeTab.url.startsWith('lumen://settings') ||
      activeTab.url === 'about:settings' ||
      activeTab.url === 'chrome://settings'
    : false;

  const isNewTab =
    !activeTab?.url ||
    activeTab.url === 'blade://newtab' ||
    activeTab.url === 'lumen://newtab' ||
    activeTab.url === 'about:newtab' ||
    activeTab.url === 'about:blank' ||
    activeTab.url.includes('honeyquote.com');

  const isVerticalTabs = sidebarOpen && sidebarPanel === 'tabs';
  const showTabStrip = !isVerticalTabs;

  useEffect(() => {
    void init();
  }, [init]);

  const headerRef = useRef<HTMLElement>(null);

  // Sync chrome height with main process layout dynamically
  useLayoutEffect(() => {
    if (!headerRef.current) return;
    const syncChromeHeight = (height: number) => {
      document.documentElement.style.setProperty('--chrome-height', `${Math.round(height)}px`);
      void api.app.setChromeHeight(Math.round(height));
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = headerRef.current?.getBoundingClientRect().height ?? entry.contentRect.height;
        if (height > 0) {
          syncChromeHeight(height);
        }
      }
    });
    observer.observe(headerRef.current);
    
    // Initial measure
    const initialHeight = headerRef.current.getBoundingClientRect().height;
    if (initialHeight > 0) {
      syncChromeHeight(initialHeight);
    }
    
    return () => observer.disconnect();
  }, [initialized, activeTab?.id, showTabStrip, bookmarksBarVisible, fullscreen, findBarOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      applyAppearanceMode(theme ?? 'system');
      document.documentElement.dataset.incognito = String(incognito);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, incognito]);

  useEffect(() => {
    const unsub = api.onOpenFindBar?.(() => {
      useBrowserStore.getState().setFindBarOpen(true);
    });
    return () => {
      unsub?.();
    };
  }, []);

  // Global browser shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        useBrowserStore.getState().zoomIn();
      } else if (isCmdOrCtrl && e.key === '-') {
        e.preventDefault();
        useBrowserStore.getState().zoomOut();
      } else if (isCmdOrCtrl && e.key === '0') {
        e.preventDefault();
        useBrowserStore.getState().zoomReset();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault();
        useBrowserStore.getState().createTab();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'w' && !e.shiftKey) {
        e.preventDefault();
        const id = useBrowserStore.getState().activeTabId;
        if (id) useBrowserStore.getState().closeTab(id);
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        useBrowserStore.getState().reopenClosedTab();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const s = useBrowserStore.getState();
        const id = s.activeTabId;
        if (id && e.shiftKey) void api.tabs.reloadIgnoringCache(id);
        else s.reload();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[placeholder="Search or enter website name..."]');
        input?.focus();
        input?.select();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        useBrowserStore.getState().setFindBarOpen(true);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        useBrowserStore.getState().savePage();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const s = useBrowserStore.getState();
        s.setBookmarksBarVisible(!s.bookmarksBarVisible);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        void useBrowserStore.getState().toggleBookmarkActive();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (e.shiftKey) useBrowserStore.getState().newIncognitoWindow();
        else useBrowserStore.getState().newWindow();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        useBrowserStore.getState().toggleDevTools();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        useBrowserStore.getState().toggleDevTools('bottom');
      } else if (isCmdOrCtrl && e.key.toLowerCase() === ',') {
        e.preventDefault();
        useBrowserStore.getState().openSettings();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        useBrowserStore.getState().viewSource();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        useBrowserStore.getState().setSidebar(true, 'bookmarks');
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        useBrowserStore.getState().setSidebar(true, 'history');
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        useBrowserStore.getState().openSettings('downloads');
      } else if (isCmdOrCtrl && e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        void useBrowserStore.getState().clearBrowsingData();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        useBrowserStore.getState().exit();
      } else if (isCmdOrCtrl && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const s = useBrowserStore.getState();
        const index = e.key === '9' ? s.tabs.length - 1 : Number(e.key) - 1;
        const tab = s.tabs[index];
        if (tab) s.activateTab(tab.id);
      } else if (e.key === 'F11') {
        e.preventDefault();
        useBrowserStore.getState().toggleFullscreen();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        useBrowserStore.getState().print();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        useBrowserStore.getState().viewSource();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        useBrowserStore.getState().goBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        useBrowserStore.getState().goForward();
      } else if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const s = useBrowserStore.getState();
        const allTabs = s.tabs;
        const idx = allTabs.findIndex((t) => t.id === s.activeTabId);
        if (e.shiftKey) {
          const prev = allTabs[(idx - 1 + allTabs.length) % allTabs.length];
          if (prev) s.activateTab(prev.id);
        } else {
          const next = allTabs[(idx + 1) % allTabs.length];
          if (next) s.activateTab(next.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Chrome surfaces are rendered in this process, so forward their right-clicks
  // to the same native menu used by real web pages.
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      // Do not trigger native context menu on tabs, bookmarks, or header/aside surfaces
      if (target?.closest('[data-sidebar-surface], header, aside, .glass-panel, button, input, textarea, [data-tab-id]')) {
        return;
      }
      event.preventDefault();
      const editable = !!target?.closest('input, textarea, [contenteditable="true"]');
      void api.app.showContextMenu(event.clientX, event.clientY, editable);
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  if (!initialized) {
    return <div className="h-full" style={{ background: 'var(--app-bg, #1e1914)' }} />;
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden" style={{ background: 'transparent' }}>
      {/* ── Glassmorphic Chrome Header ── */}
      {!fullscreen && <header ref={headerRef} className={`glass-bar relative z-20 shrink-0 select-none ${incognito ? 'incognito-shell' : ''}`}>
        {/* Tab strip — only when multiple tabs are open */}
        {showTabStrip && (
          <div className="flex items-center pr-2 border-b border-white/[0.06]">
            <TrafficLightsSpacer />
            <TabBar />
            <TrafficLights />
          </div>
        )}

        {/* Main navigation bar */}
        <div className="no-drag">
          <AddressBar showTrafficLights={!showTabStrip} />
        </div>

        {/* Bookmarks Bar */}
        {bookmarksBarVisible && (
          <div className="no-drag border-t border-white/[0.06]">
            <BookmarksBar />
          </div>
        )}
      </header>}

      {/* ── Floating Find in Page Popup ── */}
      {findBarOpen && (
        <div className="fixed top-14 right-6 z-50 animate-menu-in no-drag">
          <FindBar />
        </div>
      )}

      {/* ── Settings Page ── */}
      {isSettings && (
        <div className={`page-shell flex-1 overflow-hidden relative z-10 ${isVerticalTabs ? 'page-shell-shifted' : ''}`}>
          <SettingsPage url={activeTab?.url} />
        </div>
      )}

      {/* ── New Tab / Dashboard Page ── */}
      {isNewTab && !isSettings && (
        <div className={`page-shell flex-1 overflow-hidden relative z-10 ${isVerticalTabs ? 'page-shell-shifted' : ''}`}>
          <NewTab />
        </div>
      )}

      {/* ── Vertical Tabs Bar (Zen / Edge style) ── */}
      {!fullscreen && isVerticalTabs && <VerticalTabBar />}

      {/* Downloads Pill */}
      <DownloadsPill />
    </div>
  );
}

function DownloadsPill() {
  const [toast, setToast] = useState<DownloadItem | null>(null);
  const firstUpdate = useRef(true);
  const toastTimer = useRef<number | null>(null);
  const previousStates = useRef(new Map<string, DownloadItem['state']>());
  const downloads = useBrowserStore((s) => s.downloads);
  const initialized = useBrowserStore((s) => s.initialized);
  const downloadPopupOpen = useBrowserStore((s) => s.downloadPopupOpen);
  const setDownloadPopupOpen = useBrowserStore((s) => s.setDownloadPopupOpen);
  const openSettings = useBrowserStore((s) => s.openSettings);
  const active = downloads.find((d) => d.state === 'progressing' || d.state === 'paused');

  useEffect(() => {
    if (!initialized) return;
    const nextStates = new Map(downloads.map((download) => [download.id, download.state]));
    if (firstUpdate.current) {
      firstUpdate.current = false;
      previousStates.current = nextStates;
      return;
    }

    const newDownload = downloads.find((download) => !previousStates.current.has(download.id));
    const completedDownload = downloads.find((download) => download.state === 'completed' && previousStates.current.get(download.id) !== 'completed');
    previousStates.current = nextStates;
    const changed = newDownload ?? completedDownload;
    if (!changed) return;

    setToast(changed);
    setDownloadPopupOpen(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      setDownloadPopupOpen(false);
    }, 5000);
  }, [downloads, initialized]);

  const visible = toast ?? active;
  useEffect(() => {
    if (downloadPopupOpen || visible) void api.app.showDownloadPopup();
    else void api.app.hideDownloadPopup();
  }, [downloadPopupOpen, visible]);

  return null;
}

function DownloadPopupPanel() {
  const downloads = useBrowserStore((s) => s.downloads);
  const openSettings = useBrowserStore((s) => s.openSettings);

  return (
    <div className="download-popup-panel w-full glass-panel p-4 shadow-2xl text-[13px] pointer-events-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-semibold text-[var(--color-text-primary)]">Recent download history</span>
        <button onClick={() => void api.app.hideDownloadPopup()} className="nav-pill w-7 h-7" title="Close downloads"><Icon name="x" size={15} /></button>
      </div>

      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {downloads.slice(0, 5).map((download) => {
          const pct = download.totalBytes ? Math.round((download.receivedBytes / download.totalBytes) * 100) : 0;
          const status = download.state === 'completed' ? 'Download complete' : download.state === 'interrupted' ? 'Site wasn’t available' : download.state === 'cancelled' ? 'Cancelled' : download.state === 'paused' ? 'Paused' : `Downloading · ${pct}%`;
          return (
            <button key={download.id} onClick={() => { if (download.state === 'completed') void api.downloads.open(download.id); else if (download.state === 'paused') void api.downloads.resume(download.id); }} className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-[var(--theme-hover-bg)] transition-colors">
              <span className={`w-7 h-7 rounded-md grid place-items-center shrink-0 ${download.state === 'interrupted' ? 'bg-red-500/15 text-red-400' : 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]'}`}><Icon name="download" size={15} /></span>
              <span className="min-w-0 flex-1"><span className="block font-medium truncate text-[var(--color-text-primary)]">{download.filename}</span><span className={`block text-[11px] truncate ${download.state === 'interrupted' ? 'text-red-400' : 'text-[var(--color-text-secondary)]'}`}>{status}</span></span>
              {download.state === 'paused' && <span className="text-[11px] text-[var(--theme-primary)]">Resume</span>}
            </button>
          );
        })}
        {downloads.length === 0 && <div className="py-8 text-center text-[var(--color-text-secondary)]">No recent downloads</div>}
      </div>

      <button onClick={() => { void api.app.hideDownloadPopup(); openSettings('downloads'); }} className="w-full border-t border-white/10 mt-3 pt-3 flex items-center justify-between text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--theme-primary)] transition-colors">
        <span>Full download history</span><Icon name="external" size={16} />
      </button>
    </div>
  );
}
