// Extractor de recursos de Macromedia Director 6 (RIFX, big-endian, sin comprimir).
// Uso: node extraer.js <archivo.DXR|.CXT> <carpeta-salida>
// Genera: miembros.json (lista de miembros con nombre/tipo/texto), PNG de bitmaps, WAV de sonidos.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [, , inFile, outDir] = process.argv;
const buf = fs.readFileSync(inFile);
fs.mkdirSync(outDir, { recursive: true });

const u8 = (o) => buf[o];
const u16 = (o) => buf.readUInt16BE(o);
const i16 = (o) => buf.readInt16BE(o);
const u32 = (o) => buf.readUInt32BE(o);
const tag = (o) => buf.toString('latin1', o, o + 4);

if (tag(0) !== 'RIFX') throw new Error('No es un archivo RIFX big-endian');

// Mac Roman -> Unicode (0x80-0xFF)
const MACROMAN = 'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';
function macStr(b) {
  let s = '';
  for (const c of b) s += c < 0x80 ? String.fromCharCode(c) : MACROMAN[c - 0x80];
  return s.replace(/\r/g, '\n');
}

// ---- mmap: tabla de chunks
const mmapOff = u32(12 + 8 + 4);
if (tag(mmapOff) !== 'mmap') throw new Error('mmap no encontrado');
const mm = mmapOff + 8;
const entrySize = u16(mm + 2);
const used = u32(mm + 8);
const chunks = [];
for (let i = 0; i < used; i++) {
  const e = mm + u16(mm) + i * entrySize;
  chunks.push({ id: i, tag: tag(e), len: u32(e + 4), off: u32(e + 8) });
}
const data = (id) => { const c = chunks[id]; return buf.subarray(c.off + 8, c.off + 8 + c.len); };
const firstOf = (t) => chunks.find((c) => c.tag === t);

// ---- KEY*: qué chunks pertenecen a qué miembro
const owned = {}; // castSectionId -> [{tag,id}]
{
  const k = firstOf('KEY*'); if (!k) { console.log(path.basename(inFile) + ': elenco vacío (sin KEY*)'); process.exit(0); }
  const d = data(k.id);
  const hdr = d.readUInt16BE(0), es = d.readUInt16BE(2), n = d.readUInt32BE(8);
  for (let i = 0; i < n; i++) {
    const o = hdr + i * es;
    const sec = d.readUInt32BE(o), parent = d.readUInt32BE(o + 4), t = d.toString('latin1', o + 8, o + 12);
    (owned[parent] = owned[parent] || []).push({ tag: t, id: sec });
  }
}

// ---- Primer número de miembro (Cinf/DRCF no siempre); para elencos CAS* el índice empieza en minMember
let minMember = 1;
const lctxCas = firstOf('CAS*');
if (!lctxCas) { console.log(path.basename(inFile) + ': elenco vacío (sin CAS*)'); process.exit(0); }
const castIds = [];
{
  const d = data(lctxCas.id);
  for (let i = 0; i + 4 <= d.length; i += 4) castIds.push(d.readUInt32BE(i));
}
{
  const drcf = firstOf('DRCF') || firstOf('VWCF');
  if (drcf) { const d = data(drcf.id); minMember = d.readInt16BE(0x14) || 1; }
}

// ---- Paletas
function macSystemPalette() {
  const p = [];
  const steps = [0xff, 0xcc, 0x99, 0x66, 0x33, 0x00];
  for (const r of steps) for (const g of steps) for (const b of steps) if (r || g || b) p.push([r, g, b]);
  const ramp = [0xee, 0xdd, 0xbb, 0xaa, 0x88, 0x77, 0x55, 0x44, 0x22, 0x11];
  for (const v of ramp) p.push([v, 0, 0]);
  for (const v of ramp) p.push([0, v, 0]);
  for (const v of ramp) p.push([0, 0, v]);
  for (const v of ramp) p.push([v, v, v]);
  p.push([0, 0, 0]);
  return p;
}
const SYS_MAC = macSystemPalette();
const grayPal = (n) => Array.from({ length: n }, (_, i) => { const v = 255 - Math.round(i * 255 / (n - 1)); return [v, v, v]; });

// ---- PNG
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function pngChunk(t, d) {
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t, 'latin1'), d]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]));
}

// ---- WAV
function writeWAV(file, rate, channels, bits, pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * bits / 8, 28); h.writeUInt16LE(channels * bits / 8, 32); h.writeUInt16LE(bits, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}
function decodeSnd(d) {
  // Recurso 'snd ' de Mac (formato 1 o 2)
  let o = 0;
  const fmt = d.readUInt16BE(o); o += 2;
  if (fmt === 1) { const nf = d.readUInt16BE(o); o += 2 + nf * 6; } else o += 2;
  const ncmd = d.readUInt16BE(o); o += 2;
  let hdr = -1;
  for (let i = 0; i < ncmd; i++) { const cmd = d.readUInt16BE(o) & 0x7fff; if (cmd === 0x51 || cmd === 0x50) hdr = d.readUInt32BE(o + 4); o += 8; }
  if (hdr < 0) return null;
  const len = d.readUInt32BE(hdr + 4), rate = d.readUInt32BE(hdr + 8) >>> 16, enc = d[hdr + 20];
  if (enc === 0x00) { // 8 bits sin signo, mono
    return { rate, channels: 1, bits: 8, pcm: Buffer.from(d.subarray(hdr + 22, hdr + 22 + len)) };
  }
  if (enc === 0xff) { // cabecera extendida
    const ch = len, frames = d.readUInt32BE(hdr + 22), bits = d.readUInt16BE(hdr + 48);
    const bytes = frames * ch * bits / 8;
    let pcm = Buffer.from(d.subarray(hdr + 64, hdr + 64 + bytes));
    if (bits === 16) for (let i = 0; i + 1 < pcm.length; i += 2) pcm.writeInt16LE(pcm.readInt16BE(i), i);
    return { rate, channels: ch, bits, pcm };
  }
  return null;
}

// ---- Bitmaps
function decodeBITD(d, w, h, bpp, rowBytes) {
  const need = rowBytes * h;
  let px;
  if (d.length >= need) px = d;
  else { // PackBits
    px = Buffer.alloc(need);
    let i = 0, o = 0;
    while (i < d.length && o < need) {
      const c = d[i++];
      if (c < 0x80) { const n = c + 1; d.copy(px, o, i, i + n); i += n; o += n; }
      else if (c > 0x80) { const n = 257 - c; px.fill(d[i++], o, o + n); o += n; }
      else i++;
    }
  }
  return px;
}

const TYPES = { 1: 'bitmap', 2: 'filmloop', 3: 'texto', 4: 'paleta', 5: 'picture', 6: 'sonido', 7: 'boton', 8: 'forma', 9: 'pelicula', 10: 'video', 11: 'script', 12: 'texto', 14: 'transicion', 15: 'xtra' };
const members = [];
const palettes = {}; // número de miembro -> paleta
const pendingBitmaps = [];
const safe = (s) => s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);

castIds.forEach((secId, idx) => {
  if (!secId || !chunks[secId] || chunks[secId].tag !== 'CASt') return;
  const num = idx + minMember;
  const d = data(secId);
  const type = d.readUInt32BE(0), infoLen = d.readUInt32BE(4), specLen = d.readUInt32BE(8);
  const info = d.subarray(12, 12 + infoLen), spec = d.subarray(12 + infoLen, 12 + infoLen + specLen);
  let name = '';
  if (infoLen >= 22) {
    const dOff = info.readUInt32BE(0), cnt = info.readUInt16BE(dOff);
    const offs = []; for (let i = 0; i <= cnt; i++) offs.push(info.readUInt32BE(dOff + 2 + i * 4));
    const base = dOff + 2 + (cnt + 1) * 4;
    if (cnt >= 2) { const s = info.subarray(base + offs[1], base + offs[2]); if (s.length) name = macStr(s.subarray(1, 1 + s[0])); }
  }
  const m = { num, name, tipo: TYPES[type] || 'tipo' + type };
  const own = owned[secId] || [];
  const ch = (t) => own.find((x) => x.tag === t);

  if (type === 3 && ch('STXT')) {
    const s = data(ch('STXT').id);
    const tl = s.readUInt32BE(4);
    m.texto = macStr(s.subarray(s.readUInt32BE(0), s.readUInt32BE(0) + tl));
  }
  if ((type === 12 || type === 15) && ch('RTE1')) {
    const s = data(ch('RTE1').id);
    m.texto = macStr(s);
  }
  if (type === 4 && ch('CLUT')) {
    const s = data(ch('CLUT').id); const p = [];
    for (let i = 0; i + 6 <= s.length; i += 6) p.push([s[i], s[i + 2], s[i + 4]]);
    palettes[num] = p;
  }
  if (type === 1) {
    const rb = spec.readUInt16BE(0) & 0x7fff;
    const top = spec.readInt16BE(2), left = spec.readInt16BE(4), bottom = spec.readInt16BE(6), right = spec.readInt16BE(8);
    m.rect = [left, top, right, bottom];
    m.reg = [spec.readInt16BE(20), spec.readInt16BE(18)];
    let bpp = 1, clut = 0;
    if (specLen > 22) { bpp = spec[23]; clut = spec.readInt16BE(26); }
    m.bpp = bpp; m.clut = clut;
    if (ch('BITD')) pendingBitmaps.push({ m, d: data(ch('BITD').id), rb });
  }
  if (type === 6 && ch('snd ')) {
    try {
      const s = decodeSnd(data(ch('snd ').id));
      if (s) { m.archivo = `${num}_${safe(name || 'sonido')}.wav`; writeWAV(path.join(outDir, m.archivo), s.rate, s.channels, s.bits, s.pcm); }
    } catch (e) { m.error = String(e.message); }
  }
  members.push(m);
});

for (const { m, d, rb } of pendingBitmaps) {
  const [l, t, r, b] = m.rect; const w = r - l, h = b - t;
  if (w <= 0 || h <= 0) continue;
  try {
    const px = decodeBITD(d, w, h, m.bpp, rb);
    const rgba = Buffer.alloc(w * h * 4);
    let pal = m.bpp === 8 ? (m.clut > 0 && palettes[m.clut] ? palettes[m.clut] : SYS_MAC) : grayPal(1 << Math.min(m.bpp, 8));
    if (m.bpp === 8 && m.clut > 0 && !palettes[m.clut]) m.paletaExterna = m.clut;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c;
      if (m.bpp === 8) c = pal[px[y * rb + x]] || [0, 0, 0];
      else if (m.bpp === 16) { const v = px.readUInt16BE(y * rb + x * 2); c = [((v >> 10) & 31) * 8, ((v >> 5) & 31) * 8, (v & 31) * 8]; }
      else if (m.bpp === 32) { const o = y * rb; c = [px[o + x + w], px[o + x + 2 * w], px[o + x + 3 * w]]; }
      else { const bitsPer = m.bpp, per = 8 / bitsPer, byte = px[y * rb + Math.floor(x / per)], sh = 8 - bitsPer * (x % per + 1); c = pal[(byte >> sh) & ((1 << bitsPer) - 1)]; }
      rgba.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
    m.archivo = `${m.num}_${safe(m.name || 'bitmap')}.png`;
    writePNG(path.join(outDir, m.archivo), w, h, rgba);
  } catch (e) { m.error = String(e.message); }
}

// ---- Etiquetas (marcadores) de la partitura
const labels = [];
const vwlb = firstOf('VWLB');
if (vwlb) {
  const d = data(vwlb.id); const n = d.readUInt16BE(0);
  const ent = []; for (let i = 0; i <= n; i++) ent.push({ frame: d.readUInt16BE(2 + i * 4), off: d.readUInt16BE(4 + i * 4) });
  const base = 2 + (n + 1) * 4;
  for (let i = 0; i < n; i++) labels.push({ frame: ent[i].frame, nombre: macStr(d.subarray(base + ent[i].off, base + ent[i + 1].off)) });
}

fs.writeFileSync(path.join(outDir, 'miembros.json'), JSON.stringify({ archivo: path.basename(inFile), etiquetas: labels, miembros: members }, null, 1));
console.log(`${path.basename(inFile)}: ${members.length} miembros, ${members.filter((m) => m.archivo).length} archivos, ${labels.length} etiquetas`);
