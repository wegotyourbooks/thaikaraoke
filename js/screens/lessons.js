// Lessons library. Browsing here never consumes the session rotation.
import { el, clear, audioButton, wordKaraokeHTML, phraseKaraokeHTML } from '../ui.js';
import * as S from '../state.js';
import { microLessons } from '../lessons.js';
import { LESSON_TOPICS } from '../../data/microlessons.js';
import { wordById, phraseById } from '../data.js';

let topic = 'all';

export function render(container) {
  clear(container);
  const shown = new Set((S.lessonsShown() || []).map((r) => r.lessonId));
  const list = topic === 'all' ? microLessons : microLessons.filter((l) => l.topic === topic);
  container.append(
    el('h1', { text: 'Lessons' }),
    el('p', { class: 'dim small', text: `${shown.size} of ${microLessons.length} seen. One appears at the start of a session; read them here any time.` }),
    el('div', { class: 'filter-row' }, [
      chip('All', topic === 'all', () => { topic = 'all'; render(container); }),
      ...LESSON_TOPICS.map((t) => chip(t, topic === t, () => { topic = t; render(container); })),
    ]),
    ...list.map((l) => lessonCard(l, shown.has(l.id))),
  );
}

function chip(label, active, onclick) {
  return el('button', { class: 'chip' + (active ? ' active' : ''), text: label, onclick });
}

function lessonCard(l, seen) {
  const body = el('div', { hidden: true });
  let built = false;
  const head = el('button', { class: 'lesson-head', onclick: () => {
    body.hidden = !body.hidden;
    if (!built) { built = true; body.append(lessonBody(l)); }
  } }, [
    el('span', { class: 'lesson-title', text: l.title }),
    el('span', { class: 'dim small', text: seen ? l.topic + ' · seen' : l.topic }),
  ]);
  return el('div', { class: 'panel lesson-card' }, [head, body]);
}

// Shared with the in-session card so both read identically.
export function lessonBody(l) {
  const items = (l.examples || []).map((id) => wordById.get(id) || phraseById.get(id)).filter(Boolean);
  return el('div', {}, [
    el('p', { class: 'lesson-body', text: l.body }),
    items.length ? el('div', { class: 'lesson-examples' }, items.map((c) => {
      const isPhrase = !!phraseById.get(c.id);
      return el('div', { class: 'example-item row between' }, [
        el('div', {}, [
          el('div', { html: isPhrase ? phraseKaraokeHTML(c.karaoke) : wordKaraokeHTML(c) }),
          el('div', { class: 'dim small', text: c.en }),
        ]),
        audioButton(c.thai, { inline: true }),
      ]);
    })) : null,
  ]);
}
