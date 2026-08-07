import { BrowserWindow, session } from 'electron';
import { TabManager } from '../tabs/TabManager';
import { rendererEntry, preloadPath } from '../index';
import { getSetting } from '../store/database';
import type { WindowState } from '../../shared/types';

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
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 720,
      minHeight: 480,
      frame: false,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 16, y: 18 },
      backgroundColor: getSetting('surfaceColor', '#1e1914'),
      transparent: process.platform === 'darwin',
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      visualEffectState: 'active',
      roundedCorners: true,
      autoHideMenuBar: true,
      show: false,
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
    win.once('ready-to-show', () => win.show());

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
      tabManager.destroyAll();
      managed.delete(win.id);
    });

    win.on('resize', () => tabManager.relayout());
    win.on('maximize', () => tabManager.relayout());
    win.on('unmaximize', () => tabManager.relayout());

    tabManager.createTab();
    return win;
  },

  openSettings(windowId?: number, section?: string) {
    const m = windowId ? managed.get(windowId) : managed.values().next().value;
    if (m) {
      m.tabManager.openSettingsTab(section);
    }
  },

  toggleAppMenu(parentWin: BrowserWindow, bounds: { x: number; y: number }) {
    const existing = BrowserWindow.getAllWindows().find((w) => w.title === '__lumen_app_menu__');
    if (existing && !existing.isDestroyed()) {
      existing.close();
      return;
    }

    const width = 310;
    const height = 660;
    const x = Math.max(10, Math.round(bounds.x - width));
    const y = Math.max(10, Math.round(bounds.y + 4));

    const menuWin = new BrowserWindow({
      title: '__lumen_app_menu__',
      parent: parentWin,
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      show: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        sandbox: false,
        nodeIntegration: false,
      },
    });

    menuWin.setMenuBarVisibility(false);
    menuWin.setMenu(null);

    const devUrl = process.env.LUMEN_DEV_SERVER_URL;
    if (devUrl) {
      menuWin.loadURL(`${devUrl}#/app-menu`);
    } else {
      menuWin.loadFile(rendererEntry(), { hash: '/app-menu' });
    }

    menuWin.once('ready-to-show', () => {
      if (!menuWin.isDestroyed()) {
        menuWin.show();
      }
    });

    menuWin.on('blur', () => {
      if (!menuWin.isDestroyed()) {
        menuWin.close();
      }
    });

    const closeHandler = () => {
      if (!menuWin.isDestroyed()) menuWin.close();
    };
    parentWin.once('move', closeHandler);
    parentWin.once('resize', closeHandler);
    parentWin.once('minimize', closeHandler);

    menuWin.on('closed', () => {
      parentWin.removeListener('move', closeHandler);
      parentWin.removeListener('resize', closeHandler);
      parentWin.removeListener('minimize', closeHandler);
    });
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
      sidebarPanel: m?.tabManager.sidebarPanel ?? 'shields',
      appMenuOpen: m?.tabManager.appMenuOpen ?? false,
      verticalTabs: false,
      bookmarksBarVisible: true,
      theme: 'system',
    };
    return { ...base, ...overrides };
  },
};
