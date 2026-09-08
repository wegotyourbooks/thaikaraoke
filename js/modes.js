// The 7 quiz modes. Each renderer returns { node, category, answer } where
// category is 'self' (learner self-grades) or 'objective' (auto-graded).
// It calls ctx.onReveal() (self) or ctx.onObjective(correct) (objective).
import { el, shuffle, sample, audioButton, wordKaraokeHTML, phraseKaraokeHTML } from './ui.js';
import { TONES, TONE_INFO, contourSVG, toneOfSyllable, tonesOfKaraoke, stripToneMarks } from './tones.js';
import { words, phrases, wordById, phraseById, wordsInPhrase } from './data.js';
import { drillFor, instantiate as frameInstantiate, distractors as frameDistractors, isFirstEncounter, markFrameSeen, gloss } from './frames.js';

export const ALL_MODES = ['recall', 'production', 'audio', 'cloze', 'builder', 'toneid', 'minimalpair',
  'frame_fill', 'frame_sub', 'frame_prod'];

// Which modes apply to a given item, with production weighted highest.
// Frame modes only appear for a word that actually fits a ready frame, and the
// substitution drill is weighted double because it is where fluency comes from.
export function modesFor(item) {
  if (item.type === 'phrase') return ['production', 'production', 'recall', 'audio', 'cloze', 'builder'];
  const base = ['production', 'production', 'recall', 'audio', 'toneid', 'minimalpair'];
  if (drillFor(item.id)) base.push('frame_fill', 'frame_sub', 'frame_sub', 'frame_prod');
  return base;
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
      answerArea.classList.add(correct ? 'right' : 'wrong');
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
      // Neutral color + tone marks stripped so only the audio reveals the tone.
      el('div', { class: 'karaoke-big', text: stripToneMarks(syls[k]) }),
      syls.length > 1 ? el('p', { class: 'dim small', text: `from ${stripToneMarks(w.karaoke)}` }) : null,
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

// ---- FRAME MODES ----
// A frame is shown with the target word's slot blanked or swapped. Grading
// applies to the word's own card; the frame keeps only its own hit counters.
function frameHeader(label, inst) {
  return el('div', {}, [
    el('div', { class: 'mode-tag', text: label }),
    isFirstEncounter(inst.frame.id)
      ? el('div', { class: 'frame-note' }, [el('p', { class: 'dim small', text: inst.frame.notes })])
      : null,
  ]);
}

function frameSentenceHTML(inst, blankSlot) {
  const parts = inst.frame.karaoke.split(' ').map((tok) => {
    if (!tok.startsWith('{')) return tok;
    const slot = tok.slice(1, -1);
    const w = wordById.get(inst.fills[slot]);
    if (slot === blankSlot) return '<span class="frame-slot">____</span>';
    return `<span class="frame-slot">${w.karaoke}</span>`;
  });
  return parts.join(' ');
}

// frame_fill: the slot is blank, pick the word that belongs there.
function renderFrameFill(item, ctx) {
  const inst = drillFor(item.id);
  if (!inst) return renderRecall(item, ctx);
  markFrameSeen(inst.frame.id);
  const target = wordById.get(item.id);
  const wrong = frameDistractors(inst.frame, inst.slot, item.id, 3).map((id) => wordById.get(id));
  const options = shuffle([target, ...wrong]);
  const choices = el('div', { class: 'choices' });
  const node = el('div', {}, [
    frameHeader('Frame · fill the gap', inst),
    el('div', { class: 'quiz-prompt' }, [
      el('div', { class: 'frame-line', html: frameSentenceHTML(inst, inst.slot) }),
      el('div', { class: 'dim small', text: inst.en }),
    ]),
    choices,
  ]);
  options.forEach((w) => {
    const b = el('button', { class: 'choice', html: `<b>${w.karaoke}</b> — ${w.en}`, onclick: () => {
      if (choices.dataset.done) return;
      choices.dataset.done = '1';
      const correct = w.id === item.id;
      [...choices.children].forEach((ch) => { ch.disabled = true; });
      b.classList.add(correct ? 'correct' : 'wrong');
      ctx.onObjective(correct, null, { frameId: inst.frame.id });
    } });
    choices.append(b);
  });
  return { node, category: 'objective', answer: answerOf(item), frameId: inst.frame.id };
}

// frame_sub: say the same sentence with this word swapped in. Self-graded.
function renderFrameSub(item, ctx) {
  const inst = drillFor(item.id);
  if (!inst) return renderProduction(item, ctx);
  markFrameSeen(inst.frame.id);
  const other = frameDistractors(inst.frame, inst.slot, item.id, 1)[0];
  // Same sentence, one word different: every other slot keeps its filler.
  const prev = other ? frameInstantiate(inst.frame, { ...inst.fills, [inst.slot]: other }) : null;
  const target = wordById.get(item.id);
  const node = el('div', {}, [
    frameHeader('Frame · substitution drill', inst),
    prev ? el('div', { class: 'quiz-prompt' }, [
      el('div', { class: 'frame-line', html: phraseKaraokeHTML(prev.karaoke) }),
      el('div', { class: 'dim small', text: prev.en }),
      audioButton(prev.th, { inline: true }),
    ]) : null,
    el('div', { class: 'quiz-prompt' }, [
      el('div', { class: 'en-big', text: 'now with: ' + gloss(target) }),
      el('p', { class: 'dim small center', text: 'Say the whole sentence again, swapping the word.' }),
    ]),
  ]);
  return {
    node, category: 'self', frameId: inst.frame.id,
    answer: { thai: inst.th, karaoke: inst.karaoke, en: inst.en, tone: null, isPhrase: true, literal: null },
  };
}

// frame_prod: English only, produce the whole Thai sentence. Self-graded.
function renderFrameProd(item, ctx) {
  const inst = drillFor(item.id);
  if (!inst) return renderProduction(item, ctx);
  markFrameSeen(inst.frame.id);
  const node = el('div', {}, [
    frameHeader('Frame · say the whole sentence', inst),
    el('div', { class: 'quiz-prompt' }, [
      el('div', { class: 'en-big', text: inst.en }),
      el('p', { class: 'dim small center', text: 'Say it in Thai, then reveal to check.' }),
    ]),
  ]);
  return {
    node, category: 'self', frameId: inst.frame.id,
    answer: { thai: inst.th, karaoke: inst.karaoke, en: inst.en, tone: null, isPhrase: true, literal: null },
  };
}

const RENDERERS = {
  recall: renderRecall,
  production: renderProduction,
  audio: renderAudio,
  cloze: renderCloze,
  builder: renderBuilder,
  toneid: renderToneId,
  minimalpair: renderMinimalPair,
  frame_fill: renderFrameFill,
  frame_sub: renderFrameSub,
  frame_prod: renderFrameProd,
};

export function renderMode(mode, item, ctx) {
  return (RENDERERS[mode] || renderRecall)(item, ctx);
}
