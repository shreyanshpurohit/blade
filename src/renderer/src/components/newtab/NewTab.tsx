import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { BladeLogo } from '../common/BladeLogo';
import type { HistoryEntry } from '@shared/types';

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

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    navigateActive(q);
  }, [searchValue, navigateActive]);

  const handleFaviconError = useCallback((domain: string) => {
    setFaviconErrors((prev) => new Set(prev).add(domain));
  }, []);

  return (
    <div className="newtab-page h-full w-full flex flex-col items-center justify-center select-none overflow-auto"
      style={{
        background: 'var(--newtab-bg)',
      }}
    >
      {/* ── Brand Logo, Clock & Greeting ── */}
      <div className="flex flex-col items-center mb-10 animate-fade-in">
        <div className="mb-4">
          <BladeLogo className="w-16 h-16 drop-shadow-[0_0_24px_rgba(255,255,255,0.15)] hover:scale-105 transition-transform duration-300" />
        </div>
        <time className="text-[64px] font-semibold tracking-tight text-white/90 leading-none tabular-nums">
          {formatTime(time)}
        </time>
        <p className="mt-2 text-[15px] text-white/40 font-medium tracking-wide">
          {getGreeting()} · {formatDate(time)}
        </p>
      </div>

      {/* ── Search Bar ── */}
      <form onSubmit={handleSearch} className="w-full max-w-[540px] px-6 mb-12 animate-fade-in-delay">
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white/60 transition-colors">
            <Icon name="search" size={18} strokeWidth={1.8} />
          </div>
          <input
            ref={searchRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search or enter a URL..."
            spellCheck={false}
            autoComplete="off"
            className="w-full h-12 pl-11 pr-4 rounded-2xl
              bg-white/[0.06] backdrop-blur-xl
              border border-white/[0.08] group-focus-within:border-white/20
              text-[15px] text-white/90 font-medium placeholder:text-white/25
              outline-none transition-all duration-300
              focus:bg-white/[0.09] focus:ring-2 focus:ring-white/[0.08]
              shadow-lg shadow-black/20"
          />
        </div>
      </form>

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
