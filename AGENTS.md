# AGENTS.md

A guide for AI agents working in the Lumen Browser codebase.

## Project Overview

Lumen is a glassmorphic desktop web browser built on **Electron (Chromium)** with a
**React + Tailwind CSS** renderer, **Zustand** state, and **better-sqlite3** persistence.
The UI currently follows a "Nothing Glyph" monochrome aesthetic (pure black surfaces,
dot glyphs, zero blur/radius) layered on top of the original glassmorphic Tailwind config.

## Essential Commands

```bash
npm install              # first-time setup (rebuilds better-sqlite3 for Electron)
npm run dev              # Vite dev server (port 5180) + esbuild watch + Electron hot-restart
npm run build            # production build (renderer then main/preload)
npm start                # build + launch Electron from out/
npm run typecheck        # tsc --noEmit (project-wide, no emit)
```

- `npm run dev` launches **two** processes via `concurrently`: the main-process watcher
  (`scripts/dev-main.mjs`) and the Vite renderer dev server. The watcher waits for Vite
  on `http://localhost:5180`, then spawns Electron with `LUMEN_DEV_SERVER_URL` set.
- Editing main/preload source triggers an esbuild rebuild and **Electron restart**
  (full process kill + relaunch — renderer state is lost).
- Editing renderer source triggers Vite HMR (renderer state preserved).
- `npm run build:main` bundles **both** `src/main/index.ts` and `src/preload/index.ts`
  into `out/*.cjs` (CommonJS, platform=node, externalizes `electron` and `better-sqlite3`).
- There is **no test suite** and **no linter** configured. Verify changes with
  `npm run typecheck` and manual `npm run dev` smoke-testing.
- `better-sqlite3` must be rebuilt for Electron's ABI; the dev script and `npm install`
  handle this, but if you see native-module errors run
  `npm rebuild better-sqlite3 --runtime=electron`.

## Architecture

### Three-process model

```
src/
├── shared/types.ts        IPC channel constants + shared state shapes (the contract)
├── main/                  Electron main process (Node, bundled to out/main/index.cjs)
│   ├── index.ts           App lifecycle, single-instance lock, Chromium perf flags
│   ├── windows/           WindowManager — frameless vibrancy BrowserWindow factory
│   ├── tabs/TabManager.ts One WebContentsView per tab (real multi-process Chromium),
│   │                      hibernation, pin/mute, bounds layout, dwell-time tracking
│   ├── store/             better-sqlite3 (WAL): bookmarks, history, settings, passwords
│   ├── downloads.ts       will-download handling, pause/resume/cancel
│   ├── ipc.ts             All ipcMain.handle registrations
│   ├── shields/           Ad/tracker domain blocklist, cosmetic CSS, fingerprint injection
│   └── menu/appMenu.ts    Native macOS menu with browser accelerators
├── preload/index.ts       contextBridge — exposes typed `window.lumen` API
└── renderer/              React chrome UI (Vite, root: src/renderer)
    └── src/
        ├── App.tsx            Chrome shell: header + tab strip + address bar + sidebar
        ├── store/browserStore.ts  Zustand store; single source of truth in renderer
        ├── lib/api.ts         `export const api = window.lumen` (typed bridge to preload)
        ├── lib/theme.ts       CSS variable application for customization settings
        └── components/         tabbar, addressbar, sidebar, chrome, settings, shields, etc.
```

### Control & data flow

1. **User action** → React component calls `api.tabs.create()` (etc.) from `lib/api.ts`.
2. **Preload** forwards via `ipcRenderer.invoke(IPC.TabCreate, ...)` to main.
3. **Main** `ipc.ts` routes to the per-window `TabManager` (looked up via
   `WindowManager.tabManagerFor(win.id)` from the sender's `BrowserWindow`).
4. **TabManager** mutates tab state and calls `emitState()` — a **coalesced** emitter
   that batches updates via `setImmediate` and sends `IPC.StateChanged` to the renderer.
5. **Renderer** `browserStore.init()` subscribes to `onStateChanged` and calls
   `applyState()` to merge the full `WindowState` into the Zustand store.
6. Components select slices from the store and re-render.

**Key invariant**: the renderer never owns tab state. It is a projection of main's
`TabManager`. All mutations go through IPC; the renderer reflects what main sends.
The only renderer-local state is UI flags (sidebar open, app menu open) that are also
mirrored back into `WindowState` by main.

### Layout model

- The React chrome overlays the **top 92px** of the window (`CHROME_HEIGHT = 92` in
  `WindowManager.ts`: 40px tab strip + 52px address bar). The bookmarks bar adds 36px
  when visible (synced to main via `IPC.SetChromeHeight` so `TabManager.relayout()`
  repositions the `WebContentsView`).
- Each web tab is a **`WebContentsView`** added as a child of the window's content view
  and positioned below the chrome — real multi-process Chromium, not iframes.
- The sidebar floats as a 320px glass panel over the left edge; when open, the active
  tab view's `x` shifts right by `SIDEBAR_WIDTH`. The app menu (when open) shifts the
  right margin by 320px.
- Internal pages (`lumen://newtab`, `lumen://settings*`) are **not** rendered as
  `WebContentsView`s — the view is detached and React renders the New Tab or Settings
  component directly in the chrome layer.

### IPC contract

`src/shared/types.ts` defines the `IPC` constant object with all channel names and
the `TabState`/`WindowState`/etc. interfaces. **Adding a new IPC channel requires
three coordinated edits**:

1. Add the channel name to the `IPC` object in `src/shared/types.ts`.
2. Add a handler in `src/main/ipc.ts` (use `managerFor(e)` to get window + TabManager).
3. Add a method to the `api` object in `src/preload/index.ts` (this is what the renderer
   imports via `lib/api.ts`).

Forgetting any one of these causes a silent failure (renderer call returns a promise
that rejects with "no handler registered" or `api` is `undefined`).

### State emission

`TabManager.emitState()` is **coalesced** — multiple calls in the same tick collapse
into a single `setImmediate` dispatch. Overrides can be passed to force specific
fields. The renderer's `applyState` does a **shallow merge** of the full
`WindowState`, so any field main stops sending will retain its stale renderer value.

### Database

`src/main/store/database.ts` initializes a single SQLite DB at
`app.getPath('userData')/lumen.db` with WAL mode, 64MB cache, 256MB mmap. **Settings**
are cached in an in-memory `Map` at init for 0ms lookups; writes update both the cache
and the DB. Schema migrations use `ALTER TABLE ... ADD COLUMN` wrapped in try/catch
(silent on duplicate column) — there is no formal migration framework.

## Conventions

### TypeScript & imports

- **Path aliases** (configured in both `tsconfig.json` and `vite.renderer.config.mjs`):
  - `@shared/*` → `src/shared/*` (used by main, preload, and renderer)
  - `@renderer/*` → `src/renderer/src/*` (renderer only)
- Prefer these aliases over relative paths for cross-module imports.
- Strict mode is on. `isolatedModules` requires `export type` for type-only re-exports.
- The renderer's `lib/api.ts` re-exports the preload type via a deep relative import
  (`../../../preload`) and augments the global `Window` interface — this is the only
  place the renderer touches preload types directly.

### Tailwind

- `content` scans `./src/renderer/**/*.{html,ts,tsx}`.
- `darkMode: 'class'` — the `<html>` gets `dark` toggled by `App.tsx` based on theme
  setting + `prefers-color-scheme`.
- The config defines both a **glassmorphic** design system (blur, radii, glass shadows,
  accent colors via CSS variables) and a **doodle** system (hand-drawn fonts, sketch
  shadows). The active "Nothing Glyph" aesthetic in `index.css` overrides much of this
  with pure-black surfaces and zero blur/radius via CSS variables.
- Customization is applied at runtime by `applyCustomizationStyles()` in `lib/theme.ts`,
  which sets CSS variables (`--accent-color`, `--glass-blur`, `--radius-glass`, etc.)
  on `document.documentElement`. Tailwind utilities reference these via
  `var(--radius-glass, 14px)` fallbacks.

### Components

- React 18 with `react-jsx` (no `import React` needed for JSX, but some files still
  import React for hooks — match the existing pattern per file).
- `useBrowserStore` (Zustand) is the single store. Components select slices with
  selector functions to minimize re-renders. Actions are called via
  `useBrowserStore.getState().action()` or `useBrowserStore((s) => s.action)`.
- Internal "pages" (Settings, New Tab) are rendered conditionally inside `App.tsx`
  based on `activeTab.url.startsWith('lumen://...')` — there is **no router**.

### Main process

- `WindowManager` is a singleton object (not a class) with a `Map<number, ManagedWindow>`.
- `TabManager` is a class, one per window. The app-menu is a **separate** frameless
  `BrowserWindow` with title `__lumen_app_menu__`, loaded with `#/app-menu` hash.
- `before-input-event` on each tab's webContents intercepts keyboard shortcuts
  (Ctrl/Cmd+T/W/P/U, zoom, F11, F12) — **both** the main process and the renderer
  (`App.tsx` keydown listener) handle some of the same shortcuts. Main handles tab-level
  actions; renderer handles chrome-level actions.
- `normalizeUrl()` in `TabManager.ts` is the single source for URL parsing: it detects
  internal URLs, adds `https://` to bare domains, and falls back to the configured
  search engine. `isInternalUrl()` gates history recording and view detachment.

## Gotchas

- **`AppMenuStandalone` is defined but never imported/rendered.** The app-menu window
  loads `#/app-menu` but `App.tsx` has no hash router, so the standalone menu component
  in `components/chrome/AppMenuStandalone.tsx` is currently dead code. The inline
  `AppMenu` component (in the same folder) is what the chrome renders. If you wire up
  the standalone window, you'll need to add hash-based routing in `App.tsx` (or
  `main.tsx`) to render `AppMenuStandalone` when `location.hash === '#/app-menu'`.
- **Duplicate keyboard shortcut handling**: `TabManager.wireWebContents` intercepts
  shortcuts via `before-input-event` on the page's webContents, and `App.tsx` adds a
  global `window` keydown listener for the same keys (zoom, print, view source, F11).
  When a web page has focus, the main-process handler wins (and calls
  `preventDefault`); when the chrome has focus, the renderer handler fires. Be aware of
  this split when adding new shortcuts.
- **`emitState` is coalesced and shallow-merged.** Rapid mutations collapse to one
  dispatch. The renderer's `applyState` does `{ ...prev, ...s }` — if main omits a
  field, the renderer keeps the stale value. Always send complete state or use
  `overrides`.
- **Incognito sessions are per-window, in-memory partitions** (`incognito-${win.id}`).
  History and dwell-time recording are skipped when `this.incognito` is true. The
  partition is discarded when the window closes.
- **Hibernation** (`TabManager.hibernate`) destroys the `WebContentsView` and stores
  the URL; reactivation creates a fresh view and reloads. Pinned and active tabs are
  never hibernated. The timer is configurable via the `hibernateMinutes` setting.
- **Fingerprint protection** (`shields/fingerprint.ts`) is injected via
  `executeJavaScript` before page scripts run — it patches `CanvasRenderingContext2D`
  and WebGL APIs. Disabling shields requires a reload to take effect.
- **`better-sqlite3` is externalized from the esbuild bundle** — it must be present as
  a native `.node` file in `node_modules` at runtime. If you see
  `Cannot find module 'better-sqlite3'` in main, run `npm rebuild better-sqlite3`.
- **The `out/` directory** is the build output (gitignored). `package.json`'s `main`
  points to `out/main/index.cjs`, so `electron .` requires a prior `npm run build:main`.
- **`.claude/settings.local.json`** pre-authorizes `npx tsc *` and `npm run *` bash
  commands — no need to request permission for typecheck or npm scripts.
