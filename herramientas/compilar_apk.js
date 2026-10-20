// Compila la APK de Android y la copia a remake/dist/TeamWork.apk.
// Uso (desde remake/): npm run apk
// Requisitos (ver remake/LEAME.md): Java 21 en C:\Android\jdk-21 y el SDK de Android en C:\Android\Sdk.
// Las herramientas de Android fallan con rutas que tienen caracteres como "ñ", así que se compila
// desde una unidad virtual temporal (subst) que apunta a la carpeta del proyecto.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const JDK = process.env.JAVA_HOME || 'C:\\Android\\jdk-21';
const SDK = process.env.ANDROID_HOME || 'C:\\Android\\Sdk';
const UNIDAD = 'T:';
const tipo = process.argv[2] === 'release' ? 'Release' : 'Debug';

for (const [nombre, ruta] of [['Java', path.join(JDK, 'bin', 'java.exe')], ['SDK de Android', SDK]]) {
  if (!fs.existsSync(ruta)) { console.error(`No encuentro ${nombre} en ${ruta}`); process.exit(1); }
}

const ascii = /^[\x00-\x7f]*$/.test(RAIZ);
let base = RAIZ, conSubst = false;
if (!ascii) {
  spawnSync('subst', [UNIDAD, '/d'], { stdio: 'ignore' });
  execFileSync('subst', [UNIDAD, RAIZ]);
  base = UNIDAD + '\\';
  conSubst = true;
}
const android = path.join(base, 'remake', 'android');
const env = {
  ...process.env,
  JAVA_HOME: JDK,
  ANDROID_HOME: SDK,
  PATH: path.join(JDK, 'bin') + ';' + process.env.PATH,
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || 'C:\\Android\\gradle',
  // usa los certificados de Windows (antivirus o redes que inspeccionan HTTPS)
  GRADLE_OPTS: '-Djavax.net.ssl.trustStoreType=Windows-ROOT',
};
try {
  const r = spawnSync(path.join(android, 'gradlew.bat'), [`assemble${tipo}`, '--console=plain'], { cwd: android, env, stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error(`Gradle terminó con código ${r.status}`);
  const carpeta = tipo.toLowerCase();
  const apk = fs.readdirSync(path.join(android, 'app', 'build', 'outputs', 'apk', carpeta)).find((f) => f.endsWith('.apk'));
  const destino = path.join(RAIZ, 'remake', 'dist', tipo === 'Release' ? 'TeamWork-release.apk' : 'TeamWork.apk');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(path.join(android, 'app', 'build', 'outputs', 'apk', carpeta, apk), destino);
  console.log(`APK lista: ${destino} (${(fs.statSync(destino).size / 1048576).toFixed(1)} MB)`);
} finally {
  if (conSubst) spawnSync('subst', [UNIDAD, '/d'], { stdio: 'ignore' });
}
