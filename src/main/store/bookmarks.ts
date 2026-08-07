import { getDb } from './database';
import type { BookmarkNode } from '../../shared/types';

export function listBookmarks(): BookmarkNode[] {
  return getDb()
    .prepare(
      `SELECT id, parent_id as parentId, title, url, is_folder as isFolder,
              position, created_at as createdAt
       FROM bookmarks ORDER BY parent_id, position`,
    )
    .all()
    .map((r: any) => ({ ...r, isFolder: !!r.isFolder })) as BookmarkNode[];
}

export function addBookmark(title: string, url: string, parentId: number | null = null): number {
  const max = getDb()
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 as pos FROM bookmarks WHERE parent_id IS ?')
    .get(parentId) as { pos: number };
  const result = getDb()
    .prepare('INSERT INTO bookmarks (parent_id, title, url, is_folder, position, created_at) VALUES (?, ?, ?, 0, ?, ?)')
    .run(parentId, title, url, max.pos, Date.now());
  return Number(result.lastInsertRowid);
}

export function createFolder(title: string, parentId: number | null = null): number {
  const result = getDb()
    .prepare('INSERT INTO bookmarks (parent_id, title, url, is_folder, position, created_at) VALUES (?, ?, NULL, 1, 0, ?)')
    .run(parentId, title, Date.now());
  return Number(result.lastInsertRowid);
}

export function removeBookmark(id: number) {
  getDb().prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
}

export function getBookmarkByUrl(url: string): BookmarkNode | null {
  const row = getDb()
    .prepare(
      `SELECT id, parent_id as parentId, title, url, is_folder as isFolder, position, created_at as createdAt
       FROM bookmarks WHERE is_folder = 0 AND url = ? LIMIT 1`,
    )
    .get(url) as any;
  return row ? { ...row, isFolder: !!row.isFolder } : null;
}

/** Add if absent, remove if present. Returns whether it's now bookmarked. */
export function toggleBookmark(title: string, url: string): { bookmarked: boolean; id: number | null } {
  const existing = getBookmarkByUrl(url);
  if (existing) {
    removeBookmark(existing.id);
    return { bookmarked: false, id: null };
  }
  const id = addBookmark(title, url);
  return { bookmarked: true, id };
}

export function searchBookmarks(query: string, limit = 8): BookmarkNode[] {
  return getDb()
    .prepare(
      `SELECT id, parent_id as parentId, title, url, is_folder as isFolder, position, created_at as createdAt
       FROM bookmarks WHERE is_folder = 0 AND (title LIKE ? OR url LIKE ?) LIMIT ?`,
    )
    .all(`%${query}%`, `%${query}%`, limit)
    .map((r: any) => ({ ...r, isFolder: !!r.isFolder })) as BookmarkNode[];
}

/** Export to Netscape bookmark HTML format (Chrome/Firefox compatible). */
export function exportHtml(): string {
  const nodes = listBookmarks();
  const children = (parentId: number | null) => nodes.filter((n) => n.parentId === parentId);

  const render = (parentId: number | null, indent: string): string => {
    return children(parentId)
      .map((n) => {
        if (n.isFolder) {
          return (
            `${indent}<DT><H3>${escapeHtml(n.title)}</H3>\n${indent}<DL><p>\n` +
            render(n.id, indent + '    ') +
            `${indent}</DL><p>`
          );
        }
        return `${indent}<DT><A HREF="${escapeHtml(n.url ?? '')}" ADD_DATE="${Math.floor(n.createdAt / 1000)}">${escapeHtml(n.title)}</A>`;
      })
      .join('\n');
  };

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${render(null, '    ')}
</DL><p>`;
}

/** Import Netscape bookmark HTML. Returns count of imported bookmarks. */
export function importHtml(html: string): number {
  const linkRe = /<A\s+[^>]*HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    addBookmark(decodeEntities(m[2]) || m[1], m[1]);
    count++;
  }
  return count;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}
