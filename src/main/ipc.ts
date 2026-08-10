import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs';
import { IPC } from '../shared/types';
import type { Suggestion, SidebarPanel } from '../shared/types';
import { getShieldsConfig, setShieldsConfig, getShieldsStats, getShieldsStatsForTab } from './shields/shields';
import { WindowManager } from './windows/WindowManager';
import {
  listBookmarks,
  addBookmark,
  createFolder,
  removeBookmark,
  searchBookmarks,
  exportHtml,
  importHtml,
  toggleBookmark,
  getBookmarkByUrl,
} from './store/bookmarks';
import { getSetting, setSetting } from './store/database';
import { listHistory, searchHistory, clearHistory, getHistoryTerrain } from './store/history';
import { listDownloads, pauseDownload, resumeDownload, cancelDownload } from './downloads';

function managerFor(event: Electron.IpcMainInvokeEvent) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) throw new Error('No window for IPC sender');
  const tm = WindowManager.tabManagerFor(win.id);
  if (!tm) throw new Error('No tab manager for window');
  return { win, tm };
}

export function registerIpc() {
  ipcMain.handle(IPC.TabCreate, (e, url?: string) => managerFor(e).tm.createTab(url));
  ipcMain.handle(IPC.TabClose, (e, id: string) => managerFor(e).tm.closeTab(id));
  ipcMain.handle(IPC.TabActivate, (e, id: string) => managerFor(e).tm.activateTab(id));
  ipcMain.handle(IPC.TabNavigate, (e, id: string, url: string) => managerFor(e).tm.navigate(id, url));
  ipcMain.handle(IPC.TabGoBack, (e, id: string) => managerFor(e).tm.goBack(id));
  ipcMain.handle(IPC.TabGoForward, (e, id: string) => managerFor(e).tm.goForward(id));
  ipcMain.handle(IPC.TabReload, (e, id: string) => managerFor(e).tm.reload(id));
  ipcMain.handle(IPC.TabStop, (e, id: string) => managerFor(e).tm.stop(id));
  ipcMain.handle(IPC.TabTogglePin, (e, id: string) => managerFor(e).tm.togglePin(id));
  ipcMain.handle(IPC.TabToggleMute, (e, id: string) => managerFor(e).tm.toggleMute(id));
  ipcMain.handle(IPC.TabHibernate, (e, id: string) => managerFor(e).tm.hibernate(id));
  ipcMain.handle(IPC.TabMove, (e, id: string, to: number) => managerFor(e).tm.moveTab(id, to));
  ipcMain.handle(IPC.TabSearch, (e, q: string) => managerFor(e).tm.searchTabs(q));
  ipcMain.handle(IPC.TabSetZoom, (e, factor: number, id?: string) => managerFor(e).tm.setZoom(factor, id));
  ipcMain.handle(IPC.TabGetZoom, (e, id?: string) => managerFor(e).tm.getZoom(id));
  ipcMain.handle(IPC.TabZoomIn, (e, id?: string) => managerFor(e).tm.zoomIn(id));
  ipcMain.handle(IPC.TabZoomOut, (e, id?: string) => managerFor(e).tm.zoomOut(id));
  ipcMain.handle(IPC.TabZoomReset, (e, id?: string) => managerFor(e).tm.zoomReset(id));
  ipcMain.handle(IPC.TabPrint, (e, id?: string) => managerFor(e).tm.print(id));
  ipcMain.handle(IPC.TabToggleDevTools, (e, id?: string, mode?: 'right' | 'bottom' | 'detach') =>
    managerFor(e).tm.toggleDevTools(id, mode),
  );
  ipcMain.handle(IPC.TabViewSource, (e, id?: string) => managerFor(e).tm.viewSource(id));

  ipcMain.handle(IPC.GetState, (e) => {
    const { win } = managerFor(e);
    return WindowManager.stateFor(win.id);
  });

  ipcMain.handle(IPC.SetSidebar, (e, open: boolean, panel?: SidebarPanel) => {
    const { tm } = managerFor(e);
    tm.setSidebarOpen(open, panel);
    tm.emitState();
  });

  ipcMain.handle(IPC.GetSuggestions, async (_e, query: string): Promise<Suggestion[]> => {
    if (!query.trim()) return [];
    const history = searchHistory(query, 5).map<Suggestion>((h) => ({
      type: 'history',
      title: h.title || h.url,
      url: h.url,
    }));
    const bookmarks = searchBookmarks(query, 3).map<Suggestion>((b) => ({
      type: 'bookmark',
      title: b.title,
      url: b.url ?? '',
    }));
    return [
      ...bookmarks,
      ...history,
      { type: 'search', title: `Search for "${query}"`, url: query },
    ];
  });

  ipcMain.handle(IPC.WindowControl, (e, action: 'minimize' | 'maximize' | 'close') => {
    const { win } = managerFor(e);
    if (action === 'minimize') win.minimize();
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
    else win.close();
  });

  ipcMain.handle(IPC.WindowToggleFullscreen, (e) => {
    const { win } = managerFor(e);
    win.setFullScreen(!win.isFullScreen());
  });

  ipcMain.handle(IPC.NewWindow, () => {
    WindowManager.createWindow({ incognito: false });
  });

  ipcMain.handle(IPC.NewIncognitoWindow, () => {
    WindowManager.createWindow({ incognito: true });
  });

  ipcMain.handle(IPC.ShowAppMenu, (e, bounds: { x: number; y: number }) => {
    const { win } = managerFor(e);
    WindowManager.toggleAppMenu(win, bounds);
  });

  ipcMain.handle(IPC.SetAppMenuOpen, (e, open: boolean) => {
    const { tm, win } = managerFor(e);
    tm.setAppMenuOpen(open);
    if (!open) {
      WindowManager.closeAppMenu(win);
    }
  });

  ipcMain.handle(IPC.ClearBrowsingData, async (e) => {
    const { win } = managerFor(e);
    clearHistory(0);
    await win.webContents.session.clearStorageData();
    return true;
  });

  ipcMain.handle(IPC.AppExit, () => {
    const { app } = require('electron');
    app.quit();
  });

  // Bookmarks
  ipcMain.handle(IPC.BookmarksList, () => listBookmarks());
  ipcMain.handle(IPC.BookmarkAdd, (_e, title: string, url: string, parentId: number | null) =>
    addBookmark(title, url, parentId),
  );
  ipcMain.handle(IPC.BookmarkRemove, (_e, id: number) => removeBookmark(id));
  ipcMain.handle(IPC.BookmarkToggle, (_e, title: string, url: string) => toggleBookmark(title, url));
  ipcMain.handle(IPC.BookmarkGetByUrl, (_e, url: string) => getBookmarkByUrl(url));

  // Settings
  ipcMain.handle(IPC.SettingsGet, () => ({
    theme: getSetting('theme', 'system'),
    searchEngine: getSetting('searchEngine', 'google'),
    homepage: getSetting('homepage', 'https://www.google.com'),
    verticalTabs: getSetting('verticalTabs', 'false') === 'true',
    bookmarksBarVisible: getSetting('bookmarksBarVisible', 'true') === 'true',
    hibernateMinutes: Number(getSetting('hibernateMinutes', '15')),
    accentColor: getSetting('accentColor', '#e8c06a'),
    surfaceColor: getSetting('surfaceColor', '#1e1914'),
    glassOpacity: Number(getSetting('glassOpacity', '65')),
    glassBlur: Number(getSetting('glassBlur', '16')),
    cornerRadius: Number(getSetting('cornerRadius', '14')),
    tintGlow: getSetting('tintGlow', 'true') === 'true',
  }));
  ipcMain.handle(IPC.SettingsSet, (_e, key: string, value: string) => setSetting(key, value));
  ipcMain.handle(IPC.OpenSettings, (e, section?: string) => {
    const { tm } = managerFor(e);
    tm.openSettingsTab(section);
  });

  ipcMain.handle(IPC.SetChromeHeight, (e, px: number) => {
    const { tm } = managerFor(e);
    tm.setChromeHeight(px);
  });
  ipcMain.handle(IPC.BookmarkCreateFolder, (_e, title: string, parentId: number | null) =>
    createFolder(title, parentId),
  );
  ipcMain.handle(IPC.BookmarksExport, async () => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: 'bookmarks.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (!filePath) return false;
    fs.writeFileSync(filePath, exportHtml(), 'utf-8');
    return true;
  });
  ipcMain.handle(IPC.BookmarksImport, async () => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
      properties: ['openFile'],
    });
    if (!filePaths[0]) return 0;
    return importHtml(fs.readFileSync(filePaths[0], 'utf-8'));
  });

  // History
  ipcMain.handle(IPC.HistoryList, (_e, query: string, since: number) => listHistory(query, 500, since));
  ipcMain.handle(IPC.HistoryClear, (_e, since: number) => clearHistory(since));
  ipcMain.handle(IPC.HistoryTerrain, (_e, hours?: number) => getHistoryTerrain(hours ?? 6));

  // Domain Groups Accordion State
  ipcMain.handle(IPC.DomainGroupsGet, () => {
    try {
      return JSON.parse(getSetting('domain_groups_collapsed', '{}'));
    } catch {
      return {};
    }
  });
  ipcMain.handle(IPC.DomainGroupsSet, (_e, domain: string, collapsed: boolean) => {
    try {
      const current = JSON.parse(getSetting('domain_groups_collapsed', '{}'));
      current[domain] = collapsed;
      setSetting('domain_groups_collapsed', JSON.stringify(current));
      return current;
    } catch {
      return {};
    }
  });

  // Downloads
  ipcMain.handle(IPC.DownloadsList, () => listDownloads());
  ipcMain.handle(IPC.DownloadPause, (_e, id: string) => pauseDownload(id));
  ipcMain.handle(IPC.DownloadResume, (_e, id: string) => resumeDownload(id));
  ipcMain.handle(IPC.DownloadCancel, (_e, id: string) => cancelDownload(id));
  ipcMain.handle(IPC.DownloadOpen, (_e, id: string) => {
    const d = listDownloads().find((x) => x.id === id);
    if (d?.path) shell.showItemInFolder(d.path);
  });

  // Shields
  ipcMain.handle(IPC.ShieldsGetConfig, () => getShieldsConfig());
  ipcMain.handle(IPC.ShieldsSetConfig, (_e, key: string, value: string) => {
    setShieldsConfig(key, value);
  });
  ipcMain.handle(IPC.ShieldsGetStats, (_e, origin?: string) => getShieldsStats(origin));
  ipcMain.handle(IPC.ShieldsGetStatsForTab, (e) => {
    const { tm } = managerFor(e);
    const tabId = tm.activeTabId;
    if (!tabId) return { adsBlocked: 0, trackersBlocked: 0, httpsUpgrades: 0, fingerprintsBlocked: 0, scriptsBlocked: 0 };
    // Get the active tab's webcontents URL to look up stats
    const state = tm.tabStates().find(t => t.id === tabId);
    if (!state) return { adsBlocked: 0, trackersBlocked: 0, httpsUpgrades: 0, fingerprintsBlocked: 0, scriptsBlocked: 0 };
    return getShieldsStats(new URL(state.url).hostname);
  });
  ipcMain.handle(IPC.ShieldsResetStats, () => {
    const { resetAllStats } = require('./shields/shields');
    resetAllStats();
  });
}
