// Prueba visual: recorre las escenas y guarda capturas.
// Uso: npx electron pruebas/capturas.js <carpeta-salida> [ancho] [alto]
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const salida = process.argv[2] || path.join(__dirname, 'capturas');
const ancho = +(process.argv[3] || 1280), alto = +(process.argv[4] || 800);
fs.mkdirSync(salida, { recursive: true });

const PASOS = [
  ['portada', 'TW.ir("portada")'],
  ['presentacion', 'TW.ir("presentacion")', 5000],
  ['intro1', 'TW.ir("intro")'],
  ['intro2', 'TW.ir("intro", 2)'],
  ['prima', 'TW.ir("prima")'],
  ['prima_elegidos', 'TW.ir("prima"); document.querySelectorAll(".motivo")[0].click(); document.querySelectorAll(".motivo")[3].click(); document.querySelectorAll(".motivo")[6].click();'],
  ['eleccion', 'TW.fijar({scelta:0, barca:0, rotta:0, cambusa:0, elia:0, lScelta:[]}); TW.ir("eleccion")'],
  ['eleccion_parcial', 'TW.fijar({scelta:2, barca:2, rotta:2, cambusa:0, elia:0, lScelta:["Rotta","Barca"]}); TW.ir("eleccion")'],
  ['barcos', 'TW.ir("barcos")'],
  ['barco_especial', 'TW.ir("barco", 4)'],
  ['financiacion', 'TW.fijar({barca:2}); TW.ir("financiacion")'],
  ['rutas', 'TW.ir("rutas")'],
  ['ruta', 'TW.ir("ruta", 3)'],
  ['bodega', 'TW.fijar({respaldo:null, luf:{}, lufNivel:{}, carico:0}); TW.ir("bodega")'],
  ['bodega_nivel', 'TW.fijar({luf:{L:1}, lufNivel:{}, carico:0}); TW.ir("bodegaNivel","L")'],
  ['bodega_exceso', 'TW.fijar({carico:9, respaldo:{effi:0,idea:0,carico:0,errore:0}}); TW.ir("bodegaExceso")'],
  ['tripulacion', 'TW.ir("tripulacion")'],
  ['grupo', 'TW.ir("grupo")'],
  ['decisiones', 'TW.ir("decisiones")'],
  ['responsabilidades', 'TW.ir("responsabilidades")'],
  ['lider', 'TW.ir("lider")'],
  ['lider_como', 'TW.fijar({leader:"si"}); TW.ir("liderComo")'],
  ['reintentar', 'TW.fijar({barca:3, rotta:1}); TW.ir("reintentar")'],
  ['botadura', 'TW.fijar({nombre:""}); TW.ir("botadura")'],
  ['ev_confusion', 'TW.fijar({leader:"no"}); TW.ir("evento","confusion")'],
  ['ev_ingresos', 'TW.ir("evento","ingresos")'],
  ['ev_crisis', 'TW.ir("evento","crisis")'],
  ['ev_saturacion', 'TW.ir("evento","saturacion")'],
  ['ev_tormenta', 'TW.ir("evento","tormenta")'],
  ['ev_piratas', 'TW.ir("evento","piratas")'],
  ['ev_naufragos', 'TW.ir("evento","naufragos")'],
  ['ev_competencia', 'TW.ir("evento","competencia")'],
  ['ev_isla', 'TW.ir("evento","isla")'],
  ['velas', 'TW.fijar({effi:40, idea:35, crea:14, rotta:2, nombre:"Esperanza"}); TW.ir("velas")', 1800],
  ['despedida', 'TW.ir("despedida")'],
  ['situacion', 'TW.ir("eleccion"); TW.abrirSituacion()', 1500],
  ['salir', 'TW.cerrarModal(); TW.abrirSalir()'],
  ['creditos', 'TW.cerrarModal(); TW.ir("portada"); document.querySelector(".enlace").click()'],
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ancho, height: alto, show: true, useContentSize: true, backgroundColor: '#0b1a2b', webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  const errores = [];
  win.webContents.on('console-message', (e, nivel, msg, linea, fuente) => { if (nivel >= 2) errores.push(`${msg} (${path.basename(fuente || '')}:${linea})`); });
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  await win.webContents.executeJavaScript('localStorage.setItem("teamwork.idioma", JSON.stringify("es")); localStorage.setItem("teamwork.sonido","false"); location.reload(); true');
  await new Promise((r) => setTimeout(r, 800));
  for (const [nombre, js, espera = 900] of PASOS) {
    try { await win.webContents.executeJavaScript(`(()=>{ ${js}; return true; })()`); }
    catch (e) { errores.push(`${nombre}: ${e.message}`); }
    await new Promise((r) => setTimeout(r, espera));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(salida, `${nombre}.png`), img.toPNG());
  }
  fs.writeFileSync(path.join(salida, 'errores.txt'), errores.join('\n') || 'sin errores');
  console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'sin errores');
  app.quit();
});
