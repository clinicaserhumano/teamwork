// HISTÓRICO: extrajo los textos en español del elenco TESTIES.CXT y aplicó las correcciones.
// Ahora los textos viven en remake/app/idiomas/*.js (es, en, it, de, fr) y se editan a mano;
// este script solo genera una copia de referencia en extraido/textos_es_original.js.
'use strict';
const fs = require('fs');
const path = require('path');

const es = require('../extraido/recursos/TESTIES/miembros.json').miembros;
const T = {};
for (const m of es) if (m.texto && m.name && !['Testi', 'Esempio'].includes(m.name)) T[m.name] = m.texto.trim().replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ');

// Correcciones de erratas y palabras sin traducir de la versión original
const fix = {
  'Barche3-8': 'Sí',
  'Cambusa6-5': 'Continuar',
  'Quit-2': 'Sí, salir',
  'Quit-3': 'No, seguir jugando',
  'Sigla-1': 'presenta',
  'Barche1-2': 'Pequeño barco sin camarotes',
  'Barche1-5': 'Barco habitable con camarotes',
  'Barche1-6': 'Pequeño barco sin camarotes',
  'Ultima2-1': 'Pragmatismo de empresa',
  'Ultima2-2': 'Coherencia con algunos valores guía',
  'Ultima2-3': 'Creatividad ante las diversas situaciones',
  'Ultima2-4': 'A estas alturas del viaje, con este barco, esta tripulación y estas elecciones, las velas "ganadas" están repartidas así:',
};
Object.assign(T, fix);
const rep = [
  ['tempor1-1', 'Una tempestad improvisa nos impide de anclar', 'Una tempestad imprevista nos impide anclar'],
  ['tempor2-1', 'bastante incomoda', 'bastante incómoda'],
  ['tempor2-2', 'Tratamos de regresas', 'Tratamos de regresar'],
  ['Crisi2-2', 'Nos remetimos', 'Nos remitimos'],
  ['Confus2-4', 'individuar', 'identificar'],
  ['Pirati1-1', 'nos proponen de ayudarlos', 'nos proponen ayudarlos'],
  ['Conc32-2', 'Le ofrecemos de trabajar', 'Le ofrecemos trabajar'],
  ['Isola2-2', 'proponiendo de iniciar', 'proponiendo iniciar'],
  ['Isola1-1', 'muy hospitalarios', 'muy hospitalarias'],
  ['Naufra2-1', 'arriesgar de perder', 'arriesgarnos a perder'],
  ['Inso1-1', 'No obstante el trabajo no falte,', 'Aunque no falta el trabajo,'],
  ['Cambusa2-1', '\nPor lo tanto ser autónomos significa poder decidir y actuar sin tener que consultar y depender sólo de la autogestión...', ' Por lo tanto ser autónomos significa poder decidir y actuar sin tener que consultar y depender sólo de la autogestión...'],
  ['Cambusa2-3', '\n\nCon relación a la vida de todos los días significa que todos tienen siempre los mismos derechos sin tomar en cuenta el dinero o el trabajo ...', ' Con relación a la vida de todos los días significa que todos tienen siempre los mismos derechos sin tomar en cuenta el dinero o el trabajo...'],
  ['Cambusa4-3', 'barco\nmas no', 'barco, mas no'],
  ['Rotte4-2', 'Capacidades. También si no', 'capacidades. Aunque no'],
  ['Rotte5-2', 'nuestro Viaje', 'nuestro viaje'],
];
for (const [k, a, b] of rep) { if (!T[k] || !T[k].includes(a)) throw new Error(`No encontré "${a}" en ${k}`); T[k] = T[k].replace(a, b); }
// Saltos de línea a mitad de frase (venían del ancho fijo de la pantalla original)
for (const k of Object.keys(T)) T[k] = T[k].replace(/([^\n.:;!?…])\n(?=[a-záéíóúñ(])/g, '$1 ');

const barra = {
  prima: 'Escoge tres objetivos',
  continuar: 'Haz clic para continuar',
  salir: 'Salir',
  equilibrio: 'Equilibrio',
  carga: 'Carga',
  situacion: '¿En qué punto estamos?',
  recorrido: 'Recorrido',
  imprimir: 'Imprimir diario de a bordo',
};

const out = `// Textos del juego (español). Generado desde el elenco original TESTIES.CXT
// con herramientas/generar_textos.js y luego revisado.
// Para cambiar la marca o añadir datos de contacto, edita el objeto MARCA.
'use strict';

const MARCA = {
  nombre: 'Clínica Ser Humano',
  producto: 'TeamWork',
  lema: 'Un viaje a través del trabajo en equipo',
  // Líneas que aparecen al final del juego ("algunas direcciones útiles…").
  // Ejemplo: ['Teléfono: 000 000 000', 'correo@clinicaserhumano.com', 'www.clinicaserhumano.com']
  contacto: [],
};

// Autor de la versión remasterizada (aparece en Créditos)
const AUTOR = {
  nombre: 'Jorge Urgilés Ruiz',
  cargo: 'Ingeniero en Software',
  web: 'https://jorge-urgiles-ruiz.vercel.app',
};

const BARRA = ${JSON.stringify(barra, null, 2)};

const T = ${JSON.stringify(T, null, 2)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'extraido', 'textos_es_original.js'), out);
console.log('textos:', Object.keys(T).length);
