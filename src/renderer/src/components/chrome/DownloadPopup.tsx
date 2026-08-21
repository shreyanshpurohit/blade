import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBrowserStore } from '../../store/browserStore';
import { Icon } from '../common/Icon';
import { api } from '../../lib/api';

interface DownloadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  anchorPos?: { x: number; y: number } | null;
}

export function DownloadPopup({ isOpen, onClose, anchorRect, anchorPos }: DownloadPopupProps) {
  const downloads = useBrowserStore((s) => s.downloads);
  const openSettings = useBrowserStore((s) => s.openSettings);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rightPos = anchorPos
    ? Math.max(16, window.innerWidth - anchorPos.x)
    : anchorRect
    ? Math.max(16, window.innerWidth - anchorRect.right)
    : 60;
  const topPos = anchorPos ? anchorPos.y + 8 : anchorRect ? anchorRect.bottom + 8 : 56;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 select-none pointer-events-auto"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute w-[340px] max-h-[460px] glass-panel border border-white/15 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-menu-in"
        style={{
          right: `${rightPos}px`,
          top: `${topPos}px`,
          background: 'color-mix(in srgb, var(--color-surface-solid, #1e1914) 96%, var(--app-bg))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-1 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] flex items-center justify-center">
              <Icon name="download" size={13} strokeWidth={2} />
            </div>
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              Downloads
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onClose();
                openSettings('downloads');
              }}
              className="px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 rounded-md transition-colors"
            >
              Show all
            </button>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
            >
              <Icon name="x" size={13} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Download Items */}
        <div className="flex-1 overflow-y-auto space-y-1 max-h-[320px] pr-0.5">
          {downloads.slice(0, 8).map((d) => {
            const isProgressing = d.state === 'progressing';
            const isCompleted = d.state === 'completed';
            const isPaused = d.state === 'paused';
            const isFailed = d.state === 'interrupted' || d.state === 'cancelled';
            const pct = d.totalBytes ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0;

            return (
              <div
                key={d.id}
                onClick={() => {
                  if (isCompleted) void api.downloads.open(d.id);
                }}
                className="group flex flex-col gap-1.5 p-2.5 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer border border-transparent hover:border-white/[0.06]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : isFailed
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]'
                    }`}
                  >
                    <Icon
                      name={
                        isCompleted
                          ? 'check'
                          : isFailed
                          ? 'x'
                          : isPaused
                          ? 'pause'
                          : 'download'
                      }
                      size={15}
                      strokeWidth={2}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate text-[var(--color-text-primary)]">
                      {d.filename}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-secondary)]/60 truncate flex items-center gap-1.5">
                      <span>{formatBytes(d.totalBytes || d.receivedBytes)}</span>
                      <span>•</span>
                      <span
                        className={
                          isCompleted
                            ? 'text-emerald-400'
                            : isFailed
                            ? 'text-red-400'
                            : isPaused
                            ? 'text-amber-400'
                            : 'text-[var(--theme-primary)]'
                        }
                      >
                        {isCompleted
                          ? 'Complete'
                          : isPaused
                          ? 'Paused'
                          : isFailed
                          ? 'Failed'
                          : `${pct}%`}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {isProgressing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void api.downloads.pause(d.id);
                      }}
                      className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 rounded-md"
                      title="Pause"
                    >
                      <Icon name="pause" size={12} strokeWidth={2} />
                    </button>
                  )}

                  {isPaused && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void api.downloads.resume(d.id);
                      }}
                      className="p-1 text-[var(--theme-primary)] hover:bg-white/10 rounded-md"
                      title="Resume"
                    >
                      <Icon name="play" size={12} strokeWidth={2} />
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                {isProgressing && (
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--theme-primary)] rounded-full transition-all duration-200"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {downloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center text-[var(--color-text-secondary)]/50 mb-2">
                <Icon name="download" size={18} strokeWidth={1.5} />
              </div>
              <p className="text-[12px] font-medium text-[var(--color-text-primary)]">No downloads yet</p>
              <p className="text-[10.5px] text-[var(--color-text-secondary)]/60 mt-0.5">
                Files you download will appear here
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
          <button
            onClick={() => {
              onClose();
              openSettings('downloads');
            }}
            className="text-[var(--theme-primary)] hover:underline flex items-center gap-1 font-medium"
          >
            <span>Open downloads folder</span>
            <Icon name="external" size={11} />
          </button>
          <span className="text-[10px] text-[var(--color-text-secondary)]/40">Ctrl + J</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
