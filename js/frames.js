// Sentence-frame engine.
//
// A frame is a real sentence with holes. The holes are filled from typed pools,
// and only ever with words whose card already exists and is no longer new, so a
// substitution drill never smuggles in unseen vocabulary. Frames own no FSRS
// cards: grading a frame grades the word that filled the slot.
import { frames } from '../data/frames.js';
import { pools } from '../data/pools.js';
import { wordById } from './data.js';
import * as S from './state.js';

export { frames, pools };
export const frameById = new Map(frames.map((f) => [f.id, f]));
export const poolById = new Map(pools.map((p) => [p.id, p]));

// A word is usable in a drill once it has been introduced and left the new state.
export function isMet(id) {
  const c = S.getCard(id);
  return !!c && c.state !== 'new';
}

export function eligibleFillers(frame, slot) {
  const pool = poolById.get(slot);
  if (!pool) return [];
  return pool.wordIds.filter(isMet);
}

// A frame is usable only when every one of its slots has a met word.
export function isFrameReady(frame) {
  return frame.slots.every((s) => eligibleFillers(frame, s).length > 0);
}

export function readyFrames() {
  return frames.filter(isFrameReady);
}

// Frames that would drill this particular word (it is in one of their pools).
// A word that has not been met yet is never drilled, even if a frame is ready.
export function framesForWord(wordId) {
  if (!isMet(wordId)) return [];
  return frames.filter((f) => f.slots.some((s) => {
    const pool = poolById.get(s);
    return pool && pool.wordIds.includes(wordId) && isFrameReady(f);
  }));
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Word glosses read "to eat", "to go". Dropped into an English frame that
// already supplies the grammar, they need the bare sense.
export function gloss(word) {
  return word.en.split(/[,(;]/)[0].trim().replace(/^to\s+/, '');
}

// Builds a concrete sentence. `pinned` forces one slot to a specific word so a
// drill can target the card being reviewed.
export function instantiate(frame, pinned = {}) {
  const fills = {};
  for (const slot of frame.slots) {
    const chosen = pinned[slot] && isMet(pinned[slot])
      ? pinned[slot]
      : pick(eligibleFillers(frame, slot));
    if (!chosen) return null;
    fills[slot] = chosen;
  }
  let th = frame.th, karaoke = frame.karaoke, en = frame.en;
  for (const [slot, id] of Object.entries(fills)) {
    const w = wordById.get(id);
    th = th.replaceAll('{' + slot + '}', w.thai);
    karaoke = karaoke.replaceAll('{' + slot + '}', w.karaoke);
    en = en.replaceAll('{' + slot + '}', gloss(w));
  }
  return { frame, fills, th, karaoke, en };
}

// The slot a given word occupies in a frame, if any.
export function slotForWord(frame, wordId) {
  return frame.slots.find((s) => {
    const pool = poolById.get(s);
    return pool && pool.wordIds.includes(wordId);
  }) || null;
}

// A drill for one word: a ready frame with that word pinned into its slot.
export function drillFor(wordId) {
  const candidates = framesForWord(wordId);
  if (!candidates.length) return null;
  const frame = pick(candidates);
  const slot = slotForWord(frame, wordId);
  const inst = instantiate(frame, { [slot]: wordId });
  return inst ? { ...inst, slot } : null;
}

// Wrong answers for the multiple-choice frame mode: same pool, also met, so
// every option is plausible and already known.
export function distractors(frame, slot, exceptId, n = 3) {
  const options = eligibleFillers(frame, slot).filter((id) => id !== exceptId);
  const out = [];
  while (out.length < n && options.length) {
    out.push(options.splice(Math.floor(Math.random() * options.length), 1)[0]);
  }
  return out;
}

export function markFrameSeen(frameId) {
  const p = S.getFrameProgress(frameId);
  if (!p || !p.seen) S.setFrameProgress(frameId, { seen: 1, attempts: p ? p.attempts || 0 : 0, correct: p ? p.correct || 0 : 0 });
}

export function isFirstEncounter(frameId) {
  const p = S.getFrameProgress(frameId);
  return !p || !p.seen;
}
