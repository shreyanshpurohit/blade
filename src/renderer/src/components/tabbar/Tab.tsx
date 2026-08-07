import { useState } from 'react';
import type { TabState } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';

interface TabProps {
  tab: TabState;
  active: boolean;
  compact?: boolean;
}

export default function Tab({ tab, active, compact }: TabProps) {
  const { activateTab, closeTab, togglePin, toggleMute, hibernate } = useBrowserStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const isSettings = tab.url.startsWith('lumen://settings');
  const favicon = isSettings ? (
    <span className="w-4 h-4 grid place-items-center text-[var(--color-text-secondary)] shrink-0">
      <Icon name="sliders" size={13} strokeWidth={1.8} />
    </span>
  ) : tab.favicon ? (
    <img src={tab.favicon} alt="" className="w-4 h-4 shrink-0 rounded-sm" />
  ) : (
    <span className="w-4 h-4 grid place-items-center text-[var(--color-text-secondary)] shrink-0">
      <Icon name="globe" size={13} strokeWidth={1.8} />
    </span>
  );

  return (
    <div
      onClick={() => activateTab(tab.id)}
      onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuPos({ x: e.clientX, y: e.clientY });
        setMenuOpen(true);
      }}
      className={`group h-8 flex items-center gap-2 px-3 rounded-lg transition-all duration-200 cursor-pointer select-none relative ${
        active
          ? 'bg-white/[0.12] text-[var(--color-text-primary)] shadow-sm'
          : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]'
      } ${tab.hibernated ? 'opacity-50' : ''} ${compact ? 'w-9 justify-center px-0' : 'w-full'}`}
    >
      {tab.isLoading ? (
        <div className="w-3.5 h-3.5 border-[1.5px] border-[var(--color-text-secondary)] border-t-transparent animate-spin rounded-full shrink-0" />
      ) : (
        favicon
      )}

      {!compact && (
        <>
          <span className="flex-1 text-[12px] font-medium truncate min-w-0">
            {tab.title || 'New Tab'}
          </span>

          {tab.hibernated && (
            <span className="shrink-0 text-[var(--color-text-secondary)]/50" title="Hibernated — click to wake">
              <Icon name="moon" size={11} />
            </span>
          )}

          {tab.audible && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute(tab.id);
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
              closeTab(tab.id);
            }}
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all hover:bg-white/15 ${
              active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <Icon name="x" size={10} strokeWidth={2} />
          </button>
        </>
      )}

      {/* Context menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(false);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(false);
          }}
        >
          <div
            className="absolute glass-panel p-1.5 min-w-[180px] z-50 animate-menu-in"
            style={{ left: menuPos.x, top: menuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <CtxItem
              label={tab.pinned ? 'Unpin Tab' : 'Pin Tab'}
              onClick={() => { togglePin(tab.id); setMenuOpen(false); }}
            />
            <CtxItem
              label="Duplicate Tab"
              onClick={() => { useBrowserStore.getState().createTab(tab.url); setMenuOpen(false); }}
            />
            <CtxItem
              label="Hibernate Tab"
              onClick={() => { hibernate(tab.id); setMenuOpen(false); }}
            />
            <div className="my-1 h-px bg-white/[0.08] mx-2" />
            <CtxItem
              label="Close Tab"
              onClick={() => { closeTab(tab.id); setMenuOpen(false); }}
              danger
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CtxItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors
        hover:bg-white/10
        ${danger ? 'text-[var(--color-destructive)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
    >
      {label}
    </button>
  );
}
