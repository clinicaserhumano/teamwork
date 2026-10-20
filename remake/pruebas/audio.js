// Comprueba que los ambientes y efectos se cargan y avanzan (sonido activado).
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
  await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  await win.webContents.executeJavaScript('localStorage.setItem("teamwork.sonido","true"); location.reload(); true');
  await new Promise((r) => setTimeout(r, 800));
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const [escena, args] of [['portada', []], ['presentacion', []], ['eleccion', []], ['evento', ['tormenta']], ['evento', ['isla']], ['velas', []]]) {
    await win.webContents.executeJavaScript(`TW.ir(${JSON.stringify(escena)}, ...${JSON.stringify(args)}); true`);
    await espera(2500);
    const r = await win.webContents.executeJavaScript(`(() => { const f = Sonido.fondo, c = Sonido.canal; return {
      ambiente: Sonido.fondoNombre, tiempo: f ? +f.currentTime.toFixed(1) : null, volumen: f ? +f.volume.toFixed(2) : null, errorAmb: f && f.error ? f.error.code : null,
      efecto: c ? decodeURI(c.src.split('/').pop()) : null, errorEf: c && c.error ? c.error.code : null,
      sintetizador: Sintetizador.ctx ? Sintetizador.ctx.state : 'sin usar' }; })()`);
    console.log(escena + (args[0] ? ':' + args[0] : ''), JSON.stringify(r));
  }
  await win.webContents.executeJavaScript('Sonido.ui("exito"); true');
  console.log('sintetizador tras sonido de éxito:', await win.webContents.executeJavaScript('Sintetizador.ctx.state'));
  app.quit();
});
