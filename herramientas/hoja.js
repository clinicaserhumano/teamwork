// Une varios PNG (generados por extraer.js: RGBA, filtro 0) en una hoja de contacto.
// Uso: node hoja.js salida.png anchoMax archivo1.png archivo2.png ...
'use strict';
const fs = require('fs');
const zlib = require('zlib');

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

const [, , out, maxW, ...files] = process.argv;
const imgs = files.map(readPNG);
const pad = 8, MW = +maxW;
let x = pad, y = pad, rowH = 0; const pos = [];
for (const im of imgs) {
  if (x + im.w + pad > MW && x > pad) { x = pad; y += rowH + pad; rowH = 0; }
  pos.push([x, y]); x += im.w + pad; rowH = Math.max(rowH, im.h);
}
const W = MW, H = y + rowH + pad, px = Buffer.alloc(W * H * 4);
for (let i = 0; i < px.length; i += 4) px.set([90, 90, 110, 255], i);
imgs.forEach((im, k) => { const [ox, oy] = pos[k]; for (let r = 0; r < im.h; r++) for (let c = 0; c < im.w; c++) { const s = (r * im.w + c) * 4, d = ((oy + r) * W + ox + c) * 4, a = im.px[s + 3] / 255; for (let q = 0; q < 3; q++) px[d + q] = Math.round(im.px[s + q] * a + px[d + q] * (1 - a)); } });
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let r = 0; r < H; r++) px.copy(raw, r * (W * 4 + 1) + 1, r * W * 4, (r + 1) * W * 4);
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
