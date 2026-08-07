import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let db: Database.Database | null = null;
const settingsCache = new Map<string, string>();
let setSettingStmt: Database.Statement | null = null;

export function initDatabase() {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, 'lumen.db'));

  // High-performance SQLite configuration
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456'); // 256MB memory map

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES bookmarks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT,
      is_folder INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_parent ON bookmarks(parent_id, position);

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT '',
      visited_at INTEGER NOT NULL,
      visit_count INTEGER NOT NULL DEFAULT 1,
      dwell_ms INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
    CREATE INDEX IF NOT EXISTS idx_history_time ON history(visited_at DESC);

    CREATE TABLE IF NOT EXISTS passwords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origin TEXT NOT NULL,
      username TEXT NOT NULL,
      password_enc BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(origin, username)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrate existing tables if columns missing
  try {
    db.exec('ALTER TABLE history ADD COLUMN dwell_ms INTEGER NOT NULL DEFAULT 0');
  } catch {
    /* column already exists */
  }
  try {
    db.exec("ALTER TABLE history ADD COLUMN domain TEXT NOT NULL DEFAULT ''");
  } catch {
    /* column already exists */
  }

  // Create domain index after columns are ensured
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_history_domain ON history(domain)');
  } catch {
    /* ignore */
  }

  // Pre-load all settings into in-memory cache for 0ms lookups
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  for (const row of rows) {
    settingsCache.set(row.key, row.value);
  }

  setSettingStmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function closeDatabase() {
  setSettingStmt = null;
  settingsCache.clear();
  db?.close();
  db = null;
}

export function getSetting(key: string, fallback: string): string {
  return settingsCache.get(key) ?? fallback;
}

export function setSetting(key: string, value: string) {
  settingsCache.set(key, value);
  if (setSettingStmt) {
    setSettingStmt.run(key, value);
  } else if (db) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }
}
