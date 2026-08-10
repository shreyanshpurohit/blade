import { BrowserWindow, WebContentsView, session as electronSession } from 'electron';
import { randomUUID } from 'node:crypto';
import { SIDEBAR_WIDTH } from '../windows/WindowManager';
import { IPC } from '../../shared/types';
import type { TabState, TabGroupState, WindowState, SidebarPanel, SecurityState } from '../../shared/types';
import { recordVisit, updateDwellTime } from '../store/history';
import { getSetting } from '../store/database';
import { WindowManager } from '../windows/WindowManager';
import { injectFingerprintProtection } from '../shields/fingerprint';
import { installShieldsOnSession, COSMETIC_AD_BLOCK_CSS, getShieldsConfig } from '../shields/shields';

type Session = typeof electronSession.defaultSession;

interface Tab {
  id: string;
  view: WebContentsView;
  pinned: boolean;
  groupId: string | null;
  hibernated: boolean;
  hibernatedUrl: string | null;
  state: Omit<TabState, 'id' | 'pinned' | 'groupId' | 'hibernated'>;
}

const HIBERNATE_AFTER_MS = 15 * 60 * 1000;

/** Default New Tab page loads the History-Terrain terminal view */
export const NEW_TAB_URL = 'lumen://newtab';

function detectSecurityState(url: string, certError = false): SecurityState {
  if (certError) return 'insecure';
  if (!url || url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('lumen:') || url.startsWith('file:')) {
    return 'internal';
  }
  if (url.startsWith('https://')) return 'secure';
  if (url.startsWith('http://')) return 'warning';
  return 'warning';
}

export class TabManager {
  private win: BrowserWindow;
  private ses: Session;
  private incognito: boolean;
  private tabs: Tab[] = [];
  private groups: TabGroupState[] = [];
  activeTabId: string | null = null;
  sidebarOpen = false;
  sidebarPanel: SidebarPanel = 'history';
  appMenuOpen = false;
  private chromeHeight = 60; // Glassmorphic address bar height: 60px
  private hibernateTimers = new Map<string, NodeJS.Timeout>();

  // Dwell tracking
  private activeUrl: string | null = null;
  private activeStartTime: number = Date.now();

  constructor(win: BrowserWindow, ses: Session, incognito: boolean) {
    this.win = win;
    this.ses = ses;
    this.incognito = incognito;
    installShieldsOnSession(ses);

    // Track window focus/blur for accurate dwell time estimation
    this.win.on('blur', () => {
      this.flushDwellTime();
    });
    this.win.on('focus', () => {
      this.activeStartTime = Date.now();
    });
  }

  private flushDwellTime() {
    if (!this.incognito && this.activeUrl && !this.activeUrl.startsWith('lumen:') && !this.activeUrl.startsWith('about:')) {
      const elapsed = Date.now() - this.activeStartTime;
      if (elapsed > 1000) {
        updateDwellTime(this.activeUrl, elapsed);
      }
    }
    this.activeStartTime = Date.now();
  }

  createTab(url?: string, opts: { activate?: boolean; pinned?: boolean } = {}): string {
    const id = randomUUID();
    const homepage = getSetting('homepage', 'lumen://newtab');
    const target = url ? normalizeUrl(url) : (homepage || NEW_TAB_URL);
    const isInternal = isInternalUrl(target);

    const view = new WebContentsView({
      webPreferences: {
        session: this.ses,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    const tab: Tab = {
      id,
      view,
      pinned: opts.pinned ?? false,
      groupId: null,
      hibernated: false,
      hibernatedUrl: null,
      state: {
        url: target,
        title: isInternal ? (target.includes('settings') ? 'Settings' : 'History Terrain // New Tab') : 'Terminal Tab',
        favicon: null,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        muted: false,
        audible: false,
        zoomFactor: 1.0,
        securityState: detectSecurityState(target),
        themeColor: null,
      },
    };

    this.wireWebContents(tab);
    this.tabs.push(tab);

    this.loadUrl(tab, target);

    if (opts.activate !== false) {
      this.activateTab(id);
    }
    this.emitState();
    return id;
  }

  openSettingsTab(section?: string) {
    const targetUrl = section ? `lumen://settings#${section}` : 'lumen://settings';
    const existing = this.tabs.find((t) => t.state.url.startsWith('lumen://settings'));
    if (existing) {
      existing.state.url = targetUrl;
      this.activateTab(existing.id);
      this.emitState();
    } else {
      this.createTab(targetUrl, { activate: true });
    }
  }

  private loadUrl(tab: Tab, url: string) {
    const isInternal = isInternalUrl(url);
    if (isInternal) {
      tab.state.url = url;
      tab.state.title = url.includes('settings') ? 'Settings' : 'History Terrain // New Tab';
      tab.state.favicon = null;
      tab.state.isLoading = false;
      tab.state.securityState = 'internal';
      if (tab.id === this.activeTabId) {
        this.detachView(tab);
      }
      this.emitState();
      return;
    }

    const normalized = normalizeUrl(url);
    tab.state.url = normalized;
    tab.state.securityState = detectSecurityState(normalized);

    if (tab.id === this.activeTabId) {
      if (!this.win.contentView.children.includes(tab.view)) {
        this.win.contentView.addChildView(tab.view);
      }
      this.relayout();
    }
    tab.view.webContents.loadURL(normalized).catch(() => {
      /* load failures surface via did-fail-load */
    });
  }

  private wireWebContents(tab: Tab) {
    const wc = tab.view.webContents;

    wc.on('did-start-loading', () => {
      tab.state.isLoading = true;
      this.emitState();
    });

    wc.on('did-stop-loading', () => {
      tab.state.isLoading = false;
      this.syncNavState(tab);
      this.emitState();
    });

    wc.on('dom-ready', () => {
      const cfg = getShieldsConfig();
      if (cfg.enabled && cfg.adBlockEnabled) {
        wc.insertCSS(COSMETIC_AD_BLOCK_CSS).catch(() => {});
      }
    });

    wc.on('did-navigate', (_e, url) => {
      this.flushDwellTime();
      this.activeUrl = url;
      this.activeStartTime = Date.now();

      tab.state.url = url;
      tab.state.securityState = detectSecurityState(url);
      this.syncNavState(tab);

      if (!this.incognito && !isInternalUrl(url)) {
        recordVisit(url, tab.state.title);
      }
      this.emitState();
    });

    wc.on('did-navigate-in-page', (_e, url) => {
      this.flushDwellTime();
      this.activeUrl = url;
      this.activeStartTime = Date.now();

      tab.state.url = url;
      tab.state.securityState = detectSecurityState(url);
      this.syncNavState(tab);
      this.emitState();
    });

    wc.on('certificate-error', (event, url, _error) => {
      event.preventDefault();
      tab.state.securityState = 'insecure';
      this.emitState();
    });

    wc.on('page-title-updated', (_e, title) => {
      tab.state.title = title || tab.state.url;
      if (!this.incognito && !isInternalUrl(tab.state.url)) {
        recordVisit(tab.state.url, title);
      }
      this.emitState();
    });

    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.state.favicon = favicons[0] ?? null;
      this.emitState();
    });

    wc.on('did-change-theme-color', (_e, color) => {
      tab.state.themeColor = color || null;
      this.emitState();
    });

    wc.on('media-started-playing', () => {
      tab.state.audible = true;
      this.emitState();
    });

    wc.on('media-paused', () => {
      tab.state.audible = false;
      this.emitState();
    });

    wc.on('audio-state-changed', (event) => {
      tab.state.audible = event.audible;
      tab.state.muted = wc.isAudioMuted();
      this.emitState();
    });

    wc.on('before-input-event', (event, input) => {
      // Activity pulse updates dwell timer
      if (input.type === 'keyDown' && !this.incognito && this.activeUrl) {
        this.flushDwellTime();
      }

      if (input.type !== 'keyDown') return;
      const isCmdOrCtrl = input.control || input.meta;

      if (isCmdOrCtrl && (input.key === '=' || input.key === '+' || input.key === 'Add')) {
        this.zoomIn(tab.id);
        event.preventDefault();
      } else if (isCmdOrCtrl && (input.key === '-' || input.key === 'Subtract')) {
        this.zoomOut(tab.id);
        event.preventDefault();
      } else if (isCmdOrCtrl && (input.key === '0' || input.key === 'Num0')) {
        this.zoomReset(tab.id);
        event.preventDefault();
      } else if (isCmdOrCtrl && input.key.toLowerCase() === 'p') {
        this.print(tab.id);
        event.preventDefault();
      } else if (input.key === 'F11') {
        this.win.setFullScreen(!this.win.isFullScreen());
        event.preventDefault();
      } else if ((isCmdOrCtrl && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
        this.toggleDevTools(tab.id);
        event.preventDefault();
      } else if (isCmdOrCtrl && input.key.toLowerCase() === 'u') {
        this.viewSource(tab.id);
        event.preventDefault();
      } else if (isCmdOrCtrl && input.key.toLowerCase() === 't') {
        this.createTab();
        event.preventDefault();
      } else if (isCmdOrCtrl && input.key.toLowerCase() === 'w') {
        this.closeTab(tab.id);
        event.preventDefault();
      }
    });

    // Handle new tabs opened by web content
    wc.setWindowOpenHandler(({ url }) => {
      if (url.includes('#/settings') || url === 'lumen://settings' || url === 'about:settings') {
        this.openSettingsTab();
        return { action: 'deny' };
      }
      if (url.startsWith('http') || url.startsWith('file:')) {
        this.createTab(url);
      }
      return { action: 'deny' };
    });

    // Fingerprint protection
    injectFingerprintProtection(wc);
  }

  private syncNavState(tab: Tab) {
    const nav = tab.view.webContents.navigationHistory;
    tab.state.canGoBack = nav.canGoBack();
    tab.state.canGoForward = nav.canGoForward();
  }

  activateTab(id: string) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;

    this.flushDwellTime();
    this.activeTabId = id;
    this.activeUrl = tab.state.url;
    this.activeStartTime = Date.now();

    this.resetHibernateTimer(id);

    // Detach previous views
    for (const t of this.tabs) {
      this.detachView(t);
    }

    if (isInternalUrl(tab.state.url)) {
      // Internal page (e.g. New Tab / Settings): view remains detached so React shows the internal component
      this.emitState();
      return;
    }

    // Wake from hibernation
    if (tab.hibernated && tab.hibernatedUrl) {
      tab.hibernated = false;
      const targetUrl = tab.hibernatedUrl;
      tab.hibernatedUrl = null;
      tab.view = new WebContentsView({
        webPreferences: {
          session: this.ses,
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
        },
      });
      this.wireWebContents(tab);
      this.loadUrl(tab, targetUrl);
    }

    this.win.contentView.addChildView(tab.view);
    this.relayout();

    tab.view.webContents.focus();
    this.emitState();
  }

  private detachView(tab: Tab) {
    try {
      this.win.contentView.removeChildView(tab.view);
    } catch {
      /* already detached */
    }
  }

  closeTab(id: string) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    if (this.activeTabId === id) {
      this.flushDwellTime();
    }

    const [tab] = this.tabs.splice(idx, 1);
    this.clearHibernateTimer(id);
    this.detachView(tab);
    tab.view.webContents.close();

    if (this.tabs.length === 0) {
      this.win.close();
      return;
    }
    if (this.activeTabId === id) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      this.activateTab(next.id);
    } else {
      this.emitState();
    }
  }

  navigate(id: string, url: string) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    this.loadUrl(tab, url);
    this.emitState();
  }

  goBack(id: string) {
    this.tabs.find((t) => t.id === id)?.view.webContents.navigationHistory.goBack();
  }

  goForward(id: string) {
    this.tabs.find((t) => t.id === id)?.view.webContents.navigationHistory.goForward();
  }

  reload(id: string) {
    this.tabs.find((t) => t.id === id)?.view.webContents.reload();
  }

  stop(id: string) {
    this.tabs.find((t) => t.id === id)?.view.webContents.stop();
  }

  togglePin(id: string) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    tab.pinned = !tab.pinned;
    this.tabs.sort((a, b) => Number(b.pinned) - Number(a.pinned));
    this.emitState();
  }

  toggleMute(id: string) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;
    const wc = tab.view.webContents;
    wc.setAudioMuted(!wc.isAudioMuted());
    tab.state.muted = !tab.state.muted;
    this.emitState();
  }

  moveTab(id: string, toIndex: number) {
    const from = this.tabs.findIndex((t) => t.id === id);
    if (from === -1) return;
    const [tab] = this.tabs.splice(from, 1);
    this.tabs.splice(Math.max(0, Math.min(toIndex, this.tabs.length)), 0, tab);
    this.emitState();
  }

  hibernate(id: string) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab || tab.pinned || tab.id === this.activeTabId || tab.hibernated) return;
    tab.hibernated = true;
    tab.hibernatedUrl = tab.state.url;
    this.detachView(tab);
    tab.view.webContents.close();
    this.emitState();
  }

  private resetHibernateTimer(id: string) {
    const mins = Number(getSetting('hibernateMinutes', '10')) || 10;
    const hibernateMs = Math.max(1, mins) * 60 * 1000;

    for (const tab of this.tabs) {
      this.clearHibernateTimer(tab.id);
      if (tab.id !== id && !tab.pinned && !tab.hibernated) {
        const timer = setTimeout(() => this.hibernate(tab.id), hibernateMs);
        this.hibernateTimers.set(tab.id, timer);
      }
    }
  }

  private clearHibernateTimer(id: string) {
    const t = this.hibernateTimers.get(id);
    if (t) clearTimeout(t);
    this.hibernateTimers.delete(id);
  }

  searchTabs(query: string): TabState[] {
    const q = query.toLowerCase();
    return this.tabStates().filter(
      (t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q),
    );
  }

  setSidebarOpen(open: boolean, panel?: SidebarPanel) {
    this.sidebarOpen = open;
    if (panel) this.sidebarPanel = panel;
    this.relayout();
  }

  setChromeHeight(px: number) {
    this.chromeHeight = px;
    this.relayout();
  }

  setAppMenuOpen(open: boolean) {
    this.appMenuOpen = open;
    this.relayout();
    this.emitState();
  }

  /** Recompute active web contents bounds from window size + chrome layout. */
  relayout() {
    const active = this.tabs.find((t) => t.id === this.activeTabId);
    if (!active || active.hibernated || isInternalUrl(active.state.url)) return;
    const [width, height] = this.win.getContentSize();
    const x = this.sidebarOpen ? SIDEBAR_WIDTH : 0;
    active.view.setBounds({
      x,
      y: this.chromeHeight,
      width: Math.max(0, width - x),
      height: Math.max(0, height - this.chromeHeight),
    });
  }

  tabStates(): TabState[] {
    return this.tabs.map((t) => ({
      id: t.id,
      pinned: t.pinned,
      groupId: t.groupId,
      hibernated: t.hibernated,
      ...t.state,
    }));
  }

  groupStates(): TabGroupState[] {
    return this.groups;
  }

  getZoom(id?: string): number {
    const tabId = id ?? this.activeTabId;
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return 1.0;
    return tab.state.zoomFactor ?? 1.0;
  }

  setZoom(factor: number, id?: string): number {
    const tabId = id ?? this.activeTabId;
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return 1.0;
    const clamped = Math.max(0.25, Math.min(5.0, Math.round(factor * 100) / 100));
    tab.state.zoomFactor = clamped;
    try {
      tab.view.webContents.setZoomFactor(clamped);
    } catch {
      /* ignore */
    }
    this.emitState();
    return clamped;
  }

  zoomIn(id?: string): number {
    const current = this.getZoom(id);
    const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0];
    const next = ZOOM_LEVELS.find((lvl) => lvl > current + 0.01) ?? Math.min(5.0, current + 0.25);
    return this.setZoom(next, id);
  }

  zoomOut(id?: string): number {
    const current = this.getZoom(id);
    const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0];
    const prev = [...ZOOM_LEVELS].reverse().find((lvl) => lvl < current - 0.01) ?? Math.max(0.25, current - 0.25);
    return this.setZoom(prev, id);
  }

  zoomReset(id?: string): number {
    return this.setZoom(1.0, id);
  }

  print(id?: string) {
    const tabId = id ?? this.activeTabId;
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    try {
      tab.view.webContents.print();
    } catch {
      /* ignore */
    }
  }

  toggleDevTools(id?: string, mode: 'right' | 'bottom' | 'detach' = 'right') {
    const tabId = id ?? this.activeTabId;
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    try {
      if (tab.view.webContents.isDevToolsOpened()) {
        tab.view.webContents.closeDevTools();
      } else {
        tab.view.webContents.openDevTools({ mode });
      }
    } catch {
      /* ignore */
    }
  }

  viewSource(id?: string) {
    const tabId = id ?? this.activeTabId;
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab || !tab.state.url.startsWith('http')) return;
    this.createTab(`view-source:${tab.state.url}`);
  }

  private pendingEmit = false;
  private pendingOverrides: Partial<WindowState> = {};

  emitState(overrides: Partial<WindowState> = {}) {
    if (this.win.isDestroyed()) return;
    Object.assign(this.pendingOverrides, overrides);

    if (!this.pendingEmit) {
      this.pendingEmit = true;
      setImmediate(() => {
        this.pendingEmit = false;
        if (this.win.isDestroyed()) return;
        const currentOverrides = { ...this.pendingOverrides };
        this.pendingOverrides = {};
        const state = WindowManager.stateFor(this.win.id, currentOverrides);
        this.win.webContents.send(IPC.StateChanged, state);
      });
    }
  }

  destroyAll() {
    this.flushDwellTime();
    for (const t of this.tabs) {
      this.clearHibernateTimer(t.id);
      try {
        t.view.webContents.close();
      } catch {
        /* window already tearing down */
      }
    }
    this.tabs = [];
  }
}

function isInternalUrl(url: string): boolean {
  if (!url) return true;
  return (
    url === 'lumen://newtab' ||
    url === 'about:newtab' ||
    url === 'about:blank' ||
    url.startsWith('lumen://settings') ||
    url === 'about:settings' ||
    url === 'chrome://settings'
  );
}

const SEARCH_ENGINES: Record<string, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
};

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (isInternalUrl(trimmed)) {
    return trimmed.startsWith('lumen://settings') || trimmed.includes('settings')
      ? 'lumen://settings'
      : 'lumen://newtab';
  }
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  // Looks like a domain?
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(trimmed) && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }
  const engine = SEARCH_ENGINES[getSetting('searchEngine', 'google')] ?? SEARCH_ENGINES.google;
  return `${engine}${encodeURIComponent(trimmed)}`;
}
