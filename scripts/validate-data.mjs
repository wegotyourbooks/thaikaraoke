// Data validator. Run: node scripts/validate-data.mjs
// Checks: counts, unique ids, refs resolve, every word has examples that
// really contain it, tone values valid + consistent with karaoke diacritics,
// no empty fields, phrase token alignment, minimal pair integrity.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
const err = (msg) => { errors++; console.error(`ERR  ${msg}`); };

const words = [];
for (let i = 1; i <= 12; i++) {
  const f = `words-${String(i).padStart(2, '0')}.js`;
  const m = await import(join(root, 'data', f));
  if (m.words.length !== 100) err(`${f}: has ${m.words.length} words, want 100`);
  words.push(...m.words);
}
const phrases = [];
// Files 01-08 are the fixed 50-phrase blocks; 09+ are functional add-ons.
const PHRASE_FILES = 9;
for (let i = 1; i <= PHRASE_FILES; i++) {
  const f = `phrases-${String(i).padStart(2, '0')}.js`;
  const m = await import(join(root, 'data', f));
  if (i <= 8 && m.phrases.length !== 50) err(`${f}: has ${m.phrases.length} phrases, want 50`);
  phrases.push(...m.phrases);
}
const { minimalPairs } = await import(join(root, 'data', 'minimal-pairs.js'));
const { frames } = await import(join(root, 'data', 'frames.js'));
const { pools } = await import(join(root, 'data', 'pools.js'));
const { microLessons, LESSON_TOPICS } = await import(join(root, 'data', 'microlessons.js'));

if (words.length !== 1200) err(`total words ${words.length}, want 1200`);
if (phrases.length < 400) err(`total phrases ${phrases.length}, want at least 400`);
if (minimalPairs.length !== 60) err(`minimal pairs ${minimalPairs.length}, want 60`);

const TONES = new Set(['mid', 'low', 'falling', 'high', 'rising']);
const POS = new Set(['n', 'v', 'adj', 'adv', 'pron', 'part', 'clf', 'prep', 'conj', 'num', 'interj']);
const TAGS = new Set(['core','food','transport','money','numbers','time','smalltalk','condo','shopping',
  'health','feelings','work','question','negation','grammar','people','places','colors','weather','body','tech','drink','opinion']);
const MARKS = { '̀': 'low', '́': 'high', '̂': 'falling', '̌': 'rising' };
// Paiboon karaoke alphabet (NFD base chars, tones stripped).
const KCHARS = new Set('abcdefghijklmnoprstuwyɛɔəʉ');

function toneOfSyl(syl) {
  let found = null;
  for (const ch of syl.normalize('NFD')) {
    if (MARKS[ch]) {
      if (found && found !== MARKS[ch]) return 'MULTI';
      found = MARKS[ch];
    }
  }
  return found || 'mid';
}
function checkKaraokeChars(id, karaoke) {
  const stripped = karaoke.normalize('NFD').replace(/[̀́̂̌]/g, '');
  for (const ch of stripped) {
    if (ch === '-' || ch === ' ' || ch === '.') continue;
    if (!KCHARS.has(ch)) err(`${id}: bad karaoke char "${ch}" in "${karaoke}"`);
  }
}

// ---- words ----
const wordIds = new Set();
const thaiSet = new Map();
const phraseById = new Map(phrases.map((p) => [p.id, p]));
words.forEach((w, i) => {
  if (wordIds.has(w.id)) err(`dup word id ${w.id}`);
  wordIds.add(w.id);
  const expectId = `w${String(i + 1).padStart(4, '0')}`;
  if (w.id !== expectId) err(`word order: at index ${i} got ${w.id}, want ${expectId}`);
  if (w.rank !== i + 1) err(`${w.id}: rank ${w.rank}, want ${i + 1}`);
  if (!w.thai) err(`${w.id}: empty thai`);
  if (thaiSet.has(w.thai)) err(`dup thai "${w.thai}" (${thaiSet.get(w.thai)}, ${w.id})`);
  thaiSet.set(w.thai, w.id);
  if (!w.karaoke) err(`${w.id}: empty karaoke`);
  if (!w.en) err(`${w.id}: empty en`);
  if (!POS.has(w.pos)) err(`${w.id}: bad pos "${w.pos}"`);
  if (!Array.isArray(w.tags) || w.tags.length === 0) err(`${w.id}: no tags`);
  else for (const t of w.tags) if (!TAGS.has(t)) err(`${w.id}: unknown tag "${t}"`);
  if (w.literal !== null && (typeof w.literal !== 'string' || !w.literal)) err(`${w.id}: bad literal`);
  checkKaraokeChars(w.id, w.karaoke);

  const syls = w.karaoke.split('-');
  const tones = Array.isArray(w.tone) ? w.tone : [w.tone];
  if (Array.isArray(w.tone) && w.tone.length !== syls.length) {
    err(`${w.id}: tone array length ${w.tone.length} != syllables ${syls.length} ("${w.karaoke}")`);
  }
  if (!Array.isArray(w.tone) && syls.length !== 1) {
    err(`${w.id}: multi-syllable "${w.karaoke}" needs tone array`);
  }
  tones.forEach((t, k) => {
    if (!TONES.has(t)) { err(`${w.id}: bad tone "${t}"`); return; }
    const dia = toneOfSyl(syls[k] ?? '');
    if (dia === 'MULTI') err(`${w.id}: multiple tone marks in syllable "${syls[k]}"`);
    else if (dia !== t) err(`${w.id}: tone "${t}" but diacritic says "${dia}" in "${syls[k]}" of "${w.karaoke}"`);
  });

  if (!Array.isArray(w.exampleIds) || w.exampleIds.length === 0) err(`${w.id}: no exampleIds`);
  else {
    for (const pid of w.exampleIds) {
      const p = phraseById.get(pid);
      if (!p) { err(`${w.id}: exampleId ${pid} unresolved`); continue; }
      if (!p.thai.split(/\s+/).includes(w.thai)) err(`${w.id}: phrase ${pid} does not contain ${w.thai}`);
    }
  }
});

// ---- phrases ----
const pIds = new Set();
phrases.forEach((p, i) => {
  if (pIds.has(p.id)) err(`dup phrase id ${p.id}`);
  pIds.add(p.id);
  const expectId = `p${String(i + 1).padStart(4, '0')}`;
  if (p.id !== expectId) err(`phrase order: at index ${i} got ${p.id}, want ${expectId}`);
  for (const f of ['thai', 'karaoke', 'en', 'literal']) {
    if (!p[f]) err(`${p.id}: empty ${f}`);
  }
  if (!['polite', 'casual'].includes(p.register)) err(`${p.id}: bad register "${p.register}"`);
  if (!Array.isArray(p.tags) || p.tags.length === 0) err(`${p.id}: no tags`);
  else for (const t of p.tags) if (!TAGS.has(t)) err(`${p.id}: unknown tag "${t}"`);
  checkKaraokeChars(p.id, p.karaoke);
  const tTok = p.thai.trim().split(/\s+/);
  const kTok = p.karaoke.trim().split(/\s+/);
  if (tTok.length !== kTok.length) err(`${p.id}: thai tokens ${tTok.length} != karaoke tokens ${kTok.length}`);
  if (!Array.isArray(p.wordIds) || p.wordIds.length === 0) err(`${p.id}: no wordIds`);
  else for (const wid of p.wordIds) {
    if (!wordIds.has(wid)) err(`${p.id}: wordId ${wid} unresolved`);
  }
});

// every word covered by >=1 phrase that contains it
const coveredThai = new Set();
for (const p of phrases) for (const t of p.thai.trim().split(/\s+/)) coveredThai.add(t);
let uncovered = 0;
for (const w of words) if (!coveredThai.has(w.thai)) { uncovered++; err(`word ${w.id} ${w.thai} not used in any phrase`); }

// ---- minimal pairs ----
const mpIds = new Set();
minimalPairs.forEach((mp) => {
  if (mpIds.has(mp.id)) err(`dup mp id ${mp.id}`);
  mpIds.add(mp.id);
  if (!Array.isArray(mp.items) || mp.items.length < 2) { err(`${mp.id}: needs >=2 items`); return; }
  const seen = new Set();
  for (const it of mp.items) {
    for (const f of ['thai', 'karaoke', 'en']) if (!it[f]) err(`${mp.id}: item missing ${f}`);
    if (!TONES.has(it.tone)) err(`${mp.id}: bad tone ${it.tone}`);
    if (seen.has(it.tone)) err(`${mp.id}: duplicate tone ${it.tone} in set`);
    seen.add(it.tone);
    const dia = toneOfSyl(it.karaoke.split('-').pop());
    if (dia !== it.tone) err(`${mp.id}: tone ${it.tone} != diacritic ${dia} ("${it.karaoke}")`);
    checkKaraokeChars(mp.id, it.karaoke);
  }
});

// ---- functional tier ----
const tiered = phrases.filter((p) => p.tier === 'functional150');
if (tiered.length !== 150) err(`functional150 tier has ${tiered.length} phrases, want exactly 150`);
for (const p of phrases) {
  if (p.tier !== undefined && p.tier !== 'functional150') err(`${p.id}: unknown tier "${p.tier}"`);
}

// ---- pools ----
const poolIds = new Set();
for (const pool of pools) {
  if (poolIds.has(pool.id)) err(`dup pool id ${pool.id}`);
  poolIds.add(pool.id);
  if (!pool.label) err(`pool ${pool.id}: no label`);
  if (!POS.has(pool.pos)) err(`pool ${pool.id}: bad pos "${pool.pos}"`);
  if (!Array.isArray(pool.wordIds) || pool.wordIds.length < 4) err(`pool ${pool.id}: needs at least 4 words`);
  const seen = new Set();
  for (const wid of pool.wordIds) {
    if (!wordIds.has(wid)) err(`pool ${pool.id}: unknown word ${wid}`);
    if (seen.has(wid)) err(`pool ${pool.id}: duplicate word ${wid}`);
    seen.add(wid);
  }
}

// ---- frames ----
if (frames.length !== 80) err(`frames: ${frames.length}, want 80`);
const frameIds = new Set();
const wordByIdMap = new Map(words.map((w) => [w.id, w]));
for (const f of frames) {
  if (frameIds.has(f.id)) err(`dup frame id ${f.id}`);
  frameIds.add(f.id);
  for (const field of ['th', 'karaoke', 'en', 'notes']) if (!f[field]) err(`${f.id}: empty ${field}`);
  if (!Array.isArray(f.tags) || !f.tags.length) err(`${f.id}: no tags`);
  else for (const t of f.tags) if (!TAGS.has(t)) err(`${f.id}: unknown tag "${t}"`);
  if (!Array.isArray(f.slots) || !f.slots.length) { err(`${f.id}: no slots`); continue; }
  const tTok = f.th.trim().split(/\s+/);
  const kTok = f.karaoke.trim().split(/\s+/);
  if (tTok.length !== kTok.length) err(`${f.id}: thai tokens ${tTok.length} != karaoke tokens ${kTok.length}`);
  for (const slot of f.slots) {
    const tok = '{' + slot + '}';
    if (!poolIds.has(slot)) err(`${f.id}: slot ${slot} has no pool`);
    for (const [where, str] of [['thai', f.th], ['karaoke', f.karaoke], ['english', f.en]]) {
      if (!str.includes(tok)) err(`${f.id}: ${where} is missing ${tok}`);
    }
    if (tTok.filter((t) => t === tok).length !== 1) err(`${f.id}: slot ${slot} must appear exactly once in thai`);
  }
  // every literal token must be a real lexicon word, so audio and tones work
  const slotToks = new Set(f.slots.map((s2) => '{' + s2 + '}'));
  const thaiWords = new Set(words.map((w) => w.thai));
  tTok.forEach((tok, i) => {
    if (slotToks.has(tok)) return;
    if (!thaiWords.has(tok)) err(`${f.id}: literal token "${tok}" is not a lexicon word`);
  });
  checkKaraokeChars(f.id, kTok.filter((t) => !slotToks.has(t)).join(' '));
}

// ---- micro-lessons ----
if (microLessons.length !== 40) err(`micro-lessons: ${microLessons.length}, want 40`);
const lessonIds = new Set();
const topicSet = new Set(LESSON_TOPICS);
const cardIds = new Set([...wordIds, ...pIds]);
for (const l of microLessons) {
  if (lessonIds.has(l.id)) err(`dup lesson id ${l.id}`);
  lessonIds.add(l.id);
  if (!l.title) err(`${l.id}: no title`);
  if (!l.body || l.body.length < 80) err(`${l.id}: body too short`);
  if (!topicSet.has(l.topic)) err(`${l.id}: unknown topic "${l.topic}"`);
  if (typeof l.seconds !== 'number' || l.seconds < 30 || l.seconds > 90) err(`${l.id}: seconds ${l.seconds} outside 30-90`);
  if (!Array.isArray(l.examples)) err(`${l.id}: examples must be an array`);
  else for (const id of l.examples) if (!cardIds.has(id)) err(`${l.id}: example ${id} unresolved`);
  if (l.targetStat !== undefined) {
    const m = /^tone:(mid|low|falling|high|rising)$/.exec(l.targetStat);
    if (!m) err(`${l.id}: bad targetStat "${l.targetStat}"`);
  }
}
for (const t of TONES) {
  if (!microLessons.some((l) => l.targetStat === 'tone:' + t)) err(`no micro-lesson targets the ${t} tone`);
}

console.log('');
if (errors) { console.error(`${errors} validation error(s).`); process.exit(1); }
console.log(`OK: ${words.length} words, ${phrases.length} phrases (${tiered.length} functional150), ` +
  `${minimalPairs.length} minimal-pair sets, ${frames.length} frames, ${pools.length} pools, ` +
  `${microLessons.length} micro-lessons. All checks passed.`);
