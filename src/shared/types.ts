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
  sidebarPanel: SidebarPanel;
  appMenuOpen?: boolean;
  verticalTabs: boolean;
  bookmarksBarVisible: boolean;
  theme: 'light' | 'dark' | 'system';
}

export type SidebarPanel = 'tabs' | 'bookmarks' | 'history' | 'downloads' | 'shields' | 'extensions' | 'ai' | null;

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
  type: 'history' | 'bookmark' | 'search' | 'shortcut';
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
  TabActivate: 'tab:activate',
  TabNavigate: 'tab:navigate',
  TabGoBack: 'tab:goBack',
  TabGoForward: 'tab:goForward',
  TabReload: 'tab:reload',
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
  TabPrint: 'tab:print',
  TabToggleDevTools: 'tab:toggleDevTools',
  TabViewSource: 'tab:viewSource',
  GetState: 'app:getState',
  GetSuggestions: 'omnibox:suggestions',
  SetSidebar: 'app:setSidebar',
  SetVerticalTabs: 'app:setVerticalTabs',
  SetTheme: 'app:setTheme',
  SetBookmarksBar: 'app:setBookmarksBar',
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
  HistoryList: 'history:list',
  HistoryClear: 'history:clear',
  HistoryTerrain: 'history:terrain',
  DomainGroupsGet: 'domainGroups:get',
  DomainGroupsSet: 'domainGroups:set',
  DownloadsList: 'downloads:list',
  DownloadPause: 'downloads:pause',
  DownloadResume: 'downloads:resume',
  DownloadCancel: 'downloads:cancel',
  DownloadOpen: 'downloads:open',
  CapturePage: 'tools:capturePage',
  ShowAppMenu: 'app:showAppMenu',
  SetAppMenuOpen: 'app:setAppMenuOpen',
  ClearBrowsingData: 'app:clearBrowsingData',
  AppExit: 'app:exit',
  ShieldsGetConfig: 'shields:getConfig',
  ShieldsSetConfig: 'shields:setConfig',
  ShieldsGetStats: 'shields:getStats',
  ShieldsGetStatsForTab: 'shields:getStatsForTab',
  ShieldsResetStats: 'shields:resetStats',

  // main -> renderer (events)
  StateChanged: 'event:stateChanged',
  DownloadsChanged: 'event:downloadsChanged',
} as const;
