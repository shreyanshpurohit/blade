import React, { useState, useEffect, useRef } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import { api } from '../../lib/api';
import type { Suggestion, SecurityState } from '@shared/types';

interface AmbientStatusBarProps {
  onToggleControlPanel?: () => void;
  controlPanelOpen?: boolean;
}

export function AmbientStatusBar({ onToggleControlPanel, controlPanelOpen }: AmbientStatusBarProps) {
  const activeTab = useBrowserStore((s) => s.activeTab());
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const navigateActive = useBrowserStore((s) => s.navigateActive);
  const createTab = useBrowserStore((s) => s.createTab);
  const goBack = useBrowserStore((s) => s.goBack);
  const goForward = useBrowserStore((s) => s.goForward);
  const reload = useBrowserStore((s) => s.reload);

  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const securityState: SecurityState = activeTab?.securityState ?? 'internal';

  // Determine ambient strip color based on active tab security state
  const getSecurityColor = (state: SecurityState) => {
    switch (state) {
      case 'secure':
        return '#00ff66'; // Green Phosphor for HTTPS / Valid SSL
      case 'insecure':
        return '#ff3333'; // CRT Red for Insecure / Certificate Error
      case 'warning':
        return '#ffb000'; // Amber for HTTP / Unencrypted
      case 'internal':
      default:
        return '#00e5ff'; // Cyan / Green for internal terminal pages
    }
  };

  const securityColor = getSecurityColor(securityState);

  // Sync input value when active tab changes
  useEffect(() => {
    if (activeTab?.url && !expanded) {
      setInputValue(activeTab.url === 'lumen://newtab' ? '' : activeTab.url);
    }
  }, [activeTab?.url, expanded]);

  // Adjust Electron BrowserView bounds when expanding / collapsing
  useEffect(() => {
    if (expanded) {
      void api.app.setChromeHeight(48);
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      void api.app.setChromeHeight(4);
    }
  }, [expanded]);

  // Global shortcut: Cmd/Ctrl + L expands the ambient status bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setExpanded(true);
      } else if (e.key === 'Escape' && expanded) {
        e.preventDefault();
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expanded]);

  // Fetch omnibox suggestions when typing in expanded mode
  useEffect(() => {
    if (!expanded || !inputValue.trim()) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }
    let cancelled = false;
    api.app.getSuggestions(inputValue).then((res) => {
      if (!cancelled) {
        setSuggestions((res as Suggestion[]) || []);
        setSelectedIndex(-1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [inputValue, expanded]);

  const handleSubmit = (targetUrl?: string) => {
    const query = (targetUrl ?? inputValue).trim();
    if (!query) {
      setExpanded(false);
      return;
    }
    navigateActive(query);
    setExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSubmit(suggestions[selectedIndex].url);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setExpanded(false);
    }
  };

  const getSecurityLabel = (state: SecurityState) => {
    switch (state) {
      case 'secure':
        return '[SECURE // TLS 1.3]';
      case 'insecure':
        return '[INSECURE // CERT ERR]';
      case 'warning':
        return '[HTTP // UNENCRYPTED]';
      case 'internal':
      default:
        return '[SYSTEM // INTERNAL]';
    }
  };

  return (
    <div ref={containerRef} className="relative z-50 select-none">
      {/* ── 1. Collapsed 4px Ambient Strip ── */}
      {!expanded && (
        <div
          onClick={() => setExpanded(true)}
          className="h-[4px] w-full cursor-pointer transition-all duration-150 relative group hover:h-[7px]"
          style={{ backgroundColor: securityColor }}
          title={`Active Tab: ${activeTab?.title || 'New Tab'} • ${getSecurityLabel(securityState)} (Click or Ctrl+L to expand)`}
        >
          {/* Subtle phosphor glow overlay on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              boxShadow: `0 0 12px ${securityColor}`,
              backgroundColor: securityColor,
            }}
          />
        </div>
      )}

      {/* ── 2. Expanded Terminal Omnibox ── */}
      {expanded && (
        <div className="w-full bg-[#050705] border-b border-[#00ff66]/40 p-2 animate-terminal-expand crt-scanlines">
          <div className="flex items-center gap-2 max-w-full">
            {/* Control Panel Toggle */}
            <button
              onClick={onToggleControlPanel}
              className={`px-2 py-1 text-[11px] font-mono border transition-all ${
                controlPanelOpen
                  ? 'border-[#00ff66] bg-[#00ff66]/15 text-[#00ff66]'
                  : 'border-[#1a401a] text-[#4a7c4a] hover:border-[#00ff66] hover:text-[#00ff66]'
              }`}
              title="Toggle Card-Stack Tab Panel"
            >
              [TABS]
            </button>

            {/* Back / Forward / Reload Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => goBack()}
                disabled={!activeTab?.canGoBack}
                className="px-1.5 py-0.5 text-[11px] font-mono border border-[#1a401a] text-[#4a7c4a] hover:border-[#00ff66] hover:text-[#00ff66] disabled:opacity-30 disabled:pointer-events-none"
                title="Back"
              >
                &lt;
              </button>
              <button
                onClick={() => goForward()}
                disabled={!activeTab?.canGoForward}
                className="px-1.5 py-0.5 text-[11px] font-mono border border-[#1a401a] text-[#4a7c4a] hover:border-[#00ff66] hover:text-[#00ff66] disabled:opacity-30 disabled:pointer-events-none"
                title="Forward"
              >
                &gt;
              </button>
              <button
                onClick={() => reload()}
                className="px-1.5 py-0.5 text-[11px] font-mono border border-[#1a401a] text-[#4a7c4a] hover:border-[#00ff66] hover:text-[#00ff66]"
                title="Reload"
              >
                R
              </button>
            </div>

            {/* Security Badge */}
            <div
              className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border shrink-0"
              style={{
                borderColor: securityColor,
                color: securityColor,
                backgroundColor: `${securityColor}15`,
              }}
            >
              {getSecurityLabel(securityState)}
            </div>

            {/* Omnibox Terminal Input */}
            <div className="flex-1 flex items-center bg-[#0a0f0a] border border-[#00ff66]/60 px-2 py-1 relative">
              <span className="text-[#00ff66] font-mono text-xs mr-2 font-bold select-none">&gt;</span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={(e) => {
                  // Collapse if clicking outside
                  if (!containerRef.current?.contains(e.relatedTarget as Node)) {
                    setExpanded(false);
                  }
                }}
                placeholder="ENTER URL OR SEARCH QUERY... [ESC TO COLLAPSE]"
                className="w-full bg-transparent text-[#00ff66] font-mono text-xs outline-none placeholder-[#00772e]"
                autoFocus
              />
              <span className="text-[#00ff66] text-xs font-mono crt-blink">█</span>
            </div>

            {/* New Tab Quick Button */}
            <button
              onClick={() => {
                createTab();
                setExpanded(false);
              }}
              className="px-2 py-1 text-[11px] font-mono border border-[#00ff66]/60 text-[#00ff66] hover:bg-[#00ff66]/20 transition-all shrink-0"
              title="Open New Tab (lumen://newtab)"
            >
              [+] NEW
            </button>

            {/* Collapse Button */}
            <button
              onClick={() => setExpanded(false)}
              className="px-2 py-1 text-[11px] font-mono border border-[#ff3333]/50 text-[#ff3333] hover:bg-[#ff3333]/20 transition-all shrink-0"
              title="Collapse Omnibox"
            >
              [X]
            </button>
          </div>

          {/* Autocomplete / Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div className="mt-1.5 border border-[#00ff66]/40 bg-[#070b07] text-[#00ff66] font-mono text-xs">
              <div className="px-2 py-1 text-[10px] text-[#008833] border-b border-[#143314] uppercase tracking-wider">
                -- MATCHED ENTRIES ({suggestions.length}) --
              </div>
              {suggestions.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSubmit(item.url);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-3 py-1.5 flex items-center justify-between cursor-pointer border-b border-[#0f240f] last:border-b-0 transition-colors ${
                      isSelected ? 'bg-[#00ff66]/20 text-[#33ff77]' : 'hover:bg-[#00ff66]/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] text-[#008833] uppercase">
                        [{item.type}]
                      </span>
                      <span className="truncate">{item.title}</span>
                    </div>
                    <span className="text-[10px] text-[#008833] ml-4 shrink-0 truncate max-w-[280px]">
                      {item.url}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
