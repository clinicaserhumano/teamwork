// Comprueba el modo táctil: el primer toque muestra la descripción y el segundo elige.
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ width: 800, height: 360, show: true, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    const errores = [];
    win.webContents.on('console-message', (e, nivel, msg) => { if (nivel >= 2) errores.push(msg); });
    await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
    const dbg = win.webContents.debugger;
    dbg.attach('1.3');
    await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await dbg.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    await win.webContents.executeJavaScript('localStorage.setItem("teamwork.sonido","false"); location.reload(); true');
    await new Promise((r) => setTimeout(r, 1500));
    const js = (c) => win.webContents.executeJavaScript(c);
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    console.log('modo táctil activo:', await js('TACTIL'));
    await js('TW.fijar({respaldo:null, luf:{}, lufNivel:{}, carico:0}); TW.ir("bodega"); true');
    await js('document.querySelectorAll(".opcion")[0].click(); true');
    await espera(400);
    console.log('1.er toque -> escena:', await js('TW.estado().escena'), '| descripción visible:', await js('document.querySelector(".pizarra").textContent.length > 0'), '| opción marcada:', await js('!!document.querySelector(".opcion.previa")'));
    await js('document.querySelectorAll(".opcion")[0].click(); true');
    await espera(600);
    console.log('2.º toque -> escena:', await js('TW.estado().escena'));
    await js('TW.ir("evento","tormenta"); document.querySelectorAll(".opcion")[0].click(); true');
    await espera(600);
    console.log('opción sin descripción, 1 toque -> escena:', await js('TW.estado().escena + " " + TW.estado().args.join(",")'));
    console.log(errores.length ? 'ERRORES: ' + errores.join(' | ') : 'Sin errores de JavaScript');
  } catch (e) { console.log('FALLO:', e.message); }
  app.quit();
});
