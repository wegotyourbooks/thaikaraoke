// FSRS v4.5 scheduler. Pure module: no DOM, no storage. Times are ms epochs.
// Grades: 1=Again 2=Hard 3=Good 4=Easy.

export const GRADE = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
export const STATE = { NEW: 'new', LEARNING: 'learning', REVIEW: 'review', RELEARNING: 'relearning' };

// FSRS-4.5 published default parameters.
export const DEFAULT_W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];

export const DESIRED_RETENTION = 0.9;

const DECAY = -0.5;
const FACTOR = 19 / 81; // 0.9 retention at t = S
const MIN = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const LEARNING_STEPS_MS = [1 * MIN, 10 * MIN];
const RELEARNING_STEPS_MS = [10 * MIN];
const MAX_INTERVAL_DAYS = 365 * 10;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function newCard(now = Date.now()) {
  return {
    state: STATE.NEW,
    stability: 0,
    difficulty: 0,
    due: now,          // new cards are due immediately
    lastReview: null,
    step: 0,           // index into learning/relearning steps
    reps: 0,
    lapses: 0,
  };
}

export function retrievability(card, now = Date.now()) {
  if (card.state !== STATE.REVIEW || !card.lastReview || card.stability <= 0) return 1;
  const elapsedDays = Math.max(0, (now - card.lastReview) / DAY);
  return Math.pow(1 + FACTOR * (elapsedDays / card.stability), DECAY);
}

export function intervalDays(stability, retention = DESIRED_RETENTION) {
  const ivl = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return clamp(Math.round(ivl), 1, MAX_INTERVAL_DAYS);
}

function initStability(w, grade) {
  return Math.max(w[grade - 1], 0.1);
}

function initDifficulty(w, grade) {
  return clamp(w[4] - (grade - 3) * w[5], 1, 10);
}

function nextDifficulty(w, d, grade) {
  const d0good = initDifficulty(w, GRADE.GOOD);
  const next = d - w[6] * (grade - 3);
  return clamp(w[7] * d0good + (1 - w[7]) * next, 1, 10);
}

function nextRecallStability(w, d, s, r, grade) {
  const hardPenalty = grade === GRADE.HARD ? w[15] : 1;
  const easyBonus = grade === GRADE.EASY ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) *
    (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus);
}

function nextForgetStability(w, d, s, r) {
  const sf = w[11] * Math.pow(d, -w[12]) *
    (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return Math.min(sf, s); // post-lapse stability never exceeds prior stability
}

// Grade a card. Returns a NEW card object (input is not mutated).
export function review(card, grade, now = Date.now(), opts = {}) {
  const w = opts.w || DEFAULT_W;
  const retention = opts.retention || DESIRED_RETENTION;
  const c = { ...card, reps: card.reps + 1, lastReview: now };

  if (card.state === STATE.NEW || card.state === STATE.LEARNING) {
    // Seed memory state on first grade; refine difficulty on later learning grades.
    if (card.state === STATE.NEW) {
      c.stability = initStability(w, grade);
      c.difficulty = initDifficulty(w, grade);
    } else {
      c.difficulty = nextDifficulty(w, c.difficulty, grade);
      if (grade === GRADE.EASY || grade === GRADE.GOOD) {
        c.stability = Math.max(c.stability, initStability(w, grade));
      }
    }
    if (grade === GRADE.EASY) {
      c.state = STATE.REVIEW;
      c.step = 0;
      c.due = now + intervalDays(c.stability, retention) * DAY;
    } else if (grade === GRADE.AGAIN) {
      c.state = STATE.LEARNING;
      c.step = 0;
      c.due = now + LEARNING_STEPS_MS[0];
    } else if (grade === GRADE.HARD) {
      c.state = STATE.LEARNING;
      c.due = now + (LEARNING_STEPS_MS[card.state === STATE.NEW ? 0 : c.step] ?? LEARNING_STEPS_MS[0]);
    } else { // GOOD
      const nextStep = card.state === STATE.NEW ? 1 : c.step + 1;
      if (nextStep >= LEARNING_STEPS_MS.length) {
        c.state = STATE.REVIEW;
        c.step = 0;
        c.due = now + intervalDays(c.stability, retention) * DAY;
      } else {
        c.state = STATE.LEARNING;
        c.step = nextStep;
        c.due = now + LEARNING_STEPS_MS[nextStep];
      }
    }
    return c;
  }

  if (card.state === STATE.RELEARNING) {
    c.difficulty = nextDifficulty(w, c.difficulty, grade);
    if (grade === GRADE.AGAIN) {
      c.step = 0;
      c.due = now + RELEARNING_STEPS_MS[0];
    } else if (grade === GRADE.HARD) {
      c.due = now + (RELEARNING_STEPS_MS[c.step] ?? RELEARNING_STEPS_MS[0]);
    } else {
      const nextStep = c.step + 1;
      if (grade === GRADE.EASY || nextStep >= RELEARNING_STEPS_MS.length) {
        c.state = STATE.REVIEW;
        c.step = 0;
        c.due = now + intervalDays(c.stability, retention) * DAY;
      } else {
        c.step = nextStep;
        c.due = now + RELEARNING_STEPS_MS[nextStep];
      }
    }
    return c;
  }

  // REVIEW state
  const r = retrievability(card, now);
  c.difficulty = nextDifficulty(w, card.difficulty, grade);
  if (grade === GRADE.AGAIN) {
    c.stability = nextForgetStability(w, card.difficulty, card.stability, r);
    c.lapses = card.lapses + 1;
    c.state = STATE.RELEARNING;
    c.step = 0;
    c.due = now + RELEARNING_STEPS_MS[0];
  } else {
    c.stability = nextRecallStability(w, card.difficulty, card.stability, r, grade);
    let ivl = intervalDays(c.stability, retention);
    if (grade === GRADE.HARD) {
      // Hard must not exceed the elapsed-time-implied Good interval ordering.
      ivl = Math.max(1, Math.min(ivl, intervalDays(card.stability, retention)));
    }
    c.due = now + ivl * DAY;
  }
  return c;
}

// Preview the interval each grade would produce (for grade-button labels).
export function previewIntervals(card, now = Date.now(), opts = {}) {
  const out = {};
  for (const g of [1, 2, 3, 4]) {
    const next = review(card, g, now, opts);
    out[g] = next.due - now;
  }
  return out;
}

export function formatInterval(ms) {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${(d / 30.4).toFixed(1)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}
