// Printable flashcards: 500 most frequent words, karaoke front, English back.
// US Letter, 5 x 10 grid of 1.6" x 1" cards (50 per page, 10 sheets).
// Pages alternate front, back, front, back. Backs are mirrored left-to-right so
// a duplex printer set to "flip on long edge" lands each English behind its
// karaoke.
// Run: node scripts/build-flashcards.mjs  (needs Playwright + Chromium)
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(root, 'print');
const COUNT = 500, COLS = 5, ROWS = 10, PER_PAGE = COLS * ROWS;
const CARD_W = 1.6, CARD_H = 1.0;            // inches
const PAGE_W = 8.5, PAGE_H = 11;
const MX = (PAGE_W - COLS * CARD_W) / 2;     // 0.25"
const MY = (PAGE_H - ROWS * CARD_H) / 2;     // 0.5"

const words = [];
for (let i = 1; i <= 12; i++) {
  words.push(...(await import(join(root, 'data', `words-${String(i).padStart(2, '0')}.js`))).words);
}

// Numbers, days and months are easy to learn as sets, so they are left out.
const SET_NAME = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b/;
const skipped = [];
const picked = [];
for (const w of words.slice().sort((a, b) => a.rank - b.rank)) {
  if (w.pos === 'num' || SET_NAME.test(w.en)) { skipped.push(w); continue; }
  picked.push(w);
  if (picked.length === COUNT) break;
}

const POS = { n: 'noun', v: 'verb', adj: 'adj.', adv: 'adv.', pron: 'pronoun', part: 'particle',
  clf: 'classifier', prep: 'prep.', conj: 'conj.', interj: 'interj.' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cardHTML(w, n, side, row, col) {
  const left = MX + col * CARD_W, top = MY + row * CARD_H;
  const num = String(n).padStart(3, '0');
  const body = side === 'front'
    ? `<div class="fit kar">${esc(w.karaoke.normalize('NFC'))}</div>`
    : `<div class="fit en">${esc(w.en)}</div><div class="pos">${POS[w.pos] || ''}</div>`;
  return `<div class="card ${side}" style="left:${left}in;top:${top}in">${body}<div class="num">${num}</div></div>`;
}

const pages = [];
for (let p = 0; p * PER_PAGE < picked.length; p++) {
  const chunk = picked.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
  let front = '', back = '';
  chunk.forEach((w, i) => {
    const n = p * PER_PAGE + i + 1, row = Math.floor(i / COLS), col = i % COLS;
    front += cardHTML(w, n, 'front', row, col);
    back += cardHTML(w, n, 'back', row, COLS - 1 - col); // mirrored for long-edge flip
  });
  // cut guides: full-bleed lines on the front only, so a slightly misaligned
  // back never shows an off-center line
  let guides = '';
  for (let c = 0; c <= COLS; c++) guides += `<div class="vl" style="left:${MX + c * CARD_W}in"></div>`;
  for (let r = 0; r <= ROWS; r++) guides += `<div class="hl" style="top:${MY + r * CARD_H}in"></div>`;
  pages.push(`<section class="page">${guides}${front}<div class="foot">Sheet ${p + 1} of 10 · FRONT (karaoke) · print double-sided, flip on long edge, 100% scale</div></section>`);
  pages.push(`<section class="page">${back}<div class="foot">Sheet ${p + 1} of 10 · BACK (English)</div></section>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 8.5in 11in; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: 8.5in; height: 11in; overflow: hidden; page-break-after: always; }
.vl { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.5pt dashed #b5b5b5; }
.hl { position: absolute; left: 0; right: 0; height: 0; border-top: 0.5pt dashed #b5b5b5; }
.card { position: absolute; width: ${CARD_W}in; height: ${CARD_H}in; padding: 0.09in 0.08in;
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.fit { width: 100%; overflow: hidden; }
.kar { font-family: 'DejaVu Sans', sans-serif; font-size: 19pt; white-space: nowrap; line-height: 1.35; color: #000; }
.en { font-family: 'FreeSans', 'DejaVu Sans', sans-serif; font-size: 13pt; line-height: 1.15; max-height: 0.62in;
  color: #000; overflow-wrap: anywhere; }
.pos { font-family: 'FreeSans', sans-serif; font-size: 6.5pt; color: #777; margin-top: 3px; letter-spacing: .02em; }
.num { position: absolute; right: 0.07in; bottom: 0.05in; font-family: 'FreeSans', sans-serif; font-size: 5.5pt; color: #999; }
.foot { position: absolute; left: 0; right: 0; bottom: 0.18in; text-align: center;
  font-family: 'FreeSans', sans-serif; font-size: 7pt; color: #999; }
</style></head><body>${pages.join('')}
<script>
// shrink each label until it fits its card
for (const el of document.querySelectorAll('.fit')) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  const min = el.classList.contains('kar') ? 9 : 7;
  while ((el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + 0.5) && size > min) {
    size -= 0.5; el.style.fontSize = size + 'px';
  }
  if (el.scrollWidth > el.clientWidth + 0.5 || el.scrollHeight > el.clientHeight + 0.5) el.dataset.overflow = '1';
}
document.body.dataset.ready = '1';
</script></body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const htmlPath = join(OUT_DIR, 'thai-flashcards-500.html');
writeFileSync(htmlPath, html);

const pw = (await import('/opt/node22/lib/node_modules/playwright/index.js')).default;
const browser = await pw.chromium.launch(); // uses PLAYWRIGHT_BROWSERS_PATH
const page = await browser.newPage();
await page.goto('file://' + htmlPath);
await page.waitForSelector('body[data-ready="1"]');
const overflow = await page.$$eval('[data-overflow]', (els) => els.map((e) => e.textContent));
const pdfPath = join(OUT_DIR, 'thai-flashcards-500.pdf');
await page.pdf({ path: pdfPath, width: '8.5in', height: '11in', printBackground: true, preferCSSPageSize: true });
await browser.close();

// word list alongside, for reference
writeFileSync(join(OUT_DIR, 'thai-flashcards-500.csv'),
  'card,karaoke,thai,english,part_of_speech\n' +
  picked.map((w, i) => [i + 1, w.karaoke.normalize('NFC'), w.thai, w.en, POS[w.pos] || w.pos]
    .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n');

const mix = {};
for (const w of picked) mix[POS[w.pos] || w.pos] = (mix[POS[w.pos] || w.pos] || 0) + 1;
console.log(`cards: ${picked.length}, pages: ${pages.length}, last rank used: ${picked[picked.length - 1].rank}`);
console.log(`skipped ${skipped.length}: ${skipped.map((w) => w.en.split(/[;,]/)[0]).join(', ')}`);
console.log('mix:', JSON.stringify(mix));
console.log('labels still overflowing after shrink:', overflow.length, overflow.slice(0, 5));
console.log('wrote', pdfPath);
