import { useEffect, useLayoutEffect, useRef } from 'react';
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

export function App() {
  if (window.location.hash.startsWith('#/app-menu')) {
    return <StandaloneAppMenu />;
  }
  return <ChromeShell />;
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
  const tabs = useBrowserStore((s) => s.tabs);

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
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = headerRef.current?.getBoundingClientRect().height ?? entry.contentRect.height;
        if (height > 0) {
          void api.app.setChromeHeight(Math.round(height));
        }
      }
    });
    observer.observe(headerRef.current);
    
    // Initial measure
    const initialHeight = headerRef.current.getBoundingClientRect().height;
    if (initialHeight > 0) {
      void api.app.setChromeHeight(Math.round(initialHeight));
    }
    
    return () => observer.disconnect();
  }, [initialized, activeTab?.id, showTabStrip, bookmarksBarVisible]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

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
        useBrowserStore.getState().setSidebar(true, 'downloads');
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

  // Adaptive tinting based on theme color
  useEffect(() => {
    const root = document.documentElement;
    const themeColor = activeTab?.themeColor;
    
    if (themeColor) {
      // Parse the hex color and create a muted/darkened version for surfaces
      root.style.setProperty('--adaptive-accent', themeColor);
      // Create a darkened version (10% opacity) for surface tinting
      root.style.setProperty('--glass-bar-bg', `color-mix(in srgb, ${themeColor} 8%, rgba(20, 18, 15, 0.72))`);
      root.style.setProperty('--color-surface', `color-mix(in srgb, ${themeColor} 6%, rgba(30, 25, 20, 0.65))`);
    } else {
      // Neutral dark gray fallback
      root.style.setProperty('--glass-bar-bg', 'rgba(26, 26, 26, 0.72)');
      root.style.setProperty('--color-surface', 'rgba(26, 26, 26, 0.65)');
    }
  }, [activeTab?.themeColor]);

  if (!initialized) {
    return <div className="h-full" style={{ background: 'var(--app-bg, #1e1914)' }} />;
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden" style={{ background: 'transparent' }}>
      {/* ── Glassmorphic Chrome Header ── */}
      <header ref={headerRef} className="glass-bar relative z-20 shrink-0 select-none">
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
      </header>

      {/* ── Settings Page ── */}
      {isSettings && (
        <div
          className={`flex-1 overflow-hidden relative z-10 transition-all duration-300 ease-out ${
            sidebarOpen ? 'ml-[320px]' : ''
          }`}
        >
          <SettingsPage url={activeTab?.url} />
        </div>
      )}

      {/* ── New Tab / Dashboard Page ── */}
      {isNewTab && !isSettings && (
        <div
          className={`flex-1 overflow-hidden relative z-10 transition-all duration-300 ease-out ${
            sidebarOpen ? 'ml-[320px]' : ''
          }`}
        >
          <NewTab />
        </div>
      )}

      {/* ── Sidebar ── */}
      <Sidebar />

      {/* Downloads Pill */}
      <DownloadsPill />
    </div>
  );
}

function DownloadsPill() {
  const downloads = useBrowserStore((s) => s.downloads);
  const setSidebar = useBrowserStore((s) => s.setSidebar);
  const active = downloads.find((d) => d.state === 'progressing' || d.state === 'paused');
  if (!active) return null;

  const pct = active.totalBytes ? Math.round((active.receivedBytes / active.totalBytes) * 100) : 0;
  return (
    <button
      onClick={() => setSidebar(true, 'downloads')}
      className="absolute bottom-4 right-4 z-30 glass-panel px-4 py-2.5 flex items-center gap-3
        text-[12px] font-medium animate-menu-in hover:bg-white/10 transition-all cursor-pointer"
    >
      <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" style={{ animation: 'gentle-pulse 2s ease-in-out infinite' }} />
      <span className="text-[var(--color-text-primary)] truncate max-w-[160px]">{active.filename}</span>
      <span className="text-[var(--color-text-secondary)] font-semibold">{pct}%</span>
    </button>
  );
}
