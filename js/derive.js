// Every displayed number is computed here from the append-only logs.
// Nothing in this file is ever stored — that is what makes two devices agree.
// Pure: no DOM, no localStorage.
import { TONES } from './migrate.js';

export const MILESTONES_H = [10, 25, 50, 100, 200, 500];
const DAY_MS = 86400000;

// Local calendar day (the user's day, not UTC): what streaks and charts use.
export function localDay(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tnum(v) {
  const n = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

export function totalActiveMs(doc) {
  return (doc.sessions || []).reduce((a, s) => a + Math.max(0, s.activeMs || 0), 0);
}

// Sunday-start week containing `now`.
export function weekStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function msThisWeek(doc, now = Date.now()) {
  const from = weekStart(now);
  return (doc.sessions || [])
    .filter((s) => tnum(s.startedAt) >= from)
    .reduce((a, s) => a + Math.max(0, s.activeMs || 0), 0);
}

// A day counts toward the streak if any session that day did real work.
export function studyDays(doc) {
  const set = new Set();
  for (const s of doc.sessions || []) {
    if ((s.activeMs || 0) > 0 || (s.cardsDone || 0) > 0) set.add(localDay(tnum(s.startedAt)));
  }
  return set;
}

export function streakDays(doc, now = Date.now()) {
  const days = studyDays(doc);
  if (!days.size) return 0;
  // Today not being studied yet must not break yesterday's streak.
  let cursor = days.has(localDay(now)) ? now : now - DAY_MS;
  if (!days.has(localDay(cursor))) return 0;
  let n = 0;
  while (days.has(localDay(cursor))) { n += 1; cursor -= DAY_MS; }
  return n;
}

// [{ day, minutes }] oldest-first, one entry per day including empty days.
export function minutesPerDay(doc, days = 30, now = Date.now()) {
  const byDay = new Map();
  for (const s of doc.sessions || []) {
    const k = localDay(tnum(s.startedAt));
    byDay.set(k, (byDay.get(k) || 0) + Math.max(0, s.activeMs || 0));
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = localDay(now - i * DAY_MS);
    out.push({ day, minutes: (byDay.get(day) || 0) / 60000 });
  }
  return out;
}

// Tone accuracy from live reviews plus rolled-up aggregates.
export function toneAccuracy(doc) {
  const out = {};
  for (const t of TONES) out[t] = { count: 0, correct: 0, pct: null };
  for (const r of doc.reviews || []) {
    if (!r.tone || !out[r.tone]) continue;
    out[r.tone].count += 1;
    if (r.correct) out[r.tone].correct += 1;
  }
  for (const a of doc.reviewsDaily || []) {
    if (!a.tone || !out[a.tone]) continue;
    out[a.tone].count += a.count || 0;
    out[a.tone].correct += a.correctCount || 0;
  }
  for (const t of TONES) if (out[t].count) out[t].pct = (out[t].correct / out[t].count) * 100;
  return out;
}

// Daily caps run off facts: which cards got their first exposure today, and
// which already-known cards were reviewed today.
export function todayCounts(doc, now = Date.now()) {
  const today = localDay(now);
  const fresh = new Set(), seen = new Set();
  for (const r of doc.reviews || []) {
    if (localDay(tnum(r.ts)) !== today) continue;
    if (r.isNew) fresh.add(r.cardId); else seen.add(r.cardId);
  }
  for (const id of fresh) seen.delete(id);
  return { newToday: fresh.size, reviewsToday: seen.size };
}

export function answeredToday(doc, now = Date.now()) {
  const today = localDay(now);
  let done = 0, correct = 0;
  for (const r of doc.reviews || []) {
    if (localDay(tnum(r.ts)) !== today) continue;
    done += 1;
    if (r.correct) correct += 1;
  }
  return { done, correct };
}

// [{ day, done, correct }] oldest-first over the last `days` days.
export function answersPerDay(doc, days = 30, now = Date.now()) {
  const byDay = new Map();
  for (const r of doc.reviews || []) {
    const k = localDay(tnum(r.ts));
    const cur = byDay.get(k) || { done: 0, correct: 0 };
    cur.done += 1; if (r.correct) cur.correct += 1;
    byDay.set(k, cur);
  }
  // sessions carry aggregate counts for backfilled (pre-v2) days
  for (const s of doc.sessions || []) {
    if (!s.backfill) continue;
    const k = localDay(tnum(s.startedAt));
    const cur = byDay.get(k) || { done: 0, correct: 0 };
    cur.done += s.cardsDone || 0; cur.correct += s.correct || 0;
    byDay.set(k, cur);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = localDay(now - i * DAY_MS);
    out.push({ day, ...(byDay.get(day) || { done: 0, correct: 0 }) });
  }
  return out;
}

// Most-missed card ids over the last `window` reviews.
export function weakestCardIds(doc, n = 3, window = 200) {
  const recent = (doc.reviews || []).slice(-window);
  const miss = new Map();
  for (const r of recent) if (!r.correct) miss.set(r.cardId, (miss.get(r.cardId) || 0) + 1);
  return [...miss.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, c]) => ({ id, misses: c }));
}

export function milestone(totalMs) {
  const hours = totalMs / 3600000;
  const next = MILESTONES_H.find((h) => hours < h) ?? null;
  const prev = [...MILESTONES_H].reverse().find((h) => hours >= h) ?? 0;
  const pct = next ? ((hours - prev) / (next - prev)) * 100 : 100;
  return { hours, prev, next, pct: Math.max(0, Math.min(100, pct)) };
}

// Honest formatting: always truncates, never rounds up.
export function fmtHM(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60), m = total % 60;
  return { h, m, text: h ? `${h}h ${m}m` : `${m}m` };
}
