// Recorta, normaliza y copia al juego los sonidos elegidos; genera los créditos.
// Uso: node herramientas/procesar_sonidos.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const CAND = path.join(RAIZ, 'extraido', 'sonidos_candidatos');
const DST = path.join(RAIZ, 'remake', 'app', 'assets', 'snd');

// Candidato elegido para cada sonido: número, o { n, desde } para empezar en otro segundo
const ELEGIDOS = {
  amb_olas: 3, amb_puerto: 1, amb_viento: 2, amb_tormenta: 1, amb_tambores: 1,
  amb_multitud: 1, amb_oficina: 1, amb_tension: 1, musica: 1,
  ef_gaviotas: 1, ef_lobo: 1, ef_deporte: 2, ef_militar: 1, ef_amigos: 2, ef_familia: 3,
  ef_aplausos: 2, ef_campana: 1, ef_bocina: 3, ef_cajas: 1, ef_trueno: 1,
};

const lista = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, 'sonidos.json'), 'utf8')).sonidos.map((s) => [s.id, s]));
const datos = JSON.parse(fs.readFileSync(path.join(CAND, 'candidatos.json'), 'utf8'));

// Se borran los sonidos antiguos (1998) que ya no usa el juego
for (const f of fs.readdirSync(DST)) if (!Object.keys(ELEGIDOS).includes(path.basename(f, '.mp3'))) fs.unlinkSync(path.join(DST, f));

const creditos = [];
for (const [id, eleccion] of Object.entries(ELEGIDOS)) {
  const { n, desde = 0 } = typeof eleccion === 'number' ? { n: eleccion } : eleccion;
  const s = lista[id], c = datos[id].candidatos[n - 1];
  const dur = Math.min(s.recorte, c.duracion - desde);
  const fadeIn = s.bucle ? 1.5 : 0.02, fadeOut = s.bucle ? 1.5 : Math.min(0.8, dur / 4);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(desde), '-t', String(dur), '-i', path.join(CAND, c.archivo),
    '-af', `loudnorm=I=${s.bucle ? -20 : -16}:TP=-1.5:LRA=11,afade=t=in:d=${fadeIn},afade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut}`,
    '-ac', s.bucle ? '2' : '1', '-ar', '44100', '-b:a', s.bucle ? '112k' : '96k', path.join(DST, `${id}.mp3`)]);
  creditos.push({ sonido: id, titulo: c.titulo, autor: c.autor, pagina: c.pagina, licencia: c.licencia });
}

fs.writeFileSync(path.join(RAIZ, 'remake', 'app', 'creditos_sonidos.js'),
  `// Generado por herramientas/procesar_sonidos.js\n'use strict';\nconst CREDITOS_SONIDOS = ${JSON.stringify(creditos.map(({ sonido, autor }) => ({ sonido, autor })), null, 1)};\n`);
const md = path.join(RAIZ, 'remake', 'CREDITOS.md');
let texto = fs.readFileSync(md, 'utf8').split('\n# Créditos de los sonidos')[0].trimEnd();
texto += ['', '', '# Créditos de los sonidos', '', 'Sonidos de [Freesound](https://freesound.org) con licencia [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (dominio público), encontrados con [Openverse](https://openverse.org). Los sonidos de la interfaz (clic, elección, acierto, error) se generan por código.', '',
  '| Sonido del juego | Título original | Autor |', '|---|---|---|',
  ...creditos.map((c) => `| ${c.sonido} | [${c.titulo.replace(/\|/g, '/')}](${c.pagina}) | ${c.autor} |`)].join('\n') + '\n';
fs.writeFileSync(md, texto);
const peso = fs.readdirSync(DST).reduce((a, f) => a + fs.statSync(path.join(DST, f)).size, 0);
console.log(`${creditos.length} sonidos procesados, ${(peso / 1048576).toFixed(1)} MB`);
