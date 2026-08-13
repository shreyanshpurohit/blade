import { app, BrowserWindow, WebContentsView, session as electronSession, Menu, clipboard, dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IPC } from '../../shared/types';
import type { TabState, TabGroupState, WindowState, SidebarPanel, SecurityState } from '../../shared/types';
import { clearHistory, recordVisit, updateDwellTime } from '../store/history';
import { getSetting, setSetting } from '../store/database';
import { toggleBookmark } from '../store/bookmarks';
import { WindowManager, SIDEBAR_WIDTH } from '../windows/WindowManager';
import { injectFingerprintProtection } from '../shields/fingerprint';
import { installShieldsOnSession, COSMETIC_AD_BLOCK_CSS, getShieldsConfig } from '../shields/shields';
import { recordCompletedDownload } from '../downloads';

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
  sidebarPinned = false;
  sidebarPanel: SidebarPanel = 'history';
  appMenuOpen = false;
  private chromeHeight = 92 + (getSetting('bookmarksBarVisible', 'true') === 'true' ? 36 : 0);
  private hibernateTimers = new Map<string, NodeJS.Timeout>();
  private closedTabs: string[] = [];
  private userAgent = '';

  // Dwell tracking
  private activeUrl: string | null = null;
  private activeStartTime: number = Date.now();

  constructor(win: BrowserWindow, ses: Session, incognito: boolean) {
    this.win = win;
    this.ses = ses;
    this.incognito = incognito;
    this.sidebarPinned = getSetting('sidebarPinned', 'false') === 'true';
    this.userAgent = getSetting('devUserAgent', 'default');
    installShieldsOnSession(ses);
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      let origin = '';
      try { origin = new URL(webContents.getURL()).origin; } catch { /* non-web URL */ }
      const decision = origin ? getSetting(`permission:${origin}:${permission}`, 'ask') : 'ask';
      callback(decision === 'allow');
    });

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

  createTab(url?: string, opts: { activate?: boolean; pinned?: boolean; afterId?: string } = {}): string {
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
        title: isInternal ? (target.includes('settings') ? 'Settings' : 'Lumen Home') : 'Terminal Tab',
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
    this.applyUserAgent(tab.view.webContents);
    const afterIndex = opts.afterId ? this.tabs.findIndex((candidate) => candidate.id === opts.afterId) : -1;
    if (afterIndex >= 0) this.tabs.splice(afterIndex + 1, 0, tab);
    else this.tabs.push(tab);

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
      tab.state.title = url.includes('settings') ? 'Settings' : 'Lumen Home';
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

      this.handleBrowserShortcut(event, input, tab.id);
    });

    wc.on('context-menu', (_event, params) => {
      this.popupContextMenu(tab.id, params);
    });

    // Web sites such as YouTube use HTML fullscreen rather than F11. Hide
    // browser chrome for that mode as well, then restore it on exit.
    wc.on('enter-html-full-screen', () => this.setFullscreen(true));
    wc.on('leave-html-full-screen', () => this.setFullscreen(false));

    // Handle new tabs opened by web content
    wc.setWindowOpenHandler(({ url }) => {
      if (url.includes('#/settings') || url === 'lumen://settings' || url === 'about:settings') {
        this.openSettingsTab();
        return { action: 'deny' };
      }
      if (url.startsWith('http') || url.startsWith('file:')) {
        this.createTab(url, { afterId: tab.id });
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
      this.applyUserAgent(tab.view.webContents);
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
      // The view may already be detached or have been destroyed.
    }
  }

  closeTab(id: string) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;

    if (this.activeTabId === id) {
      this.flushDwellTime();
    }

    const [tab] = this.tabs.splice(idx, 1);
    if (!isInternalUrl(tab.state.url)) {
      this.closedTabs.unshift(tab.state.url);
      this.closedTabs = this.closedTabs.slice(0, 10);
    }
    this.clearHibernateTimer(id);
    try {
      this.win.contentView.removeChildView(tab.view);
    } catch {
      /* already detached */
    }
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

  reopenClosedTab() {
    const url = this.closedTabs.shift();
    if (url) this.createTab(url);
  }

  /** Handle shortcuts from either the chrome renderer or the active tab view. */
  handleBrowserShortcut(
    event: { preventDefault: () => void },
    input: { type: string; key: string; control: boolean; meta: boolean; shift: boolean; alt: boolean },
    sourceTabId?: string,
  ) {
    if (input.type !== 'keyDown') return;

    const key = input.key.toLowerCase();
    const isCmdOrCtrl = input.control || input.meta;
    const tabId = sourceTabId ?? this.activeTabId ?? undefined;
    const active = this.tabs.find((tab) => tab.id === tabId);

    if (isCmdOrCtrl && (input.key === '=' || input.key === '+' || input.key === 'Add')) {
      this.zoomIn(tabId);
    } else if (isCmdOrCtrl && (input.key === '-' || input.key === 'Subtract')) {
      this.zoomOut(tabId);
    } else if (isCmdOrCtrl && (input.key === '0' || input.key === 'Num0')) {
      this.zoomReset(tabId);
    } else if (isCmdOrCtrl && key === 't' && !input.shift) {
      this.createTab();
    } else if (isCmdOrCtrl && key === 'w' && !input.shift) {
      if (tabId) this.closeTab(tabId);
    } else if (isCmdOrCtrl && input.shift && key === 't') {
      this.reopenClosedTab();
    } else if (isCmdOrCtrl && key === 'r') {
      if (active) {
        if (input.shift) active.view.webContents.reloadIgnoringCache();
        else active.view.webContents.reload();
      }
    } else if (isCmdOrCtrl && key === 'l') {
      this.win.webContents.send('menu:focusAddressBar');
    } else if (isCmdOrCtrl && key === 'f') {
      this.win.webContents.send('menu:find');
    } else if (isCmdOrCtrl && key === 's') {
      this.win.webContents.send('menu:savePage');
    } else if (isCmdOrCtrl && key === ',') {
      this.openSettingsTab();
    } else if (isCmdOrCtrl && input.shift && key === 'b') {
      const visible = getSetting('bookmarksBarVisible', 'true') === 'true';
      setSetting('bookmarksBarVisible', String(!visible));
      this.win.webContents.send('menu:toggleBookmarksBar');
    } else if (isCmdOrCtrl && key === 'd') {
      if (active && active.state.url.startsWith('http')) {
        toggleBookmark(active.state.title, active.state.url);
        this.emitState();
      }
    } else if (isCmdOrCtrl && key === 'p') {
      this.print(tabId);
    } else if (input.key === 'F11') {
      const fullscreen = !this.win.isFullScreen();
      this.win.setFullScreen(fullscreen);
      this.setFullscreen(fullscreen);
    } else if ((isCmdOrCtrl && input.shift && key === 'i') || input.key === 'F12') {
      this.toggleDevTools(tabId);
    } else if (isCmdOrCtrl && input.shift && key === 'j') {
      this.toggleDevTools(tabId, 'bottom');
    } else if (isCmdOrCtrl && key === 'u') {
      this.viewSource(tabId);
    } else if (isCmdOrCtrl && key === 'n' && input.shift) {
      WindowManager.createWindow({ incognito: true });
    } else if (isCmdOrCtrl && key === 'n') {
      WindowManager.createWindow({ incognito: false });
    } else if (isCmdOrCtrl && input.shift && key === 'o') {
      this.win.webContents.send('menu:openBookmarks');
    } else if (isCmdOrCtrl && key === 'h') {
      this.win.webContents.send('menu:openHistory');
    } else if (isCmdOrCtrl && key === 'j') {
      this.win.webContents.send('menu:openDownloads');
    } else if (isCmdOrCtrl && input.shift && (key === 'delete' || key === 'backspace')) {
      clearHistory(0);
      void this.ses.clearStorageData();
    } else if (isCmdOrCtrl && key >= '1' && key <= '9') {
      const index = key === '9' ? this.tabs.length - 1 : Number(key) - 1;
      const target = this.tabs[index];
      if (target) this.activateTab(target.id);
    } else {
      return;
    }

    event.preventDefault();
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

  reloadIgnoringCache(id: string) {
    this.tabs.find((t) => t.id === id)?.view.webContents.reloadIgnoringCache();
  }

  findInPage(query: string, id?: string) {
    if (!query.trim()) return;
    const tab = this.tabs.find((candidate) => candidate.id === (id ?? this.activeTabId));
    tab?.view.webContents.findInPage(query);
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
    const mins = Number(getSetting('hibernateMinutes', '15'));

    for (const tab of this.tabs) {
      this.clearHibernateTimer(tab.id);
      if (mins > 0 && tab.id !== id && !tab.pinned && !tab.hibernated) {
        const timer = setTimeout(() => this.hibernate(tab.id), mins * 60 * 1000);
        this.hibernateTimers.set(tab.id, timer);
      }
    }
  }

  refreshHibernateTimers() {
    if (this.activeTabId) this.resetHibernateTimer(this.activeTabId);
  }

  setUserAgent(preset: string) {
    const userAgents: Record<string, string> = {
      default: '',
      'safari-mac': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      'chrome-win': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'firefox-linux': 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
      'iphone-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    };
    this.userAgent = preset;
    const userAgent = userAgents[preset] || this.ses.getUserAgent();
    for (const tab of this.tabs) {
      try {
        tab.view.webContents.setUserAgent(userAgent);
        if (!tab.hibernated && !isInternalUrl(tab.state.url)) {
          tab.view.webContents.reload();
        }
      } catch {
        /* tab may be hibernated or closing */
      }
    }
  }

  private applyUserAgent(webContents: Electron.WebContents) {
    const userAgents: Record<string, string> = {
      'safari-mac': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      'chrome-win': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'firefox-linux': 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
      'iphone-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    };
    webContents.setUserAgent(userAgents[this.userAgent] || this.ses.getUserAgent());
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

  setFullscreen(fullscreen: boolean) {
    this.chromeHeight = fullscreen
      ? 0
      : 92 + (getSetting('bookmarksBarVisible', 'true') === 'true' ? 36 : 0);
    this.relayout();
    this.emitState({ fullscreen });
  }

  setAppMenuOpen(open: boolean) {
    this.appMenuOpen = open;
    this.relayout();
    this.emitState();
  }

  setSidebarPinned(pinned: boolean) {
    this.sidebarPinned = pinned;
    setSetting('sidebarPinned', String(pinned));
    this.relayout();
    this.emitState();
  }

  /** Recompute active web contents bounds from window size + chrome layout. */
  relayout() {
    const active = this.tabs.find((t) => t.id === this.activeTabId);
    if (!active || active.hibernated || isInternalUrl(active.state.url)) return;
    const [width, height] = this.win.getContentSize();
    // React chrome cannot paint above a WebContentsView. When an external page
    // is active, reserve the sidebar column even when it is not pinned so the
    // page cannot cover the open sidebar. Internal pages can still float.
    const dockSidebar = this.sidebarOpen && (this.sidebarPinned || !isInternalUrl(active.state.url));
    const x = dockSidebar ? SIDEBAR_WIDTH : 0;
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

  sessionUrls(): string[] {
    const urls = this.tabStates()
      .filter((tab) => tab.url && tab.url !== 'lumen://newtab' && tab.url !== 'about:newtab' && tab.url !== 'about:blank')
      .map((tab) => tab.url);
    const activeUrl = this.tabs.find((tab) => tab.id === this.activeTabId)?.state.url;
    return activeUrl && urls.includes(activeUrl)
      ? [activeUrl, ...urls.filter((url) => url !== activeUrl)]
      : urls;
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

  performanceSnapshot() {
    const active = this.tabs.find((tab) => tab.id === this.activeTabId);
    const activePid = active && !active.hibernated ? active.view.webContents.getProcessId() : null;
    const metrics = app.getAppMetrics();
    const activeMetric = activePid ? metrics.find((metric) => metric.pid === activePid) : undefined;
    const workingSet = metrics.reduce((total, metric) => total + (metric.memory?.workingSetSize ?? 0), 0);
    return {
      memoryMb: Math.round((workingSet / 1024) * 10) / 10,
      cpuPercent: Math.round(metrics.reduce((total, metric) => total + (metric.cpu?.percentCPUUsage ?? 0), 0) * 10) / 10,
      processCount: metrics.length,
      tabCount: this.tabs.length,
      activeTabCpuPercent: Math.round((activeMetric?.cpu?.percentCPUUsage ?? 0) * 10) / 10,
    };
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

  print(id?: string): Promise<boolean> {
    const tabId = id ?? this.activeTabId;
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return Promise.resolve(false);
    const target = tab && !isInternalUrl(tab.state.url) ? tab.view.webContents : this.win.webContents;
    if (!target || target.isDestroyed()) return Promise.resolve(false);

    return new Promise((resolve) => {
      try {
        target.print({ silent: false, printBackground: true }, (success, failureReason) => {
          if (!success && failureReason) console.warn('[print] failed:', failureReason);
          resolve(success);
        });
      } catch (error) {
        console.warn('[print] unavailable:', error);
        resolve(false);
      }
    });
  }

  async savePage(filePath: string, id?: string) {
    const tab = this.tabs.find((candidate) => candidate.id === (id ?? this.activeTabId));
    if (!tab || !filePath) return false;
    try {
      await tab.view.webContents.savePage(filePath, 'HTMLComplete');
      return true;
    } catch {
      return false;
    }
  }

  async savePageWithDialog(id?: string) {
    const { filePath } = await dialog.showSaveDialog(this.win, {
      defaultPath: 'page.html',
      filters: [{ name: 'HTML page', extensions: ['html'] }],
    });
    return filePath ? this.savePage(filePath, id) : false;
  }

  private async saveResourceWithDialog(url: string, suggestedFilename = '') {
    if (!url || /^(data|blob):/i.test(url)) return;
    let fallback = suggestedFilename;
    try {
      fallback ||= path.basename(new URL(url).pathname) || 'download';
    } catch {
      fallback ||= 'download';
    }
    const { filePath } = await dialog.showSaveDialog(this.win, {
      defaultPath: path.join(require('electron').app.getPath('downloads'), fallback),
    });
    if (!filePath) return;
    try {
      const response = await this.ses.fetch(url);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(filePath, bytes);
      recordCompletedDownload(url, path.basename(filePath), filePath, bytes.byteLength);
    } catch (error) {
      console.error('Failed to save resource:', error);
    }
  }

  showChromeContextMenu(x: number, y: number, editable = false) {
    this.popupContextMenu(this.activeTabId ?? undefined, { isEditable: editable }, { x, y });
  }

  private popupContextMenu(
    tabId?: string,
    params: Partial<Electron.ContextMenuParams> = {},
    position?: { x: number; y: number },
  ) {
    const tab = this.tabs.find((candidate) => candidate.id === tabId);
    const wc = tab?.view.webContents ?? this.win.webContents;
    const template: Electron.MenuItemConstructorOptions[] = [];

    if (params.linkURL) {
      template.push(
        { label: 'Open link in new tab', click: () => this.createTab(params.linkURL, { afterId: tab?.id }) },
        { label: 'Save link as…', click: () => void this.saveResourceWithDialog(params.linkURL ?? '', params.suggestedFilename) },
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL ?? '') },
        { type: 'separator' },
      );
    }

    if (params.mediaType === 'image' && params.srcURL) {
      template.push(
        { label: 'Open image in new tab', click: () => this.createTab(params.srcURL, { afterId: tab?.id }) },
        { label: 'Save image as…', click: () => void this.saveResourceWithDialog(params.srcURL ?? '', params.suggestedFilename) },
        { label: 'Copy image', enabled: typeof params.x === 'number' && typeof params.y === 'number', click: () => wc.copyImageAt(params.x ?? 0, params.y ?? 0) },
        { label: 'Copy image address', click: () => clipboard.writeText(params.srcURL ?? '') },
        { type: 'separator' },
      );
    } else if ((params.mediaType === 'audio' || params.mediaType === 'video') && params.srcURL) {
      template.push(
        { label: 'Open media in new tab', click: () => this.createTab(params.srcURL, { afterId: tab?.id }) },
        { label: 'Save media as…', click: () => void this.saveResourceWithDialog(params.srcURL ?? '', params.suggestedFilename) },
        { label: 'Copy media address', click: () => clipboard.writeText(params.srcURL ?? '') },
        { type: 'separator' },
      );
    }

    if (params.selectionText) {
      template.push(
        { label: 'Copy selection', click: () => clipboard.writeText(params.selectionText ?? '') },
        { label: 'Search selection', click: () => this.createTab(params.selectionText) },
        { type: 'separator' },
      );
    }

    if (params.isEditable) {
      template.push(
        { label: 'Cut', click: () => wc.cut() },
        { label: 'Copy', click: () => wc.copy() },
        { label: 'Paste', click: () => wc.paste() },
        { label: 'Select all', click: () => wc.selectAll() },
        { type: 'separator' },
      );
    }

    template.push(
      { label: 'Back', accelerator: 'Alt+Left', enabled: !!tab?.state.canGoBack, click: () => tab && this.goBack(tab.id) },
      { label: 'Forward', accelerator: 'Alt+Right', enabled: !!tab?.state.canGoForward, click: () => tab && this.goForward(tab.id) },
      { label: 'Reload', accelerator: 'Ctrl+R', enabled: !!tab, click: () => tab && this.reload(tab.id) },
      { type: 'separator' },
      { label: 'Save as…', accelerator: 'Ctrl+S', enabled: !!tab && !isInternalUrl(tab.state.url), click: () => void this.savePageWithDialog(tab?.id) },
      { label: 'Print…', accelerator: 'Ctrl+P', enabled: !!tab, click: () => this.print(tab?.id) },
      { label: 'Cast…', enabled: false },
      { type: 'separator' },
      { label: 'View page source', accelerator: 'Ctrl+U', enabled: !!tab, click: () => this.viewSource(tab?.id) },
      { label: 'Inspect', enabled: !!tab, click: () => tab && wc.inspectElement(params.x ?? 0, params.y ?? 0) },
    );

    Menu.buildFromTemplate(template).popup({
      window: this.win,
      ...(position ? { x: position.x, y: position.y } : {}),
    });
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
  if (/^view-source:/i.test(trimmed)) return trimmed;
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  // Looks like a domain?
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(trimmed) && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }
  const engine = SEARCH_ENGINES[getSetting('searchEngine', 'google')] ?? SEARCH_ENGINES.google;
  return `${engine}${encodeURIComponent(trimmed)}`;
}
