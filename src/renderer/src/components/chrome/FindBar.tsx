import { useEffect, useRef, useState } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { api } from '../../lib/api';

export function FindBar() {
  const findBarOpen = useBrowserStore((s) => s.findBarOpen);
  const setFindBarOpen = useBrowserStore((s) => s.setFindBarOpen);
  const activeTab = useBrowserStore((s) => s.activeTab());

  const [query, setQuery] = useState('');
  const [matchInfo, setMatchInfo] = useState<{ activeMatchOrdinal: number; matches: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = api.onOpenFindBar?.(() => {
      setFindBarOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    });
    return () => {
      unsub?.();
    };
  }, [setFindBarOpen]);

  useEffect(() => {
    const unsub = api.onFindResult?.((res) => {
      setMatchInfo({
        activeMatchOrdinal: res.activeMatchOrdinal,
        matches: res.matches,
      });
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (findBarOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setMatchInfo(null);
      void api.tabs.stopFind?.('clearSelection');
    }
  }, [findBarOpen, activeTab?.id]);

  if (!findBarOpen) return null;

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setMatchInfo(null);
      void api.tabs.stopFind?.('clearSelection');
    } else {
      void api.tabs.find(val, { forward: true, findNext: false });
    }
  };

  const handleFindNext = (forward = true) => {
    if (query.trim()) {
      void api.tabs.find(query, { forward, findNext: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleFindNext(!e.shiftKey);
    }
  };

  const close = () => {
    setFindBarOpen(false);
    void api.tabs.stopFind?.('clearSelection');
  };

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-xl glass-panel border border-white/20 shadow-md text-xs no-drag select-none"
      style={{
        background: 'color-mix(in srgb, var(--color-surface-solid, #181818) 96%, var(--app-bg))',
      }}
    >
      <Icon name="search" size={13} className="text-white/40 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
        className="w-48 bg-transparent outline-none text-white text-xs font-medium placeholder:text-white/30"
      />

      {/* Match count indicator */}
      {query.trim() && (
        <span className="text-[10.5px] text-white/60 px-1 font-mono shrink-0">
          {matchInfo && matchInfo.matches > 0
            ? `${matchInfo.activeMatchOrdinal}/${matchInfo.matches}`
            : '0/0'}
        </span>
      )}

      {query && (
        <button
          onClick={() => handleQueryChange('')}
          className="w-4 h-4 rounded-full flex items-center justify-center text-white/40 hover:text-white"
          title="Clear search"
        >
          <Icon name="x" size={10} />
        </button>
      )}

      <div className="h-4 w-px bg-white/10 mx-0.5" />

      {/* Previous Match */}
      <button
        onClick={() => handleFindNext(false)}
        className="w-6 h-6 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title="Previous match (Shift+Enter)"
      >
        <Icon name="chevron-up" size={13} strokeWidth={2} />
      </button>

      {/* Next Match */}
      <button
        onClick={() => handleFindNext(true)}
        className="w-6 h-6 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title="Next match (Enter)"
      >
        <Icon name="chevron-down" size={13} strokeWidth={2} />
      </button>

      {/* Close Find Bar */}
      <button
        onClick={close}
        className="w-6 h-6 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title="Close (Esc)"
      >
        <Icon name="x" size={13} strokeWidth={2} />
      </button>
    </div>
  );
}
