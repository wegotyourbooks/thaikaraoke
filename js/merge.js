// Pure merge for schema v2 documents. No DOM, no localStorage: Node-testable.
//
// Two rules, nothing else:
//   1. keyed maps (cards, frameProgress) and the settings object -> last write wins
//      on `updatedAt`, tie-broken deterministically so merge(a,b) === merge(b,a).
//   2. append-only logs -> union by `id`, then canonical sort.
//
// Timestamps in the syncable document are epoch milliseconds. Day keys are
// "YYYY-MM-DD" UTC strings.

// log name -> field used for ordering
export const LOG_FIELDS = {
  sessions: 'startedAt',
  reviews: 'ts',
  microLessonsShown: 'ts',
  reviewsDaily: 'date',
  coverageSnapshots: 'day',
};
export const LOG_NAMES = Object.keys(LOG_FIELDS);
export const KEYED_MAPS = ['cards', 'frameProgress'];

// Stable stringify (sorted keys) so structural comparison is order-insensitive.
export function canonicalJSON(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(v[k])).join(',') + '}';
}

function ts(v) {
  const n = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

// Deterministic last-write-wins between two versions of the same keyed entry.
export function pickLater(a, b) {
  if (a == null) return b == null ? null : b;
  if (b == null) return a;
  const ta = ts(a.updatedAt), tb = ts(b.updatedAt);
  if (ta !== tb) return ta > tb ? a : b;
  const ua = String(a.updatedBy || ''), ub = String(b.updatedBy || '');
  if (ua !== ub) return ua > ub ? a : b;
  const ca = canonicalJSON(a), cb = canonicalJSON(b);
  return ca >= cb ? a : b;
}

function mergeKeyed(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[k] = pickLater(a[k], b[k]);
  }
  return out;
}

function sortLog(name, arr) {
  const f = LOG_FIELDS[name];
  return arr.slice().sort((x, y) => {
    const dx = ts(x[f]), dy = ts(y[f]);
    if (dx !== dy) return dx - dy;
    return String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0;
  });
}

// Union by id. Aggregate records (reviewsDaily) take the safe upper bound when
// both sides carry the same key; every other log keeps the deterministic winner.
function mergeLog(name, a = [], b = []) {
  const byId = new Map();
  for (const rec of [...a, ...b]) {
    if (!rec || rec.id == null) continue;
    const prev = byId.get(rec.id);
    if (!prev) { byId.set(rec.id, rec); continue; }
    if (name === 'reviewsDaily') {
      byId.set(rec.id, {
        ...prev,
        count: Math.max(prev.count || 0, rec.count || 0),
        correctCount: Math.max(prev.correctCount || 0, rec.correctCount || 0),
      });
    } else {
      byId.set(rec.id, canonicalJSON(prev) <= canonicalJSON(rec) ? prev : rec);
    }
  }
  return sortLog(name, [...byId.values()]);
}

export function dayKeyUTC(t) {
  return new Date(ts(t)).toISOString().slice(0, 10);
}

// Reviews already summarized into reviewsDaily must never be counted twice.
// A review is dropped when an aggregate exists for its exact (date, mode, tone).
export function dedupeAgainstDaily(reviews, reviewsDaily) {
  if (!reviewsDaily.length) return reviews;
  const covered = new Set(reviewsDaily.map((r) => r.id));
  return reviews.filter((r) => !covered.has(dailyKey(r)));
}

export function dailyKey(review) {
  return `${dayKeyUTC(review.ts)}|${review.mode || 'unknown'}|${review.tone || 'none'}`;
}

export function merge(a, b) {
  if (!a) return b ? merge(b, b) : null;
  if (!b) b = a;
  const out = {
    schemaVersion: Math.max(a.schemaVersion || 2, b.schemaVersion || 2),
    createdAt: Math.min(ts(a.createdAt) || Infinity, ts(b.createdAt) || Infinity) || Date.now(),
    settings: pickLater(a.settings, b.settings) || {},
  };
  for (const k of KEYED_MAPS) out[k] = mergeKeyed(a[k], b[k]);
  for (const name of LOG_NAMES) out[name] = mergeLog(name, a[name], b[name]);
  out.reviews = dedupeAgainstDaily(out.reviews, out.reviewsDaily);
  return out;
}

// Deep structural equality via canonical JSON.
export function sameDoc(a, b) {
  return canonicalJSON(a) === canonicalJSON(b);
}
