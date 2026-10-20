// Analiza los sonidos candidatos: volumen (LUFS), silencios y un espectrograma por candidato.
// Uso: node herramientas/analizar_sonidos.js <carpeta-salida-imagenes>
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CAND = path.join(__dirname, '..', 'extraido', 'sonidos_candidatos');
const OUT = process.argv[2] || path.join(CAND, '_analisis');
fs.mkdirSync(OUT, { recursive: true });
const datos = JSON.parse(fs.readFileSync(path.join(CAND, 'candidatos.json'), 'utf8'));
const FUENTE = 'C\\:/Windows/Fonts/arial.ttf';

for (const [id, { candidatos }] of Object.entries(datos)) {
  const filas = [];
  for (const [i, c] of candidatos.entries()) {
    const f = path.join(CAND, c.archivo);
    const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'ebur128,silencedetect=n=-45dB:d=1', '-f', 'null', '-'], { encoding: 'utf8' });
    const lufs = (r.stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop();
    const silencios = (r.stderr.match(/silence_duration: ([\d.]+)/g) || []).map((s) => +s.split(': ')[1]).reduce((a, b) => a + b, 0);
    c.lufs = lufs ? +lufs.match(/-?[\d.]+/)[0] : null;
    c.silencio = +silencios.toFixed(1);
    const etiqueta = `${i + 1}  ${c.duracion.toFixed(0)}s  ${c.lufs} LUFS  silencio ${c.silencio}s  ${c.titulo}`.replace(/[':\\%]/g, ' ').slice(0, 90);
    const png = path.join(OUT, `${id}_${i + 1}.png`);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-t', '30', '-lavfi',
      `showspectrumpic=s=560x150:legend=0:scale=log:color=magma,pad=560:180:0:30:color=0x10263d,drawtext=fontfile='${FUENTE}':text='${etiqueta}':x=6:y=8:fontsize=15:fontcolor=white`, png]);
    filas.push(png);
    console.log(`${id} #${i + 1}: ${c.duracion.toFixed(1)}s, ${c.lufs} LUFS, silencio ${c.silencio}s — ${c.titulo} [${c.etiquetas.slice(0, 6).join(', ')}]`);
  }
  if (filas.length) {
    const args = filas.flatMap((p) => ['-i', p]);
    spawnSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', filas.length > 1 ? `vstack=${filas.length}` : 'null', path.join(OUT, `_${id}.png`)]);
  }
}
fs.writeFileSync(path.join(CAND, 'candidatos.json'), JSON.stringify(datos, null, 1));
