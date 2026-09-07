// Loads all dataset modules and builds lookup indexes.
const wordModules = await Promise.all(
  Array.from({ length: 12 }, (_, i) => import(`../data/words-${String(i + 1).padStart(2, '0')}.js`))
);
const phraseModules = await Promise.all(
  Array.from({ length: 8 }, (_, i) => import(`../data/phrases-${String(i + 1).padStart(2, '0')}.js`))
);
const { minimalPairs } = await import('../data/minimal-pairs.js');

export const words = wordModules.flatMap((m) => m.words);
export const phrases = phraseModules.flatMap((m) => m.phrases);
export { minimalPairs };

export const wordById = new Map(words.map((w) => [w.id, w]));
export const phraseById = new Map(phrases.map((p) => [p.id, p]));
export const cardById = (id) => wordById.get(id) || phraseById.get(id);

// words sorted by curriculum order (already rank order w0001..w1200)
export const wordsByRank = words.slice().sort((a, b) => a.rank - b.rank);

export const allTags = (() => {
  const s = new Set();
  for (const w of words) for (const t of w.tags) s.add(t);
  return [...s].sort();
})();

export function phrasesForWord(word) {
  return (word.exampleIds || []).map((id) => phraseById.get(id)).filter(Boolean);
}

export function wordsInPhrase(phrase) {
  return (phrase.wordIds || []).map((id) => wordById.get(id)).filter(Boolean);
}

// English meaning for any card id.
export function meaningOf(id) {
  const c = cardById(id);
  return c ? c.en : '';
}

// Politeness swap for phrase display: male ครับ <-> female ค่ะ/คะ.
export function applyPoliteness(text, karaoke, gender) {
  if (gender !== 'female') return { thai: text, karaoke };
  const th = text.replace(/ครับ/g, 'ค่ะ');
  const ka = karaoke.replace(/\bkráp\b/g, 'kâ');
  return { thai: th, karaoke: ka };
}
