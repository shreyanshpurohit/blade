import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { BladeLogo } from '../common/BladeLogo';
import type { HistoryEntry, Suggestion } from '@shared/types';

/** Derive the top N most-visited domains from history. */
function deriveTopSites(entries: HistoryEntry[], max = 8) {
  const domainMap = new Map<string, { title: string; url: string; domain: string; visits: number; favicon: string }>();

  for (const e of entries) {
    try {
      const u = new URL(e.url);
      const domain = u.hostname.replace(/^www\./, '');
      const existing = domainMap.get(domain);
      if (existing) {
        existing.visits += e.visitCount;
        // Prefer the entry with a real title
        if (e.title && e.title.length > (existing.title?.length || 0)) {
          existing.title = e.title;
          existing.url = e.url;
        }
      } else {
        domainMap.set(domain, {
          title: e.title || domain,
          url: e.url,
          domain,
          visits: e.visitCount,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        });
      }
    } catch {
      // skip invalid URLs
    }
  }

  return [...domainMap.values()]
    .sort((a, b) => b.visits - a.visits)
    .slice(0, max);
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function NewTab() {
  const navigateActive = useBrowserStore((s) => s.navigateActive);
  const [searchValue, setSearchValue] = useState('');
  const [time, setTime] = useState(new Date());
  const [topSites, setTopSites] = useState<ReturnType<typeof deriveTopSites>>([]);
  const [faviconErrors, setFaviconErrors] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load top sites from history
  useEffect(() => {
    void api.history.list('', 0).then((h) => {
      setTopSites(deriveTopSites(h as HistoryEntry[]));
    });
  }, []);

  // Focus search on any keypress (when not already in an input)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) return;

      if (e.key.length === 1 && searchRef.current) {
        searchRef.current.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [focused, setFocused] = useState(false);

  // Fetch suggestions when searchValue changes or on focus
  useEffect(() => {
    if (!focused) {
      setSuggestions([]);
      setHighlight(-1);
      return;
    }
    const q = searchValue.trim();
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const s = (await api.app.getSuggestions(q)) as Suggestion[];
        if (!cancelled) setSuggestions((s as Suggestion[]) || []);
      } catch {
        // ignore
      }
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchValue, focused]);

  const handleSearch = useCallback((e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();
    const q = (customQuery ?? (highlight >= 0 && suggestions[highlight] ? suggestions[highlight].url : searchValue)).trim();
    if (!q) return;
    navigateActive(q);
  }, [searchValue, highlight, suggestions, navigateActive]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setHighlight(-1);
      searchRef.current?.blur();
    }
  };

  const handleFaviconError = useCallback((domain: string) => {
    setFaviconErrors((prev) => new Set(prev).add(domain));
  }, []);

  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'history': return 'clock';
      case 'bookmark': return 'star';
      case 'url': return 'globe';
      default: return 'search';
    }
  };

  return (
    <div className="newtab-page h-full w-full flex flex-col items-center justify-center select-none overflow-auto"
      style={{
        background: 'var(--newtab-bg)',
      }}
      onClick={() => setFocused(false)}
    >
      {/* ── Clock & Greeting ── */}
      <div className="flex flex-col items-center mb-10 animate-fade-in">
        <time className="text-[64px] font-semibold tracking-tight text-white/90 leading-none tabular-nums">
          {formatTime(time)}
        </time>
        <p className="mt-2 text-[15px] text-white/40 font-medium tracking-wide">
          {getGreeting()} · {formatDate(time)}
        </p>
      </div>

      {/* ── Search Bar with Blade Logo & Live Suggestions ── */}
      <div className="w-full max-w-[560px] px-6 mb-12 animate-fade-in-delay relative z-30" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSearch} className="w-full">
          <div className="relative group flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-transform duration-200 group-focus-within:scale-105">
              <BladeLogo className="w-5 h-5 opacity-70 group-focus-within:opacity-100 transition-opacity" />
            </div>
            <input
              ref={searchRef}
              type="text"
              value={searchValue}
              onFocus={() => setFocused(true)}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setFocused(true);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Search or enter a URL..."
              spellCheck={false}
              autoComplete="off"
              className="w-full h-12 pl-12 pr-4 rounded-2xl
                bg-white/[0.06] backdrop-blur-xl
                border border-white/[0.08] group-focus-within:border-white/20
                text-[15px] text-white/90 font-medium placeholder:text-white/25
                outline-none transition-all duration-300
                focus:bg-white/[0.09] focus:ring-2 focus:ring-white/[0.08]
                shadow-lg shadow-black/20"
            />
          </div>
        </form>

        {/* ── Suggestions & History Dropdown ── */}
        {focused && suggestions.length > 0 && (
          <div
            className="absolute left-6 right-6 top-[calc(100%+8px)] glass-panel border border-white/15 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl flex flex-col gap-0.5 animate-menu-in z-50 overflow-hidden"
            style={{
              background: 'color-mix(in srgb, var(--color-surface-solid, #141414) 96%, var(--app-bg))',
            }}
          >
            {suggestions.map((s, idx) => {
              const isSelected = idx === highlight;
              return (
                <button
                  key={`${s.type}-${s.url}-${idx}`}
                  type="button"
                  onClick={() => handleSearch(undefined, s.url)}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                    isSelected ? 'bg-white/[0.12] text-white' : 'text-white/80 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Icon
                      name={getSuggestionIcon(s.type)}
                      size={14}
                      strokeWidth={1.8}
                      className="shrink-0 text-white/40"
                    />
                    <span className="text-[13px] font-medium truncate">{s.title || s.url}</span>
                  </div>
                  {s.type !== 'search' && (
                    <span className="text-[11px] text-white/40 truncate max-w-[160px] font-mono ml-2">
                      {s.url}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Top Sites Grid ── */}
      {topSites.length > 0 && (
        <div className="grid grid-cols-4 gap-4 px-6 max-w-[480px] w-full animate-fade-in-delay-2">
          {topSites.map((site) => (
            <button
              key={site.domain}
              onClick={() => navigateActive(site.url)}
              title={site.title}
              className="group/site flex flex-col items-center gap-2 p-3 rounded-2xl
                hover:bg-white/[0.06] transition-all duration-200"
            >
              <div className="w-11 h-11 rounded-xl bg-white/[0.08] border border-white/[0.06]
                flex items-center justify-center overflow-hidden
                group-hover/site:bg-white/[0.12] group-hover/site:border-white/[0.12]
                group-hover/site:scale-105
                transition-all duration-200 shadow-sm">
                {faviconErrors.has(site.domain) ? (
                  <span className="text-white/50 text-[16px] font-bold uppercase">
                    {site.domain.charAt(0)}
                  </span>
                ) : (
                  <img
                    src={site.favicon}
                    alt=""
                    className="w-6 h-6 rounded-sm"
                    onError={() => handleFaviconError(site.domain)}
                  />
                )}
              </div>
              <span className="text-[11px] font-medium text-white/40 group-hover/site:text-white/70
                truncate max-w-full transition-colors duration-200">
                {site.domain}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Empty state when no history */}
      {topSites.length === 0 && (
        <div className="flex flex-col items-center gap-3 text-white/25 animate-fade-in-delay-2">
          <Icon name="globe" size={32} strokeWidth={1.2} />
          <p className="text-[13px] font-medium">Your most visited sites will appear here</p>
        </div>
      )}
    </div>
  );
}
