import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBrowserStore } from './store/browserStore';
import { api } from './lib/api';
import { TrafficLights, TrafficLightsSpacer } from './components/chrome/TrafficLights';
import { BookmarksBar } from './components/chrome/BookmarksBar';
import { TabBar } from './components/tabbar/TabBar';
import { AddressBar } from './components/addressbar/AddressBar';
import { Sidebar } from './components/sidebar/Sidebar';
import { SettingsPage } from './components/settings/SettingsPage';
import { NewTab } from './components/newtab/NewTab';

import { AppMenu } from './components/chrome/AppMenu';
import { applyAppearanceMode } from './lib/theme';
import type { DownloadItem, Suggestion } from '@shared/types';
import { Icon } from './components/common/Icon';

export function App() {
  if (window.location.hash.startsWith('#/app-menu')) {
    return <StandaloneAppMenu />;
  }
  if (window.location.hash.startsWith('#/suggestions')) {
    return <StandaloneSuggestions />;
  }
  if (window.location.hash.startsWith('#/download-popup')) {
    return <StandaloneDownloadPopup />;
  }
  return <ChromeShell />;
}

function StandaloneSuggestions() {
  const init = useBrowserStore((s) => s.init);
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const initialQuery = params.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    void init();
    const unsubscribe = api.onSuggestionsChanged(setQuery);
    return () => { unsubscribe(); };
  }, [init]);

  useEffect(() => {
    let cancelled = false;
    void api.app.getSuggestions(query).then((value) => {
      if (!cancelled) setSuggestions((value as Suggestion[]).slice(0, 6));
    });
    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="suggestions-overlay h-full w-full p-2 pointer-events-none">
      <div className="suggestions-overlay-panel pointer-events-auto w-full rounded-2xl p-2 shadow-2xl animate-menu-in">
        {suggestions.map((suggestion) => (
          <button
            key={`${suggestion.type}:${suggestion.url}`}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              useBrowserStore.getState().navigateActive(suggestion.url);
              void api.app.hideSuggestions();
            }}
            className="suggestions-overlay-item w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-xl transition-colors"
          >
            <Icon name={suggestion.type === 'history' ? 'clock' : suggestion.type === 'bookmark' ? 'bookmark' : 'search'} size={14} />
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium truncate">{suggestion.title}</span>{suggestion.type !== 'search' && <span className="block text-[11px] truncate text-[var(--color-text-secondary)]">{suggestion.url}</span>}</span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full suggestions-overlay-badge">{suggestion.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StandaloneDownloadPopup() {
  const init = useBrowserStore((s) => s.init);
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void init();
  }, [init]);
  useEffect(() => {
    if (!popupRef.current) return;
    const reportSize = () => {
      const height = popupRef.current?.getBoundingClientRect().height ?? 0;
      if (height > 0) void api.app.resizeDownloadPopup(Math.ceil(height));
    };
    const observer = new ResizeObserver(reportSize);
    observer.observe(popupRef.current);
    reportSize();
    return () => observer.disconnect();
  }, []);
  return <div ref={popupRef} className="w-full pointer-events-none"><DownloadPopupPanel /></div>;
}

function StandaloneAppMenu() {
  const init = useBrowserStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const x = parseInt(params.get('x') || '0', 10);
  const y = parseInt(params.get('y') || '0', 10);

  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent pointer-events-auto">
      <AppMenu
        isOpen={true}
        onClose={() => {
          void api.app.setAppMenuOpen(false);
        }}
        standalone={true}
        customPos={{ x, y }}
      />
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
  const fullscreen = useBrowserStore((s) => s.fullscreen);

  const isSettings = activeTab?.url
    ? activeTab.url.startsWith('lumen://settings') ||
      activeTab.url === 'about:settings' ||
      activeTab.url === 'chrome://settings'
    : false;

  const isNewTab =
    !activeTab?.url ||
    activeTab.url === 'lumen://newtab' ||
    activeTab.url === 'about:newtab' ||
    activeTab.url === 'about:blank' ||
    activeTab.url.includes('honeyquote.com');

  const showTabStrip = true;

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
  }, [initialized, activeTab?.id, showTabStrip, bookmarksBarVisible, fullscreen]);

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
        const query = window.prompt('Find in page');
        if (query) void api.tabs.find(query);
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Chrome surfaces are rendered in this process, so forward their right-clicks
  // to the same native menu used by real web pages.
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-sidebar-surface]')) return;
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

      {/* ── Settings Page ── */}
      {isSettings && (
        <div className={`page-shell flex-1 overflow-hidden relative z-10 ${sidebarOpen && sidebarPinned ? 'page-shell-shifted' : ''}`}>
          <SettingsPage url={activeTab?.url} />
        </div>
      )}

      {/* ── New Tab / Dashboard Page ── */}
      {isNewTab && !isSettings && (
        <div className={`page-shell flex-1 overflow-hidden relative z-10 ${sidebarOpen && sidebarPinned ? 'page-shell-shifted' : ''}`}>
          <NewTab />
        </div>
      )}

      {/* ── Sidebar ── */}
      {!fullscreen && <Sidebar />}

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
