import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../common/Icon';

export interface SidebarContextItem {
  label: string;
  icon: IconName;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function SidebarContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: SidebarContextItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('blur', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('blur', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  const sidebar = document.querySelector<HTMLElement>('[data-sidebar-surface]')?.getBoundingClientRect();
  const menuWidth = 190;
  const menuHeight = items.length * 36 + 12;
  const left = sidebar
    ? Math.max(sidebar.left + 8, Math.min(x, sidebar.right - menuWidth - 8))
    : Math.min(x, window.innerWidth - menuWidth - 8);
  const top = sidebar
    ? Math.max(sidebar.top + 8, Math.min(y, sidebar.bottom - menuHeight - 8))
    : Math.min(y, window.innerHeight - menuHeight - 8);

  return createPortal(
    (
    <div
      className="fixed inset-0 z-[100]"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className="sidebar-context-menu absolute min-w-[190px] p-1.5 rounded-2xl shadow-2xl animate-menu-in"
        style={{ left, top }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`sidebar-context-item w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] rounded-xl transition-colors disabled:opacity-40 disabled:pointer-events-none ${item.danger ? 'is-danger' : ''}`}
          >
            <Icon name={item.icon} size={14} strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
    ),
    document.body,
  );
}
