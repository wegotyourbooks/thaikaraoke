// Unit tests for js/fsrs.js. Run: node scripts/test-fsrs.mjs
import {
  newCard, review, retrievability, intervalDays, previewIntervals,
  GRADE, STATE, DEFAULT_W, DESIRED_RETENTION,
} from '../js/fsrs.js';

const DAY = 86400000;
const MIN = 60000;
let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log(`  ok  ${msg}`); }
  else { failures++; console.error(`FAIL  ${msg}`); }
}
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const T0 = Date.parse('2026-01-01T00:00:00Z');

console.log('new card basics');
{
  const c = newCard(T0);
  ok(c.state === STATE.NEW && c.due === T0 && c.reps === 0 && c.lapses === 0, 'newCard shape');
  ok(retrievability(c, T0) === 1, 'retrievability of non-review card is 1');
}

console.log('learning steps 1m/10m');
{
  let c = newCard(T0);
  c = review(c, GRADE.AGAIN, T0);
  ok(c.state === STATE.LEARNING && c.due === T0 + 1 * MIN, 'Again on new -> 1m step');
  c = review(c, GRADE.GOOD, T0 + 1 * MIN);
  ok(c.state === STATE.LEARNING && c.due === T0 + 1 * MIN + 10 * MIN, 'Good -> 10m step');
  c = review(c, GRADE.GOOD, T0 + 11 * MIN);
  ok(c.state === STATE.REVIEW, 'Good on last step graduates to review');
  ok(c.due > T0 + DAY / 2, 'graduated interval is at least ~1 day');
}

console.log('Good on new skips to step 2, Easy graduates immediately');
{
  let c = review(newCard(T0), GRADE.GOOD, T0);
  ok(c.state === STATE.LEARNING && c.due === T0 + 10 * MIN, 'Good on new -> 10m step');
  const e = review(newCard(T0), GRADE.EASY, T0);
  ok(e.state === STATE.REVIEW, 'Easy on new graduates immediately');
  ok(approx(e.stability, DEFAULT_W[3]), 'Easy initial stability = w[3]');
  const ivl = Math.round((e.due - T0) / DAY);
  ok(ivl === intervalDays(DEFAULT_W[3]), 'Easy graduate interval matches stability');
}

console.log('initial difficulty');
{
  const g = review(newCard(T0), GRADE.GOOD, T0);
  ok(approx(g.difficulty, DEFAULT_W[4]), 'D0(Good) = w[4]');
  const a = review(newCard(T0), GRADE.AGAIN, T0);
  ok(approx(a.difficulty, Math.min(10, DEFAULT_W[4] + 2 * DEFAULT_W[5])), 'D0(Again) = w[4]+2*w[5]');
  ok(a.difficulty > g.difficulty, 'Again is harder than Good');
}

console.log('retrievability curve');
{
  let c = review(newCard(T0), GRADE.EASY, T0); // review state, S = w[3]
  const S = c.stability;
  const atS = retrievability(c, T0 + S * DAY);
  ok(approx(atS, 0.9, 1e-6), 'R = 0.9 exactly at t = S (FSRS-4.5 factor 19/81)');
  ok(retrievability(c, T0) === 1 || retrievability(c, T0) > 0.999, 'R ~ 1 at t=0');
  ok(retrievability(c, T0 + 4 * S * DAY) < atS, 'R decreases with time');
}

console.log('review-state grading');
{
  const base = review(newCard(T0), GRADE.EASY, T0);
  const t1 = base.due; // review exactly when due
  const again = review(base, GRADE.AGAIN, t1);
  const hard = review(base, GRADE.HARD, t1);
  const good = review(base, GRADE.GOOD, t1);
  const easy = review(base, GRADE.EASY, t1);
  ok(again.state === STATE.RELEARNING && again.lapses === 1, 'Again -> relearning + lapse');
  ok(again.due === t1 + 10 * MIN, 'relearning step is 10m');
  ok(again.stability < base.stability, 'lapse reduces stability');
  ok(good.stability > base.stability, 'Good grows stability');
  ok(hard.stability < good.stability && good.stability < easy.stability, 'S(hard) < S(good) < S(easy)');
  ok(hard.due <= good.due && good.due <= easy.due, 'interval ordering hard <= good <= easy');
  ok(hard.difficulty > good.difficulty && good.difficulty > easy.difficulty, 'difficulty ordering');
  for (const c of [again, hard, good, easy]) {
    ok(c.difficulty >= 1 && c.difficulty <= 10, `difficulty in [1,10] (${c.difficulty.toFixed(2)})`);
  }
}

console.log('relearning flow');
{
  let c = review(newCard(T0), GRADE.EASY, T0);
  c = review(c, GRADE.AGAIN, c.due);            // -> relearning
  const t = c.due;
  const back = review(c, GRADE.GOOD, t);
  ok(back.state === STATE.REVIEW, 'Good in relearning returns to review');
  const stuck = review(c, GRADE.AGAIN, t);
  ok(stuck.state === STATE.RELEARNING && stuck.due === t + 10 * MIN, 'Again in relearning repeats step');
  ok(stuck.lapses === c.lapses, 'no extra lapse counted while relearning');
}

console.log('long-run simulation stays sane');
{
  let c = newCard(T0);
  let now = T0;
  let prevIvl = 0;
  for (let i = 0; i < 30; i++) {
    c = review(c, GRADE.GOOD, now);
    now = c.due;
  }
  ok(c.state === STATE.REVIEW, '30x Good ends in review');
  ok(c.reps === 30, 'reps counted');
  const ivl = (c.due - c.lastReview) / DAY;
  ok(ivl > 30, `interval grows large with consistent Good (${Math.round(ivl)}d)`);
  ok(Number.isFinite(c.stability) && Number.isFinite(c.difficulty), 'no NaN/Infinity');
  ok(ivl <= 3650, 'interval capped at 10y');
}

console.log('mixed simulation with lapses');
{
  let c = newCard(T0);
  let now = T0;
  const grades = [3, 3, 1, 3, 3, 3, 2, 3, 1, 3, 3, 4, 3, 3, 3];
  for (const g of grades) { c = review(c, g, now); now = c.due; }
  ok(c.lapses === 2, `lapses tracked through mixed run (${c.lapses})`);
  ok(Number.isFinite(c.stability) && c.stability > 0, 'stability positive and finite');
  ok(c.difficulty >= 1 && c.difficulty <= 10, 'difficulty clamped');
}

console.log('previewIntervals');
{
  const base = review(newCard(T0), GRADE.EASY, T0);
  const p = previewIntervals(base, base.due);
  ok(p[1] === 10 * MIN, 'preview Again = 10m relearning step');
  ok(p[2] <= p[3] && p[3] <= p[4], 'preview ordering');
}

console.log('immutability');
{
  const c = newCard(T0);
  const snapshot = JSON.stringify(c);
  review(c, GRADE.GOOD, T0);
  ok(JSON.stringify(c) === snapshot, 'review() does not mutate input');
}

console.log('');
if (failures) { console.error(`${failures} test(s) FAILED`); process.exit(1); }
console.log('All FSRS tests passed.');
