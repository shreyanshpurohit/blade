import { useEffect, useRef, useState } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import { api } from '../../lib/api';
import { Icon } from '../common/Icon';
import { BladeLogo } from '../common/BladeLogo';
import { TrafficLights, TrafficLightsSpacer } from '../chrome/TrafficLights';
import { BookmarksPopup } from '../chrome/BookmarksPopup';
import { DownloadPopup } from '../chrome/DownloadPopup';
import { AppMenuPopup } from '../chrome/AppMenuPopup';
import type { Suggestion } from '@shared/types';

interface AddressBarProps {
  showTrafficLights?: boolean;
}

export function AddressBar({ showTrafficLights = false }: AddressBarProps) {
  const {
    goBack,
    goForward,
    reload,
    stop,
    activeTab,
    navigateActive,
    activeBookmarked,
    toolbarConfig,
  } = useBrowserStore();
  const incognito = useBrowserStore((s) => s.incognito);

  const tab = activeTab();
  const [value, setValue] = useState('');
  const [originalQuery, setOriginalQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [shieldsStats, setShieldsStats] = useState<{ adsBlocked: number; trackersBlocked: number; fingerprintsBlocked: number } | null>(null);
  const [shieldsEnabled, setShieldsEnabled] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const omniboxRef = useRef<HTMLDivElement>(null);
  const suggestionsDropdownRef = useRef<HTMLDivElement>(null);
  const bookmarkBtnRef = useRef<HTMLButtonElement>(null);
  const downloadBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const activeUrl = tab?.url || '';

  useEffect(() => {
    const fetchShields = () => {
      void api.shields.getConfig().then((c: any) => {
        if (c) setShieldsEnabled(c.enabled);
      });
      void api.shields.getStatsForTab().then((s: any) => {
        if (s) setShieldsStats(s);
      });
    };
    fetchShields();
    const interval = setInterval(fetchShields, 2000);
    return () => clearInterval(interval);
  }, [tab?.url]);

  const totalShieldBlocked = (shieldsStats?.adsBlocked ?? 0) + (shieldsStats?.trackersBlocked ?? 0) + (shieldsStats?.fingerprintsBlocked ?? 0);

  useEffect(() => {
    if (!focused) {
      const url = tab?.url ?? '';
      if (!url || url === 'blade://newtab' || url === 'lumen://newtab' || url === 'about:newtab') {
        setValue('');
      } else {
        setValue(displayUrl(url));
      }
    }
  }, [tab?.url, focused]);

  useEffect(() => {
    const q = value.trim();
    if (!focused || q === displayUrl(tab?.url ?? '')) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const s = (await api.app.getSuggestions(q)) as Suggestion[];
        if (!cancelled) setSuggestions(s.slice(0, 10));
      } catch {
        // ignore
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, focused, tab?.url]);

  useEffect(() => {
    if (focused && suggestions.length > 0) {
      const raf = requestAnimationFrame(() => {
        const h = suggestionsDropdownRef.current?.getBoundingClientRect().height ?? 0;
        if (h > 0) {
          void api.app.setSuggestionsHeight(Math.round(h + 16));
        }
      });
      return () => {
        cancelAnimationFrame(raf);
        void api.app.setSuggestionsHeight(0);
      };
    } else {
      void api.app.setSuggestionsHeight(0);
    }
  }, [focused, suggestions.length]);

  const submit = (raw: string) => {
    if (!raw.trim()) return;
    navigateActive(raw.trim());
    setFocused(false);
    setSuggestions([]);
    void api.app.setSuggestionsHeight(0);
    void api.app.hideSuggestions();
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => {
        const next = Math.min(h + 1, suggestions.length - 1);
        if (next >= 0 && suggestions[next]) {
          setValue(suggestions[next].url);
        }
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => {
        const next = Math.max(h - 1, -1);
        if (next >= 0 && suggestions[next]) setValue(suggestions[next].url);
        else setValue(originalQuery);
        return next;
      });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        submit(suggestions[highlight].url);
      } else {
        submit(value);
      }
    } else if (e.key === 'Escape') {
      setFocused(false);
      setSuggestions([]);
      void api.app.setSuggestionsHeight(0);
      setValue(displayUrl(tab?.url ?? ''));
      setOriginalQuery('');
      setHighlight(-1);
    }
  };

  // URL display formatting: split domain vs path
  const formatUrlDisplay = (urlStr: string) => {
    if (!urlStr) return { domain: '', path: '' };
    try {
      const clean = urlStr.replace(/^https?:\/\//, '').replace(/^blade:\/\//, '').replace(/^lumen:\/\//, '');
      const slashIndex = clean.indexOf('/');
      if (slashIndex === -1) {
        return { domain: clean, path: '' };
      }
      return {
        domain: clean.slice(0, slashIndex),
        path: clean.slice(slashIndex),
      };
    } catch {
      return { domain: urlStr, path: '' };
    }
  };

  const urlDisplay = formatUrlDisplay(value);
  const hasSuggestions = focused && suggestions.length > 0;



  return (
    <div className="relative px-6 py-2.5 flex items-center justify-between gap-4 drag-region select-none">
      {/* Left traffic lights for macOS when tab strip is hidden */}
      {showTrafficLights && <TrafficLightsSpacer />}

      {/* ── Left Navigation Pill Cluster ── */}
      {(toolbarConfig.backForward || toolbarConfig.reload || toolbarConfig.home) && (
        <div className="flex items-center gap-0.5 backdrop-blur-xl border border-white/[0.08] rounded-full p-1 shadow-lg shrink-0 no-drag transition-all" style={{ background: 'var(--glass-bar-bg)' }}>
          {/* Back Button */}
          {toolbarConfig.backForward && (
            <button
              type="button"
              title="Back (Alt+Left)"
              disabled={!tab?.canGoBack}
              onClick={goBack}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <Icon name="chevron-left" size={15} strokeWidth={2} />
            </button>
          )}

          {/* Forward Button */}
          {toolbarConfig.backForward && (
            <button
              type="button"
              title="Forward (Alt+Right)"
              disabled={!tab?.canGoForward}
              onClick={goForward}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <Icon name="chevron-right" size={15} strokeWidth={2} />
            </button>
          )}

          {/* Reload / Stop Button */}
          {toolbarConfig.reload && (
            <button
              type="button"
              title={tab?.isLoading ? 'Stop loading (Esc)' : 'Reload (Ctrl+R)'}
              onClick={() => {
                if (tab?.isLoading) {
                  stop();
                } else {
                  reload();
                }
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <Icon
                name={tab?.isLoading ? 'x' : 'arrow-clockwise'}
                size={14}
                strokeWidth={2}
                className={tab?.isLoading ? 'animate-spin' : ''}
              />
            </button>
          )}

          {/* Home Button */}
          {toolbarConfig.home && (
            <button
              type="button"
              title="Home (Blade New Tab)"
              onClick={() => navigateActive('blade://newtab')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <Icon name="home" size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      {/* ── Center Omnibox Pill ── */}
      <div ref={omniboxRef} className="flex-1 max-w-2xl min-w-0 relative no-drag">
        <div
          className={`h-10 px-4 flex items-center gap-3 rounded-full backdrop-blur-xl border transition-all duration-200 shadow-lg ${
            focused
              ? 'bg-[var(--color-surface)] border-white/25 ring-2 ring-white/10'
              : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border-white/[0.08]'
          }`}
          onClick={() => {
            if (!focused) {
              inputRef.current?.focus();
            }
          }}
        >
          {/* URL Input / Display */}
          <div className="flex-1 min-w-0 relative flex items-center">
            {incognito && (
              <span className="incognito-badge mr-2 shrink-0" title="Private window">
                <Icon name="eye-slash" size={12} strokeWidth={1.8} />
                <span>Private</span>
              </span>
            )}
            {/* When not focused, render formatted URL with subtle path */}
            {!focused && (
              <div className="flex items-center gap-2 pointer-events-none text-[13px] tracking-wide truncate max-w-full font-medium">
                {(activeUrl.startsWith('blade://') || activeUrl.startsWith('lumen://') || activeUrl.startsWith('about:') || !activeUrl) && (
                  <BladeLogo size={13} className="shrink-0" />
                )}
                <span className="text-white/90">{urlDisplay.domain}</span>
                {urlDisplay.path && (
                  <span className="text-white/45">{urlDisplay.path}</span>
                )}
              </div>
            )}

            {/* Actual interactive input */}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setOriginalQuery(e.target.value);
                setHighlight(-1);
              }}
              onFocus={() => {
                setFocused(true);
                inputRef.current?.select();
              }}
              onBlur={() => {
                setTimeout(() => {
                  setFocused(false);
                  void api.app.hideSuggestions();
                }, 200);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search or enter website name..."
              spellCheck={false}
              className={`w-full bg-transparent outline-none text-[13px] text-white text-left font-medium placeholder:text-white/30 ${
                focused ? 'opacity-100' : 'opacity-0 absolute inset-0'
              }`}
            />
          </div>

          {/* Shields Button inside Omnibox */}
          {toolbarConfig.shields && tab?.url && !tab.url.startsWith('blade://') && !tab.url.startsWith('lumen://') && !tab.url.startsWith('about:') && (
            <button
              type="button"
              title={`Blade Shields: ${shieldsEnabled ? (totalShieldBlocked > 0 ? `${totalShieldBlocked} items blocked` : 'Active') : 'Disabled'}`}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                void api.app.showPopup({ type: 'shields', x: rect.right, y: rect.bottom });
              }}
              className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                shieldsEnabled
                  ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/30'
                  : 'bg-white/10 text-white/40 hover:bg-white/15'
              }`}
            >
              <Icon name="shield" size={13} strokeWidth={2.2} />
              {totalShieldBlocked > 0 && <span>{totalShieldBlocked}</span>}
            </button>
          )}

          {/* Inline Suggestions Dropdown */}
          {focused && suggestions.length > 0 && (
            <div
              ref={suggestionsDropdownRef}
              className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 backdrop-blur-2xl bg-[var(--color-surface)]/95 border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto max-h-[420px] py-2 flex flex-col gap-1"
            >
              {/* Top sites grid (if any top-sites exist) */}
              {suggestions.some(s => s.type === 'top-site') && (
                <div className="flex overflow-x-auto gap-2 px-3 pb-2 mb-1 border-b border-white/[0.08] custom-scrollbar">
                  {suggestions.filter(s => s.type === 'top-site').map((s, i) => (
                    <div key={'top'+i} onClick={() => submit(s.url)} className="flex flex-col items-center gap-1.5 p-2 hover:bg-white/[0.06] cursor-pointer rounded-xl min-w-[72px] flex-shrink-0 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center">
                        <Icon name="arrow-up-right" size={18} className="text-white/40" />
                      </div>
                      <span className="text-[10px] text-white/70 truncate w-full text-center">{s.title ? s.title.substring(0, 15) : (s.url ? new URL(s.url).hostname : '')}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* List suggestions (non top-site) */}
              {suggestions.map((s, i) => {
                if (s.type === 'top-site') return null;
                const isHighlighted = i === highlight;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => submit(s.url)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl mx-1 transition-colors ${isHighlighted ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]'}`}
                  >
                    <div className="shrink-0 flex items-center justify-center w-6 h-6">
                      <Icon name={getCategoryIcon(s.type)} size={14} className="text-white/40" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-white/90 text-[13px] truncate">{s.type === 'search' ? s.title : (s.title || s.url)}</span>
                      {s.type !== 'search' && (
                        <span className="text-white/40 text-[11px] truncate">{s.url}</span>
                      )}
                    </div>
                    <div className="shrink-0">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-white/30 px-2 py-0.5 rounded-full bg-white/[0.05]">
                        {getCategoryLabel(s.type)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ── Right Action Pill Cluster (Customizable) ── */}
      <div className="flex items-center gap-0.5 backdrop-blur-xl border border-white/[0.08] rounded-full p-1 shadow-lg shrink-0 no-drag transition-all" style={{ background: 'var(--glass-bar-bg)' }}>
        {/* History Button */}
        {toolbarConfig.history && (
          <button
            title="History (Ctrl+H)"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              void api.app.showPopup({ type: 'history', x: rect.right, y: rect.bottom });
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <Icon name="clock" size={15} strokeWidth={1.8} />
          </button>
        )}

        {/* Bookmark / Star Button */}
        {toolbarConfig.bookmark && (
          <button
            ref={bookmarkBtnRef}
            title={activeBookmarked ? 'Edit bookmark for this tab' : 'Bookmark this tab'}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              void api.app.showPopup({ type: 'bookmarks', x: rect.right, y: rect.bottom });
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              activeBookmarked
                ? 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon name="star" size={15} strokeWidth={activeBookmarked ? 2.5 : 1.8} />
          </button>
        )}

        {/* Settings Button */}
        {toolbarConfig.settings && (
          <button
            title="Settings (Ctrl+,)"
            onClick={() => {
              void api.app.closePopup();
              api.app.openSettings();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <Icon name="gear" size={15} strokeWidth={1.8} />
          </button>
        )}

        {/* Downloads Button */}
        {toolbarConfig.downloads && (
          <button
            ref={downloadBtnRef}
            title="Downloads (Ctrl+J)"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              void api.app.showPopup({ type: 'downloads', x: rect.right, y: rect.bottom });
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <Icon name="download" size={15} strokeWidth={1.8} />
          </button>
        )}

        {/* 3-Dots / 3-Lines Menu Button */}
        <button
          ref={menuBtnRef}
          title="Customize and control Blade"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            void api.app.showPopup({ type: 'menu', x: rect.right, y: rect.bottom });
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          <Icon name="dots-vertical" size={15} strokeWidth={2} />
        </button>

        {showTrafficLights && <TrafficLights />}
      </div>
    </div>
  );
}


function getCategoryIcon(type: string): any {
  switch (type) {
    case 'history': return 'clock';
    case 'bookmark': return 'star';
    case 'search': return 'search';
    case 'url': return 'globe';
    case 'top-site': return 'arrow-up-right';
    default: return 'search';
  }
}

function getCategoryLabel(type: string): string {
  switch (type) {
    case 'history': return 'History';
    case 'bookmark': return 'Bookmark';
    case 'search': return 'Search';
    case 'url': return 'Link';
    case 'top-site': return 'Top Site';
    default: return 'Suggestion';
  }
}

function displayUrl(url: string): string {
  return url;
}

