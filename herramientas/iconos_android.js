// Genera las imágenes base para el ícono y la pantalla de arranque de Android
// (remake/resources/*.png), que luego procesa `npx @capacitor/assets generate --android`.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const IMG = path.join(__dirname, '..', 'remake', 'app', 'assets', 'img');
const OUT = path.join(__dirname, '..', 'remake', 'resources');
fs.mkdirSync(OUT, { recursive: true });
const MARINO = [11, 26, 43];

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
function writePNG(f, W, H, px) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

// Lienzo W×H con fondo (o transparente) y una imagen escalada para ocupar `fraccion` del lado menor, centrada
function lienzo(W, H, fondo, src, fraccion) {
  const px = Buffer.alloc(W * H * 4);
  if (fondo) for (let i = 0; i < W * H; i++) px.set([...fondo, 255], i * 4);
  const esc = Math.min(W, H) * fraccion / Math.max(src.w, src.h);
  const ox = (W - src.w * esc) / 2, oy = (H - src.h * esc) / 2;
  const at = (x, y, q) => src.px[(Math.max(0, Math.min(src.h - 1, y)) * src.w + Math.max(0, Math.min(src.w - 1, x))) * 4 + q];
  for (let y = Math.floor(oy); y < Math.ceil(oy + src.h * esc); y++) for (let x = Math.floor(ox); x < Math.ceil(ox + src.w * esc); x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const sx = (x - ox) / esc - 0.5, sy = (y - oy) / esc - 0.5, x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    let a = 0; const c = [0, 0, 0];
    for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const al = at(x0 + dx, y0 + dy, 3) / 255 * w; a += al;
      for (let q = 0; q < 3; q++) c[q] += at(x0 + dx, y0 + dy, q) * al;
    }
    if (a <= 0) continue;
    const o = (y * W + x) * 4, da = px[o + 3] / 255, na = a + da * (1 - a);
    for (let q = 0; q < 3; q++) px[o + q] = Math.round((c[q] + px[o + q] * da * (1 - a)) / na);
    px[o + 3] = Math.round(na * 255);
  }
  return px;
}

const simbolo = readPNG(path.join(IMG, 'csh_simbolo_naranja.png'));
const logoBlanco = readPNG(path.join(IMG, 'csh_logo_blanco.png'));
writePNG(path.join(OUT, 'icon-only.png'), 1024, 1024, lienzo(1024, 1024, MARINO, simbolo, 0.62));
writePNG(path.join(OUT, 'icon-foreground.png'), 1024, 1024, lienzo(1024, 1024, null, simbolo, 0.5));
writePNG(path.join(OUT, 'icon-background.png'), 1024, 1024, lienzo(1024, 1024, MARINO, simbolo, 0));
for (const n of ['splash.png', 'splash-dark.png']) writePNG(path.join(OUT, n), 2732, 2732, lienzo(2732, 2732, MARINO, logoBlanco, 0.32));
console.log('recursos creados en', OUT);
