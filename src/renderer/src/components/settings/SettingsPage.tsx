import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { AppSettings, useBrowserStore } from '../../store/browserStore';
import { Icon, IconName } from '../common/Icon';
import { BladeLogo } from '../common/BladeLogo';
import { COLOR_THEMES, DEFAULT_CUSTOMIZATION, type ColorTheme } from '../../lib/theme';
import type { HistoryEntry, StoredPassword } from '@shared/types';

const SEARCH_ENGINES = [
  { id: 'google', label: 'Google', description: "The world's most popular search engine" },
  { id: 'duckduckgo', label: 'DuckDuckGo', description: 'Privacy-focused, zero tracking or profiling' },
  { id: 'bing', label: 'Bing', description: 'Microsoft AI and web search index' },
  { id: 'brave', label: 'Brave Search', description: 'Independent, private web index' },
];

const HOMEPAGES = [
  { label: 'New Tab Page', value: 'blade://newtab', description: 'Blade internal page' },
  { label: 'Google', value: 'https://www.google.com', description: 'google.com' },
  { label: 'DuckDuckGo', value: 'https://duckduckgo.com', description: 'duckduckgo.com' },
  { label: 'YouTube', value: 'https://www.youtube.com', description: 'youtube.com' },
  { label: 'GitHub', value: 'https://github.com', description: 'github.com' },
  { label: 'Reddit', value: 'https://www.reddit.com', description: 'reddit.com' },
];

const USER_AGENT_PRESETS = [
  { id: 'default', label: 'Default (Chromium)' },
  { id: 'safari-mac', label: 'Safari · macOS' },
  { id: 'chrome-win', label: 'Chrome · Windows 11' },
  { id: 'firefox-linux', label: 'Firefox · Linux' },
  { id: 'iphone-ios', label: 'Mobile · iPhone iOS 17' },
];

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'home' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'search', label: 'Search Engine', icon: 'search' },
  { id: 'tabs', label: 'Tabs & Windows', icon: 'layers' },
  { id: 'performance', label: 'Performance', icon: 'bolt' },
  { id: 'shields', label: 'Blade Shields', icon: 'shield-check' },
  { id: 'privacy', label: 'Privacy & Data', icon: 'lock' },
  { id: 'history', label: 'History', icon: 'clock' },
  { id: 'downloads', label: 'Downloads', icon: 'download' },
  { id: 'passwords', label: 'Password Manager', icon: 'key' },
  { id: 'permissions', label: 'Site Permissions', icon: 'shield' },
  { id: 'developer', label: 'Developer & Tools', icon: 'terminal' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' },
  { id: 'about', label: 'About Blade', icon: 'sparkles' },
];

const SHORTCUT_GROUPS = [
  {
    category: 'Tabs & Navigation',
    items: [
      ['Ctrl + T', 'Open new tab'],
      ['Ctrl + W', 'Close current tab'],
      ['Ctrl + Shift + T', 'Reopen last closed tab'],
      ['Ctrl + R', 'Reload tab'],
      ['Ctrl + Shift + R', 'Hard reload tab'],
      ['Ctrl + 1-8', 'Jump to a tab'],
      ['Ctrl + 9', 'Jump to the last tab'],
    ],
  },
  {
    category: 'Browser Interface',
    items: [
      ['Ctrl + L', 'Focus address bar'],
      ['Ctrl + ,', 'Open settings'],
      ['Ctrl + Shift + B', 'Toggle bookmarks bar'],
      ['Ctrl + F', 'Find text on page'],
      ['F11', 'Toggle fullscreen'],
      ['Ctrl + + / - / 0', 'Zoom in, out, and reset'],
    ],
  },
  {
    category: 'Developer & Windows',
    items: [
      ['Ctrl + Shift + I', 'Toggle Developer Tools'],
      ['Ctrl + Shift + J', 'Open JavaScript Console'],
      ['Ctrl + U', 'View page source'],
      ['Ctrl + N', 'Open new browser window'],
      ['Ctrl + Shift + N', 'Open private window'],
      ['Ctrl + Shift + Del', 'Clear browsing data'],
    ],
  },
];

interface ShieldsConfig {
  enabled: boolean;
  adBlockEnabled: boolean;
  trackerBlockEnabled: boolean;
  httpsUpgrade: boolean;
}

interface ShieldsStats {
  adsBlocked: number;
  trackersBlocked: number;
  httpsUpgrades: number;
}

interface PerformanceSnapshot {
  memoryMb: number;
  cpuPercent: number;
  processCount: number;
  tabCount: number;
  activeTabCpuPercent: number;
}

export function SettingsPage({ url }: { url?: string }) {
  const storeTheme = useBrowserStore((s) => s.theme);
  const updateSetting = useBrowserStore((s) => s.updateSetting);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [shieldsConfig, setShieldsConfig] = useState<ShieldsConfig | null>(null);
  const [shieldsStats, setShieldsStats] = useState<ShieldsStats | null>(null);
  const [section, setSection] = useState('general');
  const [searchFilter, setSearchFilter] = useState('');
  const [status, setStatus] = useState('');
  const activeTab = useBrowserStore((state) => state.activeTab());
  const downloads = useBrowserStore((state) => state.downloads);
  const toolbarConfig = useBrowserStore((state) => state.toolbarConfig);
  const setToolbarButton = useBrowserStore((state) => state.setToolbarButton);
  const resetToolbarConfig = useBrowserStore((state) => state.resetToolbarConfig);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');
  const [passwords, setPasswords] = useState<StoredPassword[]>([]);
  const [passwordForm, setPasswordForm] = useState({ origin: '', username: '', password: '' });
  const [performance, setPerformance] = useState<PerformanceSnapshot | null>(null);
  const [permissionValues, setPermissionValues] = useState<Record<string, string>>({});

  useEffect(() => {
    void api.settings.get().then((value) => setSettings(value as AppSettings));
    void api.shields.getConfig().then((value) => setShieldsConfig(value as ShieldsConfig));
    void api.shields.getStats().then((value) => setShieldsStats(value as ShieldsStats));
  }, []);

  useEffect(() => {
    if (section === 'history') void api.history.list(historyQuery, 0).then((value) => setHistoryEntries(value as HistoryEntry[]));
    if (section === 'passwords') void api.passwords.list().then((value) => setPasswords(value as StoredPassword[]));
  }, [section, historyQuery]);

  useEffect(() => {
    if (section !== 'performance') return;
    let cancelled = false;
    const refresh = async () => {
      const value = await api.performance.snapshot() as PerformanceSnapshot;
      if (!cancelled) setPerformance(value);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [section]);

  const activeOrigin = (() => {
    try { return activeTab?.url ? new URL(activeTab.url).origin : ''; } catch { return ''; }
  })();

  useEffect(() => {
    if (!activeOrigin) return;
    const permissions = ['notifications', 'geolocation', 'camera', 'microphone'];
    void api.settings.get(`permission:${activeOrigin}:`).then((value) => {
      const stored = (value as { permissions?: Record<string, string> }).permissions ?? {};
      setPermissionValues((current) => {
        const next = { ...current };
        for (const permission of permissions) next[permission] = stored[permission] ?? next[permission] ?? 'ask';
        return next;
      });
    });
    setPermissionValues((current) => {
      const next = { ...current };
      for (const permission of permissions) next[permission] ??= 'ask';
      return next;
    });
  }, [activeOrigin]);

  useEffect(() => {
    const hash = url?.includes('#')
      ? url.split('#')[1]
      : window.location.hash.replace(/^#\/?/, '');
    if (hash && SECTIONS.some((item) => item.id === hash)) setSection(hash);
  }, [url]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    updateSetting(key, value);
  };

  const resetTheme = () => {
    useBrowserStore.getState().resetCustomization();
    setSettings((current) => current ? {
      ...current,
      glassOpacity: DEFAULT_CUSTOMIZATION.glassOpacity,
      glassBlur: DEFAULT_CUSTOMIZATION.glassBlur,
      cornerRadius: DEFAULT_CUSTOMIZATION.cornerRadius,
      theme: DEFAULT_CUSTOMIZATION.theme,
      colorTheme: DEFAULT_CUSTOMIZATION.colorTheme,
    } : current);
    showStatus('Theme reset');
  };

  const showStatus = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(''), 2200);
  };

  const setShield = (key: string, value: string) => {
    void api.shields.setConfig(key, value);
    setShieldsConfig((current) => {
      if (!current) return current;
      const mapping: Record<string, keyof ShieldsConfig> = {
        enabled: 'enabled',
        adBlock: 'adBlockEnabled',
        trackerBlock: 'trackerBlockEnabled',
        httpsUpgrade: 'httpsUpgrade',
      };
      const stateKey = mapping[key] ?? key as keyof ShieldsConfig;
      return { ...current, [stateKey]: value === 'true' };
    });
  };

  const clearHistory = async () => {
    await api.history.clear(0);
    showStatus('Browsing history cleared');
  };

  const clearCache = async () => {
    await api.app.clearCache();
    showStatus('Browser cache cleared');
  };

  const clearSiteData = async () => {
    await api.app.clearBrowsingData();
    showStatus('Cookies and site data cleared');
  };

  const savePasswordEntry = async () => {
    if (!passwordForm.origin || !passwordForm.username || !passwordForm.password) return;
    await api.passwords.save(passwordForm.origin, passwordForm.username, passwordForm.password);
    setPasswordForm({ origin: '', username: '', password: '' });
    setPasswords((await api.passwords.list()) as StoredPassword[]);
    showStatus('Password saved securely');
  };

  const filteredSections = searchFilter.trim()
    ? SECTIONS.filter((item) => item.label.toLowerCase().includes(searchFilter.toLowerCase()))
    : SECTIONS;

  return (
    <div className="settings-page h-full flex antialiased select-none overflow-hidden">
      <nav className="settings-nav w-[260px] shrink-0 flex flex-col p-5 border-r border-white/10 overflow-y-auto relative">
        <div className="flex items-center gap-3 px-1 mb-6">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <BladeLogo className="w-7 h-7" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">Blade Settings</div>
            <div className="text-[11px] text-white/50 font-medium">Browser Configuration</div>
          </div>
        </div>

        <div className="relative mb-5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"><Icon name="search" size={13} strokeWidth={1.8} /></span>
          <input
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Search settings…"
            spellCheck={false}
            className="settings-control w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none placeholder:text-white/30 focus:border-white/30"
          />
        </div>

        <div className="space-y-1 flex-1">
          {filteredSections.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); window.location.hash = `#${item.id}`; }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  active ? 'settings-selected text-white shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <span className={active ? 'text-white' : 'text-white/50'}><Icon name={item.icon} size={15} strokeWidth={1.8} /></span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-4 mt-auto border-t border-white/10 text-[11px] text-white/40 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><BladeLogo className="w-3.5 h-3.5" />Blade Browser</span><span>v0.2.0</span>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-6">
        {section === 'general' && (
          <SettingsSection title="General" description="Configure startup behavior and the default home page.">
            <Card title="Startup & Home" description="Choose what opens when a new window starts.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 mb-3">
                {[
                  { value: 'newtab' as const, label: 'New tab page', description: 'Start with a clean Blade tab.' },
                  { value: 'continue' as const, label: 'Continue where you left off', description: 'Restore your tabs when Blade starts again.' },
                ].map((item) => {
                  const active = (settings?.startupBehavior ?? 'newtab') === item.value;
                  return <button key={item.value} onClick={() => set('startupBehavior', item.value)} className={`settings-control ${active ? 'settings-selected' : ''} p-3 rounded-xl border text-left transition-all hover:bg-white/10`}>
                    <div className="text-xs font-semibold text-white">{item.label}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{item.description}</div>
                  </button>;
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {HOMEPAGES.map((item) => {
                  const active = (settings?.homepage ?? 'blade://newtab') === item.value;
                  return <button key={item.value} onClick={() => set('homepage', item.value)} className={`settings-control ${active ? 'settings-selected' : ''} p-3 rounded-xl border text-left transition-all hover:bg-white/10`}>
                    <div className="text-xs font-semibold text-white">{item.label}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{item.description}</div>
                  </button>;
                })}
              </div>
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/10">
                <div><div className="text-xs font-medium text-white">Custom Homepage URL</div><div className="text-[11px] text-white/50">Used for new windows.</div></div>
                <input type="text" value={settings?.homepage ?? 'blade://newtab'} onChange={(event) => set('homepage', event.target.value)} className="settings-control px-3 py-1.5 rounded-xl border text-xs outline-none w-64 text-right" />
              </div>
            </Card>
          </SettingsSection>
        )}

        {section === 'appearance' && (
          <SettingsSection title="Appearance" description="Choose the browser mood and keep every bar, menu, and internal page in sync.">
            <Card title="Theme mode" description="Choose whether the browser follows your system appearance.">
              <div className="grid grid-cols-3 gap-3 pt-2">
                {(['dark', 'light', 'system'] as const).map((mode) => <button key={mode} onClick={() => set('theme', mode)} className={`settings-control ${(settings?.theme ?? storeTheme ?? 'dark') === mode ? 'settings-selected' : ''} py-3 px-4 rounded-xl border capitalize text-xs font-semibold hover:bg-white/10`}>
                  {mode === 'system' ? 'System Sync' : `${mode} Mode`}
                </button>)}
              </div>
            </Card>
            <Card title="Browser color" description="Choose a color atmosphere for the browser chrome and internal pages.">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                {COLOR_THEMES.map((item) => {
                  const active = (settings?.colorTheme ?? 'ember') === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => set('colorTheme', item.id as ColorTheme)}
                      className={`settings-control ${active ? 'settings-selected' : ''} p-2.5 rounded-xl border text-left transition-all hover:bg-white/10`}
                      title={item.description}
                    >
                      <span className="block w-full h-5 rounded-md mb-2" style={{ background: item.swatch }} />
                      <span className="block text-[11px] font-semibold text-white">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card title="Glass surfaces" description="These settings affect the shared browser chrome, bars, menus, and internal pages.">
              <RangeRow label="Glass opacity" value={`${settings?.glassOpacity ?? 65}%`} min={30} max={100} current={settings?.glassOpacity ?? 65} onChange={(value) => set('glassOpacity', value)} />
              <RangeRow label="Glass blur" value={`${settings?.glassBlur ?? 16}px`} min={0} max={40} current={settings?.glassBlur ?? 16} onChange={(value) => set('glassBlur', value)} />
              <div className="flex justify-end pt-3 mt-2 border-t border-white/10"><button onClick={resetTheme} className="settings-action-button px-4 py-2 text-xs font-medium rounded-xl">Reset shared theme</button></div>
            </Card>

            <Card title="Customize Toolbar" description="Choose which buttons and quick actions appear in the navigation bar.">
              <div className="space-y-1 pt-1">
                <ToggleRow
                  label="Back & Forward buttons"
                  hint="Show navigation chevrons on the left"
                  checked={toolbarConfig.backForward}
                  onChange={(v) => setToolbarButton('backForward', v)}
                />
                <ToggleRow
                  label="Reload button"
                  hint="Show reload / stop button in address bar"
                  checked={toolbarConfig.reload}
                  onChange={(v) => setToolbarButton('reload', v)}
                />
                <ToggleRow
                  label="Shields protection badge"
                  hint="Show privacy shield with blocked tracker count"
                  checked={toolbarConfig.shields}
                  onChange={(v) => setToolbarButton('shields', v)}
                />
                <ToggleRow
                  label="History shortcut"
                  hint="Quick access to recently visited pages (Ctrl+H)"
                  checked={toolbarConfig.history}
                  onChange={(v) => setToolbarButton('history', v)}
                />
                <ToggleRow
                  label="Bookmark shortcut"
                  hint="Star button to bookmark the active page"
                  checked={toolbarConfig.bookmark}
                  onChange={(v) => setToolbarButton('bookmark', v)}
                />
                <ToggleRow
                  label="Downloads shortcut"
                  hint="Quick tray for download progress and history (Ctrl+J)"
                  checked={toolbarConfig.downloads}
                  onChange={(v) => setToolbarButton('downloads', v)}
                />
                <ToggleRow
                  label="Settings shortcut"
                  hint="Quick gear icon to open preferences"
                  checked={toolbarConfig.settings}
                  onChange={(v) => setToolbarButton('settings', v)}
                />
              </div>
              <div className="flex justify-end pt-3 mt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    resetToolbarConfig();
                    showStatus('Toolbar reset to defaults');
                  }}
                  className="settings-action-button px-4 py-2 text-xs font-medium rounded-xl"
                >
                  Reset toolbar to defaults
                </button>
              </div>
            </Card>
          </SettingsSection>
        )}

        {section === 'search' && (
          <SettingsSection title="Search Engine" description="Choose the provider used by the address bar.">
            <Card title="Default Search Engine">
              <div className="space-y-2 pt-2">
                {SEARCH_ENGINES.map((item) => {
                  const active = (settings?.searchEngine ?? 'google') === item.id;
                  return <button key={item.id} onClick={() => set('searchEngine', item.id)} className={`settings-control ${active ? 'settings-selected' : ''} w-full p-3 rounded-xl border text-left flex items-center justify-between hover:bg-white/10`}>
                    <span><span className="block text-xs font-semibold text-white">{item.label}</span><span className="block text-[11px] text-white/50 mt-1">{item.description}</span></span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${active ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]' : 'border-white/30'}`}>{active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-surface-solid)]" />}</span>
                  </button>;
                })}
              </div>
            </Card>
          </SettingsSection>
        )}

        {section === 'tabs' && (
          <SettingsSection title="Tabs & Windows" description="Manage tab layout, vertical tabs, and memory behavior.">
            <Card title="Tab layout & orientation" description="Choose how tabs are arranged in the browser interface.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => useBrowserStore.getState().setVerticalTabs(false)}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    !(useBrowserStore.getState().sidebarOpen && useBrowserStore.getState().sidebarPanel === 'tabs')
                      ? 'bg-white/[0.12] border-[var(--theme-primary)] shadow-sm'
                      : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0 text-[var(--theme-primary)]">
                    <Icon name="window" size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span>Horizontal Tabs</span>
                      {!(useBrowserStore.getState().sidebarOpen && useBrowserStore.getState().sidebarPanel === 'tabs') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] font-medium">Active</span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">Classic Chrome-style tab strip positioned along the top.</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => useBrowserStore.getState().setVerticalTabs(true)}
                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    (useBrowserStore.getState().sidebarOpen && useBrowserStore.getState().sidebarPanel === 'tabs')
                      ? 'bg-white/[0.12] border-[var(--theme-primary)] shadow-sm'
                      : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0 text-[var(--theme-primary)]">
                    <Icon name="sidebar" size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span>Vertical Tabs</span>
                      {(useBrowserStore.getState().sidebarOpen && useBrowserStore.getState().sidebarPanel === 'tabs') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] font-medium">Active</span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">Zen / Edge-style vertical tab drawer on the left side.</div>
                  </div>
                </button>
              </div>
            </Card>

            <Card title="Tab strips & bookmarks">
              <ToggleRow label="Show bookmarks bar" hint="Display quick access links beneath the address bar." checked={settings?.bookmarksBarVisible ?? true} onChange={(value) => set('bookmarksBarVisible', value)} />
              <div className="flex items-center justify-between pt-4 mt-3 border-t border-white/10">
                <div>
                  <div className="text-xs font-medium text-white">Auto-hibernate inactive tabs (Memory Saver)</div>
                  <div className="text-[11px] text-white/50">Free memory by unloading background tabs after inactivity.</div>
                </div>
                <ThemedSelect
                  value={String(settings?.hibernateMinutes ?? 15)}
                  onChange={(value) => set('hibernateMinutes', Number(value))}
                  options={[
                    { value: '0', label: 'Never' },
                    { value: '5', label: 'After 5 minutes' },
                    { value: '15', label: 'After 15 minutes' },
                    { value: '30', label: 'After 30 minutes' },
                    { value: '60', label: 'After 1 hour' },
                  ]}
                />
              </div>
            </Card>
          </SettingsSection>
        )}

        {section === 'performance' && (
          <SettingsSection title="Performance" description="Manage real Chromium cache and memory behavior.">
            <Card title="Live browser performance" description="Updated every second from Chromium process metrics.">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Stat label="Memory" value={performance ? `${performance.memoryMb} MB` : '—'} />
                <Stat label="CPU" value={performance ? `${performance.cpuPercent}%` : '—'} />
                <Stat label="Active tab" value={performance ? `${performance.activeTabCpuPercent}%` : '—'} />
                <Stat label="Processes" value={performance?.processCount ?? 0} />
                <Stat label="Tabs" value={performance?.tabCount ?? 0} />
              </div>
            </Card>
            <Card title="Browser cache" description="Clear cached web resources without deleting bookmarks or history.">
              <div className="flex items-center justify-between"><div><div className="text-xs font-medium text-white">Clear cached files</div><div className="text-[11px] text-white/50">Useful when a site is showing stale assets.</div></div><button onClick={() => void clearCache()} className="settings-action-button px-4 py-2 text-xs font-medium rounded-xl">Clear cache</button></div>
            </Card>
          </SettingsSection>
        )}

        {section === 'shields' && (
          <SettingsSection title="Blade Shields" description="Ad blocking, tracker protection, and secure transport.">
            <Card title="Protection master switch"><ToggleRow label="Enable Blade Shields" hint="Apply protection to all web tabs." checked={shieldsConfig?.enabled ?? true} onChange={(value) => setShield('enabled', String(value))} /></Card>
            <Card title="Protection modules">
              <ToggleRow label="Ad & cosmetic filtering" hint="Remove intrusive display ads and banners." checked={shieldsConfig?.adBlockEnabled ?? true} onChange={(value) => setShield('adBlock', String(value))} />
              <ToggleRow label="Tracker protection" hint="Block common analytics and tracking beacons." checked={shieldsConfig?.trackerBlockEnabled ?? true} onChange={(value) => setShield('trackerBlock', String(value))} />
              <ToggleRow label="HTTPS upgrade" hint="Upgrade eligible HTTP connections." checked={shieldsConfig?.httpsUpgrade ?? true} onChange={(value) => setShield('httpsUpgrade', String(value))} />
            </Card>
            {shieldsStats && <Card title="Live statistics"><div className="grid grid-cols-3 gap-3"><Stat label="Ads blocked" value={shieldsStats.adsBlocked} /><Stat label="Trackers" value={shieldsStats.trackersBlocked} /><Stat label="HTTPS upgrades" value={shieldsStats.httpsUpgrades} /></div></Card>}
          </SettingsSection>
        )}

        {section === 'privacy' && (
          <SettingsSection title="Privacy & Data" description="Control what Blade sends, stores, and removes on your behalf.">
            <Card title="Privacy preferences">
              <ToggleRow label="Send a Do Not Track request" hint="Ask websites not to use your activity for tracking." checked={settings?.sendDoNotTrack ?? false} onChange={(value) => set('sendDoNotTrack', value)} />
              <div className="border-t border-white/10 pt-3 mt-2"><ToggleRow label="Clear site data when Blade closes" hint="Remove cookies, local storage, and service-worker data on exit." checked={settings?.clearSiteDataOnExit ?? false} onChange={(value) => set('clearSiteDataOnExit', value)} /></div>
              <div className="border-t border-white/10 pt-3 mt-2"><ToggleRow label="Clear history when Blade closes" hint="Delete locally stored visit records when the browser exits." checked={settings?.clearHistoryOnExit ?? false} onChange={(value) => set('clearHistoryOnExit', value)} /></div>
            </Card>
            <Card title="Browsing history" description="Delete visit records and search queries stored on this device.">
              <div className="flex items-center justify-between gap-4"><div><div className="text-xs font-medium text-white">Clear browsing history now</div><div className="text-[11px] text-white/50">This cannot be undone.</div></div><button onClick={() => void clearHistory()} className="settings-danger-button px-4 py-2 text-xs font-medium rounded-xl">Clear history</button></div>
            </Card>
            <Card title="Site data" description="Remove cookies and local site storage without touching bookmarks or saved passwords.">
              <div className="flex items-center justify-between gap-4"><div><div className="text-xs font-medium text-white">Clear cookies and site data</div><div className="text-[11px] text-white/50">You may be signed out of websites.</div></div><button onClick={() => void clearSiteData()} className="settings-danger-button px-4 py-2 text-xs font-medium rounded-xl">Clear site data</button></div>
            </Card>
          </SettingsSection>
        )}

        {section === 'history' && (
          <SettingsSection title="History" description="Search, revisit, and remove individual browsing records.">
            <Card title="Browsing history">
              <div className="flex gap-2 mb-3"><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search history…" className="settings-control flex-1 px-3 py-2 rounded-xl border text-xs outline-none" /><button onClick={() => void clearHistory().then(() => setHistoryEntries([]))} className="settings-danger-button px-3 rounded-xl text-xs">Clear all</button></div>
              <div className="space-y-1 max-h-[520px] overflow-y-auto">{historyEntries.map((entry) => <div key={entry.id} className="history-entry flex items-center gap-3 p-2 rounded-xl"><div className="min-w-0 flex-1"><div className="text-xs font-semibold truncate">{entry.title || entry.url}</div><div className="text-[11px] text-[var(--color-text-secondary)] truncate">{new Date(entry.visitedAt).toLocaleString()} · {entry.url}</div></div><button className="history-entry-remove grid place-items-center w-7 h-7 rounded-lg" onClick={() => void api.history.remove(entry.id).then(() => setHistoryEntries((current) => current.filter((item) => item.id !== entry.id)))}><Icon name="x" size={13} /></button></div>)}</div>
              {historyEntries.length === 0 && <div className="text-xs text-[var(--color-text-secondary)] text-center py-8">No history found.</div>}
            </Card>
          </SettingsSection>
        )}

        {section === 'downloads' && (
          <SettingsSection title="Downloads" description="View downloaded files and open them in your file manager.">
            <Card title="Downloaded files">
              <div className="space-y-2">
                {downloads.map((download) => (
                  <div key={download.id} className="flex items-center gap-3 p-3 rounded-xl settings-control">
                    <Icon name="download" size={16} className="text-[var(--theme-primary)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{download.filename}</div>
                      <div className="text-[11px] text-[var(--color-text-secondary)] truncate">{download.path || download.url || 'Download'} · {formatBytes(download.receivedBytes)}</div>
                    </div>
                    <span className="text-[10px] uppercase text-[var(--color-text-secondary)]">{download.state}</span>
                    <button disabled={!download.path} onClick={() => void api.downloads.open(download.id)} className="settings-action-button px-3 py-1.5 rounded-lg text-[11px] disabled:opacity-40">Show in folder</button>
                  </div>
                ))}
                {downloads.length === 0 && <div className="text-xs text-[var(--color-text-secondary)] text-center py-8">No downloads yet.</div>}
              </div>
            </Card>
          </SettingsSection>
        )}

        {section === 'passwords' && (
          <SettingsSection title="Password Manager" description="Store login metadata locally with encrypted password values.">
            <Card title="Saved passwords">
              <div className="space-y-1 mb-4">{passwords.map((entry) => <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl settings-control"><Icon name="lock" size={15} className="text-[var(--theme-primary)]" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold truncate">{entry.origin}</div><div className="text-[11px] text-[var(--color-text-secondary)] truncate">{entry.username}</div></div><button className="settings-danger-button px-2 py-1 rounded-lg text-[11px]" onClick={() => void api.passwords.remove(entry.id).then(() => setPasswords((current) => current.filter((item) => item.id !== entry.id)))}>Remove</button></div>)}</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><input value={passwordForm.origin} onChange={(event) => setPasswordForm({ ...passwordForm, origin: event.target.value })} placeholder="https://example.com" className="settings-control px-3 py-2 rounded-xl border text-xs outline-none" /><input value={passwordForm.username} onChange={(event) => setPasswordForm({ ...passwordForm, username: event.target.value })} placeholder="Username" className="settings-control px-3 py-2 rounded-xl border text-xs outline-none" /><input type="password" value={passwordForm.password} onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })} placeholder="Password" className="settings-control px-3 py-2 rounded-xl border text-xs outline-none" /></div><button onClick={() => void savePasswordEntry()} className="settings-action-button mt-3 px-4 py-2 rounded-xl text-xs">Add password</button>
            </Card>
          </SettingsSection>
        )}

        {section === 'permissions' && (
          <SettingsSection title="Site Permissions" description="Choose the default permission behavior for the active site.">
            <Card title={activeOrigin || 'No active website'} description="Permission controls are scoped to the current site origin.">
              {['notifications', 'geolocation', 'camera', 'microphone'].map((permission) => <div key={permission} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0"><div><div className="text-xs font-semibold capitalize">{permission}</div><div className="text-[11px] text-[var(--color-text-secondary)]">Ask, allow, or block this site.</div></div><ThemedSelect value={permissionValues[permission] ?? 'ask'} onChange={(value) => { setPermissionValues({ ...permissionValues, [permission]: value }); if (activeOrigin) void api.settings.set(`permission:${activeOrigin}:${permission}`, value); }} options={[{ value: 'ask', label: 'Ask' }, { value: 'allow', label: 'Allow' }, { value: 'block', label: 'Block' }]} /></div>)}
            </Card>
          </SettingsSection>
        )}

        {section === 'developer' && (
          <SettingsSection title="Developer & Tools" description="Configure real Chromium inspection tools.">
            <Card title="DevTools layout" description="Choose where Chromium docks DevTools.">
              <div className="grid grid-cols-3 gap-3">{(['right', 'bottom', 'detach'] as const).map((mode) => <button key={mode} onClick={() => set('devDockMode', mode)} className={`settings-control ${(settings?.devDockMode ?? 'right') === mode ? 'settings-selected' : ''} py-3 px-4 rounded-xl border capitalize text-xs font-semibold hover:bg-white/10`}>{mode === 'detach' ? 'Separate window' : `Dock to ${mode}`}</button>)}</div>
              <div className="flex justify-end pt-4 mt-4 border-t border-white/10"><button onClick={() => useBrowserStore.getState().toggleDevTools(settings?.devDockMode ?? 'right')} className="settings-action-button px-4 py-2 text-xs font-medium rounded-xl">Inspect active tab</button></div>
            </Card>
            <Card title="User agent emulation" description="Apply a browser identity to the current window's tabs."><ThemedSelect value={settings?.devUserAgent ?? 'default'} onChange={(value) => set('devUserAgent', value)} options={USER_AGENT_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))} fullWidth /></Card>
          </SettingsSection>
        )}

        {section === 'shortcuts' && <SettingsSection title="Keyboard Shortcuts" description="Shortcuts available in both the browser chrome and web pages.">{SHORTCUT_GROUPS.map((group) => <Card key={group.category} title={group.category}><div className="divide-y divide-white/[0.06]">{group.items.map(([keys, action]) => <div key={keys} className="py-2.5 flex items-center justify-between text-xs"><span className="text-white/80">{action}</span><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-white/90 font-mono text-[11px]">{keys}</kbd></div>)}</div></Card>)}</SettingsSection>}

        {section === 'about' && (
          <SettingsSection title="About Blade" description="A multi-process Chromium browser with a local-first data store.">
            <Card title="Blade Browser">
              <div className="flex items-center gap-4 pb-3 border-b border-white/10">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  <BladeLogo className="w-10 h-10" />
                </div>
                <div>
                  <div className="text-base font-bold text-white tracking-tight">Blade</div>
                  <div className="text-xs text-white/50">Version 0.2.0 · Glassmorphic Desktop Browser</div>
                </div>
              </div>
              <div className="space-y-3 text-xs text-white/80 leading-relaxed pt-2">
                <p>Blade uses Electron WebContentsView tabs, React chrome, and SQLite persistence.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[['Engine', 'Chromium'], ['Database', 'SQLite (WAL)'], ['UI layer', 'React + Tailwind'], ['Architecture', 'Multi-process']].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase font-semibold">{label}</div>
                      <div className="text-xs font-bold text-white mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </SettingsSection>
        )}
      </main>
      {status && <div className="absolute bottom-4 right-4 glass-panel px-4 py-2 text-xs text-white shadow-xl">{status}</div>}
    </div>
  );
}

function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="space-y-4 animate-tab-enter"><div><h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>{description && <p className="text-xs text-white/50 mt-1">{description}</p>}</div><div className="space-y-4">{children}</div></div>;
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="settings-card p-6 shadow-xl space-y-3"><div><h3 className="text-sm font-semibold text-white">{title}</h3>{description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}</div>{children}</div>;
}

function RangeRow({ label, value, min, max, current, onChange }: { label: string; value: string; min: number; max: number; current: number; onChange: (value: number) => void }) {
  return <div className="pt-2"><div className="flex justify-between text-xs font-medium mb-2"><span className="text-white/80">{label}</span><span className="font-semibold text-white">{value}</span></div><input type="range" min={min} max={max} value={current} onChange={(event) => onChange(Number(event.target.value))} className="w-full cursor-pointer h-1.5 bg-white/10 rounded-lg" /></div>;
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between py-1.5 gap-4"><div className="min-w-0"><div className="text-xs font-medium text-white">{label}</div>{hint && <div className="text-[11px] text-white/50 mt-0.5">{hint}</div>}</div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="toggle-track w-10 h-5" data-checked={checked}><span className="toggle-thumb" /></button></div>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-center"><div className="text-xl font-bold text-white">{value}</div><div className="text-[11px] text-white/50 mt-1">{label}</div></div>;
}

function formatBytes(n: number): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function ThemedSelect({
  value,
  options,
  onChange,
  fullWidth = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`themed-select relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="settings-control flex items-center justify-between gap-5 px-3 py-1.5 rounded-xl border text-xs outline-none min-w-[150px]"
      >
        <span className="truncate">{selected?.label}</span>
        <Icon name="chevron-down" size={13} strokeWidth={1.8} />
      </button>
      {open && (
        <div className="themed-select-menu absolute right-0 top-[calc(100%+6px)] z-[70] min-w-full p-1 rounded-xl border shadow-xl animate-menu-in" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={`themed-select-option w-full px-3 py-2 rounded-lg text-left text-xs transition-colors ${option.value === value ? 'settings-selected font-semibold' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
