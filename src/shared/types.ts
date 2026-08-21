// Shared types & IPC channel names between main / preload / renderer.

export type SecurityState = 'secure' | 'insecure' | 'warning' | 'internal';

export interface TabState {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  pinned: boolean;
  muted: boolean;
  audible: boolean;
  groupId: string | null;
  hibernated: boolean;
  zoomFactor: number;
  securityState: SecurityState;
  dwellTimeMs?: number;
  themeColor: string | null;
}

export interface TabGroupState {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
}

export interface WindowState {
  windowId: number;
  incognito: boolean;
  tabs: TabState[];
  groups: TabGroupState[];
  activeTabId: string | null;
  sidebarOpen: boolean;
  sidebarPinned: boolean;
  sidebarPanel: SidebarPanel;
  appMenuOpen?: boolean;
  bookmarksBarVisible?: boolean;
  fullscreen: boolean;
  theme?: 'light' | 'dark' | 'system';
  colorTheme?: 'ember' | 'ocean' | 'forest' | 'violet' | 'rose';
}

export type SidebarPanel = 'tabs' | 'bookmarks' | 'history' | 'downloads' | 'shields' | null;

export interface BookmarkNode {
  id: number;
  parentId: number | null;
  title: string;
  url: string | null;
  isFolder: boolean;
  position: number;
  createdAt: number;
}

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  domain?: string;
  visitedAt: number;
  visitCount: number;
  dwellMs?: number;
}

export interface StoredPassword {
  id: number;
  origin: string;
  username: string;
  createdAt: number;
}

export interface HistoryTerrainBucket {
  bucketIndex: number;
  startTime: number;
  endTime: number;
  timeLabel: string;
  totalDwellSec: number;
  visitCount: number;
  topDomain: string | null;
  topTitle: string | null;
  isPeak: boolean;
}

export interface HistoryTerrainData {
  buckets: HistoryTerrainBucket[];
  totalDwellSec: number;
  totalVisits: number;
  topSites: { domain: string; dwellSec: number; visits: number; title: string }[];
  timeRangeLabel: string;
}

export interface DownloadItem {
  id: string;
  url: string;
  filename: string;
  path: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted';
  startedAt: number;
}

export interface Suggestion {
  type: 'history' | 'bookmark' | 'search' | 'shortcut' | 'url' | 'top-site';
  title: string;
  url: string;
}

export interface ShieldsConfig {
  enabled: boolean;
  adBlockEnabled: boolean;
  trackerBlockEnabled: boolean;
  httpsUpgrade: boolean;
  fingerprintProtection: 'off' | 'standard' | 'aggressive';
  cookieControl: 'all' | 'cross-site' | 'blocked';
}

export interface ShieldsStats {
  adsBlocked: number;
  trackersBlocked: number;
  httpsUpgrades: number;
  fingerprintsBlocked: number;
  scriptsBlocked: number;
}

export const IPC = {
  // renderer -> main (invoke)
  TabCreate: 'tab:create',
  TabClose: 'tab:close',
  TabReopenClosed: 'tab:reopenClosed',
  TabActivate: 'tab:activate',
  TabNavigate: 'tab:navigate',
  TabGoBack: 'tab:goBack',
  TabGoForward: 'tab:goForward',
  TabReload: 'tab:reload',
  TabReloadIgnoringCache: 'tab:reloadIgnoringCache',
  TabFind: 'tab:find',
  TabStop: 'tab:stop',
  TabTogglePin: 'tab:togglePin',
  TabToggleMute: 'tab:toggleMute',
  TabHibernate: 'tab:hibernate',
  TabMove: 'tab:move',
  TabSearch: 'tab:search',
  TabSetZoom: 'tab:setZoom',
  TabGetZoom: 'tab:getZoom',
  TabZoomIn: 'tab:zoomIn',
  TabZoomOut: 'tab:zoomOut',
  TabZoomReset: 'tab:zoomReset',
  TabStopFind: 'tab:stopFind',
  TabPrint: 'tab:print',
  TabSavePage: 'tab:savePage',
  TabToggleDevTools: 'tab:toggleDevTools',
  TabViewSource: 'tab:viewSource',
  ShowTabContextMenu: 'tab:showContextMenu',
  ShowTabBarContextMenu: 'tab:showTabBarContextMenu',
  GetState: 'app:getState',
  GetSuggestions: 'omnibox:suggestions',
  SetSidebar: 'app:setSidebar',
  SetSidebarPinned: 'app:setSidebarPinned',
  SetSidebarWidth: 'app:setSidebarWidth',
  OpenFindBar: 'app:openFindBar',
  WindowControl: 'window:control',
  WindowToggleFullscreen: 'window:toggleFullscreen',
  NewWindow: 'window:newWindow',
  NewIncognitoWindow: 'window:newIncognito',
  BookmarksList: 'bookmarks:list',
  BookmarkAdd: 'bookmarks:add',
  BookmarkRemove: 'bookmarks:remove',
  BookmarkToggle: 'bookmarks:toggle',
  BookmarkGetByUrl: 'bookmarks:getByUrl',
  BookmarkCreateFolder: 'bookmarks:createFolder',
  BookmarksExport: 'bookmarks:export',
  BookmarksImport: 'bookmarks:import',
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',
  OpenSettings: 'app:openSettings',
  SetChromeHeight: 'app:setChromeHeight',
  SetSuggestionsHeight: 'app:setSuggestionsHeight',
  HistoryList: 'history:list',
  HistoryRemove: 'history:remove',
  HistoryClear: 'history:clear',
  HistoryTerrain: 'history:terrain',
  PasswordsList: 'passwords:list',
  PasswordSave: 'passwords:save',
  PasswordRemove: 'passwords:remove',
  PerformanceSnapshot: 'performance:snapshot',
  DomainGroupsGet: 'domainGroups:get',
  DomainGroupsSet: 'domainGroups:set',
  DownloadsList: 'downloads:list',
  DownloadPause: 'downloads:pause',
  DownloadResume: 'downloads:resume',
  DownloadCancel: 'downloads:cancel',
  DownloadOpen: 'downloads:open',
  CapturePage: 'tools:capturePage',
  ShowPopup: 'app:showPopup',
  ClosePopup: 'app:closePopup',
  PopupOpen: 'app:popupOpen',
  PopupClose: 'app:popupClose',
  ShowAppMenu: 'app:showAppMenu',
  ShowSuggestions: 'app:showSuggestions',
  UpdateSuggestions: 'app:updateSuggestions',
  HideSuggestions: 'app:hideSuggestions',
  ShowDownloadPopup: 'app:showDownloadPopup',
  ResizeDownloadPopup: 'app:resizeDownloadPopup',
  HideDownloadPopup: 'app:hideDownloadPopup',
  SetAppMenuOpen: 'app:setAppMenuOpen',
  ShowBookmarkContextMenu: 'app:showBookmarkContextMenu',
  ShowContextMenu: 'app:showContextMenu',
  ClearBrowsingData: 'app:clearBrowsingData',
  ClearCache: 'app:clearCache',
  AppExit: 'app:exit',
  ShieldsGetConfig: 'shields:getConfig',
  ShieldsSetConfig: 'shields:setConfig',
  ShieldsGetStats: 'shields:getStats',
  ShieldsGetStatsForTab: 'shields:getStatsForTab',
  ShieldsResetStats: 'shields:resetStats',

  // Tab group management
  TabGroupCreate: 'tab:group:create',
  TabGroupAddTab: 'tab:group:addTab',
  TabGroupRemoveTab: 'tab:group:removeTab',
  TabGroupRename: 'tab:group:rename',
  TabGroupSetColor: 'tab:group:setColor',
  TabGroupDelete: 'tab:group:delete',
  TabGroupToggleCollapse: 'tab:group:toggleCollapse',
  TabGroupCloseTabs: 'tab:group:closeTabs',
  TabGroupNewTab: 'tab:group:newTab',
  TabGroupMoveToNewWindow: 'tab:group:moveToNewWindow',

  // main -> renderer (events)
  StateChanged: 'event:stateChanged',
  DownloadsChanged: 'event:downloadsChanged',
  SuggestionsChanged: 'event:suggestionsChanged',
  DownloadPopupClosed: 'event:downloadPopupClosed',
  FindResult: 'event:findResult',
  OpenFindBarEvent: 'event:openFindBar',
} as const;
