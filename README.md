# Blade

Blade is a desktop web browser built with Electron, React, Tailwind CSS, and SQLite. It combines a glassmorphic user interface with real multi-process Chromium architecture.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

```bash
git clone https://github.com/shreyanshpurohit/blade.git
cd blade
npm install
```

### Development

Run the development environment with hot reloading:

```bash
npm run dev
```

### Production Build

Compile the main process and renderer bundle:

```bash
npm run build
npm start
```

To package the browser for distribution:

```bash
npm run dist
```

## Features

### Tab Management
- Tab groups: organize tabs with color tags and drag-and-drop grouping
- Horizontal and vertical tab strips with smooth drag reordering
- Tab hibernation for inactive tabs to conserve system memory
- Pinned tabs, tab muting, audio indicators, and tab search
- Context menu for quick tab operations and group controls

### Omnibox
- Smart autocomplete ranking with direct URL detection
- Integrated history and bookmark suggestions with deduplication
- Most-visited top sites grid for fast access
- Clean dropdown interface with keyboard navigation (Tab to accept, Arrow keys, Escape to revert)

### Built-in Pages and Tools
- blade://newtab: Speed dial page with clock widget and top sites
- blade://history: Full browsing history with date grouping, search, and deletion tools
- blade://downloads: Download manager with real-time progress, pause/resume, and file location controls
- blade://settings: Complete browser preferences, theme configuration, site permissions, and developer tools
- Blade Shields: Built-in ad blocking, tracker protection, and HTTPS upgrades

### Design and Motion
- Frosted glass interface with customizable color themes (Default, Ocean, Forest, Violet, Rose)
- Light, Dark, and Incognito appearance modes
- Custom spring physics motion curves for tabs, menus, panels, and micro-interactions

## Architecture

Blade uses a three-tier process model:

```
src/
├── main/
│   ├── index.ts                Application lifecycle and single-instance handling
│   ├── windows/WindowManager.ts Window management and overlays
│   ├── tabs/TabManager.ts      WebContentsView tab management and navigation
│   ├── store/                  SQLite persistence (history, bookmarks, passwords, settings)
│   ├── downloads.ts            Download item handling and events
│   └── ipc.ts                  Main process IPC handlers
├── preload/
│   └── index.ts                Secure contextBridge API (window.blade)
├── renderer/
│   └── src/
│       ├── components/         React UI components (tabs, omnibox, sidebar, pages)
│       ├── store/browserStore.ts Zustand client state store
│       └── index.css           Tailwind base, glass surfaces, and motion tokens
└── shared/
    └── types.ts                Shared interfaces and IPC channel contracts
```

### Layout Model
The React chrome occupies the top bar and sidebar of the window. Each web page renders inside its own native WebContentsView attached to the main window below the chrome. Internal pages (such as settings, history, and new tab) detach the active WebContentsView so the React view renders directly within the glass shell.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl + T | Open new tab |
| Ctrl + W | Close active tab |
| Ctrl + Shift + T | Reopen closed tab |
| Ctrl + Tab | Next tab |
| Ctrl + Shift + Tab | Previous tab |
| Ctrl + 1-8 | Jump to tab 1 through 8 |
| Ctrl + 9 | Jump to last tab |
| Ctrl + L | Focus address bar |
| Ctrl + D | Bookmark current page |
| Ctrl + R | Reload tab |
| Ctrl + Shift + R | Reload ignoring cache |
| Ctrl + H | Open history page |
| Ctrl + J | Open downloads page |
| Ctrl + F | Open find in page |
| Alt + Left | Navigate back |
| Alt + Right | Navigate forward |
| Ctrl + Shift + I | Toggle Developer Tools |

## Tech Stack

- Electron 33
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- better-sqlite3 (WAL mode)
- Vite and esbuild

## License

MIT License. See LICENSE for details.
