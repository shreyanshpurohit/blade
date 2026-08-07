import React, { useState, useEffect } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import { api } from '../../lib/api';
import type { TabState, SecurityState } from '@shared/types';

interface CardStackTabsProps {
  onClosePanel?: () => void;
}

export function CardStackTabs({ onClosePanel }: CardStackTabsProps) {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const activateTab = useBrowserStore((s) => s.activateTab);
  const closeTab = useBrowserStore((s) => s.closeTab);
  const createTab = useBrowserStore((s) => s.createTab);
  const toggleMute = useBrowserStore((s) => s.toggleMute);
  const togglePin = useBrowserStore((s) => s.togglePin);

  const [viewMode, setViewMode] = useState<'stack' | 'accordion'>('stack');
  const [collapsedDomains, setCollapsedDomains] = useState<Record<string, boolean>>({});

  // Load persisted domain collapse state
  useEffect(() => {
    if (api?.domainGroups?.get) {
      api.domainGroups.get().then((res) => {
        if (res && typeof res === 'object') {
          setCollapsedDomains(res as Record<string, boolean>);
        }
      });
    }
  }, []);

  const toggleDomainCollapse = (domain: string) => {
    const nextState = !collapsedDomains[domain];
    const updated = { ...collapsedDomains, [domain]: nextState };
    setCollapsedDomains(updated);
    if (api?.domainGroups?.set) {
      api.domainGroups.set(domain, nextState);
    }
  };

  const getDomain = (url: string): string => {
    if (!url || url.startsWith('lumen://') || url.startsWith('about:')) return 'lumen://system';
    try {
      const parsed = new URL(url);
      return parsed.hostname || url;
    } catch {
      return url;
    }
  };

  // Group tabs by domain for accordion mode
  const domainGroups = tabs.reduce<Record<string, TabState[]>>((acc, tab) => {
    const domain = getDomain(tab.url);
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(tab);
    return acc;
  }, {});

  const getSecurityDot = (state: SecurityState) => {
    switch (state) {
      case 'secure':
        return { color: '#00ff66', char: '●', label: 'SECURE' };
      case 'insecure':
        return { color: '#ff3333', char: '▲', label: 'INSECURE' };
      case 'warning':
        return { color: '#ffb000', char: '◆', label: 'HTTP' };
      case 'internal':
      default:
        return { color: '#00e5ff', char: '■', label: 'INTERNAL' };
    }
  };

  return (
    <div className="w-[300px] h-full bg-[#070b07] border-r border-[#00ff66]/30 flex flex-col select-none text-[#00ff66] font-mono crt-scanlines z-40">
      {/* ── Header / Controls ── */}
      <div className="p-2.5 border-b border-[#00ff66]/30 flex flex-col gap-2 bg-[#050705]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#00ff66] crt-text-glow">
            <span>[CRT // TABS]</span>
            <span className="text-[10px] text-[#008833]">({tabs.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => createTab()}
              className="px-1.5 py-0.5 text-[10px] border border-[#00ff66]/60 text-[#00ff66] hover:bg-[#00ff66]/20 transition-colors"
              title="Create New Tab"
            >
              [+] NEW
            </button>
            {onClosePanel && (
              <button
                onClick={onClosePanel}
                className="px-1.5 py-0.5 text-[10px] border border-[#ff3333]/50 text-[#ff3333] hover:bg-[#ff3333]/20 transition-colors"
                title="Hide Tab Panel"
              >
                [X]
              </button>
            )}
          </div>
        </div>

        {/* View Mode Switcher: Card Stack vs Domain Accordion */}
        <div className="grid grid-cols-2 gap-1 p-0.5 border border-[#143314] bg-[#040604] text-[10px]">
          <button
            onClick={() => setViewMode('stack')}
            className={`py-1 text-center transition-all ${
              viewMode === 'stack'
                ? 'bg-[#00ff66] text-[#050705] font-bold'
                : 'text-[#4a7c4a] hover:text-[#00ff66]'
            }`}
          >
            [CARD STACK]
          </button>
          <button
            onClick={() => setViewMode('accordion')}
            className={`py-1 text-center transition-all ${
              viewMode === 'accordion'
                ? 'bg-[#00ff66] text-[#050705] font-bold'
                : 'text-[#4a7c4a] hover:text-[#00ff66]'
            }`}
          >
            [ACCORDION]
          </button>
        </div>
      </div>

      {/* ── 1. CARD-STACK TABS VIEW ── */}
      {viewMode === 'stack' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 relative card-stack-zone">
          <div className="text-[10px] text-[#008833] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>&gt; HOVER STACK TO FAN OUT</span>
            <span>TOP: ACTIVE</span>
          </div>

          <div
            className="relative min-h-[460px] w-full"
            style={{
              height: `${Math.max(460, tabs.length * 44 + 80)}px`,
            }}
          >
            {tabs.map((tab, idx) => {
              const isActive = tab.id === activeTabId;
              const sec = getSecurityDot(tab.securityState);
              const domain = getDomain(tab.url);

              return (
                <div
                  key={tab.id}
                  onClick={() => activateTab(tab.id)}
                  className={`card-stack-tab absolute left-0 w-full p-2.5 cursor-pointer border transition-all duration-200 ${
                    isActive
                      ? 'border-[#00ff66] bg-[#0c160c] crt-box-glow z-30'
                      : 'border-[#1a381a] bg-[#070d07] hover:border-[#00ff66]/80'
                  }`}
                  style={
                    {
                      '--card-index': idx,
                      top: `${idx * 10}px`,
                      left: `${idx * 10}px`,
                      width: `calc(100% - ${idx * 10}px)`,
                      zIndex: isActive ? 40 : idx + 1,
                    } as React.CSSProperties
                  }
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span style={{ color: sec.color }} className="text-[10px]" title={sec.label}>
                        {sec.char}
                      </span>
                      <span className="text-[11px] font-bold truncate text-[#d0ffd0]">
                        {tab.title || 'New Tab'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {tab.audible && (
                        <button
                          onClick={() => toggleMute(tab.id)}
                          className="text-[9px] text-[#ffb000] hover:underline"
                          title={tab.muted ? 'Unmute' : 'Mute'}
                        >
                          {tab.muted ? '[MUTED]' : '[AUDIO]'}
                        </button>
                      )}
                      <button
                        onClick={() => togglePin(tab.id)}
                        className={`text-[9px] ${tab.pinned ? 'text-[#00ff66]' : 'text-[#2a502a] hover:text-[#00ff66]'}`}
                        title={tab.pinned ? 'Unpin' : 'Pin'}
                      >
                        [P]
                      </button>
                      <button
                        onClick={() => closeTab(tab.id)}
                        className="text-[10px] text-[#ff3333] hover:bg-[#ff3333]/20 px-1 transition-colors"
                        title="Close Tab"
                      >
                        [X]
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-[#008833]">
                    <span className="truncate max-w-[170px]">{domain}</span>
                    {isActive && (
                      <span className="text-[#00ff66] font-bold uppercase tracking-wider">
                        [ACTIVE]
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. DOMAIN-GROUPED TAB ACCORDION VIEW ── */}
      {viewMode === 'accordion' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <div className="text-[10px] text-[#008833] uppercase tracking-wider px-1">
            -- CLUSTERED BY HOSTNAME --
          </div>

          {Object.entries(domainGroups).map(([domain, groupTabs]) => {
            const isCollapsed = Boolean(collapsedDomains[domain]);
            const hasActive = groupTabs.some((t) => t.id === activeTabId);

            return (
              <div
                key={domain}
                className={`border transition-all ${
                  hasActive ? 'border-[#00ff66]/60 bg-[#091109]' : 'border-[#143314] bg-[#050905]'
                }`}
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleDomainCollapse(domain)}
                  className="w-full px-2.5 py-1.5 flex items-center justify-between text-left text-xs hover:bg-[#00ff66]/10 transition-colors"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[10px] text-[#00ff66]">
                      {isCollapsed ? '[+]' : '[-]'}
                    </span>
                    <span className="font-bold text-[#33ff77] truncate">{domain}</span>
                  </div>
                  <span className="text-[10px] text-[#008833] shrink-0 ml-1">
                    ({groupTabs.length})
                  </span>
                </button>

                {/* Collapsible Tabs List */}
                {!isCollapsed && (
                  <div className="border-t border-[#143314] divide-y divide-[#0e240e]">
                    {groupTabs.map((tab) => {
                      const isActive = tab.id === activeTabId;
                      const sec = getSecurityDot(tab.securityState);

                      return (
                        <div
                          key={tab.id}
                          onClick={() => activateTab(tab.id)}
                          className={`px-2.5 py-1.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-[#00ff66]/20 text-[#ffffff] font-semibold border-l-2 border-l-[#00ff66]'
                              : 'hover:bg-[#00ff66]/05 text-[#a0dfa0]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span style={{ color: sec.color }} className="text-[9px]">
                              {sec.char}
                            </span>
                            <span className="truncate text-[11px]">{tab.title || 'Tab'}</span>
                          </div>

                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => closeTab(tab.id)}
                              className="text-[9px] text-[#ff3333] hover:bg-[#ff3333]/20 px-1"
                              title="Close tab"
                            >
                              [x]
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer Telemetry ── */}
      <div className="p-2 border-t border-[#00ff66]/30 text-[9px] text-[#008833] flex items-center justify-between bg-[#040604]">
        <span>MODE: {viewMode.toUpperCase()}</span>
        <span>SECURITY: ACTIVE</span>
      </div>
    </div>
  );
}
