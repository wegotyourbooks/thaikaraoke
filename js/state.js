// Persistent state: settings, FSRS card store, stats, streak, session resume.
// Autosaves to localStorage after every mutation that matters.
const KEY = 'thaikaraoke.v1';
export const SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS = {
  newPerDay: 10,
  maxReviews: 60,
  speechRate: 0.9,
  showThai: true,
  politeness: 'male', // 'male' | 'female'
};

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function freshState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    cards: {},          // id -> fsrs card object (see fsrs.js)
    modeHistory: {},    // id -> last quiz mode used
    introducedOrder: [],// word ids in the order they were introduced
    newQueuePos: 0,     // index into wordsByRank for next new word
    stats: {
      streak: 0,
      lastStudyDay: null,
      dayKey: todayKey(),
      newToday: 0,
      reviewsToday: 0,
      history: {},      // dayKey -> { done, correct, total }
      tone: { mid: { c: 0, t: 0 }, low: { c: 0, t: 0 }, falling: { c: 0, t: 0 }, high: { c: 0, t: 0 }, rising: { c: 0, t: 0 } },
      coverageHistory: [], // [{ day, pct, learned }]
    },
    session: null,      // { queue, idx, correct, total, wrongRequeued, startedNew } for resume
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.warn('State load failed, starting fresh', e);
    return freshState();
  }
}

function migrate(s) {
  if (!s || typeof s !== 'object') return freshState();
  const base = freshState();
  // shallow merge with defaults so new fields appear
  const merged = { ...base, ...s };
  merged.settings = { ...base.settings, ...(s.settings || {}) };
  merged.stats = { ...base.stats, ...(s.stats || {}) };
  merged.stats.tone = { ...base.stats.tone, ...((s.stats && s.stats.tone) || {}) };
  merged.stats.history = (s.stats && s.stats.history) || {};
  merged.stats.coverageHistory = (s.stats && s.stats.coverageHistory) || [];
  merged.cards = s.cards || {};
  merged.modeHistory = s.modeHistory || {};
  merged.introducedOrder = s.introducedOrder || [];
  merged.schemaVersion = SCHEMA_VERSION;
  return merged;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('State save failed', e);
  }
}

// Roll over daily counters and streak if the calendar day changed.
export function rolloverDay() {
  const key = todayKey();
  if (state.stats.dayKey !== key) {
    state.stats.dayKey = key;
    state.stats.newToday = 0;
    state.stats.reviewsToday = 0;
    save();
  }
}

export function getState() { return state; }
export function getSettings() { return state.settings; }
export function setSetting(k, v) { state.settings[k] = v; save(); }

export function getCard(id) { return state.cards[id] || null; }
export function setCard(id, card) { state.cards[id] = card; save(); }
export function hasCard(id) { return !!state.cards[id]; }

export function lastMode(id) { return state.modeHistory[id] || null; }
export function setLastMode(id, mode) { state.modeHistory[id] = mode; }

export function introducedIds() { return state.introducedOrder; }
export function isIntroduced(id) { return state.cards[id] != null; }

export function markIntroduced(id) {
  if (!state.introducedOrder.includes(id)) state.introducedOrder.push(id);
}

export function newQueuePos() { return state.newQueuePos; }
export function setNewQueuePos(n) { state.newQueuePos = n; save(); }

// --- stats ---
export function stats() { return state.stats; }

export function recordAnswer({ correct, isNew, isReview, tone }) {
  const st = state.stats;
  const key = todayKey();
  const h = (st.history[key] = st.history[key] || { done: 0, correct: 0, total: 0 });
  h.done += 1; h.total += 1; if (correct) h.correct += 1;
  if (isNew) st.newToday += 1;
  if (isReview) st.reviewsToday += 1;
  if (tone && st.tone[tone]) { st.tone[tone].t += 1; if (correct) st.tone[tone].c += 1; }
  save();
}

// Record a tone-gym answer (does not affect FSRS or daily limits).
export function recordToneAnswer(tone, correct) {
  const t = state.stats.tone[tone];
  if (t) { t.t += 1; if (correct) t.c += 1; save(); }
}

export function bumpStreakForToday() {
  const st = state.stats;
  const key = todayKey();
  if (st.lastStudyDay === key) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yKey = todayKey(y);
  st.streak = st.lastStudyDay === yKey ? st.streak + 1 : 1;
  st.lastStudyDay = key;
  save();
}

export function pushCoveragePoint(pct, learned) {
  const st = state.stats;
  const key = todayKey();
  const last = st.coverageHistory[st.coverageHistory.length - 1];
  if (last && last.day === key) { last.pct = pct; last.learned = learned; }
  else st.coverageHistory.push({ day: key, pct, learned });
  save();
}

// --- session resume ---
export function getSession() { return state.session; }
export function setSession(s) { state.session = s; save(); }
export function clearSession() { state.session = null; save(); }

// --- export / import / reset ---
export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  state = migrate(parsed);
  save();
  return state;
}

export function resetAll() {
  state = freshState();
  save();
  return state;
}
