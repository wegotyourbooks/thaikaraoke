// Persistent state, schema v2.
//
// The document is split in two:
//   * syncable  — facts only: append-only logs (reviews, sessions, lessons shown,
//     coverage snapshots) and keyed last-write-wins objects (cards, settings,
//     frameProgress). This is what merges across devices.
//   * _local    — device-only UI state (session resume, mode history, in-flight
//     timer, gist id, token, sync bookkeeping). Never pushed, never merged.
//
// Derive-never-store: no counter (streak, cards today, tone accuracy, hours) is
// ever written down. See derive.js. Timestamps are epoch milliseconds.
import { migrateV1toV2, emptyDoc, DEFAULT_SETTINGS, SCHEMA_VERSION } from './migrate.js';
import { merge } from './merge.js';
import { localDay } from './derive.js';

export { SCHEMA_VERSION, DEFAULT_SETTINGS };

const KEY = 'thaikaraoke.v2';
const KEY_V1 = 'thaikaraoke.v1';
const KEY_BACKUP = 'thaikaraoke-v1-backup';

const LOCAL_DEFAULT = {
  deviceId: '',
  modeHistory: {},
  resumePoint: null,
  activeSession: null,
  gistId: '',
  token: '',
  lastSyncAt: 0,
  pendingPush: false,
  lessonCycle: [],
};

function newDeviceId() {
  const r = new Uint8Array(8);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) globalThis.crypto.getRandomValues(r);
  else for (let i = 0; i < r.length; i++) r[i] = Math.floor(Math.random() * 256);
  return [...r].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let seq = 0;
function uid(prefix) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${state._local.deviceId.slice(0, 6)}`;
}

function withLocal(doc, local) {
  return { ...doc, _local: { ...LOCAL_DEFAULT, ...(local || {}) } };
}

function freshState() {
  const doc = withLocal(emptyDoc(), { deviceId: newDeviceId() });
  doc.settings.updatedBy = doc._local.deviceId;
  return doc;
}

let migrationRan = false;
export function didMigrate() { return migrationRan; }

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { return freshState(); }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schemaVersion >= 2) return hydrate(parsed);
    } catch (e) { console.warn('v2 state unreadable, checking v1 backup', e); }
  }
  // No v2 document: migrate v1 if one exists.
  let v1raw = null;
  try { v1raw = localStorage.getItem(KEY_V1); } catch (e) {}
  if (!v1raw) return freshState();
  // Back up the untouched v1 blob BEFORE anything else happens to it.
  try {
    if (localStorage.getItem(KEY_BACKUP) == null) localStorage.setItem(KEY_BACKUP, v1raw);
  } catch (e) { console.warn('v1 backup failed', e); }
  let v1 = null;
  try { v1 = JSON.parse(v1raw); } catch (e) { return freshState(); }
  const deviceId = newDeviceId();
  const doc = withLocal(migrateV1toV2(v1, deviceId), {
    deviceId,
    modeHistory: v1.modeHistory || {},
    resumePoint: v1.session || null,
  });
  migrationRan = true;
  return doc;
}

function hydrate(parsed) {
  const base = emptyDoc(parsed.createdAt || Date.now());
  const doc = { ...base, ...parsed };
  doc.settings = { ...base.settings, ...(parsed.settings || {}) };
  doc._local = { ...LOCAL_DEFAULT, ...(parsed._local || {}) };
  if (!doc._local.deviceId) doc._local.deviceId = newDeviceId();
  doc.schemaVersion = SCHEMA_VERSION;
  return doc;
}

let state = load();
// Persist immediately so the device id (used for merge tie-breaks) is stable
// from the very first load, not just after the first answer.
save();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('State save failed', e); }
}

export function getState() { return state; }
export function deviceId() { return state._local.deviceId; }

// ---- device-local slice ----
export function local() { return state._local; }
export function setLocal(patch) { Object.assign(state._local, patch); save(); }

// ---- settings (one LWW object) ----
export function getSettings() { return state.settings; }
export function setSetting(k, v) {
  state.settings[k] = v;
  state.settings.updatedAt = Date.now();
  state.settings.updatedBy = deviceId();
  save();
}

// ---- cards (keyed LWW) ----
export function getCard(id) { return state.cards[id] || null; }
export function hasCard(id) { return !!state.cards[id]; }
export function isIntroduced(id) { return !!state.cards[id]; }
export function setCard(id, card) {
  state.cards[id] = { ...card, updatedAt: Date.now(), updatedBy: deviceId() };
  save();
}

// ---- append-only logs ----
export function appendReview({ cardId, grade, correct, mode, tone, isNew, ts = Date.now() }) {
  const rec = { id: uid('r'), ts, cardId, grade, correct: !!correct, mode: mode || 'unknown', tone: tone || null, isNew: !!isNew, deviceId: deviceId() };
  state.reviews.push(rec);
  save();
  return rec;
}

export function appendSession({ startedAt, endedAt, activeMs, cardsDone, correct, mode }) {
  const rec = {
    id: uid('s'), deviceId: deviceId(),
    startedAt, endedAt, activeMs: Math.max(0, Math.round(activeMs || 0)),
    cardsDone: cardsDone || 0, correct: correct || 0, mode: mode || 'session',
  };
  state.sessions.push(rec);
  save();
  return rec;
}

export function appendLessonShown(lessonId, ts = Date.now()) {
  const rec = { id: uid('l'), lessonId, ts, deviceId: deviceId() };
  state.microLessonsShown.push(rec);
  save();
  return rec;
}

export function lessonsShown() { return state.microLessonsShown; }

export function pushCoveragePoint(pct, learned) {
  const day = localDay();
  const i = state.coverageSnapshots.findIndex((s) => s.id === day);
  const rec = { id: day, day, pct, learned };
  if (i >= 0) state.coverageSnapshots[i] = rec; else state.coverageSnapshots.push(rec);
  save();
}

export function coverageSnapshots() { return state.coverageSnapshots; }

// ---- frame progress (keyed LWW, no FSRS cards of its own) ----
export function getFrameProgress(id) { return state.frameProgress[id] || null; }
export function setFrameProgress(id, patch) {
  const cur = state.frameProgress[id] || { seen: 0, attempts: 0, correct: 0 };
  state.frameProgress[id] = { ...cur, ...patch, updatedAt: Date.now(), updatedBy: deviceId() };
  save();
}
export function bumpFrame(id, correct) {
  const cur = state.frameProgress[id] || { seen: 0, attempts: 0, correct: 0 };
  setFrameProgress(id, { seen: (cur.seen || 0) + 1, attempts: (cur.attempts || 0) + 1, correct: (cur.correct || 0) + (correct ? 1 : 0) });
}

// ---- device-local UI state ----
export function lastMode(id) { return state._local.modeHistory[id] || null; }
export function setLastMode(id, mode) { state._local.modeHistory[id] = mode; }

export function getSession() { return state._local.resumePoint; }
export function setSession(s) { state._local.resumePoint = s; save(); }
export function clearSession() { state._local.resumePoint = null; save(); }

// ---- sync surface ----
const LOCAL_ONLY = new Set(['_local']);

export function syncableDoc() {
  const out = {};
  for (const [k, v] of Object.entries(state)) if (!LOCAL_ONLY.has(k)) out[k] = v;
  return JSON.parse(JSON.stringify(out));
}

export function replaceSyncable(doc) {
  const keep = state._local;
  state = { ...hydrate(doc), _local: keep };
  save();
}

// ---- export / import / reset ----
export function exportJSON() { return JSON.stringify(syncableDoc(), null, 2); }

// Importing merges rather than replaces, so restoring a backup onto a device
// that has since studied never destroys the newer work.
export function importJSON(text) {
  const parsed = JSON.parse(text);
  const incoming = parsed && parsed.schemaVersion >= 2
    ? hydrate(parsed)
    : withLocal(migrateV1toV2(parsed, 'imported'), {});
  replaceSyncable(merge(syncableDoc(), stripLocal(incoming)));
  return state;
}

function stripLocal(doc) {
  const out = { ...doc };
  delete out._local;
  return out;
}

export function resetAll() {
  const keepDevice = state._local.deviceId;
  state = withLocal(emptyDoc(), { deviceId: keepDevice });
  state.settings.updatedBy = keepDevice;
  save();
  return state;
}

// ---- v1 backup ----
export function hasV1Backup() {
  try { return localStorage.getItem(KEY_BACKUP) != null; } catch (e) { return false; }
}

// Puts the v1 blob back where v1 looked for it and removes the v2 document, so
// the previous build (or a re-migration) starts from exactly the old state.
export function restoreV1Backup() {
  try {
    const raw = localStorage.getItem(KEY_BACKUP);
    if (raw == null) return false;
    localStorage.setItem(KEY_V1, raw);
    localStorage.removeItem(KEY);
    return true;
  } catch (e) { return false; }
}
