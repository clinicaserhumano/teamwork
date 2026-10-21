// Recorre las pantallas en los cinco idiomas: errores de JavaScript, textos vacíos o restos en español.
// Uso: npx electron pruebas/idiomas_pantallas.js [carpeta-capturas]
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const salida = process.argv[2];
const ESCENAS = [
  ['portada', 'TW.ir("portada")'],
  ['prima', 'TW.ir("prima")'],
  ['eleccion', 'TW.fijar({scelta:1, barca:2, lScelta:["Barca"]}); TW.ir("eleccion")'],
  ['bodega', 'TW.fijar({respaldo:null, luf:{}, lufNivel:{}, carico:0}); TW.ir("bodega")'],
  ['bodegaNivel', 'TW.fijar({luf:{U:1}, lufNivel:{}}); TW.ir("bodegaNivel","U")'],
  ['responsabilidades', 'TW.ir("responsabilidades")'],
  ['evento', 'TW.ir("evento","tormenta")'],
  ['velas', 'TW.fijar({effi:40, idea:35, crea:14, rotta:2, nombre:"Esperanza"}); TW.ir("velas")'],
  ['situacion', 'TW.abrirSituacion()'],
];
// Palabras españolas que no deberían aparecer en otros idiomas
const RESTOS_ES = /\b(barco|ruta|equipo|tripulación|elegir|viaje|bodega|carga del|decidimos|navegado|velas ganadas|Continuar el)\b/i;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: true, useContentSize: true, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  const errores = [];
  win.webContents.on('console-message', (e, nivel, msg) => { if (nivel >= 2) errores.push(msg); });
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  const js = (c) => win.webContents.executeJavaScript(c);
  await js('localStorage.setItem("teamwork.sonido","false"); true');
  let problemas = 0;
  for (const cod of ['es', 'en', 'it', 'de', 'fr']) {
    await js(`localStorage.setItem("teamwork.idioma", JSON.stringify("${cod}")); location.reload(); true`);
    await new Promise((r) => setTimeout(r, 900));
    const lang = await js('document.documentElement.lang');
    const avisos = [];
    for (const [nombre, codigo] of ESCENAS) {
      try { await js(`(()=>{ TW.cerrarModal(); ${codigo}; return true; })()`); } catch (e) { avisos.push(`${nombre}: ${e.message}`); continue; }
      await new Promise((r) => setTimeout(r, 450));
      const texto = await js('document.body.innerText');
      if (/\bundefined\b|\bNaN\b|\[object/.test(texto)) avisos.push(`${nombre}: aparece "undefined", "NaN" u "[object"`);
      if (cod !== 'es') { const m = texto.match(RESTOS_ES); if (m) avisos.push(`${nombre}: posible texto en español ("${m[0]}")`); }
      if (salida) { try { fs.mkdirSync(salida, { recursive: true }); fs.writeFileSync(path.join(salida, `${cod}_${nombre}.png`), (await win.webContents.capturePage()).toPNG()); } catch { /* captura no disponible */ } }
    }
    problemas += avisos.length;
    console.log(`${cod} (lang="${lang}"): ${avisos.length ? avisos.join(' | ') : 'correcto'}`);
  }
  console.log(errores.length ? 'ERRORES JS: ' + [...new Set(errores)].join(' | ') : 'Sin errores de JavaScript');
  console.log(problemas ? `${problemas} aviso(s)` : 'Todos los idiomas se muestran correctamente');
  app.quit();
});
