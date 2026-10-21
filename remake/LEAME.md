# TeamWork · Clínica Ser Humano (versión remasterizada)

Reconstrucción en HTML5 + Electron del juego **TeamWork** (Macromedia Director 6, 1998).
La lógica de puntuación y navegación se extrajo del juego original y se reprodujo tal cual.

## Jugar

- **Ejecutable listo:** `dist/TeamWork-win32-x64/TeamWork.exe` (o descomprimir `dist/TeamWork-Windows.zip`).
- **Desde el código:** `npm start`

La partida se guarda sola; al volver a abrir el juego aparece **Continuar el viaje guardado**.
Teclas: números `1`–`9` eligen opciones, `Intro` continúa, `Esc` sale, `F11` pantalla completa.

## Idiomas

El juego está en **español, inglés, italiano, alemán y francés**. La primera vez usa el idioma del dispositivo (o español si no es ninguno de esos); se cambia desde la portada o con el botón del globo de la barra superior, y la elección se recuerda.

Cada idioma es un archivo en `app/idiomas/` (`es.js`, `en.js`, `it.js`, `de.js`, `fr.js`) con dos partes:
- `T`: los textos del juego. Las claves son los nombres del juego original (p. ej. `Naufra1-1`).
- `U`: los textos de la interfaz (botones, etapas, títulos de los eventos…). Algunos son funciones porque cambian con el número o la gramática (p. ej. `duracion(min, seg)`).

Todas las traducciones parten de la versión española (la adaptada a trabajo en equipo); los textos italiano y alemán de 1998 trataban de cooperativismo y se conservan solo como referencia en `../extraido/recursos/TESTIITA` y `TESTIDE`.

**Para añadir otro idioma:** copiar `es.js` con otro código (p. ej. `pt.js`), traducirlo, añadir su `<script>` en `app/index.html` y su código a `ORDEN_IDIOMAS` en `app/juego.js`. `node pruebas/idiomas.js` comprueba que no falte ningún texto.

## Cambiar textos o marca

| Qué | Dónde |
|---|---|
| Nombre de la marca y datos de contacto del final | objeto `MARCA` en `app/textos.js` |
| Autor (nombre y web) | objeto `AUTOR` en `app/textos.js`; el cargo está traducido en `U.cargoAutor` de cada idioma |
| Cualquier texto del juego o de la interfaz | `app/idiomas/<idioma>.js` (ver *Idiomas*) |
| Colores y tipografía | variables al principio de `app/estilos.css` (marca: naranja `#FC6B12`, dorado `#F8BC08`; fuente Outfit incluida en `app/assets/fuentes`) |
| Logos de Ser Humano | `app/assets/img/csh_*.png` (se generan desde `../docs/` con `../herramientas/preparar_imagenes.js`) |
| Puntuaciones, escenas, orden del viaje | `app/juego.js` |
| Fotografías | `app/assets/fotos` (Unsplash, ver [CREDITOS.md](CREDITOS.md)). Para cambiarlas: editar `../herramientas/fotos.json`, ejecutar `buscar_fotos.js` (necesita `herramientas/claves.json` con la clave de Unsplash) y elegir en `integrar_fotos.js` |
| Sonidos de ambiente y efectos | `app/assets/snd` (Freesound, licencia CC0, ver [CREDITOS.md](CREDITOS.md)). Para cambiarlos: editar `../herramientas/sonidos.json`, ejecutar `buscar_sonidos.js` (necesita `"freesound"` en `herramientas/claves.json`), revisar con `analizar_sonidos.js` y elegir en `procesar_sonidos.js` |
| Qué sonido suena en cada escena | llamadas a `Sonido.ambiente(...)` / `Sonido.efecto(...)` en `app/juego.js` |
| Sonidos de interfaz (clic, elegir, acierto, error) | se generan por código: objeto `SONIDOS_UI` en `app/juego.js` |
| Ícono del programa | `app/assets/icono.ico` |


## Volver a generar el .exe

```
npm run empaquetar
```

El resultado queda en `dist/TeamWork-win32-x64/`. Para distribuirlo hay que copiar **la carpeta completa**, no solo el `.exe`.

## App de Android (APK)

La misma aplicación se empaqueta para Android con [Capacitor](https://capacitorjs.com) (proyecto en `android/`, configuración en `capacitor.config.json`). Funciona solo en horizontal y a pantalla completa; en pantallas táctiles las opciones con descripción se eligen con dos toques (el primero muestra la descripción).

```
npm run apk
```

Copia los cambios de `app/` al proyecto Android, compila y deja la APK en `dist/TeamWork.apk`.

Requisitos (ya instalados en este equipo, sin Android Studio):
- Java 21 en `C:\Android\jdk-21` ([Microsoft OpenJDK 21](https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip), descomprimido).
- SDK de Android en `C:\Android\Sdk`: [herramientas de línea de comandos](https://developer.android.com/studio#command-line-tools-only) en `cmdline-tools\latest`, y luego `sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"`.
- Si Java da errores de certificado (antivirus o red que inspecciona HTTPS), ya está configurado para usar los certificados de Windows.

**Instalar en un móvil:** copiar `TeamWork.apk` al teléfono y abrirlo; Android pedirá permitir "instalar apps de origen desconocido". Esta APK es de tipo *debug*: sirve para instalar directamente, pero para publicarla en Google Play hay que generar una versión firmada (`release`) con una clave propia de la clínica.

Ícono y pantalla de arranque: se generan desde `resources/` (creados con `../herramientas/iconos_android.js`) con `npx @capacitor/assets generate --android`.

## Pruebas

- `npm run probar` — juega 20 partidas al azar y comprueba que todas terminan sin errores.
- `npm run capturas -- <carpeta> [ancho] [alto]` — guarda una captura de cada pantalla (p. ej. `800 360` simula un móvil en horizontal).
- `npx electron pruebas/audio.js` — comprueba que cada escena reproduce su sonido.
- `npx electron pruebas/tactil.js` — comprueba el modo táctil (dos toques).
- `node pruebas/idiomas.js` — comprueba que los cinco idiomas tienen todos los textos.
- `npx electron pruebas/idiomas_pantallas.js` — recorre las pantallas en cada idioma buscando errores o restos en español.

(Si se ejecutan desde la terminal de VS Code, antes hay que quitar la variable `ELECTRON_RUN_AS_NODE`.)

## Cambios respecto al original

- Interfaz nueva (pantalla adaptable, alta resolución) con fotografías nuevas de Unsplash.
- Sonidos nuevos: ambientes en bucle por escena y efectos de Freesound (CC0), más sonidos de interfaz sintetizados. Ya no se usa ningún sonido de 1998.
- La botadura muestra un barco zarpando en lugar de una botella de champán.
- Cinco idiomas (español, inglés, italiano, alemán y francés), con selector en la portada y en la barra superior.
- Corregidos dos errores del original: elegir *Felicidad* como primer objetivo no sumaba puntos, y la 3.ª opción de *La isla* aplicaba la puntuación de la 1.ª.
- Corregidas erratas de la traducción española (lista en `../herramientas/generar_textos.js`).
- La partida se guarda automáticamente en lugar de pedir un archivo.
