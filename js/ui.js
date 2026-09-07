// Small DOM helpers plus shared rendering (audio buttons, tone legend, karaoke).
import { TONE_INFO, TONES, contourSVG, coloredKaraoke, coloredPhraseKaraoke, tonesOfKaraoke } from './tones.js';
import { speak } from './audio.js';
import { getSettings } from './state.js';

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// Subtle phone vibration on answer. Best-effort: no-op where unsupported (iOS Safari).
export function haptic(ok = true) {
  try { if (navigator.vibrate) navigator.vibrate(ok ? 12 : [0, 28, 38, 28]); } catch (e) {}
}

let toastTimer = null;
export function toast(msg, ms = 1800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// A round tap-to-hear button for a Thai string.
export function audioButton(thai, { inline = false, autoplay = false } = {}) {
  const b = el('button', {
    class: 'btn-audio' + (inline ? ' inline' : ''),
    'aria-label': 'Play audio',
    title: 'Play audio',
    onclick: (e) => { e.stopPropagation(); speak(thai, getSettings().speechRate); },
  }, ['🔊']);
  if (autoplay) setTimeout(() => speak(thai, getSettings().speechRate), 250);
  return b;
}

// Colored karaoke for a single word (uses its tone array).
export function wordKaraokeHTML(word) {
  const tones = Array.isArray(word.tone) ? word.tone : [word.tone];
  return coloredKaraoke(word.karaoke, tones);
}

export function phraseKaraokeHTML(karaoke) {
  return coloredPhraseKaraoke(karaoke);
}

export function toneLegend() {
  const items = TONES.map((t) =>
    el('span', { class: 'item' }, [
      el('span', { class: 'contour', html: contourSVG(t, 20) }),
      el('span', { class: `tone-${t}`, text: TONE_INFO[t].label }),
    ])
  );
  return el('div', { class: 'tone-legend' }, items);
}

export function toneBadge(tone) {
  return el('span', { class: `tone-${tone}`, html: `${contourSVG(tone, 18)} ${TONE_INFO[tone].label}` });
}

// Shuffle helper (Fisher-Yates), returns new array.
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample(arr, n, exclude = new Set()) {
  const pool = arr.filter((x) => !exclude.has(x));
  return shuffle(pool).slice(0, n);
}
