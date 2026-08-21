import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Icon, type IconName } from '../common/Icon';
import { BladeLogo } from '../common/BladeLogo';
import type { DownloadItem } from '@shared/types';
import { useBrowserStore } from '../../store/browserStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename: string): IconName {
  const ext = filename.split('.').pop()?.toLowerCase();
  return 'doc';
}

export function DownloadsPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [historicalDownloads, setHistoricalDownloads] = useState<DownloadItem[]>([]);
  const activeDownloads = useBrowserStore(s => Object.values(s.downloads));

  useEffect(() => {
    const fetchDownloads = async () => {
      const list = await api.downloads.list();
      setHistoricalDownloads(list);
    };
    fetchDownloads();
  }, []);

  const activeIds = new Set(activeDownloads.map(d => d.id));
  const allDownloads = [
    ...activeDownloads,
    ...historicalDownloads.filter(d => !activeIds.has(d.id))
  ].sort((a, b) => b.startedAt - a.startedAt);

  const filteredDownloads = allDownloads.filter(d => {
    if (filter === 'all') return true;
    if (filter === 'active') return d.state === 'progressing' || d.state === 'paused';
    if (filter === 'completed') return d.state === 'completed';
    if (filter === 'failed') return d.state === 'interrupted' || d.state === 'cancelled';
    return true;
  });

  const handlePauseResume = async (d: DownloadItem) => {
    if (d.state === 'progressing') await api.downloads.pause(d.id);
    else if (d.state === 'paused') await api.downloads.resume(d.id);
  };

  const handleCancel = async (id: string) => {
    await api.downloads.cancel(id);
  };

  const handleOpen = async (id: string) => {
    await api.downloads.open(id);
  };

  const handleRemove = async (id: string) => {
    setHistoricalDownloads(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden text-[var(--color-text-primary)]">
      <div className="flex-none px-8 py-6 max-w-4xl w-full mx-auto flex items-center justify-between mt-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
            <BladeLogo className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-semibold">Downloads</h1>
          <span className="px-2 py-1 rounded-full bg-white/[0.06] text-xs font-medium text-[var(--color-text-secondary)]">
            {allDownloads.length} items
          </span>
        </div>
      </div>

      <div className="flex-none px-8 pb-4 max-w-4xl w-full mx-auto flex gap-6 border-b border-white/[0.06] text-sm font-medium">
        {(['all', 'active', 'completed', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pb-4 border-b-2 transition-colors capitalize ${
              filter === f
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto px-8 py-6">
          {filteredDownloads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--color-text-secondary)]">
              <Icon name="download" size={48} className="mb-4 opacity-50" />
              <p className="text-lg">No downloads found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDownloads.map(download => {
                const isProgressing = download.state === 'progressing';
                const isPaused = download.state === 'paused';
                const isActive = isProgressing || isPaused;
                const isCompleted = download.state === 'completed';
                
                const percent = download.totalBytes > 0 
                  ? Math.round((download.receivedBytes / download.totalBytes) * 100) 
                  : 0;

                const time = new Date(download.startedAt).toLocaleString();

                return (
                  <div key={download.id} className="glass-panel p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-start gap-4 group hover:bg-white/[0.04] transition-colors">
                    <div className="flex-none w-12 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center text-[var(--color-text-secondary)]">
                      <Icon name={getFileIcon(download.filename)} size={24} />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium truncate">{download.filename}</span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isActive && (
                            <>
                              <button 
                                onClick={() => handlePauseResume(download)}
                                className="p-1.5 rounded hover:bg-white/10 text-[var(--color-text-secondary)]"
                                title={isPaused ? "Resume" : "Pause"}
                              >
                                <Icon name={isPaused ? "play" : "pause"} size={16} />
                              </button>
                              <button 
                                onClick={() => handleCancel(download.id)}
                                className="p-1.5 rounded hover:bg-white/10 text-[var(--color-text-secondary)]"
                                title="Cancel"
                              >
                                <Icon name="x" size={16} />
                              </button>
                            </>
                          )}
                          {isCompleted && (
                            <button 
                              onClick={() => handleOpen(download.id)}
                              className="p-1.5 rounded hover:bg-white/10 text-[var(--color-text-secondary)]"
                              title="Show in folder"
                            >
                              <Icon name="folder" size={16} />
                            </button>
                          )}
                          {!isActive && (
                            <button 
                              onClick={() => handleRemove(download.id)}
                              className="p-1.5 rounded hover:bg-white/10 text-[var(--color-text-secondary)]"
                              title="Remove from list"
                            >
                              <Icon name="x" size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {download.url}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${
                          isCompleted ? 'bg-green-500/10 text-green-400' :
                          isActive ? 'bg-blue-500/10 text-blue-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {download.state}
                        </span>
                        
                        <span className="text-[var(--color-text-secondary)]">
                          {formatBytes(download.receivedBytes)} {download.totalBytes > 0 && `/ ${formatBytes(download.totalBytes)}`}
                        </span>

                        <span className="text-[var(--color-text-secondary)] before:content-['•'] before:mr-3">
                          {time}
                        </span>
                      </div>

                      {isActive && download.totalBytes > 0 && (
                        <div className="mt-1 h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${isPaused ? 'bg-yellow-400' : 'bg-blue-400'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
