import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBrowserStore } from '../../store/browserStore';
import type { TabGroupState } from '@shared/types';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

export const GROUP_PALETTE = [
  { id: 'slate', hex: '#94a3b8', label: 'Grey' },
  { id: 'blue', hex: '#60a5fa', label: 'Blue' },
  { id: 'red', hex: '#f87171', label: 'Red' },
  { id: 'yellow', hex: '#facc15', label: 'Yellow' },
  { id: 'green', hex: '#4ade80', label: 'Green' },
  { id: 'pink', hex: '#f472b6', label: 'Pink' },
  { id: 'purple', hex: '#c084fc', label: 'Purple' },
  { id: 'cyan', hex: '#22d3ee', label: 'Cyan' },
  { id: 'orange', hex: '#fb923c', label: 'Orange' },
];

interface TabGroupMenuPopupProps {
  group: TabGroupState;
  onClose: () => void;
  anchorPos?: { x: number; y: number } | null;
  anchorRect?: DOMRect | null;
}

export function TabGroupMenuPopup({
  group,
  onClose,
  anchorPos,
  anchorRect,
}: TabGroupMenuPopupProps) {
  const {
    renameGroup,
    setGroupColor,
    deleteGroup,
    closeGroup,
    newTabInGroup,
    moveGroupToNewWindow,
  } = useBrowserStore();

  const [name, setName] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(group.name);
  }, [group.name]);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    renameGroup(group.id, val.trim() || 'Group');
  };

  const handleColorChange = (hex: string) => {
    setGroupColor(group.id, hex);
  };

  // Compute position
  const targetX = anchorPos ? anchorPos.x : anchorRect ? anchorRect.left : 120;
  const targetY = anchorPos ? anchorPos.y : anchorRect ? anchorRect.bottom + 6 : 60;

  const menuWidth = 260;
  const menuHeight = 310;

  const left = Math.min(Math.max(12, targetX), window.innerWidth - menuWidth - 12);
  const top = Math.min(Math.max(12, targetY), window.innerHeight - menuHeight - 12);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] select-none pointer-events-auto"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        className="absolute w-[260px] glass-panel border border-white/15 rounded-2xl p-2.5 shadow-2xl flex flex-col gap-2.5 animate-menu-in text-[12px]"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          background: 'color-mix(in srgb, var(--color-surface-solid, #12161a) 96%, var(--app-bg))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. Group Name Input ── */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                inputRef.current?.blur();
                if (e.key === 'Escape') onClose();
              }
            }}
            placeholder="Group name..."
            className="w-full h-8 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12]
              border border-white/15 focus:border-[var(--group-color)]
              text-[12px] font-semibold outline-none text-[var(--color-text-primary)] transition-all"
            style={{
              '--group-color': group.color,
            } as React.CSSProperties}
          />
        </div>

        {/* ── 2. Color Palette Dots ── */}
        <div className="flex items-center justify-between px-1 py-0.5">
          {GROUP_PALETTE.map((c) => {
            const isSelected = group.color.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.id}
                type="button"
                title={c.label}
                onClick={() => handleColorChange(c.hex)}
                className="w-5 h-5 rounded-full relative flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                style={{ backgroundColor: c.hex }}
              >
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-black/50 border border-white/80" />
                )}
              </button>
            );
          })}
        </div>

        <div className="h-px bg-white/[0.08] mx-0.5" />

        {/* ── 3. Group Action Items ── */}
        <div className="flex flex-col space-y-0.5">
          <GroupMenuItem
            icon="plus"
            label="New tab in group"
            shortcut="Shift+Alt+C"
            onClick={() => {
              newTabInGroup(group.id);
              onClose();
            }}
          />
          <GroupMenuItem
            icon="window"
            label="Move group to new window"
            onClick={() => {
              moveGroupToNewWindow(group.id);
              onClose();
            }}
          />
          <GroupMenuItem
            icon="x"
            label="Close group"
            shortcut="Shift+Alt+W"
            onClick={() => {
              closeGroup(group.id);
              onClose();
            }}
          />
        </div>

        <div className="h-px bg-white/[0.08] mx-0.5" />

        {/* ── 4. Ungroup and Delete ── */}
        <div className="flex flex-col space-y-0.5">
          <GroupMenuItem
            icon="external"
            label="Ungroup"
            onClick={() => {
              deleteGroup(group.id);
              onClose();
            }}
          />
          <GroupMenuItem
            icon="trash"
            label="Delete group"
            danger
            onClick={() => {
              closeGroup(group.id);
              onClose();
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GroupMenuItem({
  icon,
  label,
  shortcut,
  onClick,
  danger,
}: {
  icon: IconName;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-500/15'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.07]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon name={icon} size={14} strokeWidth={1.8} className="shrink-0 opacity-80" />
        <span className="truncate">{label}</span>
      </div>
      {shortcut && (
        <span className="text-[10px] text-[var(--color-text-secondary)]/50 font-mono shrink-0 ml-2">
          {shortcut}
        </span>
      )}
    </button>
  );
}
