// Proceso principal de Electron: abre la ventana del juego.
'use strict';
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

function crearVentana() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b1a2b',
    title: 'TeamWork · Clínica Ser Humano',
    icon: path.join(__dirname, 'app', 'assets', 'icono.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // F11: pantalla completa
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  // Los enlaces externos (p. ej. la web del autor en Créditos) se abren en el navegador del sistema
  const abrirFuera = (url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); };
  win.webContents.setWindowOpenHandler(({ url }) => { abrirFuera(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { e.preventDefault(); abrirFuera(url); });
}

app.whenReady().then(crearVentana);
app.on('window-all-closed', () => app.quit());
