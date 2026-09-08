// Minimal QR encoder: byte mode, error correction level L, versions 1-10,
// mask 0. Enough to carry a pairing URL, and small enough to read in full.
// No dependency: everything below is GF(256) arithmetic and module placement.

// Error-correction codewords per block, and block count, for level L, v1..v10.
const ECC_PER_BLOCK_L = [7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const BLOCKS_L = [1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
const MAX_VERSION = 10;
const MASK = 0; // fixed: readers decode any mask, and one mask keeps this small

function rawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
const rawCodewords = (ver) => Math.floor(rawDataModules(ver) / 8);
const dataCodewords = (ver) => rawCodewords(ver) - BLOCKS_L[ver - 1] * ECC_PER_BLOCK_L[ver - 1];

// ---- GF(256) with primitive polynomial 0x11D ----
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

// ---- bitstream -> codewords ----
function encodeBytes(bytes, ver) {
  const cap = dataCodewords(ver);
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);                       // byte mode
  push(bytes.length, ver <= 9 ? 8 : 16); // character count
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, cap * 8 - bits.length));       // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const out = new Uint8Array(cap);
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
    out[i / 8] = v;
  }
  for (let i = bits.length / 8, pad = 0xec; i < cap; i++, pad ^= 0xec ^ 0x11) out[i] = pad;
  return out;
}

// Split into blocks, append EC codewords, interleave as the spec requires.
function addEccAndInterleave(data, ver) {
  const numBlocks = BLOCKS_L[ver - 1];
  const eccLen = ECC_PER_BLOCK_L[ver - 1];
  const raw = rawCodewords(ver);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - eccLen + (i < numShort ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const block = new Uint8Array(shortLen + 1);
    block.set(dat, 0);
    block.set(rsRemainder(dat, divisor), block.length - eccLen);
    blocks.push({ dat, block });
  }
  const out = [];
  for (let i = 0; i < shortLen + 1; i++) {
    for (let j = 0; j < numBlocks; j++) {
      // the padding slot only exists in the long blocks
      if (i === shortLen - eccLen && j < numShort) continue;
      out.push(blocks[j].block[i]);
    }
  }
  return Uint8Array.from(out);
}

// ---- matrix ----
function alignmentPositions(ver) {
  if (ver === 1) return [];
  const num = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = Math.floor((ver * 4 + num * 2 + 1) / (num * 2 - 2)) * 2;
  const res = new Array(num);
  res[0] = 6;
  for (let i = num - 1, pos = size - 7; i >= 1; i--, pos -= step) res[i] = pos;
  return res;
}

function buildMatrix(ver, codewords) {
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(0));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) { m[r][c] = v ? 1 : 0; fn[r][c] = true; } };

  // finder patterns with separators
  for (const [fr, fc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = fr + dr, c = fc + dc;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        set(r, c, dist !== 2 && dist !== 4);
      }
    }
  }
  // timing patterns
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  // alignment patterns
  const pos = alignmentPositions(ver);
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      const skip = (i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0);
      if (skip) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
        set(pos[i] + dr, pos[j] + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
  // format information (level L + mask), both copies
  const fmtData = (0b01 << 3) | MASK;
  let rem = fmtData;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fmt = ((fmtData << 10) | rem) ^ 0x5412;
  const fbit = (i) => (fmt >>> i) & 1;
  for (let i = 0; i <= 5; i++) set(i, 8, fbit(i));
  set(7, 8, fbit(6));
  set(8, 8, fbit(7));
  set(8, 7, fbit(8));
  for (let i = 9; i < 15; i++) set(8, 14 - i, fbit(i));
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, fbit(i));
  for (let i = 8; i < 15; i++) set(size - 15 + i, 8, fbit(i));
  set(size - 8, 8, 1); // always dark
  // version information (v7+)
  if (ver >= 7) {
    let vrem = ver;
    for (let i = 0; i < 12; i++) vrem = (vrem << 1) ^ ((vrem >>> 11) * 0x1f25);
    const vbits = (ver << 12) | vrem;
    for (let i = 0; i < 18; i++) {
      const bit = (vbits >>> i) & 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(b, a, bit);
      set(a, b, bit);
    }
  }

  // data placement: zigzag from bottom-right, two columns at a time
  let bit = 0;
  const total = codewords.length * 8;
  const nextBit = () => (bit < total ? (codewords[bit >> 3] >>> (7 - (bit++ & 7))) & 1 : (bit++, 0));
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let v = 0; v < size; v++) {
      const r = upward ? size - 1 - v : v;
      for (let k = 0; k < 2; k++) {
        const c = right - k;
        if (fn[r][c]) continue;
        let d = nextBit();
        if ((r + c) % 2 === 0) d ^= 1; // mask 0
        m[r][c] = d;
      }
    }
    upward = !upward;
  }
  return m;
}

// Smallest version that fits, or null when the payload is too large.
export function encode(text) {
  const bytes = new TextEncoder().encode(text);
  for (let ver = 1; ver <= MAX_VERSION; ver++) {
    const headerBits = 4 + (ver <= 9 ? 8 : 16);
    if (bytes.length * 8 + headerBits <= dataCodewords(ver) * 8) {
      return buildMatrix(ver, addEccAndInterleave(encodeBytes(bytes, ver), ver));
    }
  }
  return null;
}

// Renders as one SVG path; `quiet` is the mandatory 4-module quiet zone.
export function svg(text, { size = 220, quiet = 4 } = {}) {
  const m = encode(text);
  if (!m) return null;
  const n = m.length, dim = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg viewBox="0 0 ${dim} ${dim}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="pairing code">` +
    `<rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
