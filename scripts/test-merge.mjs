// Node tests for the v2 merge, rollup and migration. Run: node scripts/test-merge.mjs
import { merge, sameDoc, canonicalJSON } from '../js/merge.js';
import { rollup, DAY_MS } from '../js/rollup.js';
import { migrateV1toV2, emptyDoc } from '../js/migrate.js';
import * as D from '../js/derive.js';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.error('  FAIL ' + name + (extra ? '\n       ' + extra : '')); }
}
function eq(name, a, b) { ok(name, canonicalJSON(a) === canonicalJSON(b), `${canonicalJSON(a)}\n       !== ${canonicalJSON(b)}`); }

const T0 = Date.parse('2026-01-15T12:00:00.000Z');

function doc(over = {}) {
  const d = emptyDoc(T0);
  return { ...d, ...over };
}
function card(due, updatedAt, updatedBy, extra = {}) {
  return { state: 2, stability: 3, difficulty: 5, due, lastReview: updatedAt, step: 0, reps: 1, lapses: 0, updatedAt, updatedBy, ...extra };
}
function review(id, ts, cardId, correct, tone = 'mid', mode = 'recall', isNew = false) {
  return { id, ts, cardId, grade: correct ? 3 : 1, correct, mode, tone, isNew, deviceId: id.slice(0, 1) };
}
function sess(id, startedAt, activeMs, cardsDone = 5) {
  return { id, deviceId: id.slice(0, 1), startedAt, endedAt: startedAt + activeMs, activeMs, cardsDone, correct: cardsDone, mode: 'session' };
}

console.log('merge: two devices, disjoint offline work');
{
  const a = doc({ cards: { w1: card(T0 + 1000, T0, 'A') }, reviews: [review('a1', T0, 'w1', true)], sessions: [sess('a-s1', T0, 600000)] });
  const b = doc({ cards: { w2: card(T0 + 2000, T0, 'B') }, reviews: [review('b1', T0 + 5, 'w2', false)], sessions: [sess('b-s1', T0 + 10, 300000)] });
  const m = merge(a, b);
  ok('both cards present', !!m.cards.w1 && !!m.cards.w2);
  ok('no review lost', m.reviews.length === 2);
  ok('session time sums', D.totalActiveMs(m) === 900000, String(D.totalActiveMs(m)));
}

console.log('merge: same card edited on both devices');
{
  const a = doc({ cards: { w1: card(T0 + 1000, T0 + 100, 'A') }, reviews: [review('a1', T0 + 100, 'w1', true)] });
  const b = doc({ cards: { w1: card(T0 + 9999, T0 + 200, 'B') }, reviews: [review('b1', T0 + 200, 'w1', false)] });
  const m = merge(a, b);
  ok('later updatedAt wins', m.cards.w1.due === T0 + 9999 && m.cards.w1.updatedBy === 'B');
  ok('both reviews survive the conflict', m.reviews.length === 2);
}

console.log('merge: identical updatedAt is resolved deterministically');
{
  const a = doc({ cards: { w1: card(1, T0, 'A') } });
  const b = doc({ cards: { w1: card(2, T0, 'B') } });
  eq('tie-break commutes', merge(a, b), merge(b, a));
}

console.log('merge: commutative and idempotent');
{
  const a = doc({ cards: { w1: card(T0 + 1, T0 + 1, 'A'), w3: card(5, T0 + 3, 'A') }, reviews: [review('a1', T0, 'w1', true), review('a2', T0 + 3, 'w3', false, 'high')], sessions: [sess('a-s', T0, 60000)] });
  const b = doc({ cards: { w1: card(T0 + 2, T0 + 2, 'B'), w2: card(9, T0, 'B') }, reviews: [review('b1', T0 + 1, 'w2', true, 'low')], sessions: [sess('b-s', T0 + 5, 120000)] });
  eq('merge(a,b) == merge(b,a)', merge(a, b), merge(b, a));
  eq('merge is idempotent', merge(merge(a, b), b), merge(a, b));
  eq('merging with self is a no-op', merge(merge(a, b), merge(a, b)), merge(a, b));
}

console.log('merge: three-way convergence');
{
  const base = doc({ cards: { w1: card(1, T0, 'A') } });
  const a = merge(base, doc({ reviews: [review('a1', T0 + 1, 'w1', true)] }));
  const b = merge(base, doc({ reviews: [review('b1', T0 + 2, 'w1', false)] }));
  const c = merge(base, doc({ reviews: [review('c1', T0 + 3, 'w1', true)] }));
  eq('order of merging does not matter', merge(merge(a, b), c), merge(a, merge(b, c)));
}

console.log('rollup: old reviews collapse, recent ones stay');
{
  const now = T0;
  const old1 = now - 200 * DAY_MS, old2 = old1 + 1000, recent = now - 3 * DAY_MS;
  const d = doc({
    reviews: [
      review('o1', old1, 'w1', true, 'mid', 'recall'),
      review('o2', old2, 'w2', false, 'mid', 'recall'),
      review('r1', recent, 'w3', true, 'high', 'audio'),
    ],
  });
  const r = rollup(d, now);
  ok('recent review kept', r.reviews.length === 1 && r.reviews[0].id === 'r1');
  ok('one aggregate for the old pair', r.reviewsDaily.length === 1, canonicalJSON(r.reviewsDaily));
  ok('aggregate counts are right', r.reviewsDaily[0].count === 2 && r.reviewsDaily[0].correctCount === 1);
  eq('rollup is idempotent', rollup(r, now), r);
  const acc = D.toneAccuracy(r);
  ok('tone totals survive rollup', acc.mid.count === 2 && acc.mid.correct === 1);
}

console.log('rollup + merge: a stale device cannot resurrect summarized reviews');
{
  const now = T0;
  const old = now - 200 * DAY_MS;
  const stale = doc({ reviews: [review('o1', old, 'w1', true, 'mid', 'recall')] });
  const rolled = rollup(doc({ reviews: [review('o1', old, 'w1', true, 'mid', 'recall')] }), now);
  const m = merge(rolled, stale);
  ok('old review is not re-added', m.reviews.length === 0, canonicalJSON(m.reviews));
  ok('aggregate still counts it once', m.reviewsDaily[0].count === 1);
}

console.log('migration: v1 -> v2 with zero card loss');
{
  const v1 = {
    schemaVersion: 1,
    settings: { newPerDay: 20, maxReviews: 80, speechRate: 0.8, showThai: false, politeness: 'female' },
    cards: {
      w0001: { state: 2, stability: 4.2, difficulty: 5.1, due: T0 + 5000, lastReview: T0 - 1000, step: 0, reps: 3, lapses: 1 },
      w0002: { state: 1, stability: 0.5, difficulty: 6.0, due: T0 + 60000, lastReview: T0 - 500, step: 1, reps: 1, lapses: 0 },
      p0001: { state: 2, stability: 9, difficulty: 4, due: T0 + 99, lastReview: T0 - 20, step: 0, reps: 5, lapses: 0 },
    },
    modeHistory: { w0001: 'recall' },
    session: { items: [], idx: 0 },
    stats: {
      streak: 4, lastStudyDay: '2026-01-15', dayKey: '2026-01-15', newToday: 3, reviewsToday: 12,
      history: { '2026-01-13': { done: 10, correct: 8 }, '2026-01-14': { done: 20, correct: 15 } },
      tone: { mid: { c: 30, t: 40 }, low: { c: 5, t: 10 }, falling: { c: 0, t: 0 }, high: { c: 9, t: 9 }, rising: { c: 2, t: 8 } },
      coverageHistory: [{ day: '2026-01-14', pct: 12.5, learned: 100 }],
    },
  };
  const v2 = migrateV1toV2(v1, 'DEV', T0);
  ok('every card migrated', Object.keys(v2.cards).length === 3);
  for (const id of Object.keys(v1.cards)) {
    const a = v1.cards[id], b = v2.cards[id];
    ok(`card ${id} FSRS fields identical`, b && ['state', 'stability', 'difficulty', 'due', 'lastReview', 'step', 'reps', 'lapses'].every((k) => a[k] === b[k]));
  }
  ok('settings renamed showThai -> showThaiScript', v2.settings.showThaiScript === false && v2.settings.newPerDay === 20);
  ok('history became per-day sessions', v2.sessions.length === 2 && v2.sessions.every((s) => s.activeMs === 0));
  ok('no invented hours', D.totalActiveMs(v2) === 0);
  ok('backfilled cards counted', D.answersPerDay(v2, 5, Date.parse('2026-01-15T12:00:00Z')).reduce((a, d) => a + d.done, 0) === 30);
  const acc = D.toneAccuracy(v2);
  ok('tone tallies preserved', acc.mid.count === 40 && acc.mid.correct === 30 && acc.rising.count === 8);
  ok('coverage curve preserved', v2.coverageSnapshots.length === 1 && v2.coverageSnapshots[0].pct === 12.5);
  ok('counters dropped', v2.stats === undefined && v2.streak === undefined);
  eq('migration merges cleanly with itself', merge(v2, v2), merge(v2, migrateV1toV2(v1, 'DEV', T0)));
}

console.log('derive: streak, today counts, milestones');
{
  const now = Date.parse('2026-01-15T20:00:00Z');
  const day = (n) => now - n * DAY_MS;
  const d = doc({
    sessions: [sess('s0', day(0), 600000), sess('s1', day(1), 600000), sess('s2', day(2), 600000), sess('s4', day(4), 600000)],
    reviews: [
      review('r1', day(0), 'w1', true, 'mid', 'recall', true),
      review('r2', day(0), 'w1', false, 'mid', 'recall', false),
      review('r3', day(0), 'w2', true, 'low', 'audio', false),
    ],
  });
  ok('streak stops at the gap', D.streakDays(d, now) === 3, String(D.streakDays(d, now)));
  const tc = D.todayCounts(d, now);
  ok('new card counted once, not double-counted as a review', tc.newToday === 1 && tc.reviewsToday === 1, JSON.stringify(tc));
  ok('30-day chart has 30 buckets', D.minutesPerDay(d, 30, now).length === 30);
  ok('minutes are real', D.minutesPerDay(d, 30, now).slice(-1)[0].minutes === 10);
  const m = D.milestone(11 * 3600000);
  ok('milestone ladder positions correctly', m.prev === 10 && m.next === 25);
  ok('hours never round up', D.fmtHM(3599999).text === '59m' && D.fmtHM(3600000).text === '1h 0m');
}

console.log('derive: a missed day today does not kill yesterday\'s streak');
{
  const now = Date.parse('2026-01-15T09:00:00Z');
  const d = doc({ sessions: [sess('s1', now - DAY_MS, 600000), sess('s2', now - 2 * DAY_MS, 600000)] });
  ok('streak still counts', D.streakDays(d, now) === 2, String(D.streakDays(d, now)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
