// Micro-lesson selection. Pure apart from reading state.
import { microLessons } from '../data/microlessons.js';
import * as D from './derive.js';

export const LESSON_BY_ID = new Map(microLessons.map((l) => [l.id, l]));
export const WEAK_TONE_PCT = 75;
export const MIN_TONE_SAMPLES = 20;
export const REPEAT_COOLDOWN_DAYS = 14;
const DAY_MS = 86400000;

function lastShownMap(shownLog) {
  const m = new Map();
  for (const r of shownLog || []) {
    const prev = m.get(r.lessonId) || 0;
    if (r.ts > prev) m.set(r.lessonId, r.ts);
  }
  return m;
}

// Weakest tone first, but only once there is enough evidence to trust it.
export function weakTones(doc) {
  const acc = D.toneAccuracy(doc);
  return Object.entries(acc)
    .filter(([, s]) => s.count >= MIN_TONE_SAMPLES && s.pct !== null && s.pct < WEAK_TONE_PCT)
    .sort((a, b) => a[1].pct - b[1].pct)
    .map(([tone, s]) => ({ tone, pct: s.pct, count: s.count }));
}

// Returns { lesson, reason } or null when nothing should be shown.
export function pickLesson(doc, now = Date.now()) {
  if (doc.settings && doc.settings.showLessons === false) return null;
  const shown = lastShownMap(doc.microLessonsShown);
  const cooled = (l) => !shown.has(l.id) || now - shown.get(l.id) > REPEAT_COOLDOWN_DAYS * DAY_MS;

  for (const w of weakTones(doc)) {
    const target = 'tone:' + w.tone;
    const l = microLessons.find((x) => x.targetStat === target && cooled(x));
    if (l) return { lesson: l, reason: `your ${w.tone} tone is at ${Math.round(w.pct)}%` };
  }

  // Rotation: anything never shown, in order; then the least recently shown.
  const unseen = microLessons.find((l) => !shown.has(l.id));
  if (unseen) return { lesson: unseen, reason: '' };
  const oldest = microLessons.slice().sort((a, b) => (shown.get(a.id) || 0) - (shown.get(b.id) || 0))[0];
  return oldest && cooled(oldest) ? { lesson: oldest, reason: '' } : null;
}

export { microLessons };
