// Busca y descarga sonidos candidatos en Freesound (solo licencia CC0 = dominio público).
// La clave se lee de herramientas/claves.json ({"freesound": "..."}, no se sube a git).
// Uso: node herramientas/buscar_sonidos.js [candidatos-por-sonido] [id1,id2,...]
// Resultado: extraido/sonidos_candidatos/<id>/<n>.mp3 y candidatos.json
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const OUT = path.join(RAIZ, 'extraido', 'sonidos_candidatos');
const N = +(process.argv[2] || 3);
const SOLO = process.argv[3] ? new Set(process.argv[3].split(',')) : null;

let claves = {};
try { claves = JSON.parse(fs.readFileSync(path.join(__dirname, 'claves.json'), 'utf8')); } catch { /* sin archivo */ }
const CLAVE = process.env.FREESOUND_API_KEY || claves.freesound;
if (!CLAVE) { console.error('Falta la clave: añade "freesound" en herramientas/claves.json'); process.exit(1); }

(async () => {
  const lista = JSON.parse(fs.readFileSync(path.join(__dirname, 'sonidos.json'), 'utf8')).sonidos;
  fs.mkdirSync(OUT, { recursive: true });
  const archivo = path.join(OUT, 'candidatos.json');
  let todos = {};
  try { todos = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch { /* primera vez */ }
  for (const s of lista) {
    if (SOLO && !SOLO.has(s.id)) continue;
    try {
      const filtro = `license:"Creative Commons 0" duration:[${s.dur[0]} TO ${s.dur[1]}]`;
      const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(s.busqueda)}&filter=${encodeURIComponent(filtro)}`
        + `&fields=id,name,duration,username,license,previews,avg_rating,num_ratings,num_downloads,tags,url&sort=downloads_desc&page_size=${N}&token=${CLAVE}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const j = await r.json();
      const dir = path.join(OUT, s.id);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const res = [];
      for (const [i, x] of j.results.entries()) {
        const a = await fetch(x.previews['preview-hq-mp3']);
        if (!a.ok) continue;
        fs.writeFileSync(path.join(dir, `${i + 1}.mp3`), Buffer.from(await a.arrayBuffer()));
        res.push({ archivo: `${s.id}/${i + 1}.mp3`, titulo: x.name, autor: x.username, pagina: x.url, licencia: 'CC0',
          duracion: x.duration, valoracion: x.avg_rating, votos: x.num_ratings, descargas: x.num_downloads, etiquetas: (x.tags || []).slice(0, 12) });
      }
      todos[s.id] = { busqueda: s.busqueda, candidatos: res };
      console.log(`${s.id}: ${res.map((c) => `[${c.duracion.toFixed(0)}s ★${(c.valoracion || 0).toFixed(1)} ${c.descargas}↓] ${c.titulo.slice(0, 40)}`).join(' | ')}`);
    } catch (e) { console.log(`${s.id}: ERROR ${e.message}`); }
  }
  fs.writeFileSync(archivo, JSON.stringify(todos, null, 1));
})();
