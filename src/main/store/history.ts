import { getDb } from './database';
import type { HistoryEntry, HistoryTerrainData, HistoryTerrainBucket } from '../../shared/types';

// In-memory debounce cache to avoid hitting SQLite on repeated navigations/reloads
const recentVisits = new Map<string, number>();

export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname || rawUrl;
  } catch {
    return rawUrl;
  }
}

export function recordVisit(url: string, title: string, dwellMs = 0) {
  if (!url || url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('lumen:')) return;

  const now = Date.now();
  const domain = extractDomain(url);
  const lastTime = recentVisits.get(url);

  // Evict old entries if memory map grows large
  if (recentVisits.size > 500) {
    const cutoff = now - 60000;
    for (const [k, v] of recentVisits.entries()) {
      if (v < cutoff) recentVisits.delete(k);
    }
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT id, visit_count, dwell_ms FROM history WHERE url = ? ORDER BY visited_at DESC LIMIT 1')
    .get(url) as { id: number; visit_count: number; dwell_ms: number } | undefined;

  if (existing && lastTime && now - lastTime < 5000) {
    // Within debounce window, just update title and dwell if provided
    db.prepare('UPDATE history SET visited_at = ?, title = ?, dwell_ms = dwell_ms + ? WHERE id = ?')
      .run(now, title || url, dwellMs, existing.id);
  } else if (existing) {
    recentVisits.set(url, now);
    db.prepare(
      'UPDATE history SET visited_at = ?, visit_count = visit_count + 1, title = ?, domain = ?, dwell_ms = dwell_ms + ? WHERE id = ?',
    ).run(now, title || url, domain, dwellMs, existing.id);
  } else {
    recentVisits.set(url, now);
    db.prepare(
      'INSERT INTO history (url, title, domain, visited_at, visit_count, dwell_ms) VALUES (?, ?, ?, ?, 1, ?)',
    ).run(url, title || url, domain, now, dwellMs);
  }
}

export function updateDwellTime(url: string, additionalMs: number) {
  if (!url || additionalMs <= 0 || url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('lumen:')) {
    return;
  }
  try {
    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM history WHERE url = ? ORDER BY visited_at DESC LIMIT 1')
      .get(url) as { id: number } | undefined;

    if (existing) {
      db.prepare('UPDATE history SET dwell_ms = dwell_ms + ? WHERE id = ?').run(additionalMs, existing.id);
    } else {
      recordVisit(url, url, additionalMs);
    }
  } catch (err) {
    console.error('Failed to update dwell time:', err);
  }
}

export function getHistoryTerrain(hours = 6): HistoryTerrainData {
  const db = getDb();
  const now = Date.now();
  const totalMs = hours * 60 * 60 * 1000;
  const since = now - totalMs;
  const bucketDurationMs = 15 * 60 * 1000; // 15-minute windows
  const numBuckets = Math.ceil(totalMs / bucketDurationMs); // 24 buckets for 6 hours

  const rows = db
    .prepare(
      `SELECT id, url, title, domain, visited_at as visitedAt, visit_count as visitCount, dwell_ms as dwellMs
       FROM history
       WHERE visited_at >= ?
       ORDER BY visited_at ASC`,
    )
    .all(since) as (HistoryEntry & { domain: string; dwellMs: number })[];

  const buckets: HistoryTerrainBucket[] = [];
  const domainTotals = new Map<string, { dwellSec: number; visits: number; title: string }>();

  for (let i = 0; i < numBuckets; i++) {
    const bucketStart = since + i * bucketDurationMs;
    const bucketEnd = bucketStart + bucketDurationMs;

    const startDate = new Date(bucketStart);
    const timeLabel = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;

    const matchingRows = rows.filter((r) => r.visitedAt >= bucketStart && r.visitedAt < bucketEnd);
    let totalDwellSec = 0;
    let visitCount = 0;
    const bucketDomains = new Map<string, { dwellSec: number; visits: number; title: string }>();

    for (const row of matchingRows) {
      const dwell = Math.round((row.dwellMs || 15000) / 1000); // minimum default 15s per visit if 0
      const visits = row.visitCount || 1;
      totalDwellSec += dwell;
      visitCount += visits;

      const dom = row.domain || extractDomain(row.url);
      const existing = bucketDomains.get(dom) || { dwellSec: 0, visits: 0, title: row.title };
      existing.dwellSec += dwell;
      existing.visits += visits;
      if (row.title) existing.title = row.title;
      bucketDomains.set(dom, existing);

      const globalExisting = domainTotals.get(dom) || { dwellSec: 0, visits: 0, title: row.title };
      globalExisting.dwellSec += dwell;
      globalExisting.visits += visits;
      if (row.title) globalExisting.title = row.title;
      domainTotals.set(dom, globalExisting);
    }

    let topDomain: string | null = null;
    let topTitle: string | null = null;
    let maxDomainScore = -1;

    for (const [dom, stat] of bucketDomains.entries()) {
      const score = stat.dwellSec + stat.visits * 10;
      if (score > maxDomainScore) {
        maxDomainScore = score;
        topDomain = dom;
        topTitle = stat.title;
      }
    }

    buckets.push({
      bucketIndex: i,
      startTime: bucketStart,
      endTime: bucketEnd,
      timeLabel,
      totalDwellSec,
      visitCount,
      topDomain,
      topTitle,
      isPeak: false,
    });
  }

  // Identify peaks (local maxima in the curve)
  for (let i = 0; i < buckets.length; i++) {
    const current = buckets[i].totalDwellSec + buckets[i].visitCount * 15;
    const prev = i > 0 ? buckets[i - 1].totalDwellSec + buckets[i - 1].visitCount * 15 : 0;
    const next = i < buckets.length - 1 ? buckets[i + 1].totalDwellSec + buckets[i + 1].visitCount * 15 : 0;
    if (current > 0 && current >= prev && current >= next && (current > prev || current > next)) {
      buckets[i].isPeak = true;
    }
  }

  const topSites = Array.from(domainTotals.entries())
    .map(([domain, data]) => ({
      domain,
      dwellSec: data.dwellSec,
      visits: data.visits,
      title: data.title || domain,
    }))
    .sort((a, b) => b.dwellSec + b.visits * 20 - (a.dwellSec + a.visits * 20))
    .slice(0, 8);

  const totalDwellSec = buckets.reduce((acc, b) => acc + b.totalDwellSec, 0);
  const totalVisits = buckets.reduce((acc, b) => acc + b.visitCount, 0);

  return {
    buckets,
    totalDwellSec,
    totalVisits,
    topSites,
    timeRangeLabel: `Last ${hours} Hours (${numBuckets} × 15-min Intervals)`,
  };
}

export function listHistory(query = '', limit = 200, since = 0): HistoryEntry[] {
  const db = getDb();
  if (!query.trim()) {
    return db
      .prepare(
        `SELECT id, url, title, domain, visited_at as visitedAt, visit_count as visitCount, dwell_ms as dwellMs
         FROM history
         WHERE visited_at >= ?
         ORDER BY visited_at DESC LIMIT ?`,
      )
      .all(since, limit) as HistoryEntry[];
  }
  const q = `%${query.trim()}%`;
  return db
    .prepare(
      `SELECT id, url, title, domain, visited_at as visitedAt, visit_count as visitCount, dwell_ms as dwellMs
       FROM history
       WHERE (url LIKE ? OR title LIKE ? OR domain LIKE ?) AND visited_at >= ?
       ORDER BY visited_at DESC LIMIT ?`,
    )
    .all(q, q, q, since, limit) as HistoryEntry[];
}

export function searchHistory(query: string, limit = 8): HistoryEntry[] {
  return listHistory(query, limit);
}

export function clearHistory(since = 0) {
  recentVisits.clear();
  getDb().prepare('DELETE FROM history WHERE visited_at >= ?').run(since);
}
