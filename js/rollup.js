// Pure rollup: fold reviews older than 180 days into per-day aggregates so the
// synced document stops growing. Deterministic and idempotent.
import { dayKeyUTC, dailyKey, LOG_FIELDS } from './merge.js';

export const ROLLUP_DAYS = 180;
export const DAY_MS = 86400000;

// Cutoff is date-granular (UTC midnight) so two devices rolling up on the same
// calendar day produce byte-identical aggregates.
export function cutoffMs(now = Date.now(), days = ROLLUP_DAYS) {
  const midnight = Date.parse(dayKeyUTC(now) + 'T00:00:00.000Z');
  return midnight - days * DAY_MS;
}

export function rollup(doc, now = Date.now(), days = ROLLUP_DAYS) {
  const cut = cutoffMs(now, days);
  const keep = [];
  const agg = new Map();
  for (const r of doc.reviewsDaily || []) agg.set(r.id, { ...r });

  for (const r of doc.reviews || []) {
    const t = typeof r.ts === 'number' ? r.ts : Date.parse(r.ts);
    if (!Number.isFinite(t) || t >= cut) { keep.push(r); continue; }
    const key = dailyKey(r);
    const cur = agg.get(key) || {
      id: key,
      date: dayKeyUTC(t),
      mode: r.mode || 'unknown',
      tone: r.tone || null,
      count: 0,
      correctCount: 0,
    };
    cur.count += 1;
    if (r.correct) cur.correctCount += 1;
    agg.set(key, cur);
  }

  const f = LOG_FIELDS.reviewsDaily;
  const reviewsDaily = [...agg.values()].sort((x, y) =>
    x[f] === y[f] ? (x.id < y.id ? -1 : x.id > y.id ? 1 : 0) : (x[f] < y[f] ? -1 : 1));
  return { ...doc, reviews: keep, reviewsDaily };
}
