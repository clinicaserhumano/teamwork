// Crea remake/app/assets/icono.ico (PNG de 256 px dentro de un ICO) a partir del barquito del logo.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = path.join(__dirname, '..', 'remake', 'app', 'assets', 'img', 'logo_barca.png');
const DST = path.join(__dirname, '..', 'remake', 'app', 'assets', 'icono.ico');

function readPNG(f) {
  const b = fs.readFileSync(f);
  let o = 8, w, h; const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), t = b.toString('latin1', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); }
    if (t === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) raw.copy(px, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  return { w, h, px };
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };

const src = readPNG(SRC);
const N = 256, margen = 16, esc = Math.min((N - 2 * margen) / src.w, (N - 2 * margen) / src.h);
const ox = (N - src.w * esc) / 2, oy = (N - src.h * esc) / 2;
const px = Buffer.alloc(N * N * 4);
const at = (x, y, q) => src.px[(clampI(y, src.h) * src.w + clampI(x, src.w)) * 4 + q];
function clampI(v, n) { return Math.max(0, Math.min(n - 1, v)); }
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const sx = (x - ox) / esc - 0.5, sy = (y - oy) / esc - 0.5;
  if (sx < -1 || sy < -1 || sx > src.w || sy > src.h) continue;
  const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
  // bilineal con alfa premultiplicado
  let a = 0; const c = [0, 0, 0];
  for (const [dx, dy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const al = at(x0 + dx, y0 + dy, 3) / 255 * wgt; a += al;
    for (let q = 0; q < 3; q++) c[q] += at(x0 + dx, y0 + dy, q) * al;
  }
  const o = (y * N + x) * 4;
  if (a > 0) { px[o] = c[0] / a; px[o + 1] = c[1] / a; px[o + 2] = c[2] / a; px[o + 3] = Math.round(a * 255); }
}
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
const ih = Buffer.alloc(13); ih.writeUInt32BE(N, 0); ih.writeUInt32BE(N, 4); ih[8] = 8; ih[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);

const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 0; ico[7] = 0; ico[8] = 0; ico[9] = 0; // 256x256
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(DST, Buffer.concat([ico, png]));
fs.writeFileSync(DST.replace('.ico', '_256.png'), png);
console.log('icono creado:', DST);
