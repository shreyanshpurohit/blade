import { BrowserWindow, session } from 'electron';
import { TabManager } from '../tabs/TabManager';
import { rendererEntry, preloadPath } from '../index';
import { IPC } from '../../shared/types';
import type { WindowState } from '../../shared/types';
import { getSetting, setSetting } from '../store/database';

interface CreateOptions {
  incognito: boolean;
}

interface ManagedWindow {
  window: BrowserWindow;
  tabManager: TabManager;
  incognito: boolean;
}

const managed = new Map<number, ManagedWindow>();

// Chrome UI chrome height: tab bar (40) + address bar (52) = 92px overlay.
// WebContentsView bounds account for this so page content starts below the chrome.
export const CHROME_HEIGHT = 92;
export const SIDEBAR_WIDTH = 240;

export const WindowManager = {
  createWindow({ incognito }: CreateOptions): BrowserWindow {
    const isDarwin = process.platform === 'darwin';
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 720,
      minHeight: 480,
      frame: false,
      titleBarStyle: isDarwin ? 'hidden' : undefined,
      trafficLightPosition: isDarwin ? { x: 16, y: 18 } : undefined,
      backgroundColor: '#1e1914',
      transparent: isDarwin,
      vibrancy: isDarwin ? 'under-window' : undefined,
      visualEffectState: 'active',
      roundedCorners: isDarwin,
      autoHideMenuBar: true,
      show: true,
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
        spellcheck: true,
      },
    });

    win.setMenuBarVisibility(false);
    win.setMenu(null);
    if (!isDarwin) win.show();

    win.webContents.on('console-message', (_e, level, message) => {
      console.log(`[chrome:${level}] ${message}`);
    });
    win.webContents.on('render-process-gone', (_e, details) => {
      console.log('[chrome] render process gone:', JSON.stringify(details));
    });
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.log('[chrome] did-fail-load:', code, desc, url);
    });

    // Incognito tabs get an in-memory session that is discarded with the window.
    const ses = incognito
      ? session.fromPartition(`incognito-${win.id}`, { cache: false })
      : session.defaultSession;

    const tabManager = new TabManager(win, ses, incognito);
    managed.set(win.id, { window: win, tabManager, incognito });

    // WebContentsView tabs receive input while a page has focus. The chrome
    // renderer receives it here when focus is in the browser UI.
    win.webContents.on('before-input-event', (event, input) => {
      tabManager.handleBrowserShortcut(event, input);
    });

    // Intercept window.open from the chrome renderer
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.includes('#/settings') || url.includes('#settings') || url === 'blade://settings' || url === 'lumen://settings') {
        tabManager.openSettingsTab();
        return { action: 'deny' };
      }
      if (url.startsWith('http')) {
        tabManager.createTab(url);
        return { action: 'deny' };
      }
      return { action: 'deny' };
    });

    if (process.env.BLADE_DEV_SERVER_URL || process.env.LUMEN_DEV_SERVER_URL) {
      win.loadURL(rendererEntry());
    } else {
      win.loadFile(rendererEntry());
    }

    win.on('closed', () => {
      if (!incognito && getSetting('startupBehavior', 'newtab') === 'continue') {
        setSetting('sessionTabs', JSON.stringify(tabManager.sessionUrls()));
      }
      if (!incognito && getSetting('clearHistoryOnExit', 'false') === 'true') {
        const { clearHistory } = require('../store/history');
        clearHistory(0);
      }
      if (getSetting('clearSiteDataOnExit', 'false') === 'true') {
        void ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] });
      }
      tabManager.destroyAll();
      managed.delete(win.id);
    });

    win.on('resize', () => tabManager.relayout());
    win.on('maximize', () => tabManager.relayout());
    win.on('unmaximize', () => tabManager.relayout());

    let restoredTabs: string[] = [];
    if (!incognito && getSetting('startupBehavior', 'newtab') === 'continue') {
      try {
        const stored = JSON.parse(getSetting('sessionTabs', '[]'));
        if (Array.isArray(stored)) restoredTabs = stored.filter((url): url is string => typeof url === 'string' && url.length > 0).slice(0, 50);
      } catch {
        restoredTabs = [];
      }
    }

    if (restoredTabs.length > 0) {
      restoredTabs.forEach((url, index) => tabManager.createTab(url, { activate: index === 0 }));
    } else {
      tabManager.createTab();
    }
    return win;
  },

  openSettings(windowId?: number, section?: string) {
    const m = windowId ? managed.get(windowId) : managed.values().next().value;
    if (m) {
      m.tabManager.openSettingsTab(section);
    }
  },

  popupView: null as any,
  popupLoaded: false,
  popupVisible: false,
  currentPopupType: '',
  suggestionsView: null as any,
  suggestionsLoaded: false,
  suggestionsVisible: false,
  downloadPopupView: null as any,
  downloadPopupVisible: false,

  showPopup(parentWin: BrowserWindow, options: { type: string; x: number; y: number }) {
    if (!options.type) return;
    if (this.popupView && this.popupVisible && this.currentPopupType === options.type) {
      this.closePopup(parentWin);
      return;
    }

    const { WebContentsView } = require('electron');
    const [winWidth, winHeight] = parentWin.getContentSize();

    if (!this.popupView) {
      this.popupView = new WebContentsView({
        webPreferences: {
          preload: preloadPath(),
          contextIsolation: true,
          sandbox: false,
          nodeIntegration: false,
        },
      });

      this.popupView.setBackgroundColor('#00000000');

      this.popupView.webContents.on('before-input-event', (_event: any, input: any) => {
        if (input.type === 'keyDown' && input.key === 'Escape') {
          this.closePopup(parentWin);
        }
      });

      this.popupView.webContents.on('render-process-gone', (_event: any, details: any) => {
        console.error('popupView crashed:', details);
        this.popupView = null;
        this.popupLoaded = false;
        this.popupVisible = false;
      });

      const hash = `#/popup?type=${options.type}&x=${Math.round(options.x)}&y=${Math.round(options.y)}`;
      const devUrl = process.env.BLADE_DEV_SERVER_URL || process.env.LUMEN_DEV_SERVER_URL;
      if (devUrl) {
        this.popupView.webContents.loadURL(`${devUrl}${hash}`);
      } else {
        this.popupView.webContents.loadFile(rendererEntry(), { hash });
      }
      this.popupLoaded = true;
    } else {
      // 0ms instantaneous switch: send IPC event without reloading the browser view
      this.popupView.webContents.send(IPC.PopupOpen, {
        type: options.type,
        x: Math.round(options.x),
        y: Math.round(options.y),
      });
    }

    try {
      parentWin.contentView.addChildView(this.popupView);
    } catch {
      /* ignore */
    }
    this.popupVisible = true;
    this.currentPopupType = options.type;
    this.popupView.setBounds({ x: 0, y: 0, width: winWidth, height: winHeight });
  },

  closePopup(parentWin?: BrowserWindow) {
    if (this.popupView) {
      this.popupVisible = false;
      this.currentPopupType = '';
      this.popupView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      this.popupView.webContents.send(IPC.PopupClose);
      const win = parentWin ?? this.primaryWindow();
      if (win && !win.isDestroyed()) {
        try {
          win.contentView.removeChildView(this.popupView);
        } catch {
          /* ignore */
        }
      }
    }
  },

  toggleAppMenu(parentWin: BrowserWindow, bounds: { x: number; y: number }) {
    this.showPopup(parentWin, { type: 'menu', x: bounds.x, y: bounds.y });
  },

  closeAppMenu(parentWin?: BrowserWindow) {
    this.closePopup(parentWin);
  },

  showSuggestions(parentWin: BrowserWindow, bounds: { x: number; y: number; width: number }, query: string) {
    const { WebContentsView } = require('electron');
    if (!this.suggestionsView) {
      this.suggestionsView = new WebContentsView({
        webPreferences: { preload: preloadPath(), contextIsolation: true, sandbox: false, nodeIntegration: false },
      });
      this.suggestionsView.setBackgroundColor('#00000000');
      const hash = `#/suggestions?q=${encodeURIComponent(query)}`;
      const devUrl = process.env.BLADE_DEV_SERVER_URL || process.env.LUMEN_DEV_SERVER_URL;
      if (devUrl) this.suggestionsView.webContents.loadURL(`${devUrl}${hash}`);
      else this.suggestionsView.webContents.loadFile(rendererEntry(), { hash });
      this.suggestionsLoaded = true;
    } else {
      this.suggestionsView.webContents.send(IPC.SuggestionsChanged, query);
    }
    try {
      parentWin.contentView.addChildView(this.suggestionsView);
    } catch {
      /* ignore */
    }
    this.suggestionsVisible = true;
    const [, contentHeight] = parentWin.getContentSize();
    this.suggestionsView.setBounds({
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(240, Math.round(bounds.width)),
      height: Math.min(270, Math.max(120, contentHeight - Math.round(bounds.y) - 16)),
    });
  },

  updateSuggestions(_parentWin: BrowserWindow, query: string) {
    if (!this.suggestionsView || !this.suggestionsVisible) return;
    if (!this.suggestionsView.webContents.isDestroyed()) {
      this.suggestionsView.webContents.send(IPC.SuggestionsChanged, query);
    }
  },

  closeSuggestions(parentWin?: BrowserWindow) {
    if (this.suggestionsView) {
      this.suggestionsVisible = false;
      this.suggestionsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      const win = parentWin ?? this.primaryWindow();
      if (win && !win.isDestroyed()) {
        try {
          win.contentView.removeChildView(this.suggestionsView);
        } catch {
          /* ignore */
        }
      }
    }
  },

  showDownloadPopup(parentWin: BrowserWindow) {
    const { WebContentsView } = require('electron');
    const [winWidth, winHeight] = parentWin.getContentSize();
    const popupWidth = Math.min(380, Math.max(280, winWidth - 32));

    if (!this.downloadPopupView) {
      this.downloadPopupView = new WebContentsView({
        webPreferences: { preload: preloadPath(), contextIsolation: true, sandbox: false, nodeIntegration: false },
      });
      this.downloadPopupView.setBackgroundColor('#00000000');
      const devUrl = process.env.BLADE_DEV_SERVER_URL || process.env.LUMEN_DEV_SERVER_URL;
      if (devUrl) this.downloadPopupView.webContents.loadURL(`${devUrl}#/download-popup`);
      else this.downloadPopupView.webContents.loadFile(rendererEntry(), { hash: '#/download-popup' });
    }

    parentWin.contentView.addChildView(this.downloadPopupView);
    this.downloadPopupVisible = true;
    this.downloadPopupView.setBounds({
      x: Math.max(16, winWidth - popupWidth - 16),
      y: 104,
      width: popupWidth,
      height: Math.min(280, Math.max(220, winHeight - 120)),
    });
  },

  resizeDownloadPopup(parentWin: BrowserWindow, requestedHeight: number) {
    if (!this.downloadPopupView || !this.downloadPopupVisible) return;
    const [winWidth, winHeight] = parentWin.getContentSize();
    const current = this.downloadPopupView.getBounds();
    const height = Math.min(Math.max(180, Math.ceil(requestedHeight)), Math.max(180, winHeight - 120));
    this.downloadPopupView.setBounds({
      x: current.x || Math.max(16, winWidth - 380 - 16),
      y: current.y || 104,
      width: current.width || Math.min(380, Math.max(280, winWidth - 32)),
      height,
    });
  },

  closeDownloadPopup(parentWin?: BrowserWindow) {
    if (!this.downloadPopupView) return;
    this.downloadPopupVisible = false;
    this.downloadPopupView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    if (parentWin && !parentWin.isDestroyed()) parentWin.webContents.send(IPC.DownloadPopupClosed);
  },

  broadcastToOverlays(state: WindowState) {
    if (this.popupView && !this.popupView.webContents.isDestroyed()) {
      this.popupView.webContents.send(IPC.StateChanged, state);
    }
  },

  primaryWindow(): BrowserWindow | undefined {
    return managed.values().next().value?.window;
  },

  tabManagerFor(windowId: number): TabManager | undefined {
    return managed.get(windowId)?.tabManager;
  },

  stateFor(windowId: number, overrides: Partial<WindowState> = {}): WindowState {
    const m = managed.get(windowId);
    const base: WindowState = {
      windowId,
      incognito: m?.incognito ?? false,
      tabs: m?.tabManager.tabStates() ?? [],
      groups: m?.tabManager.groupStates() ?? [],
      activeTabId: m?.tabManager.activeTabId ?? null,
      sidebarOpen: m?.tabManager.sidebarOpen ?? false,
      sidebarPinned: m?.tabManager.sidebarPinned ?? false,
      sidebarPanel: m?.tabManager.sidebarPanel ?? 'shields',
      appMenuOpen: m?.tabManager.appMenuOpen ?? false,
      fullscreen: m?.window.isFullScreen() ?? false,
      theme: getSetting('theme', 'system') as WindowState['theme'],
      colorTheme: getSetting('colorTheme', 'ember') as WindowState['colorTheme'],
    };
    return { ...base, ...overrides };
  },
};
