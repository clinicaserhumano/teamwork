// Comprueba que todos los idiomas tienen los mismos textos que el español.
// Uso: node pruebas/idiomas.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'app');
const ctx = { IDIOMAS: {} };
vm.createContext(ctx);
for (const f of ['es', 'en', 'it', 'de', 'fr']) {
  const archivo = path.join(APP, 'idiomas', `${f}.js`);
  if (fs.existsSync(archivo)) vm.runInContext(fs.readFileSync(archivo, 'utf8'), ctx, { filename: archivo });
}
const { es } = ctx.IDIOMAS;
let errores = 0;
const mal = (l, m) => { errores++; console.log(`  [${l}] ${m}`); };
// Estructuras que el código parte o espera
const forma = {
  'Scelta2-1': (s) => s.includes('\n'),
  'Intro1-2': (s) => s.includes('\n\n'),
  'Indir1-1': (s) => s.includes(';'),
  'Barche3-2': (s) => /:\s*$/.test(s),
};
for (const [cod, L] of Object.entries(ctx.IDIOMAS)) {
  console.log(`${cod} (${L.nombre}): ${Object.keys(L.T).length} textos de juego, ${Object.keys(L.U).length} de interfaz`);
  for (const k of Object.keys(es.T)) {
    if (!(k in L.T)) mal(cod, `falta T["${k}"]`);
    else if (!String(L.T[k]).trim()) mal(cod, `T["${k}"] vacío`);
    else if (forma[k] && !forma[k](L.T[k])) mal(cod, `T["${k}"] no tiene la forma esperada`);
  }
  for (const k of Object.keys(L.T)) if (!(k in es.T)) mal(cod, `T["${k}"] sobra`);
  const compararU = (a, b, ruta) => {
    for (const k of Object.keys(a)) {
      const r = `${ruta}${k}`;
      if (!(k in b)) { mal(cod, `falta U.${r}`); continue; }
      if (typeof a[k] !== typeof b[k] || Array.isArray(a[k]) !== Array.isArray(b[k])) mal(cod, `U.${r}: tipo distinto`);
      else if (typeof a[k] === 'function') {
        const args = a[k].length === 1 ? ['Prueba'] : [3, 7];
        try { const res = b[k](...args); if (!res || (Array.isArray(res) && !res.length)) mal(cod, `U.${r}() vacío`); } catch (e) { mal(cod, `U.${r}() falla: ${e.message}`); }
      } else if (Array.isArray(a[k])) { if (a[k].length !== b[k].length) mal(cod, `U.${r}: ${b[k].length} elementos en vez de ${a[k].length}`); }
      else if (typeof a[k] === 'object') compararU(a[k], b[k], r + '.');
    }
    for (const k of Object.keys(b)) if (!(k in a)) mal(cod, `U.${ruta}${k} sobra`);
  };
  compararU(es.U, L.U, '');
}
console.log(errores ? `\n${errores} problema(s)` : '\nTodos los idiomas están completos');
process.exitCode = errores ? 1 : 0;
