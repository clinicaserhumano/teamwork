// Datos que no dependen del idioma. Los textos del juego y de la interfaz están en app/idiomas/*.js
// (es, en, it, de, fr). Para cambiar la marca o añadir datos de contacto, edita el objeto MARCA.
'use strict';

const MARCA = {
  nombre: 'Clínica Ser Humano',
  producto: 'TeamWork',
  // Líneas que aparecen al final del juego ("algunas direcciones útiles…").
  // Ejemplo: ['Teléfono: 000 000 000', 'correo@clinicaserhumano.com', 'www.clinicaserhumano.com']
  contacto: [],
};

// Autor de la versión remasterizada (aparece en Créditos; el cargo está traducido en cada idioma)
const AUTOR = {
  nombre: 'Jorge Urgilés Ruiz',
  web: 'https://jorge-urgiles-ruiz.vercel.app',
};

// Cada archivo de app/idiomas/ añade aquí su idioma: IDIOMAS.es = { nombre, locale, T, U }
const IDIOMAS = {};
