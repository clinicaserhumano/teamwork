// Copia al juego las fotos elegidas (redimensionadas con ffmpeg) y genera los créditos.
// Requiere haber ejecutado buscar_fotos.js. Uso: node herramientas/integrar_fotos.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const CAND = path.join(RAIZ, 'extraido', 'fotos_candidatas');
const DST = path.join(RAIZ, 'remake', 'app', 'assets', 'fotos');
fs.mkdirSync(DST, { recursive: true });

// Foto elegida (número de candidata) para cada imagen del juego
const ELEGIDAS = {
  barco_grande: 3, eleccion_ruta: 3,
  prima_fortuna: 1, prima_novedad: 1, prima_aventura: 2, prima_justicia: 1, prima_ideal: 2, prima_felicidad: 3, prima_cambiar: 3,
  eleccion_barco: 1, eleccion_provisiones: 1, eleccion_tripulacion: 4,
  barco_1: 4, barco_2: 3, barco_3: 1, barco_4: 2,
  ruta_1: 4, ruta_2: 2, ruta_3: 3, ruta_4: 1,
  bodega_poca: 2, bodega_media: 1, bodega_mucha: 2,
  tripulacion_1: 3, tripulacion_2: 2, tripulacion_3: 1, tripulacion_4: 4, tripulacion_5: 1,
  lider_reunion: 2, lider_circulo: 3,
  decide_todos: 4, decide_uno: 2, decide_grupo: 2, decide_cada: 2, decide_niveles: 4,
  botella: 2, grafico: 1,
  ev_affoll: 3, ev_tempor: 4, ev_pirati: 4, ev_naufra: 3, ev_conc3: 2, ev_isola: 2, ev_confus: 3, ev_crisi: 1,
};

const candidatas = JSON.parse(fs.readFileSync(path.join(CAND, 'candidatas.json'), 'utf8'));
let claves = {};
try { claves = JSON.parse(fs.readFileSync(path.join(__dirname, 'claves.json'), 'utf8')); } catch { /* sin clave */ }

(async () => {
  const creditos = [];
  for (const [id, n] of Object.entries(ELEGIDAS)) {
    const c = candidatas[id].candidatas[n - 1];
    // Lado mayor 1400 px, JPEG de calidad alta
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(CAND, id, `${n}.jpg`),
      '-vf', "scale='if(gt(iw,ih),min(1400,iw),-2)':'if(gt(iw,ih),-2,min(1400,ih))'", '-q:v', '4', path.join(DST, `${id}.jpg`)]);
    creditos.push({ imagen: id, autor: c.autor, perfil: c.perfil, foto: c.pagina, fuente: c.fuente });
    // Las normas de la API de Unsplash piden notificar cada descarga usada
    if (c.avisoDescarga && claves.unsplash) {
      try { await fetch(c.avisoDescarga, { headers: { Authorization: `Client-ID ${claves.unsplash}` } }); } catch { /* no crítico */ }
    }
  }
  // Créditos para el juego (pantalla de créditos) y para el repositorio
  fs.writeFileSync(path.join(RAIZ, 'remake', 'app', 'creditos.js'),
    `// Generado por herramientas/integrar_fotos.js\n'use strict';\nconst CREDITOS_FOTOS = ${JSON.stringify(creditos.map(({ imagen, autor, fuente }) => ({ imagen, autor, fuente })), null, 1)};\n`);
  const md = ['# Créditos de las fotografías', '', 'Fotografías de [Unsplash](https://unsplash.com/?utm_source=teamwork&utm_medium=referral), usadas bajo la [licencia de Unsplash](https://unsplash.com/license).', '',
    '| Imagen del juego | Autor | Foto |', '|---|---|---|',
    ...creditos.map((c) => `| ${c.imagen} | [${c.autor}](${c.perfil}) | [ver en ${c.fuente}](${c.foto}) |`)];
  fs.writeFileSync(path.join(RAIZ, 'remake', 'CREDITOS.md'), md.join('\n') + '\n');
  const peso = fs.readdirSync(DST).reduce((s, f) => s + fs.statSync(path.join(DST, f)).size, 0);
  console.log(`${creditos.length} fotos integradas, ${(peso / 1048576).toFixed(1)} MB`);
})();
