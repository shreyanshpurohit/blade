import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { WindowManager } from './windows/WindowManager';
import { registerIpc } from './ipc';
import { initDatabase, closeDatabase } from './store/database';
import { setupDownloadHandling } from './downloads';
import { buildAppMenu } from './menu/appMenu';
import { installShieldsOnSession } from './shields/shields';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = WindowManager.primaryWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ──── High-Performance Chromium Engine Flags ────
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-quic');
app.commandLine.appendSwitch('enable-fast-unload');
app.commandLine.appendSwitch('enable-v8-idle-tasks');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('enable-pointer-lock-options');
app.commandLine.appendSwitch(
  'enable-features',
  'ParallelDownloading,BackForwardCache,WebAssemblySimd,PointerLockOptions,RawMouseEvents',
);

export function cleanUserAgent(rawUa?: string): string {
  const ua = rawUa || app.userAgentFallback || '';
  return ua
    .replace(/Electron\/\S+\s?/g, '')
    .replace(/blade\/\S+\s?/g, '')
    .replace(/Blade\/\S+\s?/g, '')
    .replace(/lumen\/\S+\s?/g, '')
    .replace(/Lumen\/\S+\s?/g, '')
    .trim();
}

app.whenReady().then(() => {
  app.userAgentFallback = cleanUserAgent(app.userAgentFallback);
  session.defaultSession.setUserAgent(cleanUserAgent(session.defaultSession.getUserAgent()));
  initDatabase();
  installShieldsOnSession(session.defaultSession);
  setupDownloadHandling();
  registerIpc();
  buildAppMenu();
  WindowManager.createWindow({ incognito: false });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      WindowManager.createWindow({ incognito: false });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  closeDatabase();
});

// Renderer entry resolution: dev server in dev, built files in prod.
export function rendererEntry(): string {
  if (process.env.BLADE_DEV_SERVER_URL || process.env.LUMEN_DEV_SERVER_URL) {
    return (process.env.BLADE_DEV_SERVER_URL || process.env.LUMEN_DEV_SERVER_URL)!;
  }
  return path.join(__dirname, '../renderer/index.html');
}

export function preloadPath(): string {
  return path.join(__dirname, '../preload/index.cjs');
}
