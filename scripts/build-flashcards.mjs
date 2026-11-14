// Printable flashcards: 500 most frequent words, karaoke front, English back.
// A4, 5 x 10 grid of 38 x 27 mm cards (50 per page, 10 sheets), centred with
// symmetric margins so the front and back grids share the same frame.
// Pages alternate front, back, front, back. Backs are mirrored left-to-right so
// a duplex printer set to "flip on long edge" lands each English behind its
// karaoke.
//
// Duplex printers rarely register perfectly. Print the alignment test sheet,
// read the two offsets off its rulers, and rebuild with them:
//   node scripts/build-flashcards.mjs --back-dx=1.5 --back-dy=-1
// Values are millimetres, measured on the back page: +dx moves the backs right,
// +dy moves them down.
// Run: node scripts/build-flashcards.mjs  (needs Playwright + Chromium)
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(root, 'print');
const COUNT = 500, COLS = 5, ROWS = 10, PER_PAGE = COLS * ROWS;
// all geometry in millimetres
const PAGE_W = 210, PAGE_H = 297;            // A4
const CARD_W = 38, CARD_H = 27;
const MX = (PAGE_W - COLS * CARD_W) / 2;     // 10 mm
const MY = (PAGE_H - ROWS * CARD_H) / 2;     // 13.5 mm
const arg = (name) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  const v = m ? parseFloat(m.split('=')[1]) : 0;
  return Number.isFinite(v) ? v : 0;
};
const BACK_DX = arg('back-dx'), BACK_DY = arg('back-dy');

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
  const dx = side === 'back' ? BACK_DX : 0, dy = side === 'back' ? BACK_DY : 0;
  const left = MX + col * CARD_W + dx, top = MY + row * CARD_H + dy;
  const num = String(n).padStart(3, '0');
  const body = side === 'front'
    ? `<div class="fit kar">${esc(w.karaoke.normalize('NFC'))}</div>`
    : `<div class="fit en">${esc(w.en)}</div><div class="pos">${POS[w.pos] || ''}</div>`;
  return `<div class="card ${side}" style="left:${left}mm;top:${top}mm">${body}<div class="num">${num}</div></div>`;
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
  for (let c = 0; c <= COLS; c++) guides += `<div class="vl" style="left:${MX + c * CARD_W}mm"></div>`;
  for (let r = 0; r <= ROWS; r++) guides += `<div class="hl" style="top:${MY + r * CARD_H}mm"></div>`;
  pages.push(`<section class="page">${guides}${front}<div class="foot">Sheet ${p + 1} of 10 · FRONT (karaoke) · A4 · double-sided, flip on long edge, actual size (100%)</div></section>`);
  pages.push(`<section class="page">${back}<div class="foot">Sheet ${p + 1} of 10 · BACK (English)</div></section>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 210mm 297mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.vl { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.5pt dashed #b5b5b5; }
.hl { position: absolute; left: 0; right: 0; height: 0; border-top: 0.5pt dashed #b5b5b5; }
.card { position: absolute; width: ${CARD_W}mm; height: ${CARD_H}mm; padding: 2.4mm 2mm;
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.fit { width: 100%; overflow: hidden; }
.kar { font-family: 'DejaVu Sans', sans-serif; font-size: 19pt; white-space: nowrap; line-height: 1.35; color: #000; }
.en { font-family: 'FreeSans', 'DejaVu Sans', sans-serif; font-size: 13pt; line-height: 1.15; max-height: 16.5mm;
  color: #000; overflow-wrap: anywhere; }
.pos { font-family: 'FreeSans', sans-serif; font-size: 6.5pt; color: #777; margin-top: 3px; letter-spacing: .02em; }
.num { position: absolute; right: 1.8mm; bottom: 1.3mm; font-family: 'FreeSans', sans-serif; font-size: 5.5pt; color: #999; }
.foot { position: absolute; left: 0; right: 0; bottom: 6mm; text-align: center;
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
await page.pdf({ path: pdfPath, width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true });

// ---- alignment test: one sheet, front crosshairs, back rulers ----
// Hold the printed sheet up to a light with the BACK facing you. Each front
// crosshair shows through onto a ruler; the number it sits on is the offset.
const POINTS = [
  // one grid intersection in from each corner, clear of the printer's dead zone
  [MX + CARD_W, MY + CARD_H], [PAGE_W - MX - CARD_W, MY + CARD_H], [PAGE_W / 2, PAGE_H / 2],
  [MX + CARD_W, PAGE_H - MY - CARD_H], [PAGE_W - MX - CARD_W, PAGE_H - MY - CARD_H],
];
const cross = ([x, y]) => `<div class="xh" style="left:${x}mm;top:${y}mm"></div>`;
const ruler = ([x, y]) => {
  const bx = PAGE_W - x; // the back is mirrored left-to-right
  const line = (l, t, w, h) => `<div class="tk" style="left:${l}mm;top:${t}mm;width:${w}mm;height:${h}mm"></div>`;
  // Horizontal scale sits below the point and is read by the crosshair's
  // vertical arm; vertical scale sits to the right and is read by its
  // horizontal arm. Kept apart so their numbers never collide.
  const H = y + 8, V = bx + 8;
  let out = line(bx - 6.5, H, 13, 0) + line(V, y - 6.5, 0, 13);
  out += `<div class="dot" style="left:${bx}mm;top:${y}mm"></div>`;
  for (let mm = -6; mm <= 6; mm++) {
    const major = mm % 3 === 0;
    out += line(bx + mm, H, 0, major ? 2 : 1.1);
    out += line(V, y + mm, major ? 2 : 1.1, 0);
    if (major) {
      const t = mm > 0 ? '+' + mm : String(mm);
      out += `<div class="tl" style="left:${bx + mm - 2.5}mm;top:${H + 2.6}mm">${t}</div>`;
      out += `<div class="tl tr" style="left:${V + 2.6}mm;top:${y + mm - 1}mm">${t}</div>`;
    }
  }
  out += `<div class="tl cap" style="left:${bx - 10}mm;top:${H + 5.6}mm">left / right</div>`;
  out += `<div class="tl cap tr" style="left:${V + 6.8}mm;top:${y - 1}mm">up / down</div>`;
  return out;
};
let scale = '';
for (let mm = 0; mm <= 100; mm += 10) scale += `<div class="tk" style="left:${55 + mm}mm;top:100mm;height:${mm % 50 ? 3 : 5}mm;width:0;border-top:0;border-left:0.4pt solid #000"></div>`;
const testHTML = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 210mm 297mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'FreeSans', sans-serif; }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.xh { position: absolute; width: 0; height: 0; }
.xh::before { content: ''; position: absolute; left: -13mm; top: 0; width: 26mm; border-top: 0.6pt solid #000; }
.xh::after { content: ''; position: absolute; top: -13mm; left: 0; height: 26mm; border-left: 0.6pt solid #000; }
.tk { position: absolute; border-left: 0.3pt solid #000; border-top: 0.3pt solid #000; }
.tl { position: absolute; width: 5mm; text-align: center; font-size: 6pt; line-height: 1; }
.tl.tr { width: auto; text-align: left; }
.tl.cap { width: 20mm; font-size: 5pt; color: #555; }
.tl.cap.tr { width: 14mm; }
.dot { position: absolute; width: 0.8mm; height: 0.8mm; margin: -0.4mm 0 0 -0.4mm; border-radius: 50%; background: #000; }
.txt { position: absolute; left: 25mm; right: 25mm; font-size: 10pt; line-height: 1.45; }
</style></head><body>
<section class="page">${POINTS.map(cross).join('')}
  <div class="txt" style="top:72mm"><b>Alignment test: FRONT.</b> Print this sheet double-sided on A4, flip on long edge, actual size (100%), with the same printer and settings you will use for the cards.</div>
  ${scale}<div class="txt" style="top:107mm;font-size:8pt;left:55mm">This bar is exactly 100 mm. If it measures shorter, the printer is scaling: set it to actual size.</div>
</section>
<section class="page">${POINTS.map(ruler).join('')}
  <div class="txt" style="top:72mm"><b>Alignment test: BACK.</b> Hold the sheet up to a light with this side facing you. Each crosshair from the front shows through onto a ruler.</div>
  <div class="txt" style="top:86mm;font-size:9pt">Read the centre target. The small dot is where the crosshair should cross. Where the crosshair's vertical line crosses the <b>left / right</b> scale gives the first number; where its horizontal line crosses the <b>up / down</b> scale gives the second. Ticks are 1 mm apart. If both read 0, the cards will line up as they are. Otherwise, rebuild with those two numbers. If the corner rulers read differently from each other, the printer is skewing the paper and an offset cannot fully fix it.</div>
</section></body></html>`;
const testPath = join(OUT_DIR, 'thai-flashcards-alignment-test.html');
writeFileSync(testPath, testHTML);
await page.goto('file://' + testPath);
await page.pdf({ path: join(OUT_DIR, 'thai-flashcards-alignment-test.pdf'), width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
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
console.log(`page: A4, card ${CARD_W} x ${CARD_H} mm, margins ${MX} / ${MY} mm, back offset ${BACK_DX}, ${BACK_DY} mm`);
console.log('wrote', pdfPath);
