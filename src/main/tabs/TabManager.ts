import { app, BrowserWindow, WebContentsView, session as electronSession, Menu, clipboard, dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IPC } from '../../shared/types';
import type { TabState, TabGroupState, WindowState, SidebarPanel, SecurityState } from '../../shared/types';
import { clearHistory, recordVisit, updateDwellTime } from '../store/history';
import { getSetting, setSetting } from '../store/database';
import { toggleBookmark, addBookmark } from '../store/bookmarks';
import { WindowManager, SIDEBAR_WIDTH } from '../windows/WindowManager';
import { injectFingerprintProtection } from '../shields/fingerprint';
import { installShieldsOnSession, COSMETIC_AD_BLOCK_CSS, getShieldsConfig } from '../shields/shields';
import { recordCompletedDownload } from '../downloads';
import { cleanUserAgent } from '../index';

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
export const NEW_TAB_URL = 'blade://newtab';

function detectSecurityState(url: string, certError = false): SecurityState {
  if (certError) return 'insecure';
  if (!url || url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('blade:') || url.startsWith('lumen:') || url.startsWith('file:')) {
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
  sidebarWidth = 240;
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
    this.ses.setUserAgent(cleanUserAgent(this.ses.getUserAgent()));
    installShieldsOnSession(ses);

    ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
      const p = permission as string;
      if (
        p === 'pointerLock' ||
        p === 'fullscreen' ||
        p === 'keyboardLock' ||
        p === 'openExternal' ||
        p === 'pointer-lock'
      ) {
        return true;
      }
      const decision = requestingOrigin ? getSetting(`permission:${requestingOrigin}:${permission}`, 'ask') : 'ask';
      return decision === 'allow' || decision === 'ask';
    });

    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      const p = permission as string;
      if (
        p === 'pointerLock' ||
        p === 'fullscreen' ||
        p === 'keyboardLock' ||
        p === 'openExternal' ||
        p === 'pointer-lock'
      ) {
        return callback(true);
      }
      let origin = '';
      try { origin = new URL(webContents.getURL()).origin; } catch { /* non-web URL */ }
      const decision = origin ? getSetting(`permission:${origin}:${permission}`, 'ask') : 'ask';
      callback(decision === 'allow' || (decision === 'ask' && permission !== 'notifications' && permission !== 'media'));
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
    if (!this.incognito && this.activeUrl && !this.activeUrl.startsWith('blade:') && !this.activeUrl.startsWith('lumen:') && !this.activeUrl.startsWith('about:')) {
      const elapsed = Date.now() - this.activeStartTime;
      if (elapsed > 1000) {
        updateDwellTime(this.activeUrl, elapsed);
      }
    }
    this.activeStartTime = Date.now();
  }

  createTab(url?: string, opts: { activate?: boolean; pinned?: boolean; afterId?: string } = {}): string {
    const id = randomUUID();
    const homepage = getSetting('homepage', 'blade://newtab');
    const target = url ? normalizeUrl(url) : (homepage || NEW_TAB_URL);
    const isInternal = isInternalUrl(target);

    const view = new WebContentsView({
      webPreferences: {
        session: this.ses,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        disableHtmlFullscreenWindowResize: false,
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
        title: isInternal ? (target.includes('settings') ? 'Settings' : 'Blade Home') : 'Terminal Tab',
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
    const targetUrl = section ? `blade://settings#${section}` : 'blade://settings';
    const existing = this.tabs.find((t) => t.state.url.startsWith('blade://settings') || t.state.url.startsWith('lumen://settings'));
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
      tab.state.title = url.includes('settings') ? 'Settings' : 'Blade Home';
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
      // Robust 360-degree pointer lock support for web games on Linux/Electron
      wc.executeJavaScript(`
        if (!window.__lumen_pointer_lock_patched) {
          window.__lumen_pointer_lock_patched = true;
          try {
            if (typeof Element !== 'undefined' && Element.prototype.requestPointerLock) {
              const origRPL = Element.prototype.requestPointerLock;
              Element.prototype.requestPointerLock = function(options) {
                try {
                  const res = origRPL.call(this, options);
                  if (res && typeof res.catch === 'function') {
                    return res.catch(() => origRPL.call(this));
                  }
                  return res;
                } catch {
                  return origRPL.call(this);
                }
              };
            }
          } catch {}
        }
      `).catch(() => {});
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

    wc.on('found-in-page', (_event, result) => {
      if (tab.id === this.activeTabId && !this.win.isDestroyed()) {
        this.win.webContents.send(IPC.FindResult, {
          activeMatchOrdinal: result.activeMatchOrdinal,
          matches: result.matches,
          finalUpdate: result.finalUpdate,
        });
      }
    });

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
      this.win.webContents.send(IPC.OpenFindBarEvent);
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
    } else if (input.alt && input.key === 'ArrowLeft') {
      if (active) active.view.webContents.navigationHistory.goBack();
    } else if (input.alt && input.key === 'ArrowRight') {
      if (active) active.view.webContents.navigationHistory.goForward();
    } else if (input.control && input.key === 'Tab') {
      const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
      if (input.shift) {
        const prev = this.tabs[(idx - 1 + this.tabs.length) % this.tabs.length];
        if (prev) this.activateTab(prev.id);
      } else {
        const next = this.tabs[(idx + 1) % this.tabs.length];
        if (next) this.activateTab(next.id);
      }
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

  findInPage(query: string, options: Electron.FindInPageOptions = {}, id?: string) {
    const tabId = id ?? this.activeTabId;
    const tab = this.tabs.find((candidate) => candidate.id === tabId);
    if (!tab || isInternalUrl(tab.state.url)) return;
    if (!query || !query.trim()) {
      try {
        tab.view.webContents.stopFindInPage('clearSelection');
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      tab.view.webContents.findInPage(query, options);
    } catch {
      /* ignore */
    }
  }

  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection' = 'clearSelection', id?: string) {
    const tabId = id ?? this.activeTabId;
    const tab = this.tabs.find((candidate) => candidate.id === tabId);
    if (!tab || isInternalUrl(tab.state.url)) return;
    try {
      tab.view.webContents.stopFindInPage(action);
    } catch {
      /* ignore */
    }
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
      'chrome-win': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      'firefox-linux': 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
      'iphone-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    };
    webContents.setUserAgent(userAgents[this.userAgent] || cleanUserAgent(this.ses.getUserAgent()));
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
    const x = dockSidebar ? this.sidebarWidth : 0;
    active.view.setBounds({
      x,
      y: this.chromeHeight,
      width: Math.max(0, width - x),
      height: Math.max(0, height - this.chromeHeight),
    });
  }

  setSidebarWidth(px: number) {
    this.sidebarWidth = Math.max(160, Math.min(500, Math.round(px)));
    this.relayout();
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
      .filter((tab) => tab.url && tab.url !== 'blade://newtab' && tab.url !== 'lumen://newtab' && tab.url !== 'about:newtab' && tab.url !== 'about:blank')
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

  showTabContextMenu(tabId: string, position?: { x: number; y: number }) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const isPinned = tab.pinned;
    const isMuted = tab.state.muted;
    const isHibernated = tab.hibernated;
    const isVertical = this.sidebarOpen && this.sidebarPanel === 'tabs';

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: isPinned ? 'Unpin tab' : 'Pin tab',
        click: () => this.togglePin(tabId),
      },
      {
        label: 'Duplicate tab',
        click: () => this.createTab(tab.state.url, { afterId: tabId }),
      },
      {
        label: isMuted ? 'Unmute tab' : 'Mute tab',
        click: () => this.toggleMute(tabId),
      },
      {
        label: isHibernated ? 'Wake tab' : 'Hibernate tab',
        click: () => this.hibernate(tabId),
      },
      { type: 'separator' },
      {
        label: isVertical ? 'Switch to horizontal tabs' : 'Switch to vertical tabs',
        click: () => {
          this.setSidebarOpen(!isVertical, 'tabs');
          this.setSidebarPinned(!isVertical);
          this.emitState();
        },
      },
      { type: 'separator' },
      {
        label: 'Add to new group',
        click: () => {
          const domain = (() => {
            try { return new URL(tab.state.url).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; }
          })();
          const name = domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : 'Group';
          this.createGroup(name, '#6366f1', [tabId]);
        },
      },
      {
        label: 'Remove from group',
        enabled: !!tab.groupId,
        click: () => { tab.groupId = null; this.emitState(); },
      },
      { type: 'separator' },
      {
        label: 'Reload',
        accelerator: 'Ctrl+R',
        click: () => this.reload(tabId),
      },
      {
        label: 'Close tab',
        accelerator: 'Ctrl+W',
        click: () => this.closeTab(tabId),
      },
      {
        label: 'Close other tabs',
        click: () => {
          this.tabs
            .filter((t) => t.id !== tabId && !t.pinned)
            .forEach((t) => this.closeTab(t.id));
        },
      },
      {
        label: 'Close tabs to the right',
        click: () => {
          const idx = this.tabs.findIndex((t) => t.id === tabId);
          if (idx !== -1) {
            this.tabs
              .slice(idx + 1)
              .filter((t) => !t.pinned)
              .forEach((t) => this.closeTab(t.id));
          }
        },
      },
    ];

    Menu.buildFromTemplate(template).popup({
      window: this.win,
      ...(position ? { x: Math.round(position.x), y: Math.round(position.y) } : {}),
    });
  }

  showTabBarContextMenu(position?: { x: number; y: number }) {
    const isVertical = this.sidebarOpen && this.sidebarPanel === 'tabs';
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'New tab',
        accelerator: 'Ctrl+T',
        click: () => this.createTab(),
      },
      {
        label: 'Reopen closed tab',
        accelerator: 'Ctrl+Shift+T',
        click: () => this.reopenClosedTab(),
      },
      { type: 'separator' },
      {
        label: isVertical ? 'Switch to horizontal tabs' : 'Switch to vertical tabs',
        click: () => {
          this.setSidebarOpen(!isVertical, 'tabs');
          this.setSidebarPinned(!isVertical);
          this.emitState();
        },
      },
      { type: 'separator' },
      {
        label: 'Bookmark all tabs…',
        accelerator: 'Ctrl+Shift+D',
        click: () => {
          this.tabs.forEach((t) => {
            if (t.state.url && t.state.url.startsWith('http')) {
              addBookmark(t.state.title || t.state.url, t.state.url);
            }
          });
        },
      },
      {
        label: 'Settings',
        click: () => this.openSettingsTab(),
      },
    ];

    Menu.buildFromTemplate(template).popup({
      window: this.win,
      ...(position ? { x: Math.round(position.x), y: Math.round(position.y) } : {}),
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
        WindowManager.broadcastToOverlays(state);
      });
    }
  }


  /** ── Tab Group Management ── */

  createGroup(name: string, color: string, tabIds: string[]): string {
    const id = randomUUID();
    this.groups.push({ id, name, color, collapsed: false });
    for (const tabId of tabIds) {
      const tab = this.tabs.find((t) => t.id === tabId);
      if (tab) tab.groupId = id;
    }
    this.emitState();
    return id;
  }

  addTabToGroup(tabId: string, groupId: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (tab) {
      tab.groupId = groupId;
      this.emitState();
    }
  }

  removeTabFromGroup(tabId: string) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab || !tab.groupId) return;
    const groupId = tab.groupId;
    tab.groupId = null;
    // Clean up group if it has no remaining members
    const hasMembers = this.tabs.some((t) => t.groupId === groupId);
    if (!hasMembers) {
      this.groups = this.groups.filter((g) => g.id !== groupId);
    }
    this.emitState();
  }

  renameGroup(groupId: string, name: string) {
    const g = this.groups.find((group) => group.id === groupId);
    if (g) {
      g.name = name;
      this.emitState();
    }
  }

  setGroupColor(groupId: string, color: string) {
    const g = this.groups.find((group) => group.id === groupId);
    if (g) {
      g.color = color;
      this.emitState();
    }
  }

  deleteGroup(groupId: string) {
    this.groups = this.groups.filter((g) => g.id !== groupId);
    for (const tab of this.tabs) {
      if (tab.groupId === groupId) tab.groupId = null;
    }
    this.emitState();
  }

  toggleGroupCollapse(groupId: string) {
    const g = this.groups.find((group) => group.id === groupId);
    if (g) {
      g.collapsed = !g.collapsed;
      this.emitState();
    }
  }

  closeGroup(groupId: string) {
    const tabsInGroup = this.tabs.filter((t) => t.groupId === groupId);
    for (const tab of tabsInGroup) {
      this.closeTab(tab.id);
    }
    this.groups = this.groups.filter((g) => g.id !== groupId);
    this.emitState();
  }

  newTabInGroup(groupId: string, url = 'blade://newtab') {
    const lastTabInGroup = [...this.tabs].reverse().find((t) => t.groupId === groupId);
    const newTabId = this.createTab(url, {
      activate: true,
      afterId: lastTabInGroup?.id,
    });
    this.addTabToGroup(newTabId, groupId);
    return newTabId;
  }

  moveGroupToNewWindow(groupId: string) {
    const g = this.groups.find((group) => group.id === groupId);
    const tabsInGroup = this.tabs.filter((t) => t.groupId === groupId);
    if (tabsInGroup.length === 0) return;

    const urls = tabsInGroup.map((t) => t.state.url);
    const groupName = g ? g.name : 'Group';
    const groupColor = g ? g.color : '#60a5fa';

    // Close in current window
    for (const tab of tabsInGroup) {
      this.closeTab(tab.id);
    }
    this.groups = this.groups.filter((group) => group.id !== groupId);
    this.emitState();

    // Create in new window
    const newWin = WindowManager.createWindow({ incognito: false });
    const newTm = WindowManager.tabManagerFor(newWin.id);
    if (newTm) {
      setTimeout(() => {
        const createdTabIds: string[] = [];
        for (let i = 0; i < urls.length; i++) {
          const id = i === 0 && newTm.tabs.length > 0 ? newTm.tabs[0].id : newTm.createTab(urls[i]);
          if (i === 0 && newTm.tabs.length > 0) newTm.navigate(id, urls[i]);
          createdTabIds.push(id);
        }
        newTm.createGroup(groupName, groupColor, createdTabIds);
      }, 200);
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
    url === 'blade://newtab' ||
    url === 'lumen://newtab' ||
    url === 'about:newtab' ||
    url === 'about:blank' ||
    url.startsWith('blade://settings') ||
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
    if (trimmed.startsWith('blade://settings') || trimmed.startsWith('lumen://settings') || trimmed.includes('settings')) {
      return 'blade://settings';
    }
    return 'blade://newtab';
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
