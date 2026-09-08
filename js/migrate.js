// Pure v1 -> v2 migration. No DOM, no localStorage: Node-testable.
//
// v1 stored counters (streak, newToday, tone tallies, per-day history). Counters
// cannot be merged across devices, so v2 keeps only facts and derives every
// number at read time. Nothing is thrown away: per-day history becomes backfill
// session records, tone tallies become reviewsDaily aggregates, and the coverage
// curve becomes a snapshot log.

export const SCHEMA_VERSION = 2;
export const TONES = ['mid', 'low', 'falling', 'high', 'rising'];

export const DEFAULT_SETTINGS = {
  newPerDay: 10,
  maxReviews: 60,
  speechRate: 0.9,
  showThaiScript: true,
  politeness: 'male',
  showLessons: true,
  phrasesInQueue: true,
};

export function emptyDoc(now = Date.now()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    settings: { ...DEFAULT_SETTINGS, updatedAt: now, updatedBy: '' },
    cards: {},
    frameProgress: {},
    reviews: [],
    reviewsDaily: [],
    sessions: [],
    microLessonsShown: [],
    coverageSnapshots: [],
  };
}

function dayToMs(day) {
  const t = Date.parse(day + 'T00:00:00.000Z');
  return Number.isFinite(t) ? t : 0;
}

export function migrateV1toV2(v1, deviceId, now = Date.now()) {
  const doc = emptyDoc(now);
  if (!v1 || typeof v1 !== 'object') return doc;
  doc.createdAt = now;

  // settings (showThai was renamed to showThaiScript)
  const s = v1.settings || {};
  doc.settings = {
    ...DEFAULT_SETTINGS,
    newPerDay: num(s.newPerDay, DEFAULT_SETTINGS.newPerDay),
    maxReviews: num(s.maxReviews, DEFAULT_SETTINGS.maxReviews),
    speechRate: num(s.speechRate, DEFAULT_SETTINGS.speechRate),
    showThaiScript: s.showThai !== undefined ? !!s.showThai : DEFAULT_SETTINGS.showThaiScript,
    politeness: s.politeness === 'female' ? 'female' : 'male',
    updatedAt: now,
    updatedBy: deviceId,
  };

  // cards: FSRS fields carried over verbatim, stamped for LWW merging.
  for (const [id, c] of Object.entries(v1.cards || {})) {
    if (!c || typeof c !== 'object') continue;
    doc.cards[id] = {
      state: c.state,
      stability: c.stability,
      difficulty: c.difficulty,
      due: c.due,
      lastReview: c.lastReview ?? null,
      step: c.step ?? 0,
      reps: c.reps ?? 0,
      lapses: c.lapses ?? 0,
      updatedAt: typeof c.lastReview === 'number' ? c.lastReview : now,
      updatedBy: deviceId,
    };
  }

  const stats = v1.stats || {};

  // per-day history -> one backfill session per day. activeMs is 0: v1 never
  // recorded time and inventing hours would poison the honest-time dashboard.
  for (const [day, h] of Object.entries(stats.history || {})) {
    if (!h) continue;
    const startedAt = dayToMs(day);
    doc.sessions.push({
      id: 'backfill-' + day,
      deviceId,
      startedAt,
      endedAt: startedAt,
      activeMs: 0,
      cardsDone: num(h.done, 0),
      correct: num(h.correct, 0),
      mode: 'session',
      backfill: true,
    });
  }

  // tone tallies -> aggregate records so tone accuracy survives without counters
  const today = new Date(now).toISOString().slice(0, 10);
  for (const tone of TONES) {
    const t = (stats.tone || {})[tone];
    if (!t || !num(t.t, 0)) continue;
    doc.reviewsDaily.push({
      id: `${today}|backfill|${tone}`,
      date: today,
      mode: 'backfill',
      tone,
      count: num(t.t, 0),
      correctCount: num(t.c, 0),
    });
  }

  // coverage curve -> append-only snapshots (historical facts, one per day)
  for (const p of stats.coverageHistory || []) {
    if (!p || !p.day) continue;
    doc.coverageSnapshots.push({ id: p.day, day: p.day, pct: num(p.pct, 0), learned: num(p.learned, 0) });
  }

  doc.sessions.sort((a, b) => a.startedAt - b.startedAt);
  doc.coverageSnapshots.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return doc;
}

function num(v, d) { return typeof v === 'number' && Number.isFinite(v) ? v : d; }
