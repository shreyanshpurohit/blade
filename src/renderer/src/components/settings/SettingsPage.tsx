import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AppSettings, useBrowserStore } from '../../store/browserStore';
import { Icon, IconName } from '../common/Icon';
import {
  ACCENT_PRESETS,
  SURFACE_PRESETS,
  DEFAULT_CUSTOMIZATION,
} from '../../lib/theme';

/* ══════════════════════════════════════════════════════════════
 *  Constants & Data
 * ══════════════════════════════════════════════════════════════ */

const SEARCH_ENGINES = [
  { id: 'google', label: 'Google', hint: 'google.com', description: "The world's most popular search engine" },
  { id: 'duckduckgo', label: 'DuckDuckGo', hint: 'duckduckgo.com', description: 'Privacy-focused, zero tracking or profiling' },
  { id: 'bing', label: 'Bing', hint: 'bing.com', description: 'Microsoft AI and web search index' },
  { id: 'brave', label: 'Brave Search', hint: 'search.brave.com', description: 'Independent, private web index' },
];

const SECTIONS: { id: string; label: string; icon: IconName; badge?: string }[] = [
  { id: 'general', label: 'General', icon: 'home' },
  { id: 'appearance', label: 'Appearance & Style', icon: 'palette' },
  { id: 'search', label: 'Search Engine', icon: 'search' },
  { id: 'tabs', label: 'Tabs & Windows', icon: 'layers' },
  { id: 'performance', label: 'Performance', icon: 'bolt' },
  { id: 'shields', label: 'Lumen Shields', icon: 'shield-check' },
  { id: 'privacy', label: 'Privacy & Data', icon: 'lock' },
  { id: 'developer', label: 'Developer & Tools', icon: 'terminal', badge: 'Dev' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' },
  { id: 'about', label: 'About Lumen', icon: 'sparkles' },
];

const USER_AGENT_PRESETS = [
  { id: 'default', label: 'Default (Chromium)', value: '' },
  {
    id: 'safari-mac',
    label: 'Safari · macOS',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  },
  {
    id: 'chrome-win',
    label: 'Chrome · Windows 11',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
  {
    id: 'firefox-linux',
    label: 'Firefox · Linux',
    value: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  },
  {
    id: 'iphone-ios',
    label: 'Mobile · iPhone iOS 17',
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
];

const SHORTCUT_GROUPS: { category: string; items: { keys: string; action: string }[] }[] = [
  {
    category: 'Tabs & Navigation',
    items: [
      { keys: 'Ctrl + T', action: 'Open new tab' },
      { keys: 'Ctrl + W', action: 'Close current tab' },
      { keys: 'Ctrl + Shift + T', action: 'Reopen last closed tab' },
      { keys: 'Ctrl + R', action: 'Reload tab' },
      { keys: 'Ctrl + Shift + R', action: 'Hard reload tab (bypass cache)' },
      { keys: 'Alt + ← / →', action: 'Navigate back / forward' },
      { keys: 'Ctrl + 1-8', action: 'Jump to tab 1 through 8' },
      { keys: 'Ctrl + 9', action: 'Jump to last tab' },
    ],
  },
  {
    category: 'Browser Interface',
    items: [
      { keys: 'Ctrl + L', action: 'Focus address bar (Omnibox)' },
      { keys: 'Ctrl + ,', action: 'Open settings' },
      { keys: 'Ctrl + Shift + B', action: 'Toggle bookmarks bar' },
      { keys: 'Ctrl + F', action: 'Find text on page' },
      { keys: 'F11', action: 'Toggle fullscreen window' },
      { keys: 'Ctrl + + / - / 0', action: 'Zoom in, out, and reset' },
    ],
  },
  {
    category: 'Developer & Inspection',
    items: [
      { keys: 'Ctrl + Shift + I', action: 'Toggle Developer Tools' },
      { keys: 'Ctrl + Shift + J', action: 'Open JavaScript Console' },
      { keys: 'Ctrl + U', action: 'View HTML page source' },
    ],
  },
  {
    category: 'Privacy & Windows',
    items: [
      { keys: 'Ctrl + N', action: 'Open new browser window' },
      { keys: 'Ctrl + Shift + N', action: 'Open new private (Incognito) window' },
      { keys: 'Ctrl + Shift + Del', action: 'Clear local browsing history' },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
 *  Main Component
 * ══════════════════════════════════════════════════════════════ */

export function SettingsPage({ url }: { url?: string }) {
  const storeAccentColor = useBrowserStore((s) => s.accentColor);
  const storeSurfaceColor = useBrowserStore((s) => s.surfaceColor);
  const storeTheme = useBrowserStore((s) => s.theme);
  const updateSetting = useBrowserStore((s) => s.updateSetting);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [shieldsConfig, setShieldsConfig] = useState<any>(null);
  const [shieldsStats, setShieldsStats] = useState<any>(null);
  const [section, setSection] = useState('general');
  const [cleared, setCleared] = useState(false);
  const [gpuCacheCleared, setGpuCacheCleared] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Developer settings — derived from persisted settings
  const devDockMode = (settings?.devDockMode ?? 'right') as 'right' | 'bottom' | 'detach';
  const devSelectedUa = settings?.devUserAgent ?? 'default';
  const [devHardwareAccel, setDevHardwareAccel] = useState(true);
  const [devSmoothScroll, setDevSmoothScroll] = useState(true);

  const currentAccent = settings?.accentColor || storeAccentColor || DEFAULT_CUSTOMIZATION.accentColor;
  const currentSurface = settings?.surfaceColor || storeSurfaceColor || DEFAULT_CUSTOMIZATION.surfaceColor;

  useEffect(() => {
    void api.settings.get().then((s) => setSettings(s as AppSettings));
    void api.shields.getConfig().then((c) => setShieldsConfig(c));
    void api.shields.getStats().then((s) => setShieldsStats(s));
  }, []);

  // Hash / URL Section selection sync
  useEffect(() => {
    if (url && url.includes('#')) {
      const hash = url.split('#')[1];
      if (hash && SECTIONS.some((s) => s.id === hash)) {
        setSection(hash);
      }
    } else if (window.location.hash) {
      const hash = window.location.hash.replace('#', '').replace('/', '');
      if (hash && SECTIONS.some((s) => s.id === hash)) {
        setSection(hash);
      }
    }
  }, [url]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    updateSetting(key, value);
  };

  const handleResetCustomization = () => {
    useBrowserStore.getState().resetCustomization();
    setSettings((s) =>
      s
        ? {
            ...s,
            accentColor: DEFAULT_CUSTOMIZATION.accentColor,
            surfaceColor: DEFAULT_CUSTOMIZATION.surfaceColor,
            glassOpacity: DEFAULT_CUSTOMIZATION.glassOpacity,
            glassBlur: DEFAULT_CUSTOMIZATION.glassBlur,
            cornerRadius: DEFAULT_CUSTOMIZATION.cornerRadius,
            tintGlow: DEFAULT_CUSTOMIZATION.tintGlow,
            theme: DEFAULT_CUSTOMIZATION.theme,
          }
        : s,
    );
  };

  const setShield = (key: string, value: string) => {
    void api.shields.setConfig(key, value);
    setShieldsConfig((prev: any) => {
      if (!prev) return prev;
      const mapping: Record<string, string> = {
        enabled: 'enabled',
        adBlock: 'adBlockEnabled',
        trackerBlock: 'trackerBlockEnabled',
        httpsUpgrade: 'httpsUpgrade',
        fingerprint: 'fingerprintProtection',
        cookies: 'cookieControl',
      };
      const stateKey = mapping[key] ?? key;
      const boolKeys = ['enabled', 'adBlockEnabled', 'trackerBlockEnabled', 'httpsUpgrade'];
      const newValue = boolKeys.includes(stateKey) ? value === 'true' : value;
      return { ...prev, [stateKey]: newValue };
    });
  };

  const clearHistory = async () => {
    await api.history.clear(0);
    setCleared(true);
    setTimeout(() => setCleared(false), 2500);
  };

  const handleClearGpuCache = () => {
    setGpuCacheCleared(true);
    setTimeout(() => setGpuCacheCleared(false), 2500);
  };

  const handleOpenDevToolsNow = () => {
    useBrowserStore.getState().toggleDevTools(devDockMode);
  };

  const filteredSections = searchFilter.trim()
    ? SECTIONS.filter((s) => s.label.toLowerCase().includes(searchFilter.toLowerCase()))
    : SECTIONS;

  return (
    <div className="h-full flex text-white font-sans antialiased select-none overflow-hidden" style={{ background: 'var(--app-bg, #16120e)' }}>
      {/* ── Sidebar Navigation ── */}
      <nav className="w-[260px] shrink-0 flex flex-col p-5 border-r border-white/10 backdrop-blur-2xl overflow-y-auto relative" style={{ background: 'var(--glass-bar-bg, rgba(28, 23, 18, 0.8))' }}>
        {/* Title */}
        <div className="flex items-center gap-3 px-1 mb-6">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-lg transition-colors duration-200"
            style={{
              backgroundColor: `${currentAccent}25`,
              borderColor: `${currentAccent}50`,
              color: currentAccent,
            }}
          >
            <Icon name="palette" size={17} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">Lumen Settings</div>
            <div className="text-[11px] text-white/50 font-medium">Browser Configuration</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            <Icon name="search" size={13} strokeWidth={2} />
          </span>
          <input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search settings…"
            spellCheck={false}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/[0.06] border border-white/10
              text-white outline-none placeholder:text-white/30 focus:border-white/30 focus:bg-white/[0.09] transition-all"
          />
        </div>

        {/* Section List */}
        <div className="space-y-1 flex-1">
          {filteredSections.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSection(s.id);
                  window.location.hash = `#${s.id}`;
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'bg-white/15 text-white shadow-sm border border-white/15'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span style={{ color: active ? currentAccent : 'rgba(255,255,255,0.5)' }}>
                    <Icon name={s.icon} size={15} strokeWidth={active ? 2 : 1.8} />
                  </span>
                  <span>{s.label}</span>
                </div>
                {s.badge && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      backgroundColor: `${currentAccent}25`,
                      color: currentAccent,
                    }}
                  >
                    {s.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Version info footer */}
        <div className="pt-4 mt-auto border-t border-white/10 text-[11px] text-white/40 flex items-center justify-between">
          <span>Lumen Browser</span>
          <span>v0.1.0 (Vision)</span>
        </div>
      </nav>

      {/* ── Main Content Area ── */}
      <main className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-6">
        {/* ── 1. General Section ── */}
        {section === 'general' && (
          <SettingsSection title="General" description="Basic browser preferences and startup behaviors">
            <Card title="Search Engine" description="Choose your default web search provider">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {SEARCH_ENGINES.map((se) => {
                  const active = (settings?.searchEngine ?? 'google') === se.id;
                  return (
                    <button
                      key={se.id}
                      onClick={() => set('searchEngine', se.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'text-white shadow-lg'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-white/80'
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: `${currentAccent}18`,
                              borderColor: `${currentAccent}50`,
                            }
                          : undefined
                      }
                    >
                      <div className="text-xs font-semibold text-white">{se.label}</div>
                      <div className="text-[11px] text-white/50 mt-1">{se.description}</div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="Startup & Home" description="Configure default startup page">
              <div className="space-y-3 pt-2">
                {/* Homepage presets */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'New Tab Page', value: 'lumen://newtab', desc: 'Lumen internal page' },
                    { label: 'Google', value: 'https://www.google.com', desc: 'google.com' },
                    { label: 'DuckDuckGo', value: 'https://duckduckgo.com', desc: 'duckduckgo.com' },
                    { label: 'YouTube', value: 'https://www.youtube.com', desc: 'youtube.com' },
                    { label: 'GitHub', value: 'https://github.com', desc: 'github.com' },
                    { label: 'Reddit', value: 'https://www.reddit.com', desc: 'reddit.com' },
                  ].map((opt) => {
                    const active = (settings?.homepage ?? 'lumen://newtab') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => set('homepage', opt.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-white/15 shadow-md'
                            : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                        }`}
                        style={
                          active
                            ? { borderColor: currentAccent, boxShadow: `0 0 14px ${currentAccent}40` }
                            : undefined
                        }
                      >
                        <div className="text-xs font-semibold text-white">{opt.label}</div>
                        <div className="text-[11px] text-white/50 mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom homepage URL */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <div>
                    <div className="text-xs font-medium text-white">Custom Homepage URL</div>
                    <div className="text-[11px] text-white/50">Page loaded on launch or new window</div>
                  </div>
                  <input
                    type="text"
                    value={settings?.homepage ?? 'lumen://newtab'}
                    onChange={(e) => set('homepage', e.target.value)}
                    placeholder="lumen://newtab"
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white outline-none w-64 text-right focus:border-white/30"
                  />
                </div>
              </div>
            </Card>
          </SettingsSection>
        )}

        {/* ── 2. Appearance Section ── */}
        {section === 'appearance' && (
          <SettingsSection title="Appearance & Style" description="Customize accent color, glass opacity, and vibrancy">
            <Card title="Color Theme" description="Choose your preferred color mode">
              <div className="grid grid-cols-3 gap-3 pt-2">
                {(['dark', 'light', 'system'] as const).map((t) => {
                  const active = (settings?.theme ?? storeTheme ?? 'dark') === t;
                  return (
                    <button
                      key={t}
                      onClick={() => set('theme', t)}
                      className={`py-3 px-4 rounded-xl border capitalize text-xs font-semibold transition-all ${
                        active
                          ? 'text-white shadow-lg'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-white/70'
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: `${currentAccent}22`,
                              borderColor: `${currentAccent}60`,
                            }
                          : undefined
                      }
                    >
                      {t === 'system' ? 'System Sync' : `${t} Mode`}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="Accent Color" description="Primary highlight color applied throughout the entire browser">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-2">
                {ACCENT_PRESETS.map((p) => {
                  const active = currentAccent.toLowerCase() === p.color.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      onClick={() => set('accentColor', p.color)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        active
                          ? 'bg-white/15 shadow-md'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                      }`}
                      style={
                        active
                          ? {
                              borderColor: currentAccent,
                              boxShadow: `0 0 14px ${currentAccent}40`,
                            }
                          : undefined
                      }
                    >
                      <span className="w-6 h-6 rounded-full shadow-md" style={{ backgroundColor: p.color }} />
                      <span className="text-[11px] font-medium text-white/90">{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex Color Picker */}
              <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-white">Custom Accent Color</div>
                  <div className="text-[11px] text-white/50">Pick any custom color hex code</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={currentAccent}
                    onChange={(e) => set('accentColor', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                  />
                  <input
                    type="text"
                    value={currentAccent}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
                        set('accentColor', val);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white outline-none w-28 text-center font-mono uppercase focus:border-white/30"
                  />
                </div>
              </div>
            </Card>

            <Card title="Background Color" description="The main surface color behind the browser chrome and glass panels">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-2">
                {SURFACE_PRESETS.map((p) => {
                  const active = currentSurface.toLowerCase() === p.color.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      onClick={() => set('surfaceColor', p.color)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        active
                          ? 'bg-white/15 shadow-md'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                      }`}
                      style={
                        active
                          ? {
                              borderColor: currentAccent,
                              boxShadow: `0 0 14px ${currentAccent}40`,
                            }
                          : undefined
                      }
                    >
                      <span className="w-6 h-6 rounded-full shadow-md ring-1 ring-white/20" style={{ backgroundColor: p.color }} />
                      <span className="text-[11px] font-medium text-white/90">{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex Color Picker */}
              <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-white">Custom Background Color</div>
                  <div className="text-[11px] text-white/50">Pick any custom color hex code</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={currentSurface}
                    onChange={(e) => set('surfaceColor', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                  />
                  <input
                    type="text"
                    value={currentSurface}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
                        set('surfaceColor', val);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-white outline-none w-28 text-center font-mono uppercase focus:border-white/30"
                  />
                </div>
              </div>
            </Card>

            <Card title="Glass Transparency & Blur" description="Adjust background blur and surface opacity">
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-2">
                    <span className="text-white/80">Glass Opacity</span>
                    <span className="font-semibold" style={{ color: currentAccent }}>
                      {settings?.glassOpacity ?? 65}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={settings?.glassOpacity ?? 65}
                    onChange={(e) => set('glassOpacity', Number(e.target.value))}
                    className="w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                    style={{ accentColor: currentAccent }}
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-2">
                    <span className="text-white/80">Glass Blur Frosting</span>
                    <span className="font-semibold" style={{ color: currentAccent }}>
                      {settings?.glassBlur ?? 16}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={settings?.glassBlur ?? 16}
                    onChange={(e) => set('glassBlur', Number(e.target.value))}
                    className="w-full cursor-pointer h-1.5 bg-white/10 rounded-lg"
                    style={{ accentColor: currentAccent }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <button
                  onClick={handleResetCustomization}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/15 text-white/90 transition-colors"
                >
                  Reset to Defaults
                </button>
              </div>
            </Card>
          </SettingsSection>
        )}

        {/* ── 3. Search Section ── */}
        {section === 'search' && (
          <SettingsSection title="Search Engine" description="Manage default search providers and suggestions">
            <Card title="Default Search Engine" description="Search provider used for Omnibox queries">
              <div className="space-y-2 pt-2">
                {SEARCH_ENGINES.map((se) => {
                  const active = (settings?.searchEngine ?? 'google') === se.id;
                  return (
                    <div
                      key={se.id}
                      onClick={() => set('searchEngine', se.id)}
                      className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        active
                          ? 'text-white shadow-md'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-white/80'
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: `${currentAccent}18`,
                              borderColor: `${currentAccent}50`,
                            }
                          : undefined
                      }
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{se.label}</div>
                        <div className="text-[11px] text-white/50">{se.description}</div>
                      </div>
                      <div
                        className="w-4 h-4 rounded-full border flex items-center justify-center transition-colors"
                        style={{
                          borderColor: active ? currentAccent : 'rgba(255,255,255,0.3)',
                          backgroundColor: active ? currentAccent : 'transparent',
                        }}
                      >
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </SettingsSection>
        )}

        {/* ── 4. Tabs Section ── */}
        {section === 'tabs' && (
          <SettingsSection title="Tabs & Windows" description="Manage tab layout, bookmarks bar, and memory hibernation">
            <Card title="Tab Strips & Bookmarks" description="Customize browser chrome visibility">
              <div className="space-y-4 divide-y divide-white/10">
                <ToggleRow
                  label="Show Bookmarks Bar"
                  hint="Display the bookmarks quick access bar beneath address bar"
                  checked={settings?.bookmarksBarVisible ?? true}
                  accentColor={currentAccent}
                  onChange={(v) => set('bookmarksBarVisible', v)}
                />
                <div className="pt-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-white">Auto-Hibernate Inactive Tabs</div>
                    <div className="text-[11px] text-white/50">Free memory by offloading background tabs</div>
                  </div>
                  <select
                    value={settings?.hibernateMinutes ?? 15}
                    onChange={(e) => set('hibernateMinutes', Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/15 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value={5}>After 5 minutes</option>
                    <option value={15}>After 15 minutes</option>
                    <option value={30}>After 30 minutes</option>
                    <option value={60}>After 1 hour</option>
                    <option value={0}>Never hibernate</option>
                  </select>
                </div>
              </div>
            </Card>
          </SettingsSection>
        )}

        {/* ── 5. Performance Section ── */}
        {section === 'performance' && (
          <SettingsSection title="Performance" description="Hardware acceleration, GPU rasterization, and memory saver">
            <Card title="Graphics & Engine Acceleration" description="Chromium GPU composite and performance speedups">
              <div className="space-y-4 divide-y divide-white/10">
                <ToggleRow
                  label="Hardware GPU Acceleration"
                  hint="Use direct GPU rasterization, zero-copy buffers, and WebGL acceleration"
                  checked={devHardwareAccel}
                  accentColor={currentAccent}
                  onChange={setDevHardwareAccel}
                />
                <ToggleRow
                  label="Smooth Scrolling Engine"
                  hint="Enable high-refresh rate interpolated smooth scrolling"
                  checked={devSmoothScroll}
                  accentColor={currentAccent}
                  onChange={setDevSmoothScroll}
                />
                <div className="pt-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-white">Shader & GPU Cache</div>
                    <div className="text-[11px] text-white/50">Clear compiled shaders and GPU buffer cache</div>
                  </div>
                  <button
                    onClick={handleClearGpuCache}
                    className="px-4 py-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors"
                  >
                    {gpuCacheCleared ? '✓ Cleared' : 'Purge GPU Cache'}
                  </button>
                </div>
              </div>
            </Card>
          </SettingsSection>
        )}

        {/* ── 6. Shields Section ── */}
        {section === 'shields' && (
          <SettingsSection title="Lumen Shields" description="Ad blocking, tracker protection, and fingerprint defense">
            <Card title="Protection Master Switch" description="Global protection state for all web browsing">
              <ToggleRow
                label="Enable Lumen Shields"
                hint="Block ads, tracking scripts, cryptominers, and malicious fingerprinting"
                checked={shieldsConfig?.enabled ?? true}
                accentColor={currentAccent}
                onChange={(v) => setShield('enabled', String(v))}
              />
            </Card>

            <Card title="Content Blocking & Privacy Controls" description="Fine-tune individual shield modules">
              <div className="space-y-4 divide-y divide-white/10">
                <ToggleRow
                  label="Ad & Cosmetic Filtering"
                  hint="Remove intrusive display ads, banners, and video prerolls"
                  checked={shieldsConfig?.adBlockEnabled ?? true}
                  accentColor={currentAccent}
                  onChange={(v) => setShield('adBlock', String(v))}
                />
                <ToggleRow
                  label="Tracker & Telemetry Shield"
                  hint="Block cross-site tracking beacons and analytic scripts"
                  checked={shieldsConfig?.trackerBlockEnabled ?? true}
                  accentColor={currentAccent}
                  onChange={(v) => setShield('trackerBlock', String(v))}
                />
                <ToggleRow
                  label="HTTPS Everywhere Upgrade"
                  hint="Automatically upgrade unencrypted HTTP connections to HTTPS"
                  checked={shieldsConfig?.httpsUpgrade ?? true}
                  accentColor={currentAccent}
                  onChange={(v) => setShield('httpsUpgrade', String(v))}
                />
              </div>
            </Card>

            {shieldsStats && (
              <Card title="Live Shield Statistics" description="Total threats and intrusions stopped on this device">
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-center">
                    <div className="text-xl font-bold" style={{ color: currentAccent }}>
                      {shieldsStats.adsBlocked ?? 0}
                    </div>
                    <div className="text-[11px] text-white/50 mt-1">Ads Blocked</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-center">
                    <div className="text-xl font-bold text-teal-300">{shieldsStats.trackersBlocked ?? 0}</div>
                    <div className="text-[11px] text-white/50 mt-1">Trackers Stopped</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-center">
                    <div className="text-xl font-bold text-emerald-300">{shieldsStats.httpsUpgrades ?? 0}</div>
                    <div className="text-[11px] text-white/50 mt-1">HTTPS Upgrades</div>
                  </div>
                </div>
              </Card>
            )}
          </SettingsSection>
        )}

        {/* ── 7. Privacy Section ── */}
        {section === 'privacy' && (
          <SettingsSection title="Privacy & Data" description="Manage browsing history, local SQLite store, and autofill">
            <Card title="Browsing History & Cache" description="Erase navigation history and local partition storage">
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-medium text-white">Clear Browsing History</div>
                  <div className="text-[11px] text-white/50">Delete all visit records and search queries</div>
                </div>
                <button
                  onClick={clearHistory}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-colors"
                >
                  {cleared ? '✓ History Cleared' : 'Clear All History'}
                </button>
              </div>
            </Card>
          </SettingsSection>
        )}

        {/* ── 8. Developer Section ── */}
        {section === 'developer' && (
          <SettingsSection title="Developer & Tools" description="Chromium DevTools dock mode, user agents, and debugging tools">
            <Card title="DevTools Layout" description="Choose docking position for inspection tools">
              <div className="grid grid-cols-3 gap-3 pt-2">
                {(['right', 'bottom', 'detach'] as const).map((mode) => {
                  const active = devDockMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => set('devDockMode', mode)}
                      className={`py-3 px-4 rounded-xl border capitalize text-xs font-semibold transition-all ${
                        active
                          ? 'text-white shadow-lg'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-white/70'
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: `${currentAccent}22`,
                              borderColor: `${currentAccent}60`,
                            }
                          : undefined
                      }
                    >
                      {mode === 'detach' ? 'Separate Window' : `Dock to ${mode}`}
                    </button>
                  );
                })}
              </div>
              <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
                <button
                  onClick={handleOpenDevToolsNow}
                  className="px-4 py-2 text-xs font-medium rounded-xl border transition-all"
                  style={{
                    backgroundColor: `${currentAccent}22`,
                    borderColor: `${currentAccent}50`,
                    color: currentAccent,
                  }}
                >
                  Inspect Active Tab (DevTools)
                </button>
              </div>
            </Card>

            <Card title="User Agent Emulation" description="Override browser identity for testing and responsive verification">
              <div className="space-y-3 pt-2">
                <select
                  value={devSelectedUa}
                  onChange={(e) => set('devUserAgent', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/15 text-xs text-white outline-none cursor-pointer"
                >
                  {USER_AGENT_PRESETS.map((ua) => (
                    <option key={ua.id} value={ua.id}>
                      {ua.label}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          </SettingsSection>
        )}

        {/* ── 9. Shortcuts Section ── */}
        {section === 'shortcuts' && (
          <SettingsSection title="Keyboard Shortcuts" description="Essential keyboard shortcuts for rapid navigation">
            {SHORTCUT_GROUPS.map((group) => (
              <Card key={group.category} title={group.category}>
                <div className="divide-y divide-white/[0.06]">
                  {group.items.map((item, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                      <span className="text-white/80">{item.action}</span>
                      <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-white/90 font-mono text-[11px] font-medium shadow-sm">
                        {item.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </SettingsSection>
        )}

        {/* ── 10. About Section ── */}
        {section === 'about' && (
          <SettingsSection title="About Lumen" description="System details, engine architecture, and credits">
            <Card title="Lumen Browser (Vision Glass Edition)">
              <div className="space-y-3 text-xs text-white/80 leading-relaxed">
                <p>
                  Lumen is a modern desktop browser built with high-performance Electron, Chromium WebContentsView multi-process tabs, and a sleek warm glassmorphic interface.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Engine</div>
                    <div className="text-xs font-bold text-white mt-0.5">Chromium 124</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Database</div>
                    <div className="text-xs font-bold text-white mt-0.5">SQLite (WAL)</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-semibold">UI Layer</div>
                    <div className="text-xs font-bold text-white mt-0.5">React + Tailwind</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                    <div className="text-[10px] text-white/40 uppercase font-semibold">Architecture</div>
                    <div className="text-xs font-bold text-white mt-0.5">Multi-Process</div>
                  </div>
                </div>
              </div>
            </Card>
          </SettingsSection>
        )}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  Reusable UI Helper Components
 * ══════════════════════════════════════════════════════════════ */

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 animate-tab-enter">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {description && <p className="text-xs text-white/50 mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] hover:border-white/15 rounded-2xl p-6 shadow-xl space-y-3 transition-all">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  accentColor,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  accentColor: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-4">
      <div className="min-w-0">
        <div className="text-xs font-medium text-white">{label}</div>
        {hint && <div className="text-[11px] text-white/50 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-out shrink-0"
        style={{
          backgroundColor: checked ? accentColor : 'rgba(255, 255, 255, 0.15)',
        }}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
