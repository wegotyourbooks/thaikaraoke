import { el, clear } from '../ui.js';
import * as S from '../state.js';
import * as D from '../derive.js';
import { TONES, TONE_INFO } from '../tones.js';
import { coveragePct, learnedCount } from '../session.js';
import { wordById } from '../data.js';

export function render(container) {
  clear(container);
  const doc = S.getState();
  const total = D.fmtHM(D.totalActiveMs(doc));
  container.append(
    el('h1', { text: 'Stats' }),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Time studied' }),
      el('div', { class: 'end-stats' }, [
        statCell('Total', total.text),
        statCell('This week', D.fmtHM(D.msThisWeek(doc)).text),
        statCell('Streak', D.streakDays(doc) + '🔥'),
        statCell('Sessions', String(doc.sessions.length)),
      ]),
    ]),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'Coverage over time' }),
      coverageChart(S.coverageSnapshots(), coveragePct()),
      el('p', { class: 'dim small', text: `${learnedCount()} words learned · ~${coveragePct().toFixed(1)}% spoken coverage` }),
    ]),
    el('div', { class: 'panel' }, [el('h2', { text: 'Tone accuracy' }), toneBars(D.toneAccuracy(doc))]),
    el('div', { class: 'panel' }, [el('h2', { text: 'Study heatmap' }), heatmap(D.answersPerDay(doc, 84))]),
    el('div', { class: 'panel' }, [el('h2', { text: 'Upcoming reviews' }), forecast()]),
  );
}

function coverageChart(history, current) {
  const pts = history.slice();
  if (!pts.length) pts.push({ day: 'now', pct: current });
  const w = 320, h = 120, pad = 8;
  const maxPct = 84;
  const n = pts.length;
  const x = (i) => pad + (n === 1 ? (w - 2 * pad) / 2 : (i / (n - 1)) * (w - 2 * pad));
  const y = (p) => h - pad - (p / maxPct) * (h - 2 * pad);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.pct).toFixed(1)}" r="3" fill="#ff9f43"/>`).join('');
  const svg = `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#2e3342"/>
    ${n > 1 ? `<polyline points="${line}" fill="none" stroke="#ff9f43" stroke-width="2"/>` : ''}
    ${dots}
    <text x="${pad}" y="12" fill="#9aa3b5" font-size="10">${maxPct}%</text>
  </svg>`;
  return el('div', { html: svg });
}

function statCell(k, v) {
  return el('div', { class: 'stat-cell' }, [el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k })]);
}

function toneBars(tone) {
  return el('div', {}, TONES.map((t) => {
    const s = tone[t] || { count: 0, correct: 0 };
    const pct = s.count ? Math.round((s.correct / s.count) * 100) : 0;
    return el('div', { class: 'bar-row' }, [
      el('span', { class: `bar-label tone-${t}`, text: TONE_INFO[t].label }),
      el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: `width:${pct}%;background:${TONE_INFO[t].color}` })]),
      el('span', { class: 'bar-val', text: s.count ? `${pct}%` : '—' }),
    ]);
  }));
}

// last 12 weeks, one cell per day, derived from the review log
function heatmap(perDay) {
  const max = Math.max(1, ...perDay.map((d) => d.done));
  const cells = perDay.map(({ day, done }) => {
    const alpha = done ? 0.25 + 0.75 * (done / max) : 0;
    return el('div', { class: 'heat-cell', title: `${day}: ${done}`, style: done ? `background:rgba(255,159,67,${alpha.toFixed(2)})` : '' });
  });
  return el('div', { class: 'heatmap' }, cells);
}

function forecast() {
  const now = Date.now();
  const DAY = 86400000;
  const buckets = new Array(14).fill(0);
  let later = 0;
  for (const card of Object.values(S.getState().cards)) {
    if (card.state === 'new') continue;
    const d = Math.floor((card.due - now) / DAY);
    if (d < 0) buckets[0] += 1;
    else if (d < 14) buckets[d] += 1;
    else later += 1;
  }
  const max = Math.max(1, ...buckets);
  const labels = ['now', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  const bars = buckets.map((n, i) => el('div', { class: 'bar-row' }, [
    el('span', { class: 'bar-label', text: i === 0 ? 'due now' : `+${i}d` }),
    el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: `width:${(n / max) * 100}%;background:#4d9de0` })]),
    el('span', { class: 'bar-val', text: String(n) }),
  ]));
  if (later) bars.push(el('p', { class: 'dim small', text: `+ ${later} scheduled beyond 14 days` }));
  return el('div', {}, bars);
}
