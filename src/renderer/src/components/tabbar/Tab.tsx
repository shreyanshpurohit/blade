import type { TabState } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { BladeLogo } from '../common/BladeLogo';
import { api } from '../../lib/api';

interface TabProps {
  tab: TabState;
  active: boolean;
  compact?: boolean;
  onDragStart?: (e: React.DragEvent, tab: TabState) => void;
  onDragOver?: (e: React.DragEvent, tab: TabState) => void;
  onDragLeave?: (e: React.DragEvent, tab: TabState) => void;
  onDrop?: (e: React.DragEvent, tab: TabState) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  dropPosition?: 'left' | 'right' | 'center' | null;
}

export default function Tab({
  tab,
  active,
  compact = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragging,
  dropPosition,
}: TabProps) {
  const { activateTab, closeTab, toggleMute } = useBrowserStore();
  const groups = useBrowserStore((s) => s.groups);
  const group = tab.groupId ? groups.find((g) => g.id === tab.groupId) : undefined;

  const isInternal = tab.url.startsWith('blade://') || tab.url.startsWith('lumen://') || tab.url.startsWith('about:') || !tab.url;
  const favicon = isInternal ? (
    <span className="w-4 h-4 grid place-items-center shrink-0">
      <BladeLogo size={13} />
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
      draggable={true}
      onDragStart={(e) => onDragStart?.(e, tab)}
      onDragOver={(e) => onDragOver?.(e, tab)}
      onDragLeave={(e) => onDragLeave?.(e, tab)}
      onDrop={(e) => onDrop?.(e, tab)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onClick={() => activateTab(tab.id)}
      onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void api.tabs.showContextMenu(tab.id, { x: e.clientX, y: e.clientY });
      }}
      className={`group h-8 flex items-center gap-2 px-3 rounded-lg transition-all duration-200 ease-out cursor-pointer select-none relative ${
        active
          ? 'bg-white/[0.12] text-[var(--color-text-primary)] shadow-sm'
          : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.06]'
      } ${tab.hibernated ? 'opacity-50' : ''} ${compact ? 'w-9 justify-center px-0' : 'w-full'} ${
        isDragging ? 'opacity-40 scale-[0.96] blur-[1px]' : ''
      } ${
        dropPosition === 'center' ? 'drop-indicator-group' : ''
      }`}
    >
      {/* Group colored bottom underline bar (extends seamlessly across tab gaps) */}
      {group && !compact && (
        <div
          className="absolute -bottom-[1px] -left-1 -right-1 h-[2.5px] z-20 pointer-events-none"
          style={{ backgroundColor: group.color }}
        />
      )}

      {/* Left drop insertion line */}
      {dropPosition === 'left' && (
        <div className="absolute left-0 top-1 bottom-1 w-1 drop-indicator-line z-30 pointer-events-none" />
      )}

      {/* Right drop insertion line */}
      {dropPosition === 'right' && (
        <div className="absolute right-0 top-1 bottom-1 w-1 drop-indicator-line z-30 pointer-events-none" />
      )}

      {/* Compact group color dot */}
      {compact && group && (
        <span
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: group.color }}
        />
      )}
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
    </div>
  );
}
