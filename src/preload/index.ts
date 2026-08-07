import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';
import type { SidebarPanel } from '../shared/types';

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api = {
  tabs: {
    create: (url?: string) => invoke(IPC.TabCreate, url),
    close: (id: string) => invoke(IPC.TabClose, id),
    activate: (id: string) => invoke(IPC.TabActivate, id),
    navigate: (id: string, url: string) => invoke(IPC.TabNavigate, id, url),
    goBack: (id: string) => invoke(IPC.TabGoBack, id),
    goForward: (id: string) => invoke(IPC.TabGoForward, id),
    reload: (id: string) => invoke(IPC.TabReload, id),
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
    toggleDevTools: (id?: string, mode?: 'right' | 'bottom' | 'detach') =>
      invoke(IPC.TabToggleDevTools, id, mode),
    viewSource: (id?: string) => invoke(IPC.TabViewSource, id),
  },
  app: {
    getState: () => invoke(IPC.GetState),
    getSuggestions: (q: string) => invoke(IPC.GetSuggestions, q),
    setSidebar: (open: boolean, panel?: SidebarPanel) => invoke(IPC.SetSidebar, open, panel),
    setVerticalTabs: (v: boolean) => invoke(IPC.SetVerticalTabs, v),
    setTheme: (t: string) => invoke(IPC.SetTheme, t),
    setBookmarksBar: (v: boolean) => invoke(IPC.SetBookmarksBar, v),
    setChromeHeight: (px: number) => invoke(IPC.SetChromeHeight, px),
    windowControl: (a: 'minimize' | 'maximize' | 'close') => invoke(IPC.WindowControl, a),
    toggleFullscreen: () => invoke(IPC.WindowToggleFullscreen),
    newWindow: () => invoke(IPC.NewWindow),
    newIncognitoWindow: () => invoke(IPC.NewIncognitoWindow),
    showAppMenu: (bounds: { x: number; y: number }) => invoke(IPC.ShowAppMenu, bounds),
    setAppMenuOpen: (open: boolean) => invoke(IPC.SetAppMenuOpen, open),
    openSettings: (section?: string) => invoke(IPC.OpenSettings, section),
    clearBrowsingData: () => invoke(IPC.ClearBrowsingData),
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
    get: () => invoke(IPC.SettingsGet),
    set: (key: string, value: string) => invoke(IPC.SettingsSet, key, value),
  },
  history: {
    list: (query = '', since = 0) => invoke(IPC.HistoryList, query, since),
    clear: (since = 0) => invoke(IPC.HistoryClear, since),
    getTerrain: (hours = 6) => invoke(IPC.HistoryTerrain, hours),
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
  onMenu: (cb: (action: string) => void) => {
    const channels = [
      'menu:newTab', 'menu:closeTab', 'menu:reload', 'menu:back', 'menu:forward',
      'menu:toggleSidebar', 'menu:toggleBookmarksBar', 'menu:newIncognito', 'menu:find', 'menu:settings',
    ];
    const listeners = channels.map((ch) => {
      const l = () => cb(ch);
      ipcRenderer.on(ch, l);
      return [ch, l] as const;
    });
    return () => listeners.forEach(([ch, l]) => ipcRenderer.removeListener(ch, l));
  },
};

export type LumenApi = typeof api;
contextBridge.exposeInMainWorld('lumen', api);
