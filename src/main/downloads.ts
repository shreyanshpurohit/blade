import { app, session, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { IPC } from '../shared/types';
import type { DownloadItem } from '../shared/types';

const items = new Map<string, { item: Electron.DownloadItem; data: DownloadItem }>();

export function setupDownloadHandling() {
  session.defaultSession.on('will-download', (_event, item) => {
    const id = randomUUID();
    const data: DownloadItem = {
      id,
      url: item.getURL(),
      filename: item.getFilename(),
      path: '',
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      startedAt: Date.now(),
    };
    items.set(id, { item, data });

    item.setSavePath(`${app.getPath('downloads')}/${item.getFilename()}`);

    item.on('updated', (_e, state) => {
      data.receivedBytes = item.getReceivedBytes();
      data.totalBytes = item.getTotalBytes();
      data.path = item.getSavePath();
      data.state = item.isPaused() ? 'paused' : state === 'interrupted' ? 'interrupted' : 'progressing';
      broadcast();
    });

    item.once('done', (_e, state) => {
      data.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted';
      data.receivedBytes = item.getReceivedBytes();
      data.path = item.getSavePath();
      broadcast();
    });

    broadcast();
  });
}

function broadcast() {
  const list = listDownloads();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.DownloadsChanged, list);
  }
}

export function listDownloads(): DownloadItem[] {
  return [...items.values()].map((v) => ({ ...v.data })).sort((a, b) => b.startedAt - a.startedAt);
}

export function pauseDownload(id: string) {
  items.get(id)?.item.pause();
}

export function resumeDownload(id: string) {
  const entry = items.get(id);
  if (entry?.item.canResume()) entry.item.resume();
}

export function cancelDownload(id: string) {
  items.get(id)?.item.cancel();
}
