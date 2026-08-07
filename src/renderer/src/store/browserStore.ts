import { create } from 'zustand';
import type { WindowState, TabState, SidebarPanel, DownloadItem } from '@shared/types';
import { api } from '../lib/api';
import { applyCustomizationStyles, DEFAULT_CUSTOMIZATION } from '../lib/theme';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  searchEngine: string;
  homepage: string;
  verticalTabs: boolean;
  bookmarksBarVisible: boolean;
  hibernateMinutes: number;
  accentColor: string;
  surfaceColor: string;
  glassOpacity: number;
  glassBlur: number;
  cornerRadius: number;
  tintGlow: boolean;
  devDockMode: 'right' | 'bottom' | 'detach';
  devUserAgent: string;
}

interface BrowserStore extends WindowState {
  downloads: DownloadItem[];
  initialized: boolean;
  /** Whether the active tab's URL is bookmarked */
  activeBookmarked: boolean;

  // Customization state
  accentColor: string;
  surfaceColor: string;
  glassOpacity: number;
  glassBlur: number;
  cornerRadius: number;
  tintGlow: boolean;

  init: () => Promise<void>;
  applyState: (s: WindowState) => void;
  refreshSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetCustomization: () => void;

  createTab: (url?: string) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  navigateActive: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  stop: () => void;
  togglePin: (id: string) => void;
  toggleMute: (id: string) => void;
  hibernate: (id: string) => void;
  toggleBookmarkActive: () => Promise<void>;

  setSidebar: (open: boolean, panel?: SidebarPanel) => void;
  openSettings: (section?: string) => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  setBookmarksBarVisible: (v: boolean) => void;
  setAppMenuOpen: (open: boolean) => void;
  toggleAppMenu: () => void;

  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  setZoom: (factor: number) => void;
  toggleFullscreen: () => void;
  print: () => void;
  toggleDevTools: (mode?: 'right' | 'bottom' | 'detach') => void;
  viewSource: () => void;
  newWindow: () => void;
  newIncognitoWindow: () => void;
  clearBrowsingData: () => Promise<void>;
  exit: () => void;

  activeTab: () => TabState | undefined;
}

const CHROME_BASE = 92;
const BOOKMARKS_BAR = 36;

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  windowId: 0,
  incognito: false,
  tabs: [],
  groups: [],
  activeTabId: null,
  sidebarOpen: false,
  sidebarPanel: 'shields',
  appMenuOpen: false,
  verticalTabs: false,
  bookmarksBarVisible: true,
  theme: 'system',
  downloads: [],
  initialized: false,
  activeBookmarked: false,

  // Customization defaults
  accentColor: DEFAULT_CUSTOMIZATION.accentColor,
  surfaceColor: DEFAULT_CUSTOMIZATION.surfaceColor,
  glassOpacity: DEFAULT_CUSTOMIZATION.glassOpacity,
  glassBlur: DEFAULT_CUSTOMIZATION.glassBlur,
  cornerRadius: DEFAULT_CUSTOMIZATION.cornerRadius,
  tintGlow: DEFAULT_CUSTOMIZATION.tintGlow,

  init: async () => {
    if (get().initialized) return;
    const state = (await api.app.getState()) as WindowState;
    set({ ...state, initialized: true });
    await get().refreshSettings();

    api.onStateChanged((s) => get().applyState(s as WindowState));
    api.onDownloadsChanged((list) => set({ downloads: list as DownloadItem[] }));
    api.onMenu((action) => handleMenuAction(action, get()));
  },

  refreshSettings: async () => {
    const s = (await api.settings.get()) as AppSettings;
    const accentColor = s.accentColor || DEFAULT_CUSTOMIZATION.accentColor;
    const surfaceColor = s.surfaceColor || DEFAULT_CUSTOMIZATION.surfaceColor;
    const glassOpacity = s.glassOpacity !== undefined && !isNaN(Number(s.glassOpacity)) ? Number(s.glassOpacity) : DEFAULT_CUSTOMIZATION.glassOpacity;
    const glassBlur = s.glassBlur !== undefined && !isNaN(Number(s.glassBlur)) ? Number(s.glassBlur) : DEFAULT_CUSTOMIZATION.glassBlur;
    const cornerRadius = s.cornerRadius !== undefined && !isNaN(Number(s.cornerRadius)) ? Number(s.cornerRadius) : DEFAULT_CUSTOMIZATION.cornerRadius;
    const tintGlow = s.tintGlow !== undefined ? (String(s.tintGlow) === 'true' || s.tintGlow === true) : DEFAULT_CUSTOMIZATION.tintGlow;

    set({
      theme: s.theme || 'system',
      verticalTabs: s.verticalTabs,
      bookmarksBarVisible: s.bookmarksBarVisible,
      accentColor,
      surfaceColor,
      glassOpacity,
      glassBlur,
      cornerRadius,
      tintGlow,
    });

    applyCustomizationStyles({
      accentColor,
      surfaceColor,
      glassOpacity,
      glassBlur,
      cornerRadius,
      tintGlow,
    });

    syncChromeHeight(s.bookmarksBarVisible);
  },

  updateSetting: (key, value) => {
    void api.settings.set(key, String(value));
    if (key === 'theme') set({ theme: value as AppSettings['theme'] });
    if (key === 'verticalTabs') set({ verticalTabs: value as boolean });
    if (key === 'bookmarksBarVisible') {
      set({ bookmarksBarVisible: value as boolean });
      syncChromeHeight(value as boolean);
    }
    if (key === 'accentColor') {
      const color = String(value);
      set({ accentColor: color });
      applyCustomizationStyles({ ...get(), accentColor: color });
    }
    if (key === 'surfaceColor') {
      const color = String(value);
      set({ surfaceColor: color });
      applyCustomizationStyles({ ...get(), surfaceColor: color });
    }
    if (key === 'glassOpacity') {
      const opacity = Number(value);
      set({ glassOpacity: opacity });
      applyCustomizationStyles({ ...get(), glassOpacity: opacity });
    }
    if (key === 'glassBlur') {
      const blur = Number(value);
      set({ glassBlur: blur });
      applyCustomizationStyles({ ...get(), glassBlur: blur });
    }
    if (key === 'cornerRadius') {
      const radius = Number(value);
      set({ cornerRadius: radius });
      applyCustomizationStyles({ ...get(), cornerRadius: radius });
    }
    if (key === 'tintGlow') {
      const glow = Boolean(value);
      set({ tintGlow: glow });
      applyCustomizationStyles({ ...get(), tintGlow: glow });
    }
  },

  resetCustomization: () => {
    const { updateSetting } = get();
    updateSetting('accentColor', DEFAULT_CUSTOMIZATION.accentColor);
    updateSetting('surfaceColor', DEFAULT_CUSTOMIZATION.surfaceColor);
    updateSetting('glassOpacity', DEFAULT_CUSTOMIZATION.glassOpacity);
    updateSetting('glassBlur', DEFAULT_CUSTOMIZATION.glassBlur);
    updateSetting('cornerRadius', DEFAULT_CUSTOMIZATION.cornerRadius);
    updateSetting('tintGlow', DEFAULT_CUSTOMIZATION.tintGlow);
    updateSetting('theme', DEFAULT_CUSTOMIZATION.theme);
  },

  applyState: (s) => {
    set((prev) => ({ ...prev, ...s }));
    // Re-check bookmark state for the now-active URL
    const url = s.tabs.find((t) => t.id === s.activeTabId)?.url;
    if (url && url.startsWith('http')) {
      void api.bookmarks.getByUrl(url).then((b) => set({ activeBookmarked: !!b }));
    } else {
      set({ activeBookmarked: false });
    }
  },

  createTab: (url) => void api.tabs.create(url),
  closeTab: (id) => void api.tabs.close(id),
  activateTab: (id) => void api.tabs.activate(id),

  navigateActive: (url) => {
    const id = get().activeTabId;
    if (id) void api.tabs.navigate(id, url);
  },
  goBack: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.goBack(id);
  },
  goForward: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.goForward(id);
  },
  reload: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.reload(id);
  },
  stop: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.stop(id);
  },
  togglePin: (id) => void api.tabs.togglePin(id),
  toggleMute: (id) => void api.tabs.toggleMute(id),
  hibernate: (id) => void api.tabs.hibernate(id),

  toggleBookmarkActive: async () => {
    const tab = get().activeTab();
    if (!tab || !tab.url.startsWith('http')) return;
    const result = (await api.bookmarks.toggle(tab.title, tab.url)) as { bookmarked: boolean };
    set({ activeBookmarked: result.bookmarked });
  },

  setSidebar: (open, panel) => {
    const current = get().sidebarPanel;
    const nextPanel = open ? (panel ?? current ?? 'shields') : current;
    set({ sidebarOpen: open, sidebarPanel: nextPanel });
    void api.app.setSidebar(open, nextPanel);
  },
  openSettings: (section?: string) => {
    void api.app.openSettings(section);
  },
  setTheme: (t) => {
    set({ theme: t });
    void api.settings.set('theme', t);
  },
  setBookmarksBarVisible: (v) => {
    set({ bookmarksBarVisible: v });
    void api.settings.set('bookmarksBarVisible', String(v));
    syncChromeHeight(v);
  },

  setAppMenuOpen: (open) => {
    set({ appMenuOpen: open });
    void api.app.setAppMenuOpen(open);
  },
  toggleAppMenu: () => {
    const next = !get().appMenuOpen;
    set({ appMenuOpen: next });
    void api.app.setAppMenuOpen(next);
  },

  zoomIn: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.zoomIn(id);
  },
  zoomOut: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.zoomOut(id);
  },
  zoomReset: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.zoomReset(id);
  },
  setZoom: (factor) => {
    const id = get().activeTabId;
    if (id) void api.tabs.setZoom(factor, id);
  },
  toggleFullscreen: () => void api.app.toggleFullscreen(),
  print: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.print(id);
  },
  toggleDevTools: (mode = 'right') => {
    const id = get().activeTabId;
    if (id) void api.tabs.toggleDevTools(id, mode);
  },
  viewSource: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.viewSource(id);
  },
  newWindow: () => void api.app.newWindow(),
  newIncognitoWindow: () => void api.app.newIncognitoWindow(),
  clearBrowsingData: async () => {
    await api.app.clearBrowsingData();
  },
  exit: () => void api.app.exit(),

  activeTab: () => get().tabs.find((t) => t.id === get().activeTabId),
}));

function handleMenuAction(action: string, s: BrowserStore) {
  switch (action) {
    case 'menu:newTab': s.createTab(); break;
    case 'menu:closeTab': if (s.activeTabId) s.closeTab(s.activeTabId); break;
    case 'menu:reload': s.reload(); break;
    case 'menu:back': s.goBack(); break;
    case 'menu:forward': s.goForward(); break;
    case 'menu:toggleSidebar': s.setSidebar(!s.sidebarOpen); break;
    case 'menu:toggleBookmarksBar': s.setBookmarksBarVisible(!s.bookmarksBarVisible); break;
    case 'menu:settings': s.openSettings(); break;
    case 'menu:newIncognito': void api.app.newIncognitoWindow(); break;
  }
}

function set(partial: Partial<BrowserStore>) {
  useBrowserStore.setState(partial);
}

function syncChromeHeight(bookmarksBarVisible: boolean) {
  void api.app.setChromeHeight(CHROME_BASE + (bookmarksBarVisible ? BOOKMARKS_BAR : 0));
}
