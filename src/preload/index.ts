import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';
import type { SidebarPanel } from '../shared/types';

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api = {
  tabs: {
    create: (url?: string) => invoke(IPC.TabCreate, url),
    close: (id: string) => invoke(IPC.TabClose, id),
    reopenClosed: () => invoke(IPC.TabReopenClosed),
    activate: (id: string) => invoke(IPC.TabActivate, id),
    navigate: (id: string, url: string) => invoke(IPC.TabNavigate, id, url),
    goBack: (id: string) => invoke(IPC.TabGoBack, id),
    goForward: (id: string) => invoke(IPC.TabGoForward, id),
    reload: (id: string) => invoke(IPC.TabReload, id),
    reloadIgnoringCache: (id: string) => invoke(IPC.TabReloadIgnoringCache, id),
    find: (query: string, options?: any, id?: string) => invoke(IPC.TabFind, query, options, id),
    stopFind: (action?: 'clearSelection' | 'keepSelection' | 'activateSelection', id?: string) =>
      invoke(IPC.TabStopFind, action, id),
    stop: (id: string) => invoke(IPC.TabStop, id),
    togglePin: (id: string) => invoke(IPC.TabTogglePin, id),
    toggleMute: (id: string) => invoke(IPC.TabToggleMute, id),
    hibernate: (id: string) => invoke(IPC.TabHibernate, id),
    move: (id: string, to: number) => invoke(IPC.TabMove, id, to),
    search: (q: string) => invoke(IPC.TabSearch, q),
    setZoom: (factor: number, id?: string) => invoke(IPC.TabSetZoom, factor, id),
    getZoom: (id?: string) => invoke(IPC.TabGetZoom, id),
    zoomIn: (id?: string) => invoke(IPC.TabZoomIn, id),
    zoomOut: (id?: string) => invoke(IPC.TabZoomOut, id),
    zoomReset: (id?: string) => invoke(IPC.TabZoomReset, id),
    print: (id?: string) => invoke(IPC.TabPrint, id),
    savePage: (id?: string) => invoke(IPC.TabSavePage, id),
    toggleDevTools: (id?: string, mode?: 'right' | 'bottom' | 'detach') =>
      invoke(IPC.TabToggleDevTools, id, mode),
    viewSource: (id?: string) => invoke(IPC.TabViewSource, id),
    showContextMenu: (tabId: string, position?: { x: number; y: number }) =>
      invoke(IPC.ShowTabContextMenu, tabId, position),
    showTabBarContextMenu: (position?: { x: number; y: number }) =>
      invoke(IPC.ShowTabBarContextMenu, position),
  },
  groups: {
    create: (name: string, color: string, tabIds: string[]) =>
      invoke(IPC.TabGroupCreate, name, color, tabIds),
    addTab: (tabId: string, groupId: string) =>
      invoke(IPC.TabGroupAddTab, tabId, groupId),
    removeTab: (tabId: string) =>
      invoke(IPC.TabGroupRemoveTab, tabId),
    rename: (groupId: string, name: string) =>
      invoke(IPC.TabGroupRename, groupId, name),
    setColor: (groupId: string, color: string) =>
      invoke(IPC.TabGroupSetColor, groupId, color),
    delete: (groupId: string) =>
      invoke(IPC.TabGroupDelete, groupId),
  },
  app: {
    getState: () => invoke(IPC.GetState),
    getSuggestions: (q: string) => invoke(IPC.GetSuggestions, q),
    openFindBar: () => invoke(IPC.OpenFindBar),
    setSidebar: (open: boolean, panel?: SidebarPanel) => invoke(IPC.SetSidebar, open, panel),
    setSidebarPinned: (pinned: boolean) => invoke(IPC.SetSidebarPinned, pinned),
    setSidebarWidth: (px: number) => invoke(IPC.SetSidebarWidth, px),
    setChromeHeight: (px: number) => invoke(IPC.SetChromeHeight, px),
    windowControl: (a: 'minimize' | 'maximize' | 'close') => invoke(IPC.WindowControl, a),
    toggleFullscreen: () => invoke(IPC.WindowToggleFullscreen),
    newWindow: () => invoke(IPC.NewWindow),
    newIncognitoWindow: () => invoke(IPC.NewIncognitoWindow),
    showPopup: (options: { type: string; x: number; y: number }) => invoke(IPC.ShowPopup, options),
    closePopup: () => invoke(IPC.ClosePopup),
    showAppMenu: (bounds: { x: number; y: number }) => invoke(IPC.ShowAppMenu, bounds),
    showSuggestions: (bounds: { x: number; y: number; width: number }, query: string) => invoke(IPC.ShowSuggestions, bounds, query),
    updateSuggestions: (query: string) => invoke(IPC.UpdateSuggestions, query),
    hideSuggestions: () => invoke(IPC.HideSuggestions),
    showDownloadPopup: () => invoke(IPC.ShowDownloadPopup),
    resizeDownloadPopup: (height: number) => invoke(IPC.ResizeDownloadPopup, height),
    hideDownloadPopup: () => invoke(IPC.HideDownloadPopup),
    setAppMenuOpen: (open: boolean) => invoke(IPC.SetAppMenuOpen, open),
    showBookmarkContextMenu: (bookmarkId: number, url?: string) => invoke(IPC.ShowBookmarkContextMenu, bookmarkId, url),
    showContextMenu: (x: number, y: number, editable = false) => invoke(IPC.ShowContextMenu, x, y, editable),
    openSettings: (section?: string) => invoke(IPC.OpenSettings, section),
    clearBrowsingData: () => invoke(IPC.ClearBrowsingData),
    clearCache: () => invoke(IPC.ClearCache),
    exit: () => invoke(IPC.AppExit),
  },
  bookmarks: {
    list: () => invoke(IPC.BookmarksList),
    add: (title: string, url: string, parentId: number | null = null) =>
      invoke(IPC.BookmarkAdd, title, url, parentId),
    remove: (id: number) => invoke(IPC.BookmarkRemove, id),
    toggle: (title: string, url: string) => invoke(IPC.BookmarkToggle, title, url),
    getByUrl: (url: string) => invoke(IPC.BookmarkGetByUrl, url),
    createFolder: (title: string, parentId: number | null = null) =>
      invoke(IPC.BookmarkCreateFolder, title, parentId),
    export: () => invoke(IPC.BookmarksExport),
    import: () => invoke(IPC.BookmarksImport),
  },
  settings: {
    get: (permissionPrefix?: string) => invoke(IPC.SettingsGet, permissionPrefix),
    set: (key: string, value: string) => invoke(IPC.SettingsSet, key, value),
  },
  history: {
    list: (query = '', since = 0) => invoke(IPC.HistoryList, query, since),
    remove: (id: number) => invoke(IPC.HistoryRemove, id),
    clear: (since = 0) => invoke(IPC.HistoryClear, since),
    getTerrain: (hours = 6) => invoke(IPC.HistoryTerrain, hours),
  },
  passwords: {
    list: () => invoke(IPC.PasswordsList),
    save: (origin: string, username: string, password: string) => invoke(IPC.PasswordSave, origin, username, password),
    remove: (id: number) => invoke(IPC.PasswordRemove, id),
  },
  performance: {
    snapshot: () => invoke(IPC.PerformanceSnapshot),
  },
  domainGroups: {
    get: () => invoke(IPC.DomainGroupsGet),
    set: (domain: string, collapsed: boolean) => invoke(IPC.DomainGroupsSet, domain, collapsed),
  },
  downloads: {
    list: () => invoke(IPC.DownloadsList),
    pause: (id: string) => invoke(IPC.DownloadPause, id),
    resume: (id: string) => invoke(IPC.DownloadResume, id),
    cancel: (id: string) => invoke(IPC.DownloadCancel, id),
    open: (id: string) => invoke(IPC.DownloadOpen, id),
  },
  shields: {
    getConfig: () => invoke(IPC.ShieldsGetConfig),
    setConfig: (key: string, value: string) => invoke(IPC.ShieldsSetConfig, key, value),
    getStats: (origin?: string) => invoke(IPC.ShieldsGetStats, origin),
    getStatsForTab: () => invoke(IPC.ShieldsGetStatsForTab),
    resetStats: () => invoke(IPC.ShieldsResetStats),
  },
  onStateChanged: (cb: (state: unknown) => void) => {
    const listener = (_e: unknown, state: unknown) => cb(state);
    ipcRenderer.on(IPC.StateChanged, listener);
    return () => ipcRenderer.removeListener(IPC.StateChanged, listener);
  },
  onDownloadsChanged: (cb: (list: unknown) => void) => {
    const listener = (_e: unknown, list: unknown) => cb(list);
    ipcRenderer.on(IPC.DownloadsChanged, listener);
    return () => ipcRenderer.removeListener(IPC.DownloadsChanged, listener);
  },
  onSuggestionsChanged: (cb: (query: string) => void) => {
    const listener = (_e: unknown, query: string) => cb(query);
    ipcRenderer.on(IPC.SuggestionsChanged, listener);
    return () => ipcRenderer.removeListener(IPC.SuggestionsChanged, listener);
  },
  onDownloadPopupClosed: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.DownloadPopupClosed, listener);
    return () => ipcRenderer.removeListener(IPC.DownloadPopupClosed, listener);
  },
  onPopupOpen: (cb: (data: { type: string; x: number; y: number }) => void) => {
    const listener = (_e: unknown, data: { type: string; x: number; y: number }) => cb(data);
    ipcRenderer.on(IPC.PopupOpen, listener);
    return () => ipcRenderer.removeListener(IPC.PopupOpen, listener);
  },
  onPopupClose: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.PopupClose, listener);
    return () => ipcRenderer.removeListener(IPC.PopupClose, listener);
  },
  onFindResult: (cb: (data: { activeMatchOrdinal: number; matches: number; finalUpdate?: boolean }) => void) => {
    const listener = (_e: unknown, data: { activeMatchOrdinal: number; matches: number; finalUpdate?: boolean }) => cb(data);
    ipcRenderer.on(IPC.FindResult, listener);
    return () => ipcRenderer.removeListener(IPC.FindResult, listener);
  },
  onOpenFindBar: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(IPC.OpenFindBarEvent, listener);
    return () => ipcRenderer.removeListener(IPC.OpenFindBarEvent, listener);
  },
  onMenu: (cb: (action: string) => void) => {
    const channels = [
      'menu:newTab', 'menu:closeTab', 'menu:reload', 'menu:back', 'menu:forward',
      'menu:toggleSidebar', 'menu:toggleBookmarksBar', 'menu:newIncognito', 'menu:find', 'menu:settings',
      'menu:focusAddressBar', 'menu:openBookmarks', 'menu:openHistory', 'menu:openDownloads', 'menu:savePage',
    ];
    const listeners = channels.map((ch) => {
      const l = () => cb(ch);
      ipcRenderer.on(ch, l);
      return [ch, l] as const;
    });
    return () => listeners.forEach(([ch, l]) => ipcRenderer.removeListener(ch, l));
  },
};

export type BladeApi = typeof api;
export type LumenApi = typeof api;
contextBridge.exposeInMainWorld('blade', api);
contextBridge.exposeInMainWorld('lumen', api);
