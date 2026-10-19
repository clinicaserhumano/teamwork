# TeamWork · Clínica Ser Humano (versión remasterizada)

Reconstrucción en HTML5 + Electron del juego **TeamWork** (Macromedia Director 6, 1998).
La lógica de puntuación y navegación se extrajo del juego original y se reprodujo tal cual.

## Jugar

- **Ejecutable listo:** `dist/TeamWork-win32-x64/TeamWork.exe` (o descomprimir `dist/TeamWork-Windows.zip`).
- **Desde el código:** `npm start`

La partida se guarda sola; al volver a abrir el juego aparece **Continuar el viaje guardado**.
Teclas: números `1`–`9` eligen opciones, `Intro` continúa, `Esc` sale, `F11` pantalla completa.

## Cambiar textos o marca

| Qué | Dónde |
|---|---|
| Nombre de la marca, lema, datos de contacto del final | objeto `MARCA` al principio de `app/textos.js` |
| Cualquier texto del juego | objeto `T` en `app/textos.js` (las claves son los nombres del juego original, p. ej. `Naufra1-1`) |
| Colores y tipografía | variables al principio de `app/estilos.css` (marca: naranja `#FC6B12`, dorado `#F8BC08`; fuente Outfit incluida en `app/assets/fuentes`) |
| Logos de Ser Humano | `app/assets/img/csh_*.png` (se generan desde `../docs/` con `../herramientas/preparar_imagenes.js`) |
| Puntuaciones, escenas, orden del viaje | `app/juego.js` |
| Fotografías | `app/assets/fotos` (Unsplash, ver [CREDITOS.md](CREDITOS.md)). Para cambiarlas: editar `../herramientas/fotos.json`, ejecutar `buscar_fotos.js` (necesita `herramientas/claves.json` con la clave de Unsplash) y elegir en `integrar_fotos.js` |
| Sonidos | `app/assets/snd` |
| Ícono del programa | `app/assets/icono.ico` |

> `app/textos.js` se generó con `../herramientas/generar_textos.js`. Si lo editas a mano, no vuelvas a ejecutar ese script o perderás los cambios.

## Volver a generar el .exe

```
npm run empaquetar
```

El resultado queda en `dist/TeamWork-win32-x64/`. Para distribuirlo hay que copiar **la carpeta completa**, no solo el `.exe`.

## Pruebas

- `npm run probar` — juega 20 partidas al azar y comprueba que todas terminan sin errores.
- `npm run capturas -- <carpeta>` — guarda una captura de cada pantalla.

(Si se ejecutan desde la terminal de VS Code, antes hay que quitar la variable `ELECTRON_RUN_AS_NODE`.)

## Cambios respecto al original

- Interfaz nueva (pantalla adaptable, alta resolución) con fotografías nuevas de Unsplash y los sonidos originales.
- Solo español; los textos en italiano y alemán siguen en `../extraido/recursos/TESTIITA` y `TESTIDE`.
- Corregidos dos errores del original: elegir *Felicidad* como primer objetivo no sumaba puntos, y la 3.ª opción de *La isla* aplicaba la puntuación de la 1.ª.
- Corregidas erratas de la traducción española (lista en `../herramientas/generar_textos.js`).
- La partida se guarda automáticamente en lugar de pedir un archivo.
