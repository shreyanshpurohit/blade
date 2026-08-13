import { useEffect, useState } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import type { SidebarPanel } from '@shared/types';
import { BookmarksPanel } from './BookmarksPanel';
import { HistoryPanel } from './HistoryPanel';
import { ShieldsSidebarPanel } from '../shields/ShieldsSidebarPanel';
import { TabsPanel } from './TabsPanel';
import { Icon, IconName } from '../common/Icon';
import { SidebarContextMenu } from './SidebarContextMenu';

const PANELS: { key: SidebarPanel; label: string; icon: IconName }[] = [
  { key: 'tabs', label: 'Tabs', icon: 'layers' },
  { key: 'shields', label: 'Shields', icon: 'shield-check' },
  { key: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { key: 'history', label: 'History', icon: 'clock' },
];

export function Sidebar() {
  const { sidebarOpen, sidebarPinned, sidebarPanel, setSidebar, setSidebarPinned, openSettings } = useBrowserStore();
  const [panel, setPanel] = useState<SidebarPanel>(sidebarPanel ?? 'tabs');
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  
  useEffect(() => {
    if (sidebarPanel === 'downloads') {
      openSettings('downloads');
      return;
    }
    if (sidebarPanel) {
      setPanel(sidebarPanel);
    }
  }, [sidebarPanel, openSettings]);

  return (
    <div
      className={`absolute w-[320px] z-30 glass-panel
        flex flex-col transition-all duration-300 ease-out select-none
        ${sidebarPinned ? 'sidebar-pinned' : 'sidebar-docked'}
        ${sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}
      data-sidebar-surface="true"
      onContextMenu={(event) => {
        event.preventDefault();
        setContext({ x: event.clientX, y: event.clientY });
      }}
      style={{
        top: 'var(--chrome-height, 92px)',
        left: '0',
        bottom: '0',
        borderRadius: sidebarPinned ? '0' : '0 var(--radius-glass) var(--radius-glass) 0',
        borderLeft: sidebarPinned ? '1px solid var(--color-border-light)' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex flex-col border-b border-white/[0.08]">
        <div className="flex items-center justify-between p-3">
          <span className="text-[var(--color-text-primary)] text-[13px] font-semibold">
            {PANELS.find((p) => p.key === panel)?.label ?? 'Panel'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarPinned(!sidebarPinned)}
              className={`nav-pill w-7 h-7 ${sidebarPinned ? 'bg-white/15 text-white' : ''}`}
              title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              aria-label={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
            >
              <Icon name={sidebarPinned ? 'pin-fill' : 'pin'} size={14} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => setSidebar(false)}
              className="nav-pill w-7 h-7"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <Icon name="x" size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Panel switcher */}
        <div className="grid grid-cols-4 px-2 pb-2 gap-1">
          {PANELS.map((p) => {
            const active = panel === p.key;
            return (
              <button
                key={p.key}
                onClick={() => {
                  setPanel(p.key);
                  setSidebar(true, p.key);
                }}
                title={p.label}
                className={`h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${
                  active
                    ? 'bg-white/[0.12] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]'
                }`}
              >
                <Icon name={p.icon} size={16} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-3">
        {panel === 'tabs' && <TabsPanel />}
        {panel === 'shields' && <ShieldsSidebarPanel />}
        {panel === 'bookmarks' && <BookmarksPanel />}
        {panel === 'history' && <HistoryPanel />}
      </div>
      {context && (
        <SidebarContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            { label: 'Show tabs', icon: 'layers', onClick: () => setSidebar(true, 'tabs') },
            { label: 'Show history', icon: 'clock', onClick: () => setSidebar(true, 'history') },
            { label: 'Show bookmarks', icon: 'bookmark', onClick: () => setSidebar(true, 'bookmarks') },
            { label: 'Close sidebar', icon: 'x', onClick: () => setSidebar(false) },
          ]}
        />
      )}
    </div>
  );
}
