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

  container.append(
    el('div', { class: 'coverage-hero panel' }, [
      el('div', { class: 'coverage-num', text: pct.toFixed(0) + '%' }),
      el('div', { class: 'coverage-cap', text: `You now cover ~${pct.toFixed(1)}% of spoken Thai` }),
    ]),
    el('div', { class: 'stat-grid' }, [
      cell(st.streak + '🔥', 'Day streak'),
      cell(String(due.total), 'Due today'),
      cell(String(learned), 'Words learned'),
    ]),
    hasResumable()
      ? el('button', { class: 'btn btn-primary btn-big', text: '▶ Resume session', onclick: () => nav('session', { resume: true }) })
      : el('button', { class: 'btn btn-primary btn-big', text: due.total ? '▶ Start session' : '▶ Study ahead', onclick: () => nav('session') }),
    el('div', { class: 'panel' }, [
      el('div', { class: 'row between' }, [el('span', { class: 'dim small', text: `${due.reviews} reviews · ${due.news} new` }), el('span', { class: 'dim small', text: `${words.length} words · ${phrases.length} phrases` })]),
      toneLegend(),
    ]),
    el('p', { class: 'dim small center', text: 'Karaoke-first · tones color-coded · fully offline' }),
  );
}

function cell(v, k) {
  return el('div', { class: 'stat-cell' }, [el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k })]);
}
