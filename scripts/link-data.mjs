// Auto-link phrases <-> words. Fills phrase.wordIds from word-spaced phrase
// thai, and word.exampleIds (up to 3) from the phrases containing each word.
// Rewrites the data files in place. Run after any data edit:
//   node scripts/link-data.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wordFiles = Array.from({ length: 12 }, (_, i) => `words-${String(i + 1).padStart(2, '0')}.js`);
const phraseFiles = Array.from({ length: 8 }, (_, i) => `phrases-${String(i + 1).padStart(2, '0')}.js`);

const words = [];
for (const f of wordFiles) {
  const m = await import(join(root, 'data', f));
  words.push(...m.words);
}
const phrases = [];
const presentPhraseFiles = [];
for (const f of phraseFiles) {
  const p = join(root, 'data', f);
  if (!existsSync(p)) continue;
  presentPhraseFiles.push(f);
  const m = await import(p);
  phrases.push(...m.phrases);
}

const byThai = new Map();
for (const w of words) {
  if (byThai.has(w.thai)) console.error(`DUP thai: ${w.thai} (${byThai.get(w.thai).id}, ${w.id})`);
  byThai.set(w.thai, w);
}

// phrase -> wordIds
const phraseWordIds = new Map();
const unknownTokens = new Map();
for (const p of phrases) {
  const tokens = p.thai.trim().split(/\s+/);
  const kTokens = p.karaoke.trim().split(/\s+/);
  if (tokens.length !== kTokens.length) {
    console.error(`TOKEN MISMATCH ${p.id}: thai ${tokens.length} vs karaoke ${kTokens.length}`);
  }
  const ids = [];
  for (const t of tokens) {
    const w = byThai.get(t);
    if (w) { if (!ids.includes(w.id)) ids.push(w.id); }
    else unknownTokens.set(t, (unknownTokens.get(t) || 0) + 1);
  }
  phraseWordIds.set(p.id, ids);
}

// word -> exampleIds (up to 3, shortest phrases first for cleaner examples)
const wordExamples = new Map(words.map((w) => [w.id, []]));
const sorted = [...phrases].sort((a, b) => a.thai.length - b.thai.length);
for (const p of sorted) {
  for (const wid of phraseWordIds.get(p.id) || []) {
    const arr = wordExamples.get(wid);
    if (arr && arr.length < 3) arr.push(p.id);
  }
}

const uncovered = words.filter((w) => (wordExamples.get(w.id) || []).length === 0);

// Rewrite files in place (entries are one per line).
function rewrite(file, field, valueFor) {
  const path = join(root, 'data', file);
  const src = readFileSync(path, 'utf8');
  const out = src.split('\n').map((line) => {
    const idm = line.match(/id:"([wp]\d{4})"/);
    if (!idm) return line;
    const val = valueFor(idm[1]);
    if (!val) return line;
    const json = JSON.stringify(val).replace(/"/g, '"');
    return line.replace(new RegExp(`${field}:\\[[^\\]]*\\]`), `${field}:${json}`);
  }).join('\n');
  writeFileSync(path, out);
}

for (const f of phraseFiles) {
  if (!presentPhraseFiles.includes(f)) continue;
  rewrite(f, 'wordIds', (id) => phraseWordIds.get(id));
}
for (const f of wordFiles) {
  rewrite(f, 'exampleIds', (id) => wordExamples.get(id));
}

console.log(`Linked ${phrases.length} phrases, ${words.length} words.`);
if (unknownTokens.size) {
  console.log(`\nUnknown phrase tokens (not in lexicon), count ${unknownTokens.size}:`);
  for (const [t, n] of [...unknownTokens].sort((a, b) => b[1] - a[1])) console.log(`  ${t} x${n}`);
}
if (uncovered.length) {
  console.log(`\nUNCOVERED words (no example phrase): ${uncovered.length}`);
  for (const w of uncovered) console.log(`  ${w.id} ${w.thai} (${w.karaoke}) = ${w.en}`);
} else if (phrases.length) {
  console.log('All words covered by at least one phrase.');
}
