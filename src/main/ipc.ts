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
import { getSetting, getSettingsByPrefix, setSetting } from './store/database';
import { listHistory, searchHistory, clearHistory, removeHistoryEntry, getHistoryTerrain } from './store/history';
import { listDownloads, pauseDownload, resumeDownload, cancelDownload } from './downloads';
import { listPasswords, savePassword, removePassword } from './store/passwords';

function managerFor(event: Electron.IpcMainInvokeEvent) {
  const win = BrowserWindow.fromWebContents(event.sender) ?? WindowManager.primaryWindow();
  if (!win) throw new Error('No window for IPC sender');
  const tm = WindowManager.tabManagerFor(win.id);
  if (!tm) throw new Error('No tab manager for window');
  return { win, tm };
}

export function registerIpc() {
  ipcMain.handle(IPC.TabCreate, (e, url?: string) => managerFor(e).tm.createTab(url));
  ipcMain.handle(IPC.TabClose, (e, id: string) => managerFor(e).tm.closeTab(id));
  ipcMain.handle(IPC.TabReopenClosed, (e) => managerFor(e).tm.reopenClosedTab());
  ipcMain.handle(IPC.TabActivate, (e, id: string) => managerFor(e).tm.activateTab(id));
  ipcMain.handle(IPC.TabNavigate, (e, id: string, url: string) => managerFor(e).tm.navigate(id, url));
  ipcMain.handle(IPC.TabGoBack, (e, id: string) => managerFor(e).tm.goBack(id));
  ipcMain.handle(IPC.TabGoForward, (e, id: string) => managerFor(e).tm.goForward(id));
  ipcMain.handle(IPC.TabReload, (e, id: string) => managerFor(e).tm.reload(id));
  ipcMain.handle(IPC.TabReloadIgnoringCache, (e, id: string) => managerFor(e).tm.reloadIgnoringCache(id));
  ipcMain.handle(IPC.TabFind, (e, query: string, options?: Electron.FindInPageOptions, id?: string) =>
    managerFor(e).tm.findInPage(query, options, id),
  );
  ipcMain.handle(IPC.TabStopFind, (e, action?: 'clearSelection' | 'keepSelection' | 'activateSelection', id?: string) =>
    managerFor(e).tm.stopFindInPage(action, id),
  );
  ipcMain.handle(IPC.OpenFindBar, (e) => {
    const { win } = managerFor(e);
    win.webContents.send(IPC.OpenFindBarEvent);
  });
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
  ipcMain.handle(IPC.TabSavePage, async (e, id?: string) => {
    const { tm } = managerFor(e);
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: 'page.html',
      filters: [{ name: 'HTML page', extensions: ['html'] }],
    });
    return filePath ? tm.savePage(filePath, id) : false;
  });
  ipcMain.handle(IPC.TabToggleDevTools, (e, id?: string, mode?: 'right' | 'bottom' | 'detach') =>
    managerFor(e).tm.toggleDevTools(id, mode),
  );
  ipcMain.handle(IPC.TabViewSource, (e, id?: string) => managerFor(e).tm.viewSource(id));
  ipcMain.handle(IPC.ShowTabContextMenu, (e, tabId: string, position?: { x: number; y: number }) =>
    managerFor(e).tm.showTabContextMenu(tabId, position),
  );
  ipcMain.handle(IPC.ShowTabBarContextMenu, (e, position?: { x: number; y: number }) =>
    managerFor(e).tm.showTabBarContextMenu(position),
  );

  ipcMain.handle(IPC.GetState, (e) => {
    const { win } = managerFor(e);
    return WindowManager.stateFor(win.id);
  });

  ipcMain.handle(IPC.SetSidebar, (e, open: boolean, panel?: SidebarPanel) => {
    const { tm } = managerFor(e);
    tm.setSidebarOpen(open, panel);
    tm.emitState();
  });
  ipcMain.handle(IPC.SetSidebarPinned, (e, pinned: boolean) => {
    const { tm } = managerFor(e);
    tm.setSidebarPinned(pinned);
  });
  ipcMain.handle(IPC.SetSidebarWidth, (e, px: number) => {
    const { tm } = managerFor(e);
    tm.setSidebarWidth(px);
  });

  ipcMain.handle(IPC.GetSuggestions, async (_e, query: string): Promise<Suggestion[]> => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      const topSites = listHistory('', 8).map<Suggestion>((h) => ({
        type: 'top-site',
        title: h.title || h.url,
        url: h.url,
      }));
      const recentHistory = searchHistory('', 6).map<Suggestion>((h) => ({
        type: 'history',
        title: h.title || h.url,
        url: h.url,
      }));
      
      const topSiteUrls = new Set(topSites.map(s => s.url));
      const filteredHistory = recentHistory.filter(h => !topSiteUrls.has(h.url));
      
      return [...topSites, ...filteredHistory].slice(0, 10);
    }

    const isUrl = trimmedQuery.includes('.') && !trimmedQuery.includes(' ');
    const suggestions: Suggestion[] = [];

    if (isUrl) {
      suggestions.push({ type: 'url', title: trimmedQuery, url: trimmedQuery });
    }

    const history = searchHistory(trimmedQuery, 6).map<Suggestion>((h) => ({
      type: 'history',
      title: h.title || h.url,
      url: h.url,
    }));
    suggestions.push(...history);

    const historyUrls = new Set(history.map((h) => h.url));
    const bookmarks = searchBookmarks(trimmedQuery, 4)
      .filter((b) => b.url && !historyUrls.has(b.url))
      .map<Suggestion>((b) => ({
        type: 'bookmark',
        title: b.title,
        url: b.url ?? '',
      }));
    
    suggestions.push(...bookmarks);

    suggestions.push({ type: 'search', title: `Search for "${trimmedQuery}"`, url: trimmedQuery });

    return suggestions.slice(0, 10);
  });

  ipcMain.handle(IPC.WindowControl, (e, action: 'minimize' | 'maximize' | 'close') => {
    const { win } = managerFor(e);
    if (action === 'minimize') win.minimize();
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
    else win.close();
  });

  ipcMain.handle(IPC.WindowToggleFullscreen, (e) => {
    const { win, tm } = managerFor(e);
    const fullscreen = !win.isFullScreen();
    win.setFullScreen(fullscreen);
    tm.setFullscreen(fullscreen);
  });

  ipcMain.handle(IPC.NewWindow, () => {
    WindowManager.createWindow({ incognito: false });
  });

  ipcMain.handle(IPC.NewIncognitoWindow, () => {
    WindowManager.createWindow({ incognito: true });
  });

  ipcMain.handle(IPC.ShowPopup, (e, options: { type: string; x: number; y: number }) => {
    const { win } = managerFor(e);
    WindowManager.showPopup(win, options);
  });

  ipcMain.handle(IPC.ClosePopup, (e) => {
    const { win } = managerFor(e);
    WindowManager.closePopup(win);
  });

  ipcMain.handle(IPC.ShowAppMenu, (e, bounds: { x: number; y: number }) => {
    const { win } = managerFor(e);
    WindowManager.toggleAppMenu(win, bounds);
  });

  ipcMain.handle(IPC.ShowSuggestions, (e, bounds: { x: number; y: number; width: number }, query: string) => {
    const { win } = managerFor(e);
    WindowManager.showSuggestions(win, bounds, query);
  });
  ipcMain.handle(IPC.UpdateSuggestions, (e, query: string) => {
    WindowManager.updateSuggestions(managerFor(e).win, query);
  });
  ipcMain.handle(IPC.HideSuggestions, (e) => {
    WindowManager.closeSuggestions(managerFor(e).win);
  });
  ipcMain.handle(IPC.ShowDownloadPopup, (e) => {
    WindowManager.showDownloadPopup(managerFor(e).win);
  });
  ipcMain.handle(IPC.ResizeDownloadPopup, (e, height: number) => {
    WindowManager.resizeDownloadPopup(managerFor(e).win, height);
  });
  ipcMain.handle(IPC.HideDownloadPopup, (e) => {
    WindowManager.closeDownloadPopup(managerFor(e).win);
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

  ipcMain.handle(IPC.ClearCache, async (e) => {
    const { win } = managerFor(e);
    await win.webContents.session.clearCache();
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

  ipcMain.handle(IPC.ShowBookmarkContextMenu, (e, id: number, url?: string) => {
    const { Menu } = require('electron');
    const { tm } = managerFor(e);

    const template: any[] = [];
    if (url) {
      template.push({
        label: 'Open in New Tab',
        click: () => {
          tm.createTab(url);
        }
      });
      template.push({ type: 'separator' });
    }

    template.push({
      label: 'Delete',
      click: () => {
        removeBookmark(id);
        tm.emitState();
      }
    });

    const menu = Menu.buildFromTemplate(template);
    menu.popup();
  });
  ipcMain.handle(IPC.ShowContextMenu, (e, x: number, y: number, editable = false) => {
    const { tm } = managerFor(e);
    tm.showChromeContextMenu(x, y, editable);
  });

  // Settings
  ipcMain.handle(IPC.SettingsGet, (_e, permissionPrefix?: string) => ({
    theme: getSetting('theme', 'system'),
    colorTheme: getSetting('colorTheme', 'ember'),
    searchEngine: getSetting('searchEngine', 'google'),
    homepage: getSetting('homepage', 'https://www.google.com'),
    startupBehavior: getSetting('startupBehavior', 'newtab'),
    bookmarksBarVisible: getSetting('bookmarksBarVisible', 'true') === 'true',
    hibernateMinutes: Number(getSetting('hibernateMinutes', '15')),
    glassOpacity: Number(getSetting('glassOpacity', '65')),
    glassBlur: Number(getSetting('glassBlur', '16')),
    cornerRadius: Number(getSetting('cornerRadius', '14')),
    devDockMode: getSetting('devDockMode', 'right'),
    devUserAgent: getSetting('devUserAgent', 'default'),
    sendDoNotTrack: getSetting('sendDoNotTrack', 'false') === 'true',
    clearSiteDataOnExit: getSetting('clearSiteDataOnExit', 'false') === 'true',
    clearHistoryOnExit: getSetting('clearHistoryOnExit', 'false') === 'true',
    permissions: permissionPrefix ? getSettingsByPrefix(permissionPrefix) : undefined,
  }));
  ipcMain.handle(IPC.SettingsSet, (e, key: string, value: string) => {
    const { tm } = managerFor(e);
    setSetting(key, value);
    if (key === 'startupBehavior' && value !== 'continue') setSetting('sessionTabs', '[]');
    if (key === 'hibernateMinutes') tm.refreshHibernateTimers();
    if (key === 'devUserAgent') tm.setUserAgent(value);
  });
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
  ipcMain.handle(IPC.HistoryRemove, (_e, id: number) => removeHistoryEntry(id));
  ipcMain.handle(IPC.HistoryClear, (_e, since: number) => clearHistory(since));
  ipcMain.handle(IPC.HistoryTerrain, (_e, hours?: number) => getHistoryTerrain(hours ?? 6));
  ipcMain.handle(IPC.PasswordsList, () => listPasswords());
  ipcMain.handle(IPC.PasswordSave, (_e, origin: string, username: string, password: string) => savePassword(origin, username, password));
  ipcMain.handle(IPC.PasswordRemove, (_e, id: number) => removePassword(id));
  ipcMain.handle(IPC.PerformanceSnapshot, (e) => managerFor(e).tm.performanceSnapshot());

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

  // Tab Group management
  ipcMain.handle(IPC.TabGroupCreate, (e, name: string, color: string, tabIds: string[]) =>
    managerFor(e).tm.createGroup(name, color, tabIds),
  );
  ipcMain.handle(IPC.TabGroupAddTab, (e, tabId: string, groupId: string) =>
    managerFor(e).tm.addTabToGroup(tabId, groupId),
  );
  ipcMain.handle(IPC.TabGroupRemoveTab, (e, tabId: string) =>
    managerFor(e).tm.removeTabFromGroup(tabId),
  );
  ipcMain.handle(IPC.TabGroupRename, (e, groupId: string, name: string) =>
    managerFor(e).tm.renameGroup(groupId, name),
  );
  ipcMain.handle(IPC.TabGroupSetColor, (e, groupId: string, color: string) =>
    managerFor(e).tm.setGroupColor(groupId, color),
  );
  ipcMain.handle(IPC.TabGroupDelete, (e, groupId: string) =>
    managerFor(e).tm.deleteGroup(groupId),
  );
}
