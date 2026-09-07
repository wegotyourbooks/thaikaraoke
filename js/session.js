// Daily session: build queue, run intro + quiz loop, grade via FSRS, resume.
import { el, clear, audioButton, wordKaraokeHTML, phraseKaraokeHTML, toneLegend, toast, haptic } from './ui.js';
import { TONE_INFO, contourSVG } from './tones.js';
import { newCard, review, previewIntervals, formatInterval, GRADE, STATE } from './fsrs.js';
import * as S from './state.js';
import { wordsByRank, wordById, phraseById, phrasesForWord, words } from './data.js';
import { renderMode, chooseMode } from './modes.js';
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
  S.rolloverDay();
  const s = S.getSettings(); const st = S.stats();
  const reviews = Math.min(dueList(now).length, Math.max(0, s.maxReviews - st.reviewsToday));
  const news = Math.min(newAvailable().length, Math.max(0, s.newPerDay - st.newToday));
  return { reviews, news, total: reviews + news };
}

// ---- build the queue ----
function buildQueue(now = Date.now()) {
  S.rolloverDay();
  const s = S.getSettings(); const st = S.stats();
  const reviewCap = Math.max(0, s.maxReviews - st.reviewsToday);
  const newCap = Math.max(0, s.newPerDay - st.newToday);
  const reviews = dueList(now).slice(0, reviewCap).map((d) => ({ id: d.id, type: d.type, isNew: false }));
  const news = newAvailable().slice(0, newCap).map((w) => ({ id: w.id, type: 'word', isNew: true }));
  return [...reviews, ...news];
}

// ---- public entry points ----
export function hasResumable() {
  const s = S.getSession();
  return !!(s && s.items && s.idx < s.items.length);
}

export function startSession(container) {
  const items = buildQueue();
  if (!items.length) { renderNothingDue(container); return; }
  S.setSession({ items, idx: 0, correct: 0, total: 0, seen: {}, counted: {}, wrong: {}, streaked: false });
  renderCurrent(container);
}

export function resumeSession(container) {
  if (!hasResumable()) { startSession(container); return; }
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
  const item = sess.items[sess.idx];
  if (item.isNew && !sess.seen[item.id]) { renderIntro(container, item); return; }
  renderQuiz(container, item);
}

function header(container, sess) {
  const pct = Math.round((sess.idx / sess.items.length) * 100);
  return el('div', {}, [
    el('div', { class: 'row between' }, [
      el('button', { class: 'btn-ghost', text: '✕ Exit', onclick: () => { S.save(); onExit(); } }),
      el('span', { class: 'dim small', text: `${sess.idx + 1} / ${sess.items.length}` }),
    ]),
    el('div', { class: 'progress-track' }, [el('div', { class: 'progress-fill', style: `width:${pct}%` })]),
  ]);
}

function renderIntro(container, item) {
  const sess = S.getSession();
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
          settings.showThai ? el('div', { class: 'thai-script', text: p.thai }) : null,
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
      settings.showThai ? el('div', { class: 'thai-script', text: w.thai }) : null,
      el('div', { class: 'en-big', style: 'margin-top:8px', text: w.en }),
      w.literal ? el('p', { class: 'dim', text: `literal: ${w.literal}` }) : null,
    ]),
    examples.length ? el('div', { class: 'panel' }, [el('h2', { text: 'Examples' }), ...examples]) : null,
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

function applyGrade(container, item, grade, correct, tone) {
  const sess = S.getSession();
  const now = Date.now();
  const prior = S.getCard(item.id) || newCard(now);
  const updated = review(prior, grade, now);
  S.setCard(item.id, updated);

  // count once per item (not on requeues)
  if (!sess.counted[item.id + ':' + sess.idx]) { /* per-position guard below */ }
  const firstAnswer = !item._answered;
  item._answered = true;

  S.recordAnswer({
    correct,
    isNew: item.isNew && firstAnswer,
    isReview: !item.isNew && firstAnswer,
    tone: item.type === 'word' ? tone : null,
  });
  if (!sess.streaked) { S.bumpStreakForToday(); sess.streaked = true; }

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
  renderCurrent(container);
}

// ---- end screen ----
function endSession(container) {
  const sess = S.getSession() || { total: 0, correct: 0, wrong: {}, items: [] };
  const pct = coveragePct();
  S.pushCoveragePoint(pct, learnedCount());
  const acc = sess.total ? Math.round((sess.correct / sess.total) * 100) : 0;
  const st = S.stats();

  // 3 weakest: most-missed ids this session, else lowest stability
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
        stat('Streak', st.streak + '🔥'),
        stat('Coverage', pct.toFixed(1) + '%'),
      ]),
    ]),
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
}

function stat(k, v) {
  return el('div', { class: 'stat-cell' }, [el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k })]);
}
