import { useEffect, useRef, useState } from 'react';
import type { TabState, TabGroupState } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import Tab from './Tab';
import { Icon } from '../common/Icon';
import { TabGroupMenuPopup } from './TabGroupMenuPopup';

export function TabBar() {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const createTab = useBrowserStore((s) => s.createTab);
  const moveTab = useBrowserStore((s) => s.moveTab);
  const addTabToGroup = useBrowserStore((s) => s.addTabToGroup);
  const createGroup = useBrowserStore((s) => s.createGroup);
  const groups = useBrowserStore((s) => s.groups);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Group menu modal state
  const [activeGroupMenu, setActiveGroupMenu] = useState<{
    group: TabGroupState;
    anchorPos?: { x: number; y: number };
    anchorRect?: DOMRect;
  } | null>(null);

  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<'left' | 'right' | 'center' | null>(null);

  const pinnedTabs = tabs.filter((t) => t.pinned);
  const regularTabs = tabs.filter((t) => !t.pinned);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const syncScrollState = () => {
      setCanScrollLeft(element.scrollLeft > 2);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };

    syncScrollState();
    element.addEventListener('scroll', syncScrollState, { passive: true });
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', syncScrollState);
      observer.disconnect();
    };
  }, [regularTabs.length, pinnedTabs.length]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !activeTabId) return;
    const active = element.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    window.setTimeout(() => {
      setCanScrollLeft(element.scrollLeft > 2);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    }, 220);
  }, [activeTabId]);

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
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    let pos: 'left' | 'right' | 'center' = 'center';
    if (ratio < 0.28) pos = 'left';
    else if (ratio > 0.72) pos = 'right';
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
      // Group merge when dropped in the middle of a tab
      if (targetTab.groupId) {
        addTabToGroup(sourceId, targetTab.groupId);
      } else {
        createGroup('Group', '#6366f1', [targetTab.id, sourceId]);
      }
      moveTab(sourceId, sourceIdx < targetIdx ? targetIdx : targetIdx + 1);
    } else if (currentDropPos === 'left') {
      const destIdx = sourceIdx < targetIdx ? targetIdx : targetIdx;
      moveTab(sourceId, destIdx);
    } else {
      // 'right'
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
    <div className="flex items-center gap-1 px-3 py-1.5 flex-1 min-w-0 drag-region overflow-hidden">
      {pinnedTabs.length > 0 && (
        <>
          <div className="flex items-center gap-1 shrink-0 no-drag">
            {pinnedTabs.map((tab) => (
              <Tab
                key={tab.id}
                tab={tab}
                active={tab.id === activeTabId}
                compact
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
          <div className="w-px h-4 bg-white/10 shrink-0 mx-1" />
        </>
      )}

      <div className="flex items-center gap-1 flex-1 min-w-0 no-drag">
        {canScrollLeft && (
          <button
            type="button"
            title="Scroll tabs left"
            aria-label="Scroll tabs left"
            onClick={() => scrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
            className="nav-pill no-drag shrink-0 w-7 h-7"
          >
            <Icon name="chevron-left" size={13} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(() => {
            const seenGroupIds = new Set<string>();
            return regularTabs.map((tab) => {
              const group = tab.groupId ? groups.find((g) => g.id === tab.groupId) : undefined;
              const isFirstInGroup = group && !seenGroupIds.has(group.id);
              if (group) seenGroupIds.add(group.id);

              const isCollapsed = group?.collapsed && tab.id !== activeTabId;
              const groupTabCount = group ? regularTabs.filter((t) => t.groupId === group.id).length : 0;

              return (
                <div
                  key={tab.id}
                  className={`flex items-center gap-1 min-w-0 shrink-0 transition-all ${
                    isCollapsed ? 'w-0 overflow-hidden opacity-0 pointer-events-none' : 'flex-1'
                  }`}
                  style={{ maxWidth: isCollapsed ? 0 : 200 }}
                >
                  {isFirstInGroup && group && (
                    <button
                      type="button"
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
                      className="tab-group-chip shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold tracking-wide select-none cursor-pointer transition-all hover:brightness-110 active:scale-95 shadow-sm border border-white/10"
                      style={{
                        '--group-color': group.color,
                        backgroundColor: `color-mix(in srgb, ${group.color} 20%, transparent)`,
                        color: group.color,
                        borderColor: `color-mix(in srgb, ${group.color} 40%, transparent)`,
                      } as React.CSSProperties}
                      title={`${group.name} (${groupTabCount}) — Click to configure, drop tab here to add`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                      <span className="truncate max-w-[80px]">{group.name}</span>
                      <span className="text-[9.5px] opacity-70 px-1 py-0.2 rounded-full bg-white/10">{groupTabCount}</span>
                    </button>
                  )}
                  {!isCollapsed && (
                    <div
                      data-tab-id={tab.id}
                      className="flex-1 min-w-[100px] animate-tab-enter overflow-hidden"
                    >
                      <Tab
                        tab={tab}
                        active={tab.id === activeTabId}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        isDragging={draggingId === tab.id}
                        dropPosition={dragOverId === tab.id ? dropPos : null}
                      />
                    </div>
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

        {canScrollRight && (
          <button
            type="button"
            title="Scroll tabs right"
            aria-label="Scroll tabs right"
            onClick={() => scrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
            className="nav-pill no-drag shrink-0 w-7 h-7"
          >
            <Icon name="chevron-right" size={13} />
          </button>
        )}

        <button
          onClick={() => createTab()}
          title="New Tab (Ctrl+T)"
          aria-label="New Tab"
          className="nav-pill no-drag shrink-0 ml-1"
        >
          <Icon name="plus" size={13} />
        </button>
      </div>
    </div>
  );
}
