import { app, session, BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { IPC } from '../shared/types';
import type { DownloadItem } from '../shared/types';
import { getDb } from './store/database';

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
    persistDownload(data);

    item.setSavePath(path.join(app.getPath('downloads'), item.getFilename()));

    item.on('updated', (_e, state) => {
      data.receivedBytes = item.getReceivedBytes();
      data.totalBytes = item.getTotalBytes();
      data.path = item.getSavePath();
      data.state = item.isPaused() ? 'paused' : state === 'interrupted' ? 'interrupted' : 'progressing';
      persistDownload(data);
      broadcast();
    });

    item.once('done', (_e, state) => {
      data.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted';
      data.receivedBytes = item.getReceivedBytes();
      data.path = item.getSavePath();
      persistDownload(data);
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
  let saved: DownloadItem[] = [];
  try {
    const rows = getDb().prepare('SELECT id, url, filename, path, total_bytes, received_bytes, state, started_at FROM downloads ORDER BY started_at DESC').all() as Array<Record<string, unknown>>;
    saved = rows.map((row) => ({
      id: String(row.id),
      url: String(row.url ?? ''),
      filename: String(row.filename),
      path: String(row.path ?? ''),
      totalBytes: Number(row.total_bytes ?? 0),
      receivedBytes: Number(row.received_bytes ?? 0),
      state: String(row.state) as DownloadItem['state'],
      startedAt: Number(row.started_at),
    }));
  } catch {
    // The database may be unavailable during shutdown.
  }

  const live = [...items.values()].map((v) => ({ ...v.data }));
  const liveById = new Map(live.map((item) => [item.id, item]));
  const merged = saved.map((item) => liveById.get(item.id) ?? item);
  for (const item of live) if (!saved.some((savedItem) => savedItem.id === item.id)) merged.push(item);
  return merged.sort((a, b) => b.startedAt - a.startedAt);
}

export function recordCompletedDownload(url: string, filename: string, filePath: string, size: number) {
  const data: DownloadItem = {
    id: randomUUID(),
    url,
    filename,
    path: filePath,
    totalBytes: size,
    receivedBytes: size,
    state: 'completed',
    startedAt: Date.now(),
  };
  persistDownload(data);
  broadcast();
}

function persistDownload(data: DownloadItem) {
  try {
    getDb().prepare(`
      INSERT INTO downloads (id, url, filename, path, total_bytes, received_bytes, state, started_at)
      VALUES (@id, @url, @filename, @path, @totalBytes, @receivedBytes, @state, @startedAt)
      ON CONFLICT(id) DO UPDATE SET
        url = excluded.url,
        filename = excluded.filename,
        path = excluded.path,
        total_bytes = excluded.total_bytes,
        received_bytes = excluded.received_bytes,
        state = excluded.state,
        started_at = excluded.started_at
    `).run(data);
  } catch {
    // Do not interrupt a download if history persistence is unavailable.
  }
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
