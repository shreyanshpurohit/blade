import { useState } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import { api } from '../../lib/api';
import type { DownloadItem } from '@shared/types';
import { SidebarContextMenu } from './SidebarContextMenu';

export function DownloadsPanel() {
  const downloads = useBrowserStore((s) => s.downloads);
  const [context, setContext] = useState<{ x: number; y: number; download: DownloadItem } | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="px-2 py-1.5 text-ui-heading">Downloads</div>
      {downloads.length === 0 && (
        <p className="text-ui-body px-2 py-6 text-center opacity-60">No downloads yet.</p>
      )}
      {downloads.map((d) => (
        <div
          key={d.id}
          className="glass-control p-2.5 flex flex-col gap-1.5"
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setContext({ x: event.clientX, y: event.clientY, download: d });
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => d.state === 'completed' && void api.downloads.open(d.id)}
              className="text-[13px] font-medium text-[var(--color-text-primary)] truncate text-left"
            >
              {d.filename}
            </button>
            <span className="text-[10px] text-[var(--color-text-secondary)] shrink-0">{formatBytes(d.receivedBytes)} / {formatBytes(d.totalBytes)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                d.state === 'completed' ? 'bg-emerald-500' : d.state === 'interrupted' ? 'bg-red-400' : 'bg-blue-500'
              }`}
              style={{ width: d.totalBytes ? `${(d.receivedBytes / d.totalBytes) * 100}%` : '20%' }}
            />
          </div>
          <div className="flex gap-1">
            {d.state === 'progressing' && (
              <DlButton label="Pause" onClick={() => void api.downloads.pause(d.id)} />
            )}
            {d.state === 'paused' && (
              <DlButton label="Resume" onClick={() => void api.downloads.resume(d.id)} />
            )}
            {(d.state === 'progressing' || d.state === 'paused') && (
              <DlButton label="Cancel" onClick={() => void api.downloads.cancel(d.id)} />
            )}
            {d.state === 'completed' && (
              <DlButton label="Show in folder" onClick={() => void api.downloads.open(d.id)} />
            )}
          </div>
        </div>
      ))}
      {context && (
        <SidebarContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            { label: 'Show in folder', icon: 'folder-open', disabled: context.download.state !== 'completed', onClick: () => void api.downloads.open(context.download.id) },
            { label: 'Cancel download', icon: 'x', danger: true, disabled: !['progressing', 'paused'].includes(context.download.state), onClick: () => void api.downloads.cancel(context.download.id) },
          ]}
        />
      )}
    </div>
  );
}

function DlButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] px-2 py-1 rounded-md text-[var(--color-text-secondary)] hover:bg-black/[0.06] dark:hover:bg-white/10">
      {label}
    </button>
  );
}

function formatBytes(n: number): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
