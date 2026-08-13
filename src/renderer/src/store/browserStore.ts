import { create } from 'zustand';
import type { WindowState, TabState, SidebarPanel, DownloadItem } from '@shared/types';
import { api } from '../lib/api';
import { applyCustomizationStyles, DEFAULT_CUSTOMIZATION, type ColorTheme } from '../lib/theme';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  colorTheme: ColorTheme;
  searchEngine: string;
  homepage: string;
  startupBehavior: 'newtab' | 'continue';
  bookmarksBarVisible: boolean;
  hibernateMinutes: number;
  glassOpacity: number;
  glassBlur: number;
  cornerRadius: number;
  devDockMode: 'right' | 'bottom' | 'detach';
  devUserAgent: string;
  sendDoNotTrack: boolean;
  clearSiteDataOnExit: boolean;
  clearHistoryOnExit: boolean;
}

interface BrowserStore extends WindowState {
  downloads: DownloadItem[];
  initialized: boolean;
  /** Whether the active tab's URL is bookmarked */
  activeBookmarked: boolean;

  // Customization state
  glassOpacity: number;
  glassBlur: number;
  cornerRadius: number;
  colorTheme: ColorTheme;

  init: () => Promise<void>;
  applyState: (s: WindowState) => void;
  refreshSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetCustomization: () => void;

  createTab: (url?: string) => void;
  closeTab: (id: string) => void;
  reopenClosedTab: () => void;
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
  setSidebarPinned: (pinned: boolean) => void;
  openSettings: (section?: string) => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  setBookmarksBarVisible: (v: boolean) => void;
  setAppMenuOpen: (open: boolean) => void;
  toggleAppMenu: () => void;
  downloadPopupOpen: boolean;
  setDownloadPopupOpen: (open: boolean) => void;
  toggleDownloadPopup: () => void;

  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  setZoom: (factor: number) => void;
  toggleFullscreen: () => void;
  print: () => void;
  savePage: () => void;
  toggleDevTools: (mode?: 'right' | 'bottom' | 'detach') => void;
  viewSource: () => void;
  newWindow: () => void;
  newIncognitoWindow: () => void;
  clearBrowsingData: () => Promise<void>;
  exit: () => void;

  activeTab: () => TabState | undefined;
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  windowId: 0,
  incognito: false,
  tabs: [],
  groups: [],
  activeTabId: null,
  sidebarOpen: false,
  sidebarPinned: false,
  sidebarPanel: 'shields',
  appMenuOpen: false,
  bookmarksBarVisible: true,
  fullscreen: false,
  theme: 'system',
  colorTheme: DEFAULT_CUSTOMIZATION.colorTheme,
  downloads: [],
  downloadPopupOpen: false,
  initialized: false,
  activeBookmarked: false,

  // Shared glass-theme defaults
  glassOpacity: DEFAULT_CUSTOMIZATION.glassOpacity,
  glassBlur: DEFAULT_CUSTOMIZATION.glassBlur,
  cornerRadius: DEFAULT_CUSTOMIZATION.cornerRadius,

  init: async () => {
    if (get().initialized) return;
    const state = (await api.app.getState()) as WindowState;
    const downloads = (await api.downloads.list()) as DownloadItem[];
    set({ ...state, downloads, initialized: true });
    await get().refreshSettings();

    api.onStateChanged((s) => get().applyState(s as WindowState));
    api.onDownloadsChanged((list) => set({ downloads: list as DownloadItem[] }));
    api.onDownloadPopupClosed(() => set({ downloadPopupOpen: false }));
    api.onMenu((action) => handleMenuAction(action, get()));
  },

  refreshSettings: async () => {
    const s = (await api.settings.get()) as AppSettings;
    const glassOpacity = s.glassOpacity !== undefined && !isNaN(Number(s.glassOpacity)) ? Number(s.glassOpacity) : DEFAULT_CUSTOMIZATION.glassOpacity;
    const glassBlur = s.glassBlur !== undefined && !isNaN(Number(s.glassBlur)) ? Number(s.glassBlur) : DEFAULT_CUSTOMIZATION.glassBlur;
    const cornerRadius = s.cornerRadius !== undefined && !isNaN(Number(s.cornerRadius)) ? Number(s.cornerRadius) : DEFAULT_CUSTOMIZATION.cornerRadius;
    const colorTheme = (s.colorTheme || DEFAULT_CUSTOMIZATION.colorTheme) as ColorTheme;
    const bookmarksBarVisible = s.bookmarksBarVisible !== undefined ? String(s.bookmarksBarVisible) === 'true' : true;

    set({
      theme: s.theme || 'system',
      colorTheme,
      bookmarksBarVisible,
      glassOpacity,
      glassBlur,
      cornerRadius,
    });

    applyCustomizationStyles({
      theme: s.theme || 'system',
      colorTheme,
      glassOpacity,
      glassBlur,
      cornerRadius,
    });

  },

  updateSetting: (key, value) => {
    void api.settings.set(key, String(value));
    if (key === 'theme') {
      set({ theme: value as AppSettings['theme'] });
      applyCustomizationStyles({ ...get(), theme: value as AppSettings['theme'] });
    }
    if (key === 'colorTheme') {
      const colorTheme = value as ColorTheme;
      set({ colorTheme });
      applyCustomizationStyles({ ...get(), colorTheme });
    }
    if (key === 'bookmarksBarVisible') {
      set({ bookmarksBarVisible: value as boolean });
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
  },

  resetCustomization: () => {
    const { updateSetting } = get();
    updateSetting('glassOpacity', DEFAULT_CUSTOMIZATION.glassOpacity);
    updateSetting('glassBlur', DEFAULT_CUSTOMIZATION.glassBlur);
    updateSetting('cornerRadius', DEFAULT_CUSTOMIZATION.cornerRadius);
    updateSetting('theme', DEFAULT_CUSTOMIZATION.theme);
    updateSetting('colorTheme', DEFAULT_CUSTOMIZATION.colorTheme);
  },

  applyState: (s) => {
    set((prev) => ({ ...prev, ...s }));
    if (s.theme || s.colorTheme) {
      applyCustomizationStyles({
        ...get(),
        theme: s.theme ?? get().theme,
        colorTheme: s.colorTheme ?? get().colorTheme,
      });
    }
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
  reopenClosedTab: () => void api.tabs.reopenClosed(),
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
  setSidebarPinned: (pinned) => {
    set({ sidebarPinned: pinned, sidebarOpen: true });
    void api.app.setSidebarPinned(pinned);
  },
  openSettings: (section?: string) => {
    void api.app.openSettings(section);
  },
  setTheme: (t) => {
    set({ theme: t });
    get().updateSetting('theme', t);
  },
  setBookmarksBarVisible: (v) => {
    set({ bookmarksBarVisible: v });
    void api.settings.set('bookmarksBarVisible', String(v));
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
  setDownloadPopupOpen: (open) => set({ downloadPopupOpen: open }),
  toggleDownloadPopup: () => set((state) => ({ downloadPopupOpen: !state.downloadPopupOpen })),

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
  savePage: () => {
    const id = get().activeTabId;
    if (id) void api.tabs.savePage(id);
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
    case 'menu:focusAddressBar': {
      const input = document.querySelector<HTMLInputElement>('input[placeholder="Search or enter website name..."]');
      input?.focus();
      input?.select();
      break;
    }
    case 'menu:find': {
      const query = window.prompt('Find in page');
      if (query) void api.tabs.find(query);
      break;
    }
    case 'menu:savePage': s.savePage(); break;
    case 'menu:openBookmarks': s.setSidebar(true, 'bookmarks'); break;
    case 'menu:openHistory': s.setSidebar(true, 'history'); break;
    case 'menu:openDownloads': s.openSettings('downloads'); break;
  }
}

function set(partial: Partial<BrowserStore>) {
  useBrowserStore.setState(partial);
}
