import { safeStorage } from 'electron';
import { getDb } from './database';

export interface StoredPassword {
  id: number;
  origin: string;
  username: string;
  createdAt: number;
}

export function listPasswords(): StoredPassword[] {
  return getDb().prepare(
    'SELECT id, origin, username, created_at as createdAt FROM passwords ORDER BY created_at DESC',
  ).all() as StoredPassword[];
}

export function savePassword(origin: string, username: string, password: string) {
  const encrypted = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(password)
    : Buffer.from(password, 'utf8');
  getDb().prepare(
    `INSERT INTO passwords (origin, username, password_enc, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(origin, username) DO UPDATE SET password_enc = excluded.password_enc`,
  ).run(origin.trim(), username.trim(), encrypted, Date.now());
}

export function removePassword(id: number) {
  getDb().prepare('DELETE FROM passwords WHERE id = ?').run(id);
}
