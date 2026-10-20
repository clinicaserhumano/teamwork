# TeamWork · Clínica Ser Humano

Juego sobre trabajo en equipo, remasterizado a partir del original **TeamWork** (Macromedia Director 6, 1998).

Remasterización y desarrollo: **Jorge Urgilés Ruiz**, Ingeniero en Software — [jorge-urgiles-ruiz.vercel.app](https://jorge-urgiles-ruiz.vercel.app).

## Descargar

| Plataforma | Descarga |
|---|---|
| Android | [TeamWork.apk](https://github.com/clinicaserhumano/teamwork/releases/latest/download/TeamWork.apk) |
| Windows | [TeamWork-Windows.zip](https://github.com/clinicaserhumano/teamwork/releases/latest/download/TeamWork-Windows.zip) |

Todas las versiones: [Releases](https://github.com/clinicaserhumano/teamwork/releases).

## Contenido del repositorio

| Carpeta | Contenido |
|---|---|
| `remake/` | Juego nuevo (HTML5 + Electron). Ver [remake/LEAME.md](remake/LEAME.md) |
| `herramientas/` | Scripts de Node que extraen textos, imágenes y sonidos del juego original |
| `teamwork/` | Juego original (Director 6) |

## Jugar / compilar

```
cd remake
npm install
npm start              # jugar
npm run empaquetar     # genera remake/dist/TeamWork-win32-x64/TeamWork.exe
```

## Regenerar los recursos desde el juego original

```
node herramientas/extraer.js <archivo.DXR|.CXT> extraido/recursos/<NOMBRE>   # por cada archivo
node herramientas/preparar_imagenes.js
node herramientas/generar_textos.js
node herramientas/icono.js
```

Para descompilar los scripts Lingo se usó [ProjectorRays](https://github.com/ProjectorRays/ProjectorRays) 0.2.0.
