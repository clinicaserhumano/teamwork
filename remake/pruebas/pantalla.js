// Captura una escena concreta en varios tamaños. Uso: npx electron pruebas/pantalla.js <carpeta> "<js>" 780x360 915x412 ...
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const [salida, codigo, ...tamanos] = process.argv.slice(2);
app.whenReady().then(async () => {
  fs.mkdirSync(salida, { recursive: true });
  for (const t of tamanos) {
    const [w, h] = t.split('x').map(Number);
    const win = new BrowserWindow({ width: w, height: h, show: true, useContentSize: true, webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    await win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
    await win.webContents.executeJavaScript('localStorage.setItem("teamwork.sonido","false"); true');
    await win.webContents.executeJavaScript(`(()=>{ ${codigo}; return true; })()`);
    await new Promise((r) => setTimeout(r, 1200));
    const info = await win.webContents.executeJavaScript('(() => { const i = document.querySelector(".niveles .imagen, .tarjetas .imagen"); const r = i && i.getBoundingClientRect(); return { alto_imagen: r ? Math.round(r.height) : null, alto_contenido: document.querySelector("#escena").scrollHeight, alto_ventana: innerHeight }; })()');
    fs.writeFileSync(path.join(salida, `${t}.png`), (await win.webContents.capturePage()).toPNG());
    console.log(t, JSON.stringify(info));
    win.destroy();
  }
  app.quit();
});
