import { el, clear, audioButton, wordKaraokeHTML, phraseKaraokeHTML, toneBadge } from '../ui.js';
import { words, phrases, allTags, phrasesForWord, wordsInPhrase } from '../data.js';
import * as S from '../state.js';
import { TONE_INFO } from '../tones.js';

let filter = { q: '', tag: null, status: 'all', kind: 'words' };

export function render(container) {
  clear(container);
  const search = el('input', { type: 'search', placeholder: 'Search Thai, karaoke or English…', value: filter.q,
    oninput: (e) => { filter.q = e.target.value.toLowerCase(); renderList(list); } });

  const kindRow = el('div', { class: 'filter-row' }, ['words', 'phrases'].map((k) =>
    chip(k, filter.kind === k, () => { filter.kind = k; filter.tag = null; syncChips(); renderList(list); })));

  const statusRow = el('div', { class: 'filter-row' }, [
    ['all', 'All'], ['new', 'Not started'], ['learning', 'Learning'], ['review', 'Review'],
  ].map(([v, label]) => chip(label, filter.status === v, () => { filter.status = v; syncChips(); renderList(list); }, 'status:' + v)));

  const tagRow = el('div', { class: 'filter-row' }, [chip('All tags', !filter.tag, () => { filter.tag = null; syncChips(); renderList(list); }, 'tag:')]
    .concat(allTags.map((t) => chip(t, filter.tag === t, () => { filter.tag = t; syncChips(); renderList(list); }, 'tag:' + t))));

  const list = el('div', {});
  const detail = el('div', {});

  function syncChips() {
    [...kindRow.children].forEach((c) => c.classList.toggle('active', c.textContent === filter.kind));
    [...statusRow.children].forEach((c) => c.classList.toggle('active', c.dataset.k === 'status:' + filter.status));
    [...tagRow.children].forEach((c) => c.classList.toggle('active', c.dataset.k === 'tag:' + (filter.tag || '')));
  }

  container.append(
    el('h1', { text: 'Browse' }), search, kindRow, statusRow, tagRow, detail, list
  );
  render._detail = detail;
  renderList(list);
}

function statusOf(id) {
  const c = S.getCard(id);
  if (!c) return 'new';
  return c.state; // learning | review | relearning | new
}

function matches(item, isWord) {
  if (filter.tag && !(item.tags || []).includes(filter.tag)) return false;
  if (filter.status !== 'all') {
    const s = statusOf(item.id);
    if (filter.status === 'new' && s !== 'new') return false;
    if (filter.status === 'learning' && !(s === 'learning' || s === 'relearning')) return false;
    if (filter.status === 'review' && s !== 'review') return false;
  }
  if (filter.q) {
    const hay = `${item.thai} ${item.karaoke} ${item.en}`.toLowerCase();
    if (!hay.includes(filter.q)) return false;
  }
  return true;
}

function renderList(list) {
  clear(list);
  const isWord = filter.kind === 'words';
  const src = isWord ? words : phrases;
  const rows = src.filter((x) => matches(x, isWord)).slice(0, 300);
  list.append(el('p', { class: 'dim small', text: `${rows.length} shown` }));
  rows.forEach((item) => {
    const s = statusOf(item.id);
    list.append(el('button', { class: 'browse-item', onclick: () => showDetail(item, isWord) }, [
      el('span', { class: `status-dot ${s}` }),
      el('span', { class: 'grow' }, [
        el('div', { html: isWord ? wordKaraokeHTML(item) : phraseKaraokeHTML(item.karaoke) }),
        el('div', { class: 'dim small', text: item.en }),
      ]),
      audioButton(item.thai, { inline: true }),
    ]));
  });
}

function showDetail(item, isWord) {
  const d = render._detail;
  clear(d);
  const settings = S.getSettings();
  const rel = isWord ? phrasesForWord(item) : wordsInPhrase(item);
  d.append(el('div', { class: 'panel' }, [
    el('div', { class: 'row between' }, [
      el('div', {}, [
        el('div', { class: 'karaoke-mid', html: isWord ? wordKaraokeHTML(item) : phraseKaraokeHTML(item.karaoke) }),
        settings.showThai ? el('div', { class: 'thai-script', text: item.thai }) : null,
        el('div', { class: 'en-big', style: 'font-size:1.1rem', text: item.en }),
        item.literal ? el('div', { class: 'dim small', text: 'literal: ' + item.literal }) : null,
      ]),
      audioButton(item.thai),
    ]),
    rel.length ? el('div', {}, [
      el('h2', { text: isWord ? 'Example phrases' : 'Words' }),
      ...rel.map((r) => el('div', { class: 'example-item row between' }, [
        el('div', {}, [el('div', { html: isWord ? phraseKaraokeHTML(r.karaoke) : wordKaraokeHTML(r) }), el('div', { class: 'dim small', text: r.en })]),
        audioButton(r.thai, { inline: true }),
      ])),
    ]) : null,
  ]));
  d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function chip(label, active, onclick, key) {
  return el('button', { class: 'chip' + (active ? ' active' : ''), text: label, onclick, 'data-k': key || label });
}
