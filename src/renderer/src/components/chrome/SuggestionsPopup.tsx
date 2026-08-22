import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import type { Suggestion } from '@shared/types';

interface SuggestionsPopupProps {
  initialQuery?: string;
}

export function SuggestionsPopup({ initialQuery = '' }: SuggestionsPopupProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const navigateActive = useBrowserStore((s) => s.navigateActive);
  const init = useBrowserStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const unsub = api.onSuggestionsChanged((newQ) => {
      setQuery(newQ);
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    void api.app.getSuggestions(q).then((s) => {
      if (!cancelled) {
        setSuggestions(((s as Suggestion[]) || []).slice(0, 6));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const select = (url: string) => {
    navigateActive(url);
    void api.app.hideSuggestions();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((prev) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlight >= 0 && suggestions[highlight]) {
          select(suggestions[highlight].url);
        } else if (query.trim()) {
          select(query.trim());
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        void api.app.hideSuggestions();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlight, suggestions, query]);

  const getCategoryIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'history': return 'clock';
      case 'bookmark': return 'star';
      case 'url': return 'globe';
      default: return 'search';
    }
  };

  const getCategoryLabel = (type: Suggestion['type']) => {
    switch (type) {
      case 'history': return 'History';
      case 'bookmark': return 'Bookmark';
      case 'url': return 'URL';
      default: return 'Search';
    }
  };

  if (!query || suggestions.length === 0) return null;

  return (
    <div className="w-full select-none animate-menu-in p-1">
      <div
        className="glass-panel border border-white/15 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl flex flex-col gap-0.5 overflow-hidden"
        style={{
          background: 'color-mix(in srgb, var(--color-surface-solid, #12151c) 98%, var(--app-bg))',
        }}
      >
        {suggestions.map((s, idx) => {
          const isHighlighted = idx === highlight;
          return (
            <button
              key={`${s.type}-${s.url}-${idx}`}
              type="button"
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => select(s.url)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                isHighlighted ? 'bg-white/[0.12] text-white' : 'text-white/80 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Icon
                  name={getCategoryIcon(s.type)}
                  size={14}
                  strokeWidth={1.8}
                  className="shrink-0 text-white/40"
                />
                <span className="text-[13px] font-medium truncate">
                  {s.type === 'search' ? s.title : (s.title || s.url)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {s.type !== 'search' && (
                  <span className="text-[11px] text-white/40 truncate max-w-[140px] font-mono">
                    {s.url}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wider font-semibold text-white/30 px-2 py-0.5 rounded-full bg-white/[0.05]">
                  {getCategoryLabel(s.type)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
