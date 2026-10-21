// Prueba de lógica: juega partidas completas eligiendo opciones al azar.
// Uso: npx electron pruebas/partidas.js [numero-de-partidas]
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');

const PARTIDAS = +(process.argv[2] || 20);

// Se ejecuta dentro de la página: da un paso de juego (clic en algo disponible)
const PASO = `(() => {
  const azar = (l) => l[Math.floor(Math.random() * l.length)];
  const S = TW.estado();
  const modal = document.querySelector('#modal');
  if (!modal.hidden) { TW.cerrarModal(); return 'modal'; }
  const pres = document.querySelector('.presentacion'); if (pres) { pres.click(); return 'presentacion'; }
  const nombre = document.querySelector('#nombre-barco');
  if (nombre && !nombre.disabled) { nombre.value = 'Prueba'; nombre.dispatchEvent(new Event('input')); [...document.querySelectorAll('.boton')].find(b => !b.disabled).click(); return 'botadura'; }
  if (nombre) return 'esperando';
  const matriz = document.querySelector('.matriz');
  if (matriz) { matriz.querySelectorAll('tbody tr').forEach(tr => { const r = azar([...tr.querySelectorAll('input')]); r.checked = true; r.dispatchEvent(new Event('change')); }); document.querySelector('.boton').click(); return 'matriz'; }
  const motivos = [...document.querySelectorAll('.motivo:not([disabled])')];
  if (motivos.length && document.querySelectorAll('.motivo.elegido').length < 3) { azar(motivos).click(); return 'motivo'; }
  const cand = [...document.querySelectorAll('.opcion:not([disabled]), .tarjeta:not([disabled]):not(.elegida), .boton:not([disabled])')]
    .filter(b => !/Volver a elegir|Imprimir|Volver al inicio|Salir|Jugar otra vez/.test(b.textContent));
  if (S.escena === 'despedida') return 'FIN';
  if (!cand.length) return 'esperando';
  azar(cand).click();
  return S.escena;
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  const errores = [];
  win.webContents.on('console-message', (e, nivel, msg, linea, fuente) => { if (nivel >= 2) errores.push(`${msg} (${path.basename(fuente || '')}:${linea})`); });
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  await win.webContents.executeJavaScript(`localStorage.clear(); localStorage.setItem("teamwork.idioma", JSON.stringify("es")); localStorage.setItem("teamwork.sonido","${process.env.TW_SONIDO ? 'true' : 'false'}"); location.reload(); true`);
  await new Promise((r) => setTimeout(r, 600));
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const resumen = { completas: 0, eventos: {}, finales: [] };

  for (let p = 1; p <= PARTIDAS; p++) {
    await win.webContents.executeJavaScript('localStorage.removeItem("teamwork.partida.v2"); TW.ir("portada"); true');
    const recorrido = [];
    let fin = false;
    for (let i = 0; i < 200 && !fin; i++) {
      const r = await win.webContents.executeJavaScript(PASO);
      const S = await win.webContents.executeJavaScript('(() => { const s = TW.estado(); return { escena: s.escena, args: s.args }; })()');
      const id = S.escena + (S.args && S.args.length ? ':' + S.args.join(',') : '');
      if (recorrido[recorrido.length - 1] !== id) recorrido.push(id);
      if (r === 'FIN') fin = true;
      await espera(r === 'botadura' ? 1900 : 260);
    }
    const S = await win.webContents.executeJavaScript('TW.estado()');
    if (fin) resumen.completas++;
    for (const e of recorrido.filter((x) => x.startsWith('evento:'))) resumen.eventos[e] = (resumen.eventos[e] || 0) + 1;
    resumen.finales.push(`#${p} ${fin ? 'OK ' : 'NO TERMINÓ'} barco=${S.barca} ruta=${S.rotta} effi=${S.effi} idea=${S.idea} crea=${S.crea} carga=${S.carico} err=${S.errore} líder=${S.leader} pasos=${recorrido.length}`);
    if (!fin || p === 1) console.log(`Recorrido partida ${p}: ${recorrido.join(' > ')}`);
  }
  console.log(resumen.finales.join('\n'));
  console.log('Eventos visitados:', JSON.stringify(resumen.eventos));
  console.log(`Partidas completas: ${resumen.completas}/${PARTIDAS}`);
  console.log(errores.length ? 'ERRORES:\n' + [...new Set(errores)].join('\n') : 'Sin errores de JavaScript');
  app.quit();
});
