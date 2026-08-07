import { useEffect, useState } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import type { SidebarPanel } from '@shared/types';
import { BookmarksPanel } from './BookmarksPanel';
import { HistoryPanel } from './HistoryPanel';
import { DownloadsPanel } from './DownloadsPanel';
import { ShieldsSidebarPanel } from '../shields/ShieldsSidebarPanel';
import { TabsPanel } from './TabsPanel';
import { Icon, IconName } from '../common/Icon';

const PANELS: { key: SidebarPanel; label: string; icon: IconName }[] = [
  { key: 'tabs', label: 'Tabs', icon: 'layers' },
  { key: 'shields', label: 'Shields', icon: 'shield-check' },
  { key: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { key: 'history', label: 'History', icon: 'clock' },
  { key: 'downloads', label: 'Downloads', icon: 'download' },
];

export function Sidebar() {
  const { sidebarOpen, sidebarPanel, setSidebar, bookmarksBarVisible } = useBrowserStore();
  const tabs = useBrowserStore((s) => s.tabs);
  const [panel, setPanel] = useState<SidebarPanel>(sidebarPanel ?? 'tabs');
  
  const showTabStrip = tabs.length > 1;
  const CHROME_TOP = showTabStrip ? 105 : 60;
  const BOOKMARKS_HEIGHT = 33;
  const topOffset = bookmarksBarVisible ? CHROME_TOP + BOOKMARKS_HEIGHT : CHROME_TOP;

  useEffect(() => {
    if (sidebarPanel) {
      setPanel(sidebarPanel);
    }
  }, [sidebarPanel]);

  return (
    <div
      className={`absolute left-0 bottom-0 w-[320px] z-30 glass-panel
        flex flex-col transition-all duration-300 ease-out select-none
        ${sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}
      style={{
        top: topOffset,
        borderRadius: '0 var(--radius-glass) var(--radius-glass) 0',
        borderLeft: 'none',
      }}
    >
      {/* Header */}
      <div className="flex flex-col border-b border-white/[0.08]">
        <div className="flex items-center justify-between p-3">
          <span className="text-[var(--color-text-primary)] text-[13px] font-semibold">
            {PANELS.find((p) => p.key === panel)?.label ?? 'Panel'}
          </span>
          <button
            onClick={() => setSidebar(false)}
            className="nav-pill w-7 h-7"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Panel switcher */}
        <div className="grid grid-cols-5 px-2 pb-2 gap-1">
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
        {panel === 'downloads' && <DownloadsPanel />}
      </div>
    </div>
  );
}
