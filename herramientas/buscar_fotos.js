// Busca y descarga fotos candidatas para cada imagen del juego (Unsplash o Pexels).
// La clave se lee de herramientas/claves.json (no se sube a git) o de variables de entorno:
//   { "unsplash": "ACCESS_KEY" }   o   { "pexels": "API_KEY" }
// Uso: node herramientas/buscar_fotos.js [candidatas-por-imagen] [id1,id2,...]
// Resultado: extraido/fotos_candidatas/<id>/<n>.jpg y extraido/fotos_candidatas/candidatas.json
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const OUT = path.join(RAIZ, 'extraido', 'fotos_candidatas');
const N = +(process.argv[2] || 4);
const SOLO = process.argv[3] ? new Set(process.argv[3].split(',')) : null;

let claves = {};
try { claves = JSON.parse(fs.readFileSync(path.join(__dirname, 'claves.json'), 'utf8')); } catch { /* sin archivo */ }
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY || claves.unsplash;
const PEXELS = process.env.PEXELS_API_KEY || claves.pexels;
if (!UNSPLASH && !PEXELS) { console.error('Falta la clave: crea herramientas/claves.json con {"unsplash": "..."} o {"pexels": "..."}'); process.exit(1); }

async function json(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} en ${url}`);
  return r.json();
}

async function buscarUnsplash(q, orientacion) {
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${N}&orientation=${orientacion}&content_filter=high`;
  const j = await json(u, { Authorization: `Client-ID ${UNSPLASH}`, 'Accept-Version': 'v1' });
  return j.results.map((r) => ({
    fuente: 'Unsplash', id: r.id, descarga: `${r.urls.raw}&w=1600&q=82&fm=jpg`,
    autor: r.user.name, perfil: `${r.user.links.html}?utm_source=teamwork&utm_medium=referral`,
    pagina: r.links.html, descripcion: r.alt_description || '', avisoDescarga: r.links.download_location,
  }));
}

async function buscarPexels(q, orientacion) {
  const o = orientacion === 'squarish' ? 'square' : orientacion;
  const j = await json(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${N}&orientation=${o}`, { Authorization: PEXELS });
  return j.photos.map((p) => ({
    fuente: 'Pexels', id: String(p.id), descarga: p.src.large2x, autor: p.photographer, perfil: p.photographer_url,
    pagina: p.url, descripcion: p.alt || '',
  }));
}

(async () => {
  const lista = JSON.parse(fs.readFileSync(path.join(__dirname, 'fotos.json'), 'utf8')).fotos;
  const archivo = path.join(OUT, 'candidatas.json');
  let todas = {};
  try { todas = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { /* primera vez */ }
  for (const f of lista) {
    if (SOLO && !SOLO.has(f.id)) continue;
    try {
      const res = UNSPLASH ? await buscarUnsplash(f.busqueda, f.orientacion) : await buscarPexels(f.busqueda, f.orientacion);
      const dir = path.join(OUT, f.id);
      fs.mkdirSync(dir, { recursive: true });
      for (const [i, r] of res.entries()) {
        const img = await fetch(r.descarga);
        fs.writeFileSync(path.join(dir, `${i + 1}.jpg`), Buffer.from(await img.arrayBuffer()));
        r.archivo = `${f.id}/${i + 1}.jpg`;
      }
      todas[f.id] = { busqueda: f.busqueda, candidatas: res };
      console.log(`${f.id}: ${res.length} candidatas`);
    } catch (e) { console.log(`${f.id}: ERROR ${e.message}`); }
  }
  fs.writeFileSync(archivo, JSON.stringify(todas, null, 1));
})();
