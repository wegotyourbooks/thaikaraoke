// Tone metadata used everywhere: names, colors, contour icons.
export const TONES = ['mid', 'low', 'falling', 'high', 'rising'];

export const TONE_INFO = {
  mid:     { label: 'mid',     color: '#9aa0a6', mark: '(none)', contour: [[2, 12], [22, 12]] },
  low:     { label: 'low',     color: '#4d9de0', mark: '̀', contour: [[2, 14], [22, 19]] },
  falling: { label: 'falling', color: '#b07ce8', mark: '̂', contour: [[2, 8], [10, 5], [22, 20]] },
  high:    { label: 'high',    color: '#ff9f43', mark: '́', contour: [[2, 10], [14, 8], [22, 3]] },
  rising:  { label: 'rising',  color: '#2ecc8f', mark: '̌', contour: [[2, 17], [10, 19], [22, 5]] },
};

// Combining diacritic -> tone name (Paiboon-style karaoke).
const MARK_TO_TONE = {
  '̀': 'low', '́': 'high', '̂': 'falling', '̌': 'rising',
};

// Detect the tone of one karaoke syllable from its diacritic. Mid if none.
export function toneOfSyllable(syl) {
  const norm = syl.normalize('NFD');
  for (const ch of norm) {
    if (MARK_TO_TONE[ch]) return MARK_TO_TONE[ch];
  }
  return 'mid';
}

// Tones of a word's karaoke, split on syllable separator '-'.
export function tonesOfKaraoke(karaoke) {
  return karaoke.split('-').map(toneOfSyllable);
}

// Normalized tone array for a word entry (string -> [string]).
export function toneArray(word) {
  return Array.isArray(word.tone) ? word.tone : [word.tone];
}

// Small inline SVG contour icon for a tone.
export function contourSVG(tone, size = 24) {
  const info = TONE_INFO[tone];
  if (!info) return '';
  const pts = info.contour.map(([x, y]) => `${x},${y}`).join(' ');
  return `<svg class="contour" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">` +
    `<polyline points="${pts}" fill="none" stroke="${info.color}" stroke-width="3" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// Karaoke rendered with each syllable colored by its tone.
export function coloredKaraoke(karaoke, toneArr) {
  const syls = karaoke.split('-');
  const tones = toneArr || syls.map(toneOfSyllable);
  return syls.map((s, i) => {
    const t = tones[i] || toneOfSyllable(s);
    return `<span class="syl tone-${t}">${s}</span>`;
  }).join('<span class="syl-sep">-</span>');
}

// Phrase karaoke (space-separated words, syllables '-' joined) colored per syllable.
export function coloredPhraseKaraoke(karaoke) {
  return karaoke.split(' ').map(w =>
    `<span class="pword">${coloredKaraoke(w)}</span>`
  ).join(' ');
}
