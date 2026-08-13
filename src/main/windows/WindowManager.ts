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
export const SIDEBAR_WIDTH = 320;

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
      if (url.includes('#/settings') || url.includes('#settings') || url === 'lumen://settings') {
        tabManager.openSettingsTab();
        return { action: 'deny' };
      }
      if (url.startsWith('http')) {
        tabManager.createTab(url);
        return { action: 'deny' };
      }
      return { action: 'deny' };
    });

    if (process.env.LUMEN_DEV_SERVER_URL) {
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

  appMenuView: null as any, // WebContentsView
  appMenuVisible: false,
  suggestionsView: null as any,
  suggestionsVisible: false,
  downloadPopupView: null as any,
  downloadPopupVisible: false,

  toggleAppMenu(parentWin: BrowserWindow, bounds: { x: number; y: number }) {
    if (this.appMenuView && this.appMenuVisible) {
      this.closeAppMenu(parentWin);
      return;
    }

    const { WebContentsView } = require('electron');
    const [winWidth, winHeight] = parentWin.getContentSize();

    if (!this.appMenuView) {
      this.appMenuView = new WebContentsView({
        webPreferences: {
          preload: preloadPath(),
          contextIsolation: true,
          sandbox: false,
          nodeIntegration: false,
        },
      });

      this.appMenuView.setBackgroundColor('#00000000');
      const devUrl = process.env.LUMEN_DEV_SERVER_URL;

      this.appMenuView.webContents.on('before-input-event', (event: any, input: any) => {
        if (input.type === 'keyDown' && input.key === 'Escape') {
          this.closeAppMenu(parentWin);
        }
      });

      this.appMenuView.webContents.on('render-process-gone', (event: any, details: any) => {
        console.error('menuView crashed:', details);
        this.appMenuView = null;
        this.appMenuVisible = false;
      });
    }

    // Always append the view to bring it to the top of the z-index stack
    // (since new tabs might have been added on top of it)
    parentWin.contentView.addChildView(this.appMenuView);

    this.appMenuVisible = true;
    this.appMenuView.setBounds({ x: 0, y: 0, width: winWidth, height: winHeight });

    const hash = `#/app-menu?x=${bounds.x}&y=${bounds.y}`;
    const devUrl = process.env.LUMEN_DEV_SERVER_URL;
    if (devUrl) {
      this.appMenuView.webContents.loadURL(`${devUrl}${hash}`);
    } else {
      this.appMenuView.webContents.loadFile(rendererEntry(), { hash });
    }
  },

  closeAppMenu(parentWin?: BrowserWindow) {
    if (this.appMenuView) {
      this.appMenuVisible = false;
      this.appMenuView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  },

  showSuggestions(parentWin: BrowserWindow, bounds: { x: number; y: number; width: number }, query: string) {
    const { WebContentsView } = require('electron');
    if (!this.suggestionsView) {
      this.suggestionsView = new WebContentsView({
        webPreferences: { preload: preloadPath(), contextIsolation: true, sandbox: false, nodeIntegration: false },
      });
      this.suggestionsView.setBackgroundColor('#00000000');
    }
    parentWin.contentView.addChildView(this.suggestionsView);
    this.suggestionsVisible = true;
    const [, contentHeight] = parentWin.getContentSize();
    this.suggestionsView.setBounds({
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(240, Math.round(bounds.width)),
      height: Math.min(300, Math.max(180, contentHeight - Math.round(bounds.y) - 8)),
    });
    const hash = `#/suggestions?q=${encodeURIComponent(query)}`;
    const devUrl = process.env.LUMEN_DEV_SERVER_URL;
    if (devUrl) this.suggestionsView.webContents.loadURL(`${devUrl}${hash}`);
    else this.suggestionsView.webContents.loadFile(rendererEntry(), { hash });
  },

  updateSuggestions(parentWin: BrowserWindow, query: string) {
    if (!this.suggestionsView || !this.suggestionsVisible) return;
    if (!this.suggestionsView.webContents.isDestroyed()) {
      this.suggestionsView.webContents.send(IPC.SuggestionsChanged, query);
    }
  },

  closeSuggestions(_parentWin?: BrowserWindow) {
    if (this.suggestionsView) {
      this.suggestionsVisible = false;
      this.suggestionsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
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
      const devUrl = process.env.LUMEN_DEV_SERVER_URL;
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
