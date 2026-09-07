import { el, clear, toneLegend } from '../ui.js';
import * as S from '../state.js';
import { coveragePct, learnedCount, dueCount, hasResumable } from '../session.js';
import { words, phrases } from '../data.js';

export function render(container, nav) {
  S.rolloverDay();
  clear(container);
  const st = S.stats();
  const pct = coveragePct();
  const due = dueCount();
  const learned = learnedCount();

  const doneToday = st.newToday + st.reviewsToday;
  const remaining = due.total;
  const planned = doneToday + remaining;
  const goalPct = planned > 0 ? Math.round((doneToday / planned) * 100) : 100;
  const centerMain = planned === 0 ? '✓' : `${doneToday}/${planned}`;
  const caption = planned === 0
    ? 'Nothing due — study ahead'
    : remaining === 0 ? 'Done for today 🎉' : `${remaining} left today`;

  container.append(
    el('div', { class: 'panel center' }, [
      goalRing(goalPct, centerMain),
      el('div', { class: 'dim', text: caption }),
      el('div', { class: 'coverage-cap', style: 'margin-top:6px', html: `<b class="tone-high">~${pct.toFixed(0)}%</b> spoken coverage` }),
    ]),
    hasResumable()
      ? el('button', { class: 'btn btn-primary btn-big', text: '▶ Resume session', onclick: () => nav('session', { resume: true }) })
      : el('button', { class: 'btn btn-primary btn-big', text: due.total ? '▶ Start session' : '▶ Study ahead', onclick: () => nav('session') }),
    el('div', { class: 'stat-grid' }, [
      cell(st.streak + '🔥', 'Day streak'),
      cell(String(due.total), 'Due today'),
      cell(String(learned), 'Words learned'),
    ]),
    el('div', { class: 'panel' }, [
      el('div', { class: 'row between' }, [el('span', { class: 'dim small', text: `${due.reviews} reviews · ${due.news} new` }), el('span', { class: 'dim small', text: `${words.length} words · ${phrases.length} phrases` })]),
      toneLegend(),
    ]),
    el('p', { class: 'dim small center', text: 'Karaoke-first · tones color-coded · fully offline' }),
  );
}

// SVG progress ring with a centered label.
function goalRing(pct, mainLabel) {
  const size = 168, stroke = 13, r = (size - stroke) / 2, c = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const svg =
    `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">` +
    `<circle class="ring-track" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}"/>` +
    `<circle class="ring-fill" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}" ` +
    `stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/></svg>`;
  return el('div', { class: 'ring-wrap' }, [
    el('div', { html: svg }),
    el('div', { class: 'ring-center' }, [
      el('div', { class: 'big', text: mainLabel }),
      el('div', { class: 'sub', text: "today's goal" }),
    ]),
  ]);
}

function cell(v, k) {
  return el('div', { class: 'stat-cell' }, [el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k })]);
}
