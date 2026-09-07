// The 7 quiz modes. Each renderer returns { node, category, answer } where
// category is 'self' (learner self-grades) or 'objective' (auto-graded).
// It calls ctx.onReveal() (self) or ctx.onObjective(correct) (objective).
import { el, shuffle, sample, audioButton, wordKaraokeHTML, phraseKaraokeHTML } from './ui.js';
import { TONES, TONE_INFO, contourSVG, toneOfSyllable, tonesOfKaraoke } from './tones.js';
import { words, phrases, wordById, phraseById, wordsInPhrase } from './data.js';

export const ALL_MODES = ['recall', 'production', 'audio', 'cloze', 'builder', 'toneid', 'minimalpair'];

// Which modes apply to a given item, with production weighted highest.
export function modesFor(item) {
  if (item.type === 'phrase') return ['production', 'production', 'recall', 'audio', 'cloze', 'builder'];
  return ['production', 'production', 'recall', 'audio', 'toneid', 'minimalpair'];
}

export function chooseMode(item, avoid) {
  const pool = modesFor(item).filter((m) => m !== avoid);
  return (pool.length ? pool : modesFor(item))[Math.floor(Math.random() * (pool.length ? pool.length : modesFor(item).length))];
}

function cardData(item) {
  const c = item.type === 'word' ? wordById.get(item.id) : phraseById.get(item.id);
  return c;
}

// answer info used by the feedback panel and self-reveal
function answerOf(item) {
  const c = cardData(item);
  if (item.type === 'word') {
    const tones = Array.isArray(c.tone) ? c.tone : [c.tone];
    return { thai: c.thai, karaoke: c.karaoke, en: c.en, tone: tones[tones.length - 1], isPhrase: false, literal: c.literal };
  }
  return { thai: c.thai, karaoke: c.karaoke, en: c.en, tone: null, isPhrase: true, literal: c.literal };
}

function karaokeHTML(item) {
  const c = cardData(item);
  return item.type === 'word' ? wordKaraokeHTML(c) : phraseKaraokeHTML(c.karaoke);
}

// ---- RECALL: karaoke shown -> recall English, self-grade ----
function renderRecall(item, ctx) {
  const c = cardData(item);
  const node = el('div', {}, [
    el('div', { class: 'mode-tag', text: 'Recall · meaning' }),
    el('div', { class: 'quiz-prompt' }, [
      el('div', { class: item.type === 'word' ? 'karaoke-big' : 'karaoke-mid', html: karaokeHTML(item) }),
      el('div', { class: 'row', style: 'justify-content:center;margin-top:8px' }, [audioButton(c.thai)]),
    ]),
    el('p', { class: 'dim center', text: 'Say the English meaning, then reveal.' }),
  ]);
  return { node, category: 'self', answer: answerOf(item) };
}

// ---- PRODUCTION: English shown -> produce karaoke aloud, self-grade ----
function renderProduction(item, ctx) {
  const c = cardData(item);
  const node = el('div', {}, [
    el('div', { class: 'mode-tag', text: 'Production · say it in Thai' }),
    el('div', { class: 'quiz-prompt' }, [
      el('div', { class: 'en-big', text: c.en }),
      c.literal ? el('p', { class: 'dim small center', text: `literal: ${c.literal}` }) : null,
    ]),
    el('p', { class: 'dim center', text: 'Say it aloud in Thai, then reveal to check.' }),
  ]);
  return { node, category: 'self', answer: answerOf(item) };
}

// ---- AUDIO: TTS plays, pick meaning (4 options) ----
function renderAudio(item, ctx) {
  const c = cardData(item);
  const pool = item.type === 'word' ? words : phrases;
  const distractors = sample(pool.filter((x) => x.id !== c.id), 3).map((x) => x.en);
  const options = shuffle([c.en, ...distractors]);
  const choices = el('div', { class: 'choices' });
  const node = el('div', {}, [
    el('div', { class: 'mode-tag', text: 'Listen · pick the meaning' }),
    el('div', { class: 'quiz-prompt' }, [audioButton(c.thai, { autoplay: true })]),
    el('p', { class: 'dim center', text: 'Tap to replay, then choose.' }),
    choices,
  ]);
  options.forEach((opt) => {
    const b = el('button', { class: 'choice', text: opt, onclick: () => {
      if (choices.dataset.done) return;
      choices.dataset.done = '1';
      const correct = opt === c.en;
      [...choices.children].forEach((ch) => {
        ch.disabled = true;
        if (ch.textContent === c.en) ch.classList.add('correct');
        else if (ch === b && !correct) ch.classList.add('wrong');
      });
      ctx.onObjective(correct);
    } });
    choices.append(b);
  });
  return { node, category: 'objective', answer: answerOf(item) };
}

// ---- CLOZE: phrase with one word blanked, choose the karaoke tile ----
function renderCloze(item, ctx) {
  const p = cardData(item);
  const tokens = p.karaoke.split(' ');
  const thaiTokens = p.thai.split(' ');
  const idx = Math.floor(Math.random() * tokens.length);
  const answer = tokens[idx];
  const distractPool = shuffle(words.map((w) => w.karaoke)).filter((k) => k !== answer);
  const opts = shuffle([answer, ...distractPool.slice(0, 3)]);
  const line = el('div', { class: 'karaoke-mid center' });
  tokens.forEach((t, i) => {
    if (i) line.append(document.createTextNode(' '));
    line.append(i === idx ? el('span', { class: 'tone-high', text: '____' }) : el('span', { html: phraseKaraokeHTML(t) }));
  });
  const choices = el('div', { class: 'tiles' });
  const node = el('div', {}, [
    el('div', { class: 'mode-tag', text: 'Cloze · fill the blank' }),
    el('div', { class: 'quiz-prompt' }, [el('div', { class: 'en-big', text: p.en }), line,
      el('div', { class: 'row', style: 'justify-content:center', }, [audioButton(p.thai)])]),
    choices,
  ]);
  opts.forEach((opt) => {
    const b = el('button', { class: 'tile', html: phraseKaraokeHTML(opt), onclick: () => {
      if (choices.dataset.done) return;
      choices.dataset.done = '1';
      const correct = opt === answer;
      [...choices.children].forEach((ch) => { ch.classList.add('used'); });
      b.classList.remove('used');
      b.classList.add(correct ? 'correct' : 'wrong');
      ctx.onObjective(correct);
    } });
    choices.append(b);
  });
  return { node, category: 'objective', answer: answerOf(item) };
}

// ---- BUILDER: English -> arrange karaoke word tiles in order ----
function renderBuilder(item, ctx) {
  const p = cardData(item);
  const tokens = p.karaoke.split(' ');
  const answerArea = el('div', { class: 'tile-answer-area' });
  const pool = el('div', { class: 'tiles' });
  const placed = [];
  const node = el('div', {}, [
    el('div', { class: 'mode-tag', text: 'Build · put the words in order' }),
    el('div', { class: 'quiz-prompt' }, [el('div', { class: 'en-big', text: p.en })]),
    answerArea,
    el('p', { class: 'dim small center', text: 'Tap tiles to build the phrase.' }),
    pool,
  ]);
  function refresh() {
    answerArea.innerHTML = placed.length ? '' : '';
    if (!placed.length) answerArea.append(el('span', { class: 'dim', text: 'tap words below…' }));
    placed.forEach((tk, i) => {
      answerArea.append(el('button', { class: 'tile', html: phraseKaraokeHTML(tk.text), onclick: () => {
        if (pool.dataset.done) return;
        tk.el.classList.remove('used');
        placed.splice(i, 1); refresh();
      } }));
    });
    if (placed.length === tokens.length && !pool.dataset.done) {
      pool.dataset.done = '1';
      const correct = placed.map((x) => x.text).join(' ') === p.karaoke;
      answerArea.classList.add(correct ? '' : '');
      ctx.onObjective(correct);
    }
  }
  shuffle(tokens.map((t, i) => ({ text: t, i }))).forEach((tk) => {
    const b = el('button', { class: 'tile', html: phraseKaraokeHTML(tk.text), onclick: () => {
      if (pool.dataset.done || b.classList.contains('used')) return;
      b.classList.add('used');
      placed.push({ text: tk.text, el: b });
      refresh();
    } });
    tk.el = b;
    pool.append(b);
  });
  refresh();
  return { node, category: 'objective', answer: answerOf(item) };
}

// ---- TONE ID: see/hear a word -> pick its tone (5 buttons) ----
function renderToneId(item, ctx) {
  const w = cardData(item);
  const syls = w.karaoke.split('-');
  const tones = Array.isArray(w.tone) ? w.tone : [w.tone];
  const k = syls.length > 1 ? syls.length - 1 : 0; // ask about last syllable
  const targetTone = tones[k];
  const btns = el('div', { class: 'tone-btns' });
  const node = el('div', {}, [
    el('div', { class: 'mode-tag', text: 'Tone ID · which tone?' }),
    el('div', { class: 'quiz-prompt' }, [
      el('div', { class: 'karaoke-big', html: wordKaraokeHTML(w) }),
      syls.length > 1 ? el('p', { class: 'dim', html: `syllable: <b>${syls[k]}</b>` }) : null,
      el('div', { class: 'row', style: 'justify-content:center', }, [audioButton(w.thai, { autoplay: true })]),
    ]),
    btns,
  ]);
  TONES.forEach((t) => {
    const b = el('button', { class: 'tone-btn', html: `${contourSVG(t, 26)}<span class="tone-${t}">${TONE_INFO[t].label}</span>`, onclick: () => {
      if (btns.dataset.done) return;
      btns.dataset.done = '1';
      const correct = t === targetTone;
      [...btns.children].forEach((ch) => ch.disabled = true);
      b.classList.add(correct ? 'correct' : 'wrong');
      if (!correct) {
        const right = [...btns.children].find((ch) => ch.textContent.trim() === TONE_INFO[targetTone].label);
        if (right) right.classList.add('correct');
      }
      ctx.onObjective(correct, targetTone);
    } });
    btns.append(b);
  });
  return { node, category: 'objective', answer: answerOf(item) };
}

// ---- MINIMAL PAIR: play one of a tone set -> pick which you heard ----
import { minimalPairs } from './data.js';
function renderMinimalPair(item, ctx) {
  const set = minimalPairs[Math.floor(Math.random() * minimalPairs.length)];
  const target = set.items[Math.floor(Math.random() * set.items.length)];
  const choices = el('div', { class: 'choices' });
  const node = el('div', {}, [
    el('div', { class: 'mode-tag', text: 'Minimal pair · which did you hear?' }),
    el('div', { class: 'quiz-prompt' }, [audioButton(target.thai, { autoplay: true })]),
    el('p', { class: 'dim center', text: 'Tap to replay, then pick the word.' }),
    choices,
  ]);
  shuffle(set.items).forEach((it) => {
    const b = el('button', { class: 'choice', html: `<b class="tone-${it.tone}">${it.karaoke}</b> — ${it.en}`, onclick: () => {
      if (choices.dataset.done) return;
      choices.dataset.done = '1';
      const correct = it.karaoke === target.karaoke;
      [...choices.children].forEach((ch) => { ch.disabled = true; });
      b.classList.add(correct ? 'correct' : 'wrong');
      if (!correct) [...choices.children].forEach((ch) => { if (ch.innerHTML.includes(`>${target.karaoke}<`)) ch.classList.add('correct'); });
      ctx.onObjective(correct, target.tone);
    } });
    choices.append(b);
  });
  // For minimal-pair drills the graded "answer" is the heard word.
  return { node, category: 'objective', answer: { thai: target.thai, karaoke: target.karaoke, en: target.en, tone: target.tone, isPhrase: false } };
}

const RENDERERS = {
  recall: renderRecall,
  production: renderProduction,
  audio: renderAudio,
  cloze: renderCloze,
  builder: renderBuilder,
  toneid: renderToneId,
  minimalpair: renderMinimalPair,
};

export function renderMode(mode, item, ctx) {
  return (RENDERERS[mode] || renderRecall)(item, ctx);
}
