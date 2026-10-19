// Copia y adapta las imágenes extraídas al juego nuevo.
// Modos: 'foto' = copia tal cual; 'transp' = fondo negro conectado al borde -> transparente;
// 'recorte' = transp + recortar al contenido; 'esquina' = foto tapando el recuadro blanco de la esquina.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = path.join(__dirname, '..', 'extraido', 'recursos');
const DST = path.join(__dirname, '..', 'remake', 'app', 'assets', 'img');
fs.mkdirSync(DST, { recursive: true });

function readPNG(f) {
  const b = fs.readFileSync(f);
  let o = 8, w, h; const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), t = b.toString('latin1', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); }
    if (t === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  // RGBA de 8 bits con cualquier filtro de fila (los logos vienen de otros programas)
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w * 4, px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)], line = Buffer.from(raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)));
    for (let x = 0; x < st; x++) {
      const a = x >= 4 ? line[x - 4] : 0, b2 = prev[x], c = x >= 4 ? prev[x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b2;
      else if (f === 3) v += (a + b2) >> 1;
      else if (f === 4) { const p = a + b2 - c, pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c; }
      line[x] = v & 255;
    }
    line.copy(px, y * st);
    prev = line;
  }
  return { w, h, px };
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function writePNG(f, { w, h, px }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

// Relleno desde el borde: píxeles que cumplen `match` y están conectados al borde.
function floodEdges(img, match, apply) {
  const { w, h, px } = img, seen = new Uint8Array(w * h), stack = [];
  const push = (x, y) => { const i = y * w + x; if (!seen[i] && match(px, i * 4)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0; apply(px, i * 4);
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
}
const isBlack = (p, o) => p[o] < 14 && p[o + 1] < 14 && p[o + 2] < 14;
const isWhite = (p, o) => p[o] > 238 && p[o + 1] > 238 && p[o + 2] > 238;
const transparent = (p, o) => { p[o + 3] = 0; };

function bbox(img) {
  const { w, h, px } = img; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return x1 < 0 ? [0, 0, w, h] : [x0, y0, x1 + 1, y1 + 1];
}
function crop(img, [x0, y0, x1, y1]) {
  const w = x1 - x0, h = y1 - y0, px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.px.copy(px, y * w * 4, ((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x1) * 4);
  return { w, h, px };
}
// Componentes conexas de píxeles opacos (para separar la tira de la tripulación)
function components(img, minArea) {
  const { w, h, px } = img, lab = new Int32Array(w * h), out = [];
  let n = 0;
  for (let s = 0; s < w * h; s++) {
    if (lab[s] || !px[s * 4 + 3]) continue;
    n++; let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0; const st = [s]; lab[s] = n;
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0; area++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (!lab[j] && px[j * 4 + 3]) { lab[j] = n; st.push(j); }
      }
    }
    if (area >= minArea) out.push([x0, y0, x1 + 1, y1 + 1]);
  }
  return out;
}

const L = [];
const add = (dst, src, modo) => L.push([dst, src, modo]);
const seq = (base, dir, nums, nombres, modo) => nums.forEach((n, i) => add(`${base}_${i + 1}`, `${dir}/${n}_${nombres(i)}.png`, modo));

add('logo_barca', 'START/31_barchetta.png', 'recorte');
add('logo_velas', 'START/5_logo150.png', 'recorte');
// Prima: motivaciones animadas
seq('prima_fortuna', 'PRIMA', [8, 9, 10, 11, 12, 13], (i) => 'soldi' + (i + 1), 'transp');
seq('prima_justicia', 'PRIMA', [15, 16, 17, 18, 19], (i) => 'bilancia' + (i + 1), 'transp');
seq('prima_ideal', 'PRIMA', [21, 22, 23, 24], (i) => 'ballon' + (i + 1), 'transp');
seq('prima_aventura', 'PRIMA', [26, 27], (i) => 'indi' + (i + 1), 'transp');
seq('prima_cambiar', 'PRIMA', [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40], (i) => 'omino' + (i + 1), 'transp');
seq('prima_felicidad', 'PRIMA', [42, 43, 44, 45, 46], (i) => 'smile' + (i + 1), 'transp');
seq('prima_novedad', 'PRIMA', [4, 5, 6], (i) => 'punto' + (i + 1), 'transp');
// Elección principal
add('eleccion_provisiones', 'SCELTA/3_Cambusa.png', 'transp');
add('eleccion_tripulacion', 'SCELTA/5_Equipaggiofoto.png', 'transp');
add('eleccion_ruta', 'SCELTA/7_La rotta.png', 'transp');
add('eleccion_barco', 'SCELTA/11_La barca2.png', 'transp');
add('barco_grande', 'SCELTA/27_mezza vestita.png', 'foto');
seq('botella', 'SCELTA', [20, 21, 22, 23, 24, 25], () => 'Bottiglia', 'transp');
// Barcos y rutas
add('barco_1', 'BARCHE/3_cabinatino.png', 'foto');
add('barco_2', 'BARCHE/4_cabinato.png', 'foto');
add('barco_3', 'BARCHE/5_Transoceanica.png', 'foto');
add('barco_4', 'BARCHE/7_Speciale.png', 'foto');
add('ruta_1', 'ROTTE/4_Sottocosta.png', 'foto');
add('ruta_2', 'ROTTE/6_Altura.png', 'foto');
add('ruta_3', 'ROTTE/8_Traversata.png', 'foto');
add('ruta_4', 'ROTTE/10_Avventura.png', 'foto');
// Bodega
add('bodega_caja', 'CAMBUSA/4_bitmap.png', 'recorte');
add('bodega_poca', 'CAMBUSA/6_little.png', 'recorte');
add('bodega_media', 'CAMBUSA/10_middle.png', 'recorte');
add('bodega_mucha', 'CAMBUSA/8_big.png', 'recorte');
// Decisiones
add('decide_todos', 'DEC/4_gialli.png', 'recorte');
add('decide_uno', 'DEC/5_leader.png', 'recorte');
add('decide_grupo', 'DEC/6_gruppo.png', 'recorte');
add('decide_cada', 'DEC/3_arcobaleno.png', 'recorte');
add('decide_niveles', 'DEC/8_livelli.png', 'recorte');
add('lider_circulo', 'DEC/9_bitmap.png', 'foto');
add('lider_reunion', 'DEC/27_bitmap.png', 'foto');
add('grafico', 'INSO/12_Grafico.png', 'foto');
// Eventos del viaje
add('ev_affoll', 'AFFOLL/3_bitmap.png', 'foto');
add('ev_conc3', 'CONC3/3_bitmap.png', 'foto');
add('ev_confus', 'CONFUS/3_bitmap.png', 'foto');
add('ev_confus_remolino', 'CONFUS/4_bitmap.png', 'foto');
add('ev_crisi', 'CRISI/3_bitmap.png', 'foto');
add('ev_isola', 'ISOLA/4_bitmap.png', 'foto');
add('ev_naufra', 'NAUFRA/3_bitmap.png', 'esquina');
add('ev_pirati', 'PIRATI/3_bA1.png', 'recorte');
add('ev_tempor', 'TEMPOR/3_bitmap.png', 'foto');

for (const [dst, src, modo] of L) {
  let img = readPNG(path.join(SRC, src));
  if (modo === 'transp' || modo === 'recorte') { floodEdges(img, isBlack, transparent); floodEdges(img, (p, o) => p[o + 3] && isWhite(p, o), transparent); floodEdges(img, (p, o) => p[o + 3] === 0 || isBlack(p, o), transparent); }
  if (modo === 'recorte') img = crop(img, bbox(img));
  if (modo === 'esquina') floodEdges(img, isWhite, (p, o) => { p[o] = p[o + 1] = p[o + 2] = 0; });
  writePNG(path.join(DST, dst + '.png'), img);
}

// Tira de la tripulación: separar en 5 imágenes, ordenadas de izquierda a derecha / arriba a abajo
{
  const img = readPNG(path.join(SRC, 'EQUIPE/21_2.png'));
  floodEdges(img, isBlack, transparent);
  // las líneas finas blancas del diseño original no son fotos: se quitan
  const comps = components(img, 1500).filter(([x0, y0, x1, y1]) => (x1 - x0) > 30 && (y1 - y0) > 30);
  comps.sort((a, b) => a[1] - b[1] > 60 ? 1 : b[1] - a[1] > 60 ? -1 : a[0] - b[0]);
  comps.forEach((bb, i) => writePNG(path.join(DST, `tripulacion_${i + 1}.png`), crop(img, bb)));
  console.log('tripulación:', JSON.stringify(comps));
}
// Logos de Clínica Ser Humano (docs/): recortados al contenido, más el símbolo solo (para el ícono)
{
  const DOCS = path.join(__dirname, '..', 'docs');
  const naranja = readPNG(path.join(DOCS, 'clinica.png'));
  const blanco = readPNG(path.join(DOCS, 'clinica2.png'));
  const caja = bbox(naranja);
  writePNG(path.join(DST, 'csh_logo_naranja.png'), crop(naranja, caja));
  writePNG(path.join(DST, 'csh_logo_blanco.png'), crop(blanco, caja));
  // el símbolo es el bloque de la izquierda, antes del texto "Ser humano"
  const izq = crop(naranja, [0, 0, Math.round(naranja.w * 0.34), naranja.h]);
  const simbolo = crop(izq, bbox(izq));
  writePNG(path.join(DST, 'csh_simbolo_naranja.png'), simbolo);
  const izqB = crop(blanco, [0, 0, Math.round(blanco.w * 0.34), blanco.h]);
  writePNG(path.join(DST, 'csh_simbolo_blanco.png'), crop(izqB, bbox(izqB)));
  console.log('logos CSH:', caja.join(','), 'símbolo:', simbolo.w + 'x' + simbolo.h);
}
console.log('imágenes preparadas:', L.length);
