import { useEffect, useRef, useState } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import { api } from '../../lib/api';
import { Icon } from '../common/Icon';
import { AppMenu } from '../chrome/AppMenu';
import { TrafficLights, TrafficLightsSpacer } from '../chrome/TrafficLights';
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
    createTab,
    setSidebar,
    sidebarOpen,
    sidebarPanel,
    toggleBookmarkActive,
    activeBookmarked,
    appMenuOpen,
    setAppMenuOpen,
    toggleAppMenu,
  } = useBrowserStore();
  const incognito = useBrowserStore((s) => s.incognito);

  const tab = activeTab();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const appMenuBtnRef = useRef<HTMLButtonElement>(null);

  const activeUrl = tab?.url || '';

  useEffect(() => {
    if (!focused) {
      const url = tab?.url ?? '';
      if (!url || url === 'lumen://newtab' || url === 'about:newtab') {
        setValue('');
      } else {
        setValue(displayUrl(url));
      }
    }
  }, [tab?.url, focused]);

  useEffect(() => {
    const q = value.trim();
    if (!focused || !q || q === displayUrl(tab?.url ?? '')) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const s = (await api.app.getSuggestions(q)) as Suggestion[];
        if (!cancelled) setSuggestions(s.slice(0, 8));
      } catch {
        // ignore
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, focused, tab?.url]);

  const submit = (raw: string) => {
    if (!raw.trim()) return;
    navigateActive(raw.trim());
    setFocused(false);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) {
        submit(suggestions[highlight].url);
      } else {
        submit(value);
      }
    } else if (e.key === 'Escape') {
      setFocused(false);
      setSuggestions([]);
      setValue(displayUrl(tab?.url ?? ''));
    }
  };

  // URL display formatting: split domain vs path
  const formatUrlDisplay = (urlStr: string) => {
    if (!urlStr) return { domain: '', path: '' };
    try {
      const clean = urlStr.replace(/^https?:\/\//, '').replace(/^lumen:\/\//, '');
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

  return (
    <div className="relative px-6 py-2.5 flex items-center justify-between gap-4 drag-region select-none">
      {/* Left traffic lights for macOS when tab strip is hidden */}
      {showTrafficLights && <TrafficLightsSpacer />}

      {/* ── Left Navigation Pill Cluster ── */}
      <div className="flex items-center gap-0.5 backdrop-blur-xl border border-white/[0.08] rounded-full p-1 shadow-lg shrink-0 no-drag transition-all" style={{ background: 'var(--glass-bar-bg)' }}>
        {/* Sidebar Panel Toggle */}
        <button
          title="Sidebar Panels"
          onClick={() => setSidebar(!sidebarOpen)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            sidebarOpen
              ? 'bg-white/20 text-white shadow-sm'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Icon name="sidebar" size={15} strokeWidth={1.8} />
        </button>

        {/* Back Button */}
        <button
          title="Back"
          disabled={!tab?.canGoBack}
          onClick={goBack}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <Icon name="chevron-left" size={15} strokeWidth={2} />
        </button>

        {/* Forward Button */}
        <button
          title="Forward"
          disabled={!tab?.canGoForward}
          onClick={goForward}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <Icon name="chevron-right" size={15} strokeWidth={2} />
        </button>
      </div>

      {/* ── Center Omnibox Pill ── */}
      <div className="flex-1 max-w-2xl min-w-0 relative no-drag">
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
            {/* When not focused, render formatted URL with subtle path */}
            {!focused && (
              <div className="flex items-center pointer-events-none text-[13px] tracking-wide truncate max-w-full font-medium">
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
                setHighlight(-1);
              }}
              onFocus={() => {
                setFocused(true);
                inputRef.current?.select();
              }}
              onBlur={() => {
                setTimeout(() => setFocused(false), 200);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search or enter website name..."
              spellCheck={false}
              className={`w-full bg-transparent outline-none text-[13px] text-white text-left font-medium placeholder:text-white/30 ${
                focused ? 'opacity-100' : 'opacity-0 absolute inset-0'
              }`}
            />
          </div>

          {/* Reload / Stop Button */}
          <button
            type="button"
            title={tab?.isLoading ? 'Stop loading' : 'Reload'}
            onClick={(e) => {
              e.stopPropagation();
              if (tab?.isLoading) {
                stop();
              } else {
                reload();
              }
            }}
            className="shrink-0 text-white/60 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <Icon
              name={tab?.isLoading ? 'x' : 'arrow-clockwise'}
              size={13}
              strokeWidth={1.8}
            />
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {focused && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 backdrop-blur-2xl border border-white/15 rounded-2xl p-2 shadow-2xl animate-menu-in" style={{ background: 'var(--glass-bar-bg, rgba(30, 25, 20, 0.95))' }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit(s.url);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-xl transition-colors duration-150 ${
                  i === highlight
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <span className="text-white/60 shrink-0">
                  <Icon
                    name={
                      s.type === 'history'
                        ? 'clock'
                        : s.type === 'bookmark'
                        ? 'bookmark'
                        : 'search'
                    }
                    size={14}
                    strokeWidth={1.8}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate text-white">
                    {s.title}
                  </div>
                  {s.type !== 'search' && (
                    <div className="text-[11px] truncate text-white/50">
                      {s.url}
                    </div>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-semibold">
                  {s.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Right Action Pill Cluster ── */}
      <div className="flex items-center gap-0.5 backdrop-blur-xl border border-white/[0.08] rounded-full p-1 shadow-lg shrink-0 no-drag transition-all" style={{ background: 'var(--glass-bar-bg)' }}>
        {/* Share / Bookmark Button */}
        <button
          title="Share / Bookmark"
          onClick={() => void toggleBookmarkActive()}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            activeBookmarked
              ? 'bg-white/20 text-accent'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Icon name="bookmark" size={15} strokeWidth={1.8} />
        </button>

        {/* New Tab Button */}
        <button
          title="New Tab (Ctrl+T)"
          onClick={() => createTab()}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          <Icon name="plus" size={15} strokeWidth={2} />
        </button>

        {/* Tab Overview / Menu Button */}
        <button
          ref={appMenuBtnRef}
          title="Tabs & Menu (Alt+F)"
          onClick={toggleAppMenu}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            appMenuOpen
              ? 'bg-white/20 text-white'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Icon name="tabs-overview" size={15} strokeWidth={1.8} />
        </button>

        {showTrafficLights && <TrafficLights />}
      </div>

      {/* App Menu Overlay */}
      <AppMenu
        isOpen={!!appMenuOpen}
        onClose={() => setAppMenuOpen(false)}
        anchorRef={appMenuBtnRef}
      />
    </div>
  );
}

function displayUrl(url: string): string {
  return url;
}
