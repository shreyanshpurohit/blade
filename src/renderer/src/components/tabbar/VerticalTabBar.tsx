import { useEffect, useRef, useState } from 'react';
import type { TabState, TabGroupState } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { BladeLogo } from '../common/BladeLogo';
import { TabGroupMenuPopup } from './TabGroupMenuPopup';
import { api } from '../../lib/api';

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 160;
const MAX_WIDTH = 480;

export function VerticalTabBar() {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const groups = useBrowserStore((s) => s.groups);
  const {
    activateTab,
    closeTab,
    toggleMute,
    createTab,
    moveTab,
    addTabToGroup,
    createGroup,
    toggleGroupCollapse,
    newTabInGroup,
  } = useBrowserStore();

  const [activeGroupMenu, setActiveGroupMenu] = useState<{
    group: TabGroupState;
    anchorPos?: { x: number; y: number };
    anchorRect?: DOMRect;
  } | null>(null);

  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('lumen_vertical_tabs_width');
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(saved, 10))) : DEFAULT_WIDTH;
  });

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  // Drag-and-drop state for vertical tabs
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<'top' | 'bottom' | 'center' | null>(null);

  // Sync width to CSS variable & main process TabManager
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    void api.app.setSidebarWidth(width);
    localStorage.setItem('lumen_vertical_tabs_width', String(width));
  }, [width]);

  const onMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = moveEvent.clientX - startX.current;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onDoubleClickResize = () => {
    setWidth(DEFAULT_WIDTH);
  };

  const pinnedTabs = tabs.filter((t) => t.pinned);
  const regularTabs = tabs.filter((t) => !t.pinned);

  const openCtx = (e: React.MouseEvent, tab: TabState) => {
    e.preventDefault();
    e.stopPropagation();
    void api.tabs.showContextMenu(tab.id, { x: e.clientX, y: e.clientY });
  };

  const openEmptyCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void api.tabs.showTabBarContextMenu({ x: e.clientX, y: e.clientY });
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const handleDragStart = (e: React.DragEvent, tab: TabState) => {
    e.dataTransfer.setData('text/plain', tab.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(tab.id);
  };

  const handleDragOver = (e: React.DragEvent, tab: TabState) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const sourceId = draggingId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === tab.id) {
      setDragOverId(null);
      setDropPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    let pos: 'top' | 'bottom' | 'center' = 'center';
    if (ratio < 0.28) pos = 'top';
    else if (ratio > 0.72) pos = 'bottom';
    else pos = 'center';

    setDragOverId(tab.id);
    setDropPos(pos);
  };

  const handleDragLeave = (_e: React.DragEvent, tab: TabState) => {
    if (dragOverId === tab.id) {
      setDragOverId(null);
      setDropPos(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetTab: TabState) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    const currentDropPos = dropPos;

    setDraggingId(null);
    setDragOverId(null);
    setDropPos(null);

    if (!sourceId || sourceId === targetTab.id) return;

    const sourceIdx = tabs.findIndex((t) => t.id === sourceId);
    const targetIdx = tabs.findIndex((t) => t.id === targetTab.id);
    if (sourceIdx === -1 || targetIdx === -1) return;

    if (currentDropPos === 'center') {
      if (targetTab.groupId) {
        addTabToGroup(sourceId, targetTab.groupId);
      } else {
        createGroup('Group', '#6366f1', [targetTab.id, sourceId]);
      }
      moveTab(sourceId, sourceIdx < targetIdx ? targetIdx : targetIdx + 1);
    } else if (currentDropPos === 'top') {
      const destIdx = sourceIdx < targetIdx ? targetIdx : targetIdx;
      moveTab(sourceId, destIdx);
    } else {
      // 'bottom'
      const destIdx = sourceIdx < targetIdx ? targetIdx : targetIdx + 1;
      moveTab(sourceId, destIdx);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    setDropPos(null);
  };

  return (
    <aside
      className="absolute left-0 bottom-0 z-30 glass-panel border-r border-white/[0.08] flex flex-col select-none transition-[width] duration-75"
      style={{
        width: `${width}px`,
        top: 'var(--chrome-height, 56px)',
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderBottom: 'none',
      }}
      onContextMenu={openEmptyCtx}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button, [data-tab-id]')) return;
        createTab();
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08]"
        onContextMenu={openEmptyCtx}
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold tracking-wide text-[var(--color-text-primary)]">
            Tabs
          </span>
          <span className="text-[10px] font-medium text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded-full bg-white/[0.06]">
            {tabs.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* New Tab Button */}
          <button
            onClick={() => createTab()}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.10] transition-colors"
            title="New Tab (Ctrl+T)"
          >
            <Icon name="plus" size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Tabs List */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar"
        onContextMenu={openEmptyCtx}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('button, [data-tab-id]')) return;
          createTab();
        }}
      >
        {/* Pinned tabs row */}
        {pinnedTabs.length > 0 && (
          <div className="mb-2 pb-2 border-b border-white/[0.06]">
            <div className="text-[10px] uppercase font-semibold text-[var(--color-text-secondary)]/60 px-2 py-1 flex items-center gap-1">
              <Icon name="pin" size={10} strokeWidth={2} />
              <span>Pinned</span>
            </div>
            <div className="space-y-0.5">
              {pinnedTabs.map((tab) => (
                <VerticalTabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  domain={getDomain(tab.url)}
                  onActivate={activateTab}
                  onClose={closeTab}
                  onToggleMute={toggleMute}
                  onContextMenu={openCtx}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingId === tab.id}
                  dropPosition={dragOverId === tab.id ? dropPos : null}
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular tabs */}
        <div className="space-y-0.5">
          {(() => {
            const seenGroupIds = new Set<string>();
            return regularTabs.map((tab) => {
              const group = tab.groupId ? groups.find((g) => g.id === tab.groupId) : undefined;
              const isFirstInGroup = group && !seenGroupIds.has(group.id);
              if (group) seenGroupIds.add(group.id);

              const isCollapsed = group?.collapsed && tab.id !== activeTabId;
              const groupTabCount = group ? regularTabs.filter((t) => t.groupId === group.id).length : 0;

              return (
                <div key={tab.id} className="space-y-0.5">
                  {isFirstInGroup && group && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveGroupMenu({ group, anchorRect: rect });
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveGroupMenu({ group, anchorPos: { x: e.clientX, y: e.clientY } });
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
                        if (sourceId && group) {
                          addTabToGroup(sourceId, group.id);
                          const firstTabIdx = tabs.findIndex((t) => t.groupId === group.id);
                          if (firstTabIdx !== -1) {
                            moveTab(sourceId, firstTabIdx);
                          }
                        }
                        setDraggingId(null);
                        setDragOverId(null);
                        setDropPos(null);
                      }}
                      className="group/grp mt-2.5 mb-1 px-2 py-1 flex items-center justify-between rounded-xl select-none cursor-pointer transition-all hover:bg-white/[0.04]"
                      title={`${group.name} (${groupTabCount}) — Click to configure, drop tab here to add`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupCollapse(group.id);
                          }}
                          className="w-4 h-4 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                          title={group.collapsed ? 'Expand group' : 'Collapse group'}
                        >
                          <Icon
                            name={group.collapsed ? 'chevron-right' : 'chevron-down'}
                            size={11}
                            strokeWidth={2}
                          />
                        </button>

                        <div
                          className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-wide shadow-sm flex items-center gap-1.5 transition-all hover:brightness-115 active:scale-95"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${group.color} 26%, transparent)`,
                            color: group.color,
                            border: `1.5px solid color-mix(in srgb, ${group.color} 65%, transparent)`,
                          }}
                        >
                          <span className="truncate max-w-[120px]">{group.name}</span>
                        </div>

                        <span className="text-[9.5px] font-medium text-white/40 px-1 py-0.2 rounded-full bg-white/[0.06]">
                          {groupTabCount}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          newTabInGroup(group.id);
                        }}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 opacity-0 group-hover/grp:opacity-100 transition-all"
                        title="New tab in group"
                      >
                        <Icon name="plus" size={12} strokeWidth={2} />
                      </button>
                    </div>
                  )}

                  {!isCollapsed && (
                    <VerticalTabItem
                      tab={tab}
                      isActive={tab.id === activeTabId}
                      domain={getDomain(tab.url)}
                      onActivate={activateTab}
                      onClose={closeTab}
                      onToggleMute={toggleMute}
                      onContextMenu={openCtx}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      isDragging={draggingId === tab.id}
                      dropPosition={dragOverId === tab.id ? dropPos : null}
                    />
                  )}
                </div>
              );
            });
          })()}
        </div>

        {activeGroupMenu && (
          <TabGroupMenuPopup
            group={activeGroupMenu.group}
            anchorRect={activeGroupMenu.anchorRect}
            anchorPos={activeGroupMenu.anchorPos}
            onClose={() => setActiveGroupMenu(null)}
          />
        )}

        {/* Empty space filler for convenient right-click / double-click */}
        <div className="h-24 w-full cursor-default" onContextMenu={openEmptyCtx} />
      </div>

      {/* Resize Drag Handle */}
      <div
        onMouseDown={onMouseDownResize}
        onDoubleClick={onDoubleClickResize}
        title="Drag to resize sidebar (double-click to reset)"
        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-white/20 active:bg-[var(--theme-primary)] transition-colors z-40"
      />
    </aside>
  );
}

function VerticalTabItem({
  tab,
  isActive,
  domain,
  onActivate,
  onClose,
  onToggleMute,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragging,
  dropPosition,
}: {
  tab: TabState;
  isActive: boolean;
  domain: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onToggleMute: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, tab: TabState) => void;
  onDragStart?: (e: React.DragEvent, tab: TabState) => void;
  onDragOver?: (e: React.DragEvent, tab: TabState) => void;
  onDragLeave?: (e: React.DragEvent, tab: TabState) => void;
  onDrop?: (e: React.DragEvent, tab: TabState) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  dropPosition?: 'top' | 'bottom' | 'center' | null;
}) {
  const groups = useBrowserStore((s) => s.groups);
  const group = tab.groupId ? groups.find((g) => g.id === tab.groupId) : undefined;

  const isInternal = tab.url.startsWith('blade://') || tab.url.startsWith('lumen://') || tab.url.startsWith('about:') || !tab.url;
  const favicon = isInternal ? (
    <span className="w-4 h-4 grid place-items-center shrink-0">
      <BladeLogo size={13} />
    </span>
  ) : tab.favicon ? (
    <img src={tab.favicon} alt="" className="w-4 h-4 shrink-0 rounded-sm object-contain" />
  ) : (
    <span className="w-4 h-4 grid place-items-center text-[var(--color-text-secondary)] shrink-0">
      <Icon name="globe" size={13} strokeWidth={1.8} />
    </span>
  );

  return (
    <div
      data-tab-id={tab.id}
      draggable={true}
      onDragStart={(e) => onDragStart?.(e, tab)}
      onDragOver={(e) => onDragOver?.(e, tab)}
      onDragLeave={(e) => onDragLeave?.(e, tab)}
      onDrop={(e) => onDrop?.(e, tab)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onClick={() => onActivate(tab.id)}
      onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
      onContextMenu={(e) => onContextMenu(e, tab)}
      style={group ? { borderLeftColor: group.color, borderLeftWidth: '2.5px', borderLeftStyle: 'solid' } : undefined}
      className={`group h-9 flex items-center gap-2.5 px-3 rounded-xl transition-all duration-150 cursor-pointer select-none relative ${
        group ? 'ml-2' : ''
      } ${
        isActive
          ? 'bg-white/[0.14] text-[var(--color-text-primary)] shadow-sm font-medium'
          : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]'
      } ${tab.hibernated ? 'opacity-50' : ''} ${isDragging ? 'opacity-40 scale-[0.98] blur-[1px]' : ''} ${
        dropPosition === 'center' ? 'drop-indicator-group' : ''
      }`}
    >
      {/* Top drop insertion line */}
      {dropPosition === 'top' && (
        <div className="absolute left-2 right-2 top-0 h-1 drop-indicator-line z-30 pointer-events-none" />
      )}

      {/* Bottom drop insertion line */}
      {dropPosition === 'bottom' && (
        <div className="absolute left-2 right-2 bottom-0 h-1 drop-indicator-line z-30 pointer-events-none" />
      )}

      {tab.isLoading ? (
        <div className="w-4 h-4 border-[1.5px] border-[var(--color-text-secondary)] border-t-transparent animate-spin rounded-full shrink-0" />
      ) : (
        favicon
      )}

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[12px] truncate leading-tight">
          {tab.title || 'New Tab'}
        </span>
        {domain && !isInternal && (
          <span className="text-[10px] text-[var(--color-text-secondary)]/50 truncate leading-tight">
            {domain}
          </span>
        )}
      </div>

      {tab.hibernated && (
        <span className="shrink-0 text-[var(--color-text-secondary)]/50" title="Hibernated — click to wake">
          <Icon name="moon" size={11} />
        </span>
      )}

      {tab.audible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute(tab.id);
          }}
          className="shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          title={tab.muted ? 'Unmute tab' : 'Mute tab'}
        >
          <Icon name={tab.muted ? 'speaker-slash' : 'speaker'} size={12} />
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all hover:bg-white/20 ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        title="Close tab (Ctrl+W)"
      >
        <Icon name="x" size={11} strokeWidth={2} />
      </button>
    </div>
  );
}
