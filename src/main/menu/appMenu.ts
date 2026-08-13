import { Menu, MenuItemConstructorOptions } from 'electron';

export function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  if (!isMac) {
    // On Linux and Windows, remove the default OS menu bar so the browser is frameless and sleek
    Menu.setApplicationMenu(null);
    return;
  }

  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' as const },
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => send('menu:newTab') },
        { label: 'New Incognito Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('menu:newIncognito') },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => send('menu:closeTab') },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => send('menu:reload') },
        { label: 'Toggle Sidebar', click: () => send('menu:toggleSidebar') },
        { label: 'Toggle Bookmarks Bar', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('menu:toggleBookmarksBar') },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => send('menu:settings') },
        { type: 'separator' },
        { label: 'Find in Page', accelerator: 'CmdOrCtrl+F', click: () => send('menu:find') },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => send('menu:back') },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => send('menu:forward') },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function send(channel: string) {
  const { BrowserWindow } = require('electron');
  BrowserWindow.getFocusedWindow()?.webContents.send(channel);
}
