import { el, clear, toneLegend } from '../ui.js';
import * as S from '../state.js';
import * as D from '../derive.js';
import { coveragePct, learnedCount, dueCount, hasResumable } from '../session.js';
import { words, phrases } from '../data.js';
import { syncStatus } from '../sync.js';

export function render(container, nav) {
  clear(container);
  const doc = S.getState();
  const pct = coveragePct();
  const due = dueCount();
  const learned = learnedCount();

  const totalMs = D.totalActiveMs(doc);
  const total = D.fmtHM(totalMs);
  const week = D.fmtHM(D.msThisWeek(doc));
  const streak = D.streakDays(doc);
  const ms = D.milestone(totalMs);

  const today = D.todayCounts(doc);
  const doneToday = today.newToday + today.reviewsToday;
  const planned = doneToday + due.total;
  const goalPct = planned > 0 ? Math.round((doneToday / planned) * 100) : 100;
  const caption = planned === 0
    ? 'Nothing due — study ahead'
    : due.total === 0 ? 'Done for today 🎉' : `${due.total} left today`;

  container.append(
    // Hours first: the number that actually predicts whether you will speak Thai.
    el('div', { class: 'panel hours-panel' }, [
      el('div', { class: 'hours-main' }, [
        el('span', { class: 'hours-num', text: String(total.h) }),
        el('span', { class: 'hours-unit', text: 'h' }),
        el('span', { class: 'hours-num sm', text: String(total.m) }),
        el('span', { class: 'hours-unit', text: 'm' }),
      ]),
      el('div', { class: 'dim small center', text: 'total time studying Thai' }),
      el('div', { class: 'hours-sub' }, [
        mini(week.text, 'this week'),
        mini(streak + '🔥', 'day streak'),
        mini('~' + pct.toFixed(0) + '%', 'spoken coverage'),
      ]),
      milestoneBar(ms),
      minutesChart(D.minutesPerDay(doc, 30)),
    ]),

    el('div', { class: 'panel center' }, [
      goalRing(goalPct, planned === 0 ? '✓' : `${doneToday}/${planned}`),
      el('div', { class: 'dim', text: caption }),
    ]),
    hasResumable()
      ? el('button', { class: 'btn btn-primary btn-big', text: '▶ Resume session', onclick: () => nav('session', { resume: true }) })
      : el('button', { class: 'btn btn-primary btn-big', text: due.total ? '▶ Start session' : '▶ Study ahead', onclick: () => nav('session') }),

    el('div', { class: 'stat-grid' }, [
      cell(String(due.total), 'Due today'),
      cell(String(learned), 'Words learned'),
      cell(String(doc.sessions.length), 'Sessions'),
    ]),
    el('div', { class: 'row', style: 'gap:8px' }, [
      el('button', { class: 'btn', style: 'flex:1', text: '📘 Lessons', onclick: () => nav('lessons') }),
      el('button', { class: 'btn', style: 'flex:1', text: '🎚 Tone Gym', onclick: () => nav('tonegym') }),
    ]),
    el('div', { class: 'panel' }, [
      el('div', { class: 'row between' }, [
        el('span', { class: 'dim small', text: `${due.reviews} reviews · ${due.news} new` }),
        el('span', { class: 'dim small', text: `${words.length} words · ${phrases.length} phrases` }),
      ]),
      toneLegend(),
    ]),
    syncLine(nav),
  );
}

function syncLine(nav) {
  const st = syncStatus();
  if (!st.connected && !st.pendingPush) return null;
  const label = st.pendingPush ? 'changes waiting to sync' : st.lastSyncAt ? 'synced ' + relTime(st.lastSyncAt) : 'sync connected';
  return el('button', { class: 'sync-line', onclick: () => nav('settings') }, [
    el('span', { class: 'sync-dot' + (st.pendingPush ? ' pending' : '') }),
    el('span', { class: 'dim small', text: label }),
  ]);
}

export function relTime(t) {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function mini(v, k) {
  return el('div', { class: 'hours-mini' }, [el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k })]);
}

function milestoneBar({ hours, prev, next, pct }) {
  const label = next ? `${prev}h → ${next}h` : 'every milestone cleared';
  const left = next ? `${(next - hours).toFixed(1)}h to go` : '';
  return el('div', { class: 'milestone' }, [
    el('div', { class: 'row between' }, [
      el('span', { class: 'dim small', text: label }),
      el('span', { class: 'dim small', text: left }),
    ]),
    el('div', { class: 'progress-track' }, [el('div', { class: 'progress-fill', style: `width:${pct.toFixed(1)}%` })]),
    el('div', { class: 'ladder' }, D.MILESTONES_H.map((h) =>
      el('span', { class: 'rung' + (hours >= h ? ' hit' : ''), text: h + 'h' }))),
  ]);
}

// 30-day minutes, inline SVG. Empty days are drawn as empty, not skipped.
function minutesChart(data) {
  const w = 320, h = 64, gap = 2;
  const max = Math.max(10, ...data.map((d) => d.minutes));
  const bw = (w - gap * (data.length - 1)) / data.length;
  const bars = data.map((d, i) => {
    const bh = Math.max(d.minutes > 0 ? 2 : 0, (d.minutes / max) * (h - 2));
    const x = i * (bw + gap);
    return `<rect x="${x.toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="1" class="${d.minutes > 0 ? 'bar-on' : 'bar-off'}"/>`;
  }).join('');
  return el('div', { class: 'chart30' }, [
    el('div', { class: 'row between' }, [
      el('span', { class: 'dim small', text: 'last 30 days' }),
      el('span', { class: 'dim small', text: `peak ${Math.floor(max)}m` }),
    ]),
    el('div', { html: `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="chart-svg" aria-hidden="true">${bars}</svg>` }),
  ]);
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
