# Lumen Browser

A glassmorphic desktop web browser with macOS Big Sur/Sonoma vibrancy aesthetics,
built on **Electron (Chromium)** + **React + Tailwind CSS** + **Zustand** + **better-sqlite3**.

## Run

```bash
npm install
npm run dev        # Vite dev server + Electron with hot-restart
# or
npm run build && npm start
```

## Architecture

```
src/
├── shared/types.ts          IPC channel names + shared state shapes
├── main/                    Electron main process (Node)
│   ├── index.ts             App lifecycle, single-instance lock
│   ├── windows/WindowManager.ts   Frameless vibrancy windows (BrowserWindow)
│   ├── tabs/TabManager.ts   Multi-process tabs via WebContentsView (one renderer
│   │                        process per tab), hibernation, pin/mute, bounds layout
│   ├── store/               better-sqlite3 (WAL): bookmarks, history, passwords, settings
│   ├── downloads.ts         will-download handling, pause/resume/cancel
│   ├── ipc.ts               All invoke handlers
│   └── menu/appMenu.ts      Native menu with browser accelerators
├── preload/index.ts         contextBridge API exposed as window.lumen
└── renderer/                Chrome UI (React + Tailwind) — the glass shell
    └── src/
        ├── components/tabbar/      Glass tab strip (pinned, context menu, animations)
        ├── components/addressbar/  Omnibox with history/bookmark/search suggestions
        ├── components/sidebar/     Bookmarks / History / Downloads panels
        ├── components/newtab/      Speed Dial new-tab page (clock + top sites)
        └── store/browserStore.ts   Zustand store synced from main via state events
```

**Layout model:** the React chrome occupies the top 92px of the window (tab bar +
address bar). Each tab's page renders in a `WebContentsView` positioned below it —
real multi-process Chromium tabs, not iframes. The sidebar floats as a glass panel
over the left edge and the tab view bounds shift right when it opens.

## Implemented

- Frameless glass chrome: backdrop-blur panels, 12–16px radii, 1px low-opacity strokes,
  light/dark (follows system), 200–300ms macOS-ease micro-animations, SF Pro/Inter stack
- Tabs: create/close/switch/pin (sorted to front), mute, middle-click close,
  context menu (pin/duplicate/hibernate), sleep after 15min inactive, tab search IPC
- Omnibox: URL normalization (domain vs. search), live history+bookmark suggestions,
  keyboard navigation, HTTPS indicator, PRIVATE badge in incognito
- Incognito windows: separate in-memory session partition, purple tint
- Bookmarks: add/remove/folders, Netscape HTML import/export
- History: recorded on navigation (skipped in incognito), day-grouped, searchable, clear
- Downloads: pause/resume/cancel, progress pill, show-in-folder
- New Tab page: clock widget, search box, speed dial from top-visited sites
- SQLite persistence (WAL) for bookmarks/history/passwords/settings

## Stubbed / next up (task 4 remainder)

- Password manager autofill (schema + encrypted column exist; needs `safeStorage` wiring)
- Reader mode, PiP button, screenshot tool, tab groups UI (state model exists)
- Vertical tab bar, shortcut customization panel, site permissions manager
- Extension loading (Electron `session.loadExtension` hook point: `WindowManager`)
- Sync (account/QR pairing)

## Notes

- On macOS the window uses `vibrancy: 'under-window'` + native traffic lights; on
  Linux/Windows it falls back to CSS `backdrop-filter` glass + custom window controls.
- `better-sqlite3` must be rebuilt for Electron: `npm rebuild better-sqlite3 --runtime=electron`
  (the dev script handles fresh checkouts via `npm rebuild` after install).
