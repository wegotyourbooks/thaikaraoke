// Daily session: build queue, run intro + quiz loop, grade via FSRS, resume.
import { el, clear, audioButton, wordKaraokeHTML, phraseKaraokeHTML, toneLegend, toast, haptic } from './ui.js';
import { TONE_INFO, contourSVG } from './tones.js';
import { newCard, review, previewIntervals, formatInterval, GRADE, STATE } from './fsrs.js';
import * as S from './state.js';
import * as D from './derive.js';
import { createTimer } from './timer.js';
import { wordsByRank, wordById, phraseById, phrasesForWord, words, functional150 } from './data.js';
import { renderMode, chooseMode } from './modes.js';
import { pickLesson } from './lessons.js';
import { lessonBody } from './screens/lessons.js';
import { coverageForLearnedRanks } from './coverage.js';
import { speak } from './audio.js';

let onExit = () => {};
export function setExitHandler(fn) { onExit = fn; }

// ---- metrics (used by home / stats too) ----
export function learnedWordRanks() {
  const ranks = [];
  for (const id of Object.keys(S.getState().cards)) {
    const w = wordById.get(id);
    if (w) ranks.push(w.rank);
  }
  return ranks;
}
export function coveragePct() {
  return coverageForLearnedRanks(learnedWordRanks());
}
export function learnedCount() { return learnedWordRanks().length; }

export function dueList(now = Date.now()) {
  const due = [];
  for (const [id, card] of Object.entries(S.getState().cards)) {
    if (card.due <= now && card.state !== STATE.NEW) {
      const type = wordById.has(id) ? 'word' : 'phrase';
      due.push({ id, type, due: card.due });
    }
  }
  due.sort((a, b) => a.due - b.due);
  return due;
}

export function newAvailable() {
  return wordsByRank.filter((w) => !S.hasCard(w.id));
}

export function dueCount(now = Date.now()) {
  const s = S.getSettings();
  const tc = D.todayCounts(S.getState(), now);
  const reviews = Math.min(dueList(now).length, Math.max(0, s.maxReviews - tc.reviewsToday));
  const news = Math.min(newAvailable().length, Math.max(0, s.newPerDay - tc.newToday));
  return { reviews, news, total: reviews + news };
}

// ---- build the queue ----
export function buildQueue(now = Date.now()) {
  const s = S.getSettings();
  const tc = D.todayCounts(S.getState(), now);
  const reviewCap = Math.max(0, s.maxReviews - tc.reviewsToday);
  const newCap = Math.max(0, s.newPerDay - tc.newToday);
  const reviews = dueList(now).slice(0, reviewCap).map((d) => ({ id: d.id, type: d.type, isNew: false }));
  const news = newAvailable().slice(0, newCap).map((w) => ({ id: w.id, type: 'word', isNew: true }));
  return [...reviews, ...interleavePhrases(news)];
}

// Functional phrases are interleaved with new words: 2 phrases per 10 words,
// placed just before the block of words they support.
function interleavePhrases(news) {
  if (!S.getSettings().phrasesInQueue) return news;
  const pool = functional150().filter((p) => !S.hasCard(p.id));
  if (!pool.length || !news.length) return news;
  const out = [];
  let pi = 0;
  for (let i = 0; i < news.length; i++) {
    if (i % 10 === 0) {
      for (let k = 0; k < 2 && pi < pool.length; k++, pi++) {
        out.push({ id: pool[pi].id, type: 'phrase', isNew: true });
      }
    }
    out.push(news[i]);
  }
  return out;
}

// ---- session timer ----
let timer = null;

function beginTimer(mode = 'session') {
  if (timer) return timer;
  timer = createTimer({ mode }).start();
  return timer;
}

// Partial sessions are real practice: this runs on Exit as well as on finish.
export function finishTimer() {
  if (!timer) return null;
  const sess = S.getSession() || {};
  const activeMs = timer.snapshot();
  const startedAt = timer.startedAt;
  const mode = timer.mode;
  const cardsDone = sess.total || 0;
  const correct = sess.correct || 0;
  timer.stop();
  timer = null;
  if (!activeMs && !cardsDone) return null;
  return S.appendSession({ startedAt, endedAt: Date.now(), activeMs, cardsDone, correct, mode });
}

// ---- public entry points ----
export function hasResumable() {
  const s = S.getSession();
  return !!(s && s.items && s.idx < s.items.length);
}

export function startSession(container) {
  const items = buildQueue();
  if (!items.length) { renderNothingDue(container); return; }
  S.setSession({ items, idx: 0, correct: 0, total: 0, seen: {}, wrong: {}, lessonDone: false });
  beginTimer();
  renderCurrent(container);
}

export function resumeSession(container) {
  if (!hasResumable()) { startSession(container); return; }
  beginTimer();
  renderCurrent(container);
}

function renderNothingDue(container) {
  clear(container);
  container.append(
    el('div', { class: 'panel center' }, [
      el('h1', { text: 'All caught up 🎉' }),
      el('p', { class: 'dim', text: 'No cards are due right now. Come back later, or raise your new-cards-per-day in Settings.' }),
      el('button', { class: 'btn btn-primary btn-big', text: 'Back to home', onclick: onExit }),
    ])
  );
}

// ---- render current item ----
function renderCurrent(container) {
  const sess = S.getSession();
  if (!sess || sess.idx >= sess.items.length) { endSession(container); return; }
  if (!sess.lessonDone && sess.idx === 0) { renderLesson(container, sess); return; }
  const item = sess.items[sess.idx];
  if (item.isNew && !sess.seen[item.id]) { renderIntro(container, item); return; }
  renderQuiz(container, item);
}

// One micro-lesson before the first card. Skippable, never repeated within the
// cooldown, and switched off entirely by a setting.
function renderLesson(container, sess) {
  const picked = pickLesson(S.getState());
  const done = () => { sess.lessonDone = true; S.setSession(sess); renderCurrent(container); };
  if (!picked) { done(); return; }
  S.appendLessonShown(picked.lesson.id);
  clear(container);
  container.append(
    el('div', { class: 'row between' }, [
      el('button', { class: 'btn-ghost', text: '✕ Exit', onclick: () => { finishTimer(); S.save(); onExit(); } }),
      el('span', { class: 'dim small', text: picked.reason || 'before you start' }),
    ]),
    el('div', { class: 'panel' }, [
      el('span', { class: 'intro-badge', text: `${picked.lesson.seconds}s · ${picked.lesson.topic}` }),
      el('h1', { text: picked.lesson.title }),
      lessonBody(picked.lesson),
    ]),
    el('button', { class: 'btn btn-primary btn-big', text: 'Start studying', onclick: done }),
    el('button', { class: 'btn-ghost', style: 'display:block;margin:8px auto', text: 'Skip lessons for now', onclick: () => {
      S.setSetting('showLessons', false);
      done();
    } }),
  );
}

function header(container, sess) {
  const pct = Math.round((sess.idx / sess.items.length) * 100);
  return el('div', {}, [
    el('div', { class: 'row between' }, [
      el('button', { class: 'btn-ghost', text: '✕ Exit', onclick: () => { finishTimer(); S.save(); onExit(); } }),
      el('span', { class: 'dim small', text: `${sess.idx + 1} / ${sess.items.length}` }),
    ]),
    el('div', { class: 'progress-track' }, [el('div', { class: 'progress-fill', style: `width:${pct}%` })]),
  ]);
}

function renderIntro(container, item) {
  const sess = S.getSession();
  if (item.type === 'phrase') { renderPhraseIntro(container, item, sess); return; }
  const w = wordById.get(item.id);
  const tones = Array.isArray(w.tone) ? w.tone : [w.tone];
  const settings = S.getSettings();
  clear(container);
  const examples = phrasesForWord(w).map((p) =>
    el('div', { class: 'example-item' }, [
      el('div', { class: 'row between' }, [
        el('div', {}, [
          el('div', { html: phraseKaraokeHTML(p.karaoke) }),
          el('div', { class: 'dim small', text: p.en }),
          settings.showThaiScript ? el('div', { class: 'thai-script', text: p.thai }) : null,
        ]),
        audioButton(p.thai, { inline: true }),
      ]),
    ])
  );
  container.append(
    header(container, sess),
    el('div', { class: 'panel center' }, [
      el('span', { class: 'intro-badge', text: 'New word' }),
      el('div', { class: 'karaoke-big', html: wordKaraokeHTML(w) }),
      el('div', { class: 'row', style: 'justify-content:center;gap:8px;margin:8px 0' }, [
        ...tones.map((t) => el('span', { class: 'row', style: 'gap:4px' }, [
          el('span', { html: contourSVG(t, 22) }),
          el('span', { class: `tone-${t} small`, text: TONE_INFO[t].label }),
        ])),
      ]),
      audioButton(w.thai, { autoplay: true }),
      settings.showThaiScript ? el('div', { class: 'thai-script', text: w.thai }) : null,
      el('div', { class: 'en-big', style: 'margin-top:8px', text: w.en }),
      w.literal ? el('p', { class: 'dim', text: `literal: ${w.literal}` }) : null,
    ]),
    examples.length ? el('div', { class: 'panel' }, [el('h2', { text: 'Examples' }), ...examples]) : null,
    el('button', { class: 'btn btn-primary btn-big', text: 'Got it — quiz me', onclick: () => {
      sess.seen[item.id] = true; S.setSession(sess); renderQuiz(container, item);
    } }),
  );
}

// Phrases enter the queue from the functional-150 tier; they get their own intro
// showing the word-by-word build so the phrase is learned, not memorized whole.
function renderPhraseIntro(container, item, sess) {
  const p = phraseById.get(item.id);
  const settings = S.getSettings();
  clear(container);
  const parts = (p.wordIds || []).map((id) => wordById.get(id)).filter(Boolean);
  container.append(
    header(container, sess),
    el('div', { class: 'panel center' }, [
      el('span', { class: 'intro-badge', text: 'Useful phrase' }),
      el('div', { class: 'karaoke-big', html: phraseKaraokeHTML(p.karaoke) }),
      audioButton(p.thai, { autoplay: true }),
      settings.showThaiScript ? el('div', { class: 'thai-script', text: p.thai }) : null,
      el('div', { class: 'en-big', style: 'margin-top:8px', text: p.en }),
      p.literal ? el('p', { class: 'dim', text: `literal: ${p.literal}` }) : null,
    ]),
    parts.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'Word by word' }),
      ...parts.map((w) => el('div', { class: 'example-item row between' }, [
        el('div', {}, [
          el('div', { html: wordKaraokeHTML(w) }),
          el('div', { class: 'dim small', text: w.en }),
        ]),
        audioButton(w.thai, { inline: true }),
      ])),
    ]) : null,
    el('button', { class: 'btn btn-primary btn-big', text: 'Got it — quiz me', onclick: () => {
      sess.seen[item.id] = true; S.setSession(sess); renderQuiz(container, item);
    } }),
  );
}

function renderQuiz(container, item) {
  const sess = S.getSession();
  const avoid = S.lastMode(item.id);
  const mode = chooseMode(item, avoid);
  S.setLastMode(item.id, mode);

  clear(container);
  const body = el('div', {});
  const footer = el('div', {});
  container.append(header(container, sess), el('div', { class: 'panel' }, [body]), footer);

  const rendered = renderMode(mode, item, {
    onReveal: () => showSelfGrade(container, item, rendered, footer),
    onObjective: (correct, tone) => showObjectiveFeedback(container, item, rendered, footer, correct, tone),
  });
  body.append(rendered.node);

  if (rendered.category === 'self') {
    footer.append(el('button', { class: 'btn btn-primary btn-big', text: 'Show answer', onclick: () => {
      showSelfGrade(container, item, rendered, footer);
    } }));
  }
}

function feedbackPanel(answer, correct, extra) {
  return el('div', { class: `feedback ${correct ? 'right' : 'wrong'}` }, [
    el('div', { class: 'verdict', text: correct ? 'Correct' : 'Not quite' }),
    el('div', { class: 'row between' }, [
      el('div', {}, [
        el('div', { html: answer.isPhrase ? phraseKaraokeHTML(answer.karaoke) : `<span class="karaoke-mid">${answer.karaoke}</span>` }),
        el('div', { class: 'dim', text: answer.en }),
        el('div', { class: 'thai-script', text: answer.thai }),
        answer.tone ? el('div', { class: 'row small', style: 'gap:4px;margin-top:4px' }, [el('span', { html: contourSVG(answer.tone, 18) }), el('span', { class: `tone-${answer.tone}`, text: TONE_INFO[answer.tone].label + ' tone' })]) : null,
      ]),
      audioButton(answer.thai),
    ]),
    extra || null,
  ]);
}

function showSelfGrade(container, item, rendered, footer) {
  clear(footer);
  haptic(true); // light tick when the answer is revealed
  const a = rendered.answer;
  footer.append(feedbackPanel(a, true, el('p', { class: 'dim small', text: 'How well did you recall it?' })));
  const card = S.getCard(item.id) || newCard();
  const prev = previewIntervals(card);
  const defs = [
    { g: GRADE.AGAIN, label: 'Again', cls: 'grade-again' },
    { g: GRADE.HARD, label: 'Hard', cls: 'grade-hard' },
    { g: GRADE.GOOD, label: 'Good', cls: 'grade-good' },
    { g: GRADE.EASY, label: 'Easy', cls: 'grade-easy' },
  ];
  const row = el('div', { class: 'grade-row' }, defs.map((d) =>
    el('button', { class: `grade-btn ${d.cls}`, onclick: () => applyGrade(container, item, d.g, d.g >= GRADE.GOOD, a.tone) }, [
      el('span', { class: 'g', text: d.label }),
      el('span', { class: 'ivl', text: formatInterval(prev[d.g]) }),
    ])
  ));
  footer.append(row);
}

function showObjectiveFeedback(container, item, rendered, footer, correct, tone) {
  clear(footer);
  haptic(correct); // right = single tick, wrong = triple buzz
  footer.append(feedbackPanel(rendered.answer, correct));
  footer.append(el('button', { class: 'btn btn-primary btn-big', text: 'Continue', onclick: () =>
    applyGrade(container, item, correct ? GRADE.GOOD : GRADE.AGAIN, correct, tone || rendered.answer.tone) }));
}

function applyGrade(container, item, grade, correct, tone, mode) {
  const sess = S.getSession();
  const now = Date.now();
  const prior = S.getCard(item.id) || newCard(now);
  const updated = review(prior, grade, now);
  S.setCard(item.id, updated);

  // The review log is the fact; every counter on screen is derived from it.
  // Only the first answer for an item counts as new (requeues are not).
  const firstAnswer = !item._answered;
  item._answered = true;
  S.appendReview({
    cardId: item.id,
    grade,
    correct,
    mode: mode || S.lastMode(item.id) || 'unknown',
    tone: item.type === 'word' ? tone || null : null,
    isNew: !!(item.isNew && firstAnswer),
    ts: now,
  });

  sess.total += 1;
  if (correct) sess.correct += 1;
  if (!correct) {
    sess.wrong[item.id] = (sess.wrong[item.id] || 0) + 1;
    // requeue 10 later within the session
    const copy = { id: item.id, type: item.type, isNew: false, _answered: true };
    const insertAt = Math.min(sess.items.length, sess.idx + 10);
    sess.items.splice(insertAt, 0, copy);
  }
  sess.idx += 1;
  S.setSession(sess);
  if (timer) timer.setCounts({ cardsDone: sess.total, correct: sess.correct });
  renderCurrent(container);
}

// ---- end screen ----
function endSession(container) {
  const sess = S.getSession() || { total: 0, correct: 0, wrong: {}, items: [] };
  const pct = coveragePct();
  S.pushCoveragePoint(pct, learnedCount());
  const acc = sess.total ? Math.round((sess.correct / sess.total) * 100) : 0;
  const beforeMs = D.totalActiveMs(S.getState());
  const record = finishTimer();
  const doc = S.getState();
  const streak = D.streakDays(doc);
  const mins = record ? D.fmtHM(record.activeMs).text : '0m';
  const crossed = crossedMilestone(beforeMs, D.totalActiveMs(doc));

  // 3 weakest: most-missed ids this session
  const weak = Object.entries(sess.wrong).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id]) => ({ card: wordById.get(id) || phraseById.get(id), miss: sess.wrong[id] }))
    .filter((x) => x.card);

  S.clearSession();
  clear(container);
  container.append(
    el('div', { class: 'panel center' }, [
      el('h1', { text: 'Session complete' }),
      el('div', { class: 'end-stats' }, [
        stat('Cards', String(sess.total)),
        stat('Accuracy', acc + '%'),
        stat('Time', mins),
        stat('Streak', streak + '🔥'),
        stat('Coverage', pct.toFixed(1) + '%'),
      ]),
    ]),
    crossed ? el('div', { class: 'panel center milestone-hit' }, [
      el('div', { class: 'big', text: `${crossed} hours of Thai` }),
      el('div', { class: 'dim small', text: 'Milestone reached.' }),
    ]) : null,
    weak.length ? el('div', { class: 'panel' }, [
      el('h2', { text: 'Review these' }),
      ...weak.map((w) => el('div', { class: 'weak-item row between' }, [
        el('div', {}, [
          el('div', { html: w.card.karaoke.includes(' ') ? phraseKaraokeHTML(w.card.karaoke) : `<b>${w.card.karaoke}</b>` }),
          el('div', { class: 'dim small', text: w.card.en }),
        ]),
        audioButton(w.card.thai, { inline: true }),
      ])),
    ]) : null,
    el('button', { class: 'btn btn-primary btn-big', text: 'Done', onclick: onExit }),
  );
  if (crossed) toast(`${crossed} hours studied 🎉`);
  onSessionEnd();
}

// Milestone crossing is detected from the derived total before and after this
// session — no "already celebrated" flag is ever stored.
function crossedMilestone(beforeMs, afterMs) {
  const b = beforeMs / 3600000, a = afterMs / 3600000;
  return D.MILESTONES_H.find((h) => b < h && a >= h) || null;
}

let onSessionEnd = () => {};
export function setSessionEndHandler(fn) { onSessionEnd = fn; }

function stat(k, v) {
  return el('div', { class: 'stat-cell' }, [el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k })]);
}
