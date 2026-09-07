// Tone Gym: unlimited minimal-pair + tone-ID drills, hardest tones first.
import { el, clear, audioButton, shuffle } from '../ui.js';
import { TONES, TONE_INFO, contourSVG, stripToneMarks } from '../tones.js';
import { minimalPairs, words } from '../data.js';
import * as S from '../state.js';
import { speak } from '../audio.js';

let drill = 'minimalpair'; // 'minimalpair' | 'toneid'

export function render(container) {
  clear(container);
  container.append(
    el('h1', { text: 'Tone Gym' }),
    el('p', { class: 'dim small', text: 'Unlimited drills. Weakest tones come up first — no FSRS, just reps.' }),
    el('div', { class: 'filter-row' }, [
      tab('Minimal pairs', drill === 'minimalpair', () => { drill = 'minimalpair'; render(container); }),
      tab('Tone ID', drill === 'toneid', () => { drill = 'toneid'; render(container); }),
    ]),
    el('div', { class: 'panel', id: 'gym-area' }),
    el('div', { class: 'panel' }, [el('h2', { text: 'Your tone accuracy' }), bars()]),
  );
  next();
}

function tab(label, active, onclick) {
  return el('button', { class: 'chip' + (active ? ' active' : ''), text: label, onclick });
}

// pick a tone weighted toward low accuracy / low sample count
function weakestTone() {
  const st = S.stats().tone;
  let worst = TONES[0], worstScore = Infinity;
  for (const t of TONES) {
    const s = st[t] || { c: 0, t: 0 };
    const acc = s.t ? s.c / s.t : 0;
    // fewer attempts and lower accuracy => lower score => picked first
    const score = acc * 100 + s.t;
    if (score < worstScore) { worstScore = score; worst = t; }
  }
  return worst;
}

function next() {
  const area = document.getElementById('gym-area');
  if (!area) return;
  clear(area);
  if (drill === 'minimalpair') renderMinimalPair(area);
  else renderToneId(area);
}

function renderMinimalPair(area) {
  const targetTone = weakestTone();
  // prefer a set that contains the weakest tone
  const candidates = minimalPairs.filter((s) => s.items.some((i) => i.tone === targetTone));
  const set = (candidates.length ? candidates : minimalPairs)[Math.floor(Math.random() * (candidates.length ? candidates.length : minimalPairs.length))];
  const target = set.items.find((i) => i.tone === targetTone) || set.items[Math.floor(Math.random() * set.items.length)];
  const choices = el('div', { class: 'choices' });
  area.append(
    el('div', { class: 'quiz-prompt' }, [audioButton(target.thai, { autoplay: true }), el('p', { class: 'dim small', text: 'Which word did you hear?' })]),
    choices,
  );
  shuffle(set.items).forEach((it) => {
    const b = el('button', { class: 'choice', html: `<b class="tone-${it.tone}">${it.karaoke}</b> — ${it.en}`, onclick: () => {
      if (choices.dataset.done) return;
      choices.dataset.done = '1';
      const correct = it.karaoke === target.karaoke;
      S.recordToneAnswer(target.tone, correct);
      [...choices.children].forEach((ch) => { ch.disabled = true; if (ch.innerHTML.includes(`>${target.karaoke}<`)) ch.classList.add('correct'); });
      if (!correct) b.classList.add('wrong');
      refreshBars();
      area.append(el('button', { class: 'btn btn-primary btn-big', text: 'Next', onclick: next }));
    } });
    choices.append(b);
  });
}

function renderToneId(area) {
  const targetTone = weakestTone();
  const pool = words.filter((w) => {
    const tones = Array.isArray(w.tone) ? w.tone : [w.tone];
    return tones[tones.length - 1] === targetTone;
  });
  const w = (pool.length ? pool : words)[Math.floor(Math.random() * (pool.length ? pool.length : words.length))];
  const tones = Array.isArray(w.tone) ? w.tone : [w.tone];
  const syls = w.karaoke.split('-');
  const k = syls.length - 1;
  const answer = tones[k];
  const btns = el('div', { class: 'tone-btns' });
  area.append(
    el('div', { class: 'quiz-prompt' }, [
      // Neutral color + tone marks stripped so only the audio reveals the tone.
      el('div', { class: 'karaoke-big', text: stripToneMarks(syls[k]) }),
      syls.length > 1 ? el('p', { class: 'dim small', text: `from ${stripToneMarks(w.karaoke)}` }) : null,
      audioButton(w.thai, { autoplay: true }),
      el('p', { class: 'dim small', text: 'What tone is this?' }),
    ]),
    btns,
  );
  TONES.forEach((t) => {
    const b = el('button', { class: 'tone-btn', html: `${contourSVG(t, 26)}<span class="tone-${t}">${TONE_INFO[t].label}</span>`, onclick: () => {
      if (btns.dataset.done) return;
      btns.dataset.done = '1';
      const correct = t === answer;
      S.recordToneAnswer(answer, correct);
      [...btns.children].forEach((ch) => ch.disabled = true);
      b.classList.add(correct ? 'correct' : 'wrong');
      if (!correct) { const right = [...btns.children].find((ch) => ch.textContent.trim() === TONE_INFO[answer].label); if (right) right.classList.add('correct'); }
      refreshBars();
      area.append(el('div', { class: 'reveal-box' }, [el('b', { text: w.karaoke }), ' — ', w.en, ' ', audioButton(w.thai, { inline: true })]),
        el('button', { class: 'btn btn-primary btn-big', text: 'Next', onclick: next }));
    } });
    btns.append(b);
  });
}

function bars() {
  const wrap = el('div', { id: 'gym-bars' });
  drawBars(wrap);
  return wrap;
}
function refreshBars() { const w = document.getElementById('gym-bars'); if (w) drawBars(w); }
function drawBars(wrap) {
  clear(wrap);
  const st = S.stats().tone;
  TONES.forEach((t) => {
    const s = st[t] || { c: 0, t: 0 };
    const pct = s.t ? Math.round((s.c / s.t) * 100) : 0;
    wrap.append(el('div', { class: 'bar-row' }, [
      el('span', { class: `bar-label tone-${t}`, text: TONE_INFO[t].label }),
      el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: `width:${pct}%;background:${TONE_INFO[t].color}` })]),
      el('span', { class: 'bar-val', text: s.t ? `${pct}%` : '—' }),
    ]));
  });
}
