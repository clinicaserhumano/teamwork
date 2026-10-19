// TeamWork — motor del juego.
// Reproduce la lógica del original (Macromedia Director 6, 1998): elencos NAVIGAZI (puntuación
// y navegación) y scripts Lingo de cada película. Los nombres de las variables de puntuación se
// conservan del original: effi (eficiencia/pragmatismo), idea (ideales/coherencia),
// crea (creatividad), carico (carga del barco), errore (incoherencias).
'use strict';

// ============================================================ Utilidades
const $ = (s, el = document) => el.querySelector(s);

function h(tag, props, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
const svgNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...hijos) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of hijos.flat()) if (c != null) el.append(c);
  return el;
}
const imagen = (nombre, alt = '', clase) => h('img', { src: `assets/img/${nombre}.png`, alt, class: clase, draggable: 'false' });
const t = (k) => (k in T ? T[k] : k);
const linea = (txt) => txt.replace(/\s*\n\s*/g, ' ');
const capital = (txt) => txt.charAt(0).toUpperCase() + txt.slice(1);
const parrafos = (txt) => txt.split(/\n{2,}/).map((p) => h('p', null, p.split('\n').flatMap((l, i) => (i ? [h('br'), l] : [l]))));
const flecha = () => h('span', { class: 'flecha', 'aria-hidden': 'true' }, '→');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Colores corporativos de Ser Humano (deben coincidir con estilos.css)
const COLOR = { naranja: '#fc6b12', dorado: '#f8bc08', crema: '#f4e9d4', blanco: '#fffaf0', marino: '#10263d' };

function leerPref(k, def) { try { const v = localStorage.getItem('teamwork.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } }
function guardarPref(k, v) { try { localStorage.setItem('teamwork.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }

// Temporizadores de la escena actual (se cancelan al cambiar de escena)
const temporizadores = new Set();
function luego(fn, ms) { const id = setTimeout(() => { temporizadores.delete(id); fn(); }, ms); temporizadores.add(id); return id; }
function cada(fn, ms) { const id = setInterval(fn, ms); temporizadores.add(id); return id; }
function cancelarTemporizadores() { for (const id of temporizadores) { clearTimeout(id); clearInterval(id); } temporizadores.clear(); }

// ============================================================ Sonido
const Sonido = {
  activo: leerPref('sonido', true),
  canal: null,
  tocar(nombre, alTerminar) {
    this.detener();
    let hecho = false;
    const fin = () => { if (!hecho) { hecho = true; if (alTerminar) alTerminar(); } };
    if (!this.activo) { if (alTerminar) luego(fin, 400); return; }
    const a = new Audio(`assets/snd/${nombre}.mp3`);
    a.volume = 0.7;
    this.canal = a;
    if (alTerminar) { a.addEventListener('ended', fin); a.addEventListener('error', fin); luego(fin, 4000); }
    a.play().catch(fin);
  },
  click() {
    if (!this.activo) return;
    const a = new Audio('assets/snd/click.mp3');
    a.volume = 0.5;
    a.play().catch(() => {});
  },
  detener() { if (this.canal) { this.canal.pause(); this.canal = null; } },
  alternar() {
    this.activo = !this.activo;
    guardarPref('sonido', this.activo);
    if (!this.activo) this.detener();
    pintarBotonSonido();
  },
};
function pintarBotonSonido() {
  const b = $('#btn-sonido');
  b.classList.toggle('apagado', !Sonido.activo);
  b.title = Sonido.activo ? 'Silenciar' : 'Activar sonido';
  b.setAttribute('aria-label', b.title);
}

// ============================================================ Estado de la partida
const CLAVE = 'teamwork.partida.v2';
const nuevoEstado = () => ({
  effi: 0, idea: 0, crea: 0, carico: 0, errore: 0,
  scelta: 0, barca: 0, rotta: 0, elia: 0, cambusa: 0,
  leader: '', random: 0,
  lScelta: [], respuestas: [], nombre: '', caracteristicas: '',
  luf: {}, lufNivel: {}, respaldo: null, somma: [0, 0, 0],
  visitasEleccion: 0, tiempo: 0, escena: 'intro', args: [],
});
let S = nuevoEstado();

function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(S)); } catch { /* sin almacenamiento */ } }
function cargarPartida() { try { const p = JSON.parse(localStorage.getItem(CLAVE)); return p && p.escena ? p : null; } catch { return null; } }
function borrarPartida() { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } }
function sumar(o) { for (const k in o) S[k] += o[k]; }
function anotar(tema, eleccion) {
  S.respuestas = S.respuestas.filter((r) => r.tema !== tema);
  S.respuestas.push({ tema, eleccion });
}

// ============================================================ Navegación entre escenas
const ESCENAS = {};
const SIN_BARRA = new Set(['portada', 'presentacion']);
const ETAPAS = ['Motivación', 'Preparación', 'Botadura', 'Travesía', 'Llegada'];
const ETAPA_DE = {
  intro: 0, prima: 0,
  eleccion: 1, barcos: 1, barco: 1, financiacion: 1, rutas: 1, ruta: 1, bodega: 1, bodegaNivel: 1, bodegaExceso: 1,
  tripulacion: 1, grupo: 1, decisiones: 1, responsabilidades: 1, lider: 1, liderComo: 1,
  reintentar: 2, botadura: 2, evento: 3, velas: 4, despedida: 4,
};
let teclas = null;

function ir(id, ...args) {
  cancelarTemporizadores();
  teclas = null;
  S.escena = id;
  S.args = args;
  if (!SIN_BARRA.has(id)) guardar();
  const main = $('#escena');
  main.replaceChildren();
  main.scrollTop = 0;
  actualizarBarra(id);
  ESCENAS[id](...args);
  if (S.escena !== id) return; // la escena redirigió a otra
  const primero = main.firstElementChild;
  if (primero) primero.classList.add('entrar');
  main.focus({ preventScroll: true });
}
const montar = (el) => $('#escena').append(el);

function actualizarBarra(id) {
  const barra = $('#barra');
  barra.hidden = SIN_BARRA.has(id);
  const actual = ETAPA_DE[id] ?? 0;
  const ol = $('#etapas');
  ol.replaceChildren(...ETAPAS.map((n, i) => h('li', { class: i < actual ? 'hecha' : i === actual ? 'actual' : null, 'aria-current': i === actual ? 'step' : null }, h('span', null, n))));
}

// ============================================================ Piezas de interfaz
function ventana(nombre, { clara = false, cubrir = false, pie = null } = {}) {
  const im = imagen(nombre, '', cubrir ? 'cubrir' : null);
  const v = h('div', { class: 'ventana' + (clara ? ' clara' : '') }, im, pie && h('div', { class: 'pie-imagen' }, pie));
  v.cambiar = (n) => { if (n) im.src = `assets/img/${n}.png`; };
  v.restaurar = () => { im.src = `assets/img/${nombre}.png`; };
  v.img = im;
  return v;
}
const lienzo = (izq, der) => h('div', { class: 'lienzo' }, izq, der);
const lienzoSolo = (...hijos) => h('div', { class: 'lienzo solo' }, h('div', { class: 'panel' }, hijos));
const cabecera = (etiqueta, pregunta) => [h('p', { class: 'etiqueta' }, etiqueta), h('h1', { class: 'pregunta' }, pregunta)];

// Lista de opciones numeradas. Cada opción: { texto, detalle?, imagen?, elegir }
function listaOpciones(items, { pizarra, vent, columnas = false } = {}) {
  let bloqueado = false;
  const mapa = {};
  const ol = h('ol', { class: 'opciones' + (columnas ? ' dos-columnas' : '') });
  items.forEach((it, i) => {
    const b = h('button', { class: 'opcion', type: 'button' }, h('span', { class: 'num' }, i + 1), h('span', { class: 'txt' }, it.texto));
    const mostrar = () => { if (pizarra && it.detalle) pizarra.textContent = it.detalle; if (vent && it.imagen) vent.cambiar(it.imagen); };
    const ocultar = () => { if (pizarra) pizarra.textContent = ''; if (vent && it.imagen) vent.restaurar(); };
    b.addEventListener('mouseenter', mostrar); b.addEventListener('focus', mostrar);
    b.addEventListener('mouseleave', ocultar); b.addEventListener('blur', ocultar);
    const elegir = () => {
      if (bloqueado) return;
      bloqueado = true;
      Sonido.click();
      mostrar();
      b.classList.add('activa');
      ol.querySelectorAll('.opcion').forEach((o) => { if (o !== b) o.disabled = true; });
      luego(it.elegir, 220);
    };
    b.addEventListener('click', elegir);
    mapa[String(i + 1)] = elegir;
    ol.append(h('li', null, b));
  });
  teclas = mapa;
  return ol;
}

// Tarjetas grandes con imagen. Cada una: { nombre, detalle?, imagen, hecha?, sello?, elegir }
function rejillaTarjetas(items, { pizarra, clase = 'tarjetas' } = {}) {
  let bloqueado = false;
  const mapa = {};
  const rej = h('div', { class: clase });
  items.forEach((it, i) => {
    const b = h('button', { class: 'tarjeta' + (it.hecha ? ' hecha' : ''), type: 'button', disabled: it.hecha || null },
      !it.hecha && h('span', { class: 'tecla', 'aria-hidden': 'true' }, i + 1),
      it.sello && h('span', { class: 'sello' }, it.sello),
      h('div', { class: 'imagen' }, imagen(it.imagen)),
      h('div', { class: 'nombre' }, it.nombre),
      it.pie && h('div', { class: 'detalle' }, it.pie));
    if (pizarra && it.detalle) {
      const mostrar = () => { pizarra.textContent = it.detalle; };
      b.addEventListener('mouseenter', mostrar); b.addEventListener('focus', mostrar);
      b.addEventListener('mouseleave', () => { pizarra.textContent = ''; });
    }
    if (!it.hecha) {
      const elegir = () => {
        if (bloqueado) return;
        bloqueado = true;
        Sonido.click();
        b.classList.add('elegida');
        luego(it.elegir, 220);
      };
      b.addEventListener('click', elegir);
      mapa[String(i + 1)] = elegir;
    }
    rej.append(b);
  });
  teclas = mapa;
  return rej;
}

const pizarra = (vacia = 'Pasa el ratón por encima de una opción para leer más.') => h('div', { class: 'pizarra', 'data-vacia': vacia, 'aria-live': 'polite' });

// Escena estándar: imagen a la izquierda, pregunta y opciones a la derecha
function decision({ etiqueta, pregunta, contexto, nota, img, vent: opcVent, opciones, columnas, conPizarra, extra }) {
  const v = ventana(img, opcVent);
  const piz = conPizarra ? pizarra() : null;
  montar(lienzo(v, h('div', { class: 'panel' },
    cabecera(etiqueta, pregunta),
    contexto && h('div', { class: 'contexto' }, parrafos(contexto)),
    nota && h('p', { class: 'nota' }, nota),
    listaOpciones(opciones, { pizarra: piz, vent: v, columnas }),
    piz, extra)));
}

// Escena de relato: texto y botón para continuar
function relato({ etiqueta, titulo, texto, nota, img, vent: opcVent, botones }) {
  const bs = botones.map((b, i) => h('button', { class: 'boton' + (i ? ' secundario' : ''), type: 'button', onclick: () => { Sonido.click(); b.accion(); } }, b.texto, i === 0 && flecha()));
  teclas = { Enter: botones[0].accion };
  montar(lienzo(ventana(img, opcVent), h('div', { class: 'panel' },
    cabecera(etiqueta, titulo),
    texto && h('div', { class: 'contexto' }, parrafos(texto)),
    nota && h('p', { class: 'nota' }, nota),
    h('div', { class: 'botonera' }, bs))));
}

function aviso(txt) {
  const a = $('#aviso');
  a.textContent = txt;
  a.classList.add('visible');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => a.classList.remove('visible'), 3200);
}

// ============================================================ Portada y presentación
ESCENAS.portada = () => {
  const guardada = cargarPartida();
  const nuevo = () => { Sonido.click(); S = nuevoEstado(); borrarPartida(); ir('presentacion'); };
  const seguir = () => { Sonido.click(); S = Object.assign(nuevoEstado(), guardada); ir(S.escena, ...(S.args || [])); };
  const puedeSeguir = guardada && guardada.escena !== 'despedida';
  montar(h('div', { class: 'portada' },
    imagen('csh_logo_blanco', MARCA.nombre, 'logo'),
    h('p', { class: 'presenta' }, t('Sigla-1')),
    h('h1', null, MARCA.producto),
    h('p', { class: 'lema' }, MARCA.lema),
    h('div', { class: 'botonera' },
      h('button', { class: 'boton', type: 'button', onclick: nuevo }, 'Nuevo viaje', flecha()),
      puedeSeguir && h('button', { class: 'boton secundario', type: 'button', onclick: seguir }, 'Continuar el viaje guardado'),
      h('button', { class: 'boton secundario', type: 'button', onclick: salirApp }, 'Salir')),
    h('p', { class: 'creditos' }, 'Versión remasterizada del juego TeamWork (1998)')));
  teclas = { Enter: puedeSeguir ? seguir : nuevo };
};

ESCENAS.presentacion = () => {
  Sonido.tocar('aeolus');
  const seguir = () => { Sonido.detener(); ir('intro'); };
  montar(h('div', { class: 'presentacion', onclick: seguir },
    h('div', { class: 'p1' }, imagen('csh_logo_blanco', MARCA.nombre)),
    h('div', { class: 'p2' }, t('Sigla-1')),
    h('div', { class: 'p3' }, MARCA.producto),
    h('div', { class: 'p4' }, MARCA.lema),
    h('div', { class: 'saltar' }, 'Haz clic o pulsa Intro para continuar')));
  luego(seguir, 9000);
  teclas = { Enter: seguir, ' ': seguir };
};

ESCENAS.intro = (paso = 1) => {
  if (paso === 1) {
    Sonido.tocar('pan21');
    relato({ etiqueta: 'Antes de zarpar', titulo: linea(t('Intro1-1')), img: 'barco_grande', vent: { cubrir: true },
      botones: [{ texto: 'Continuar', accion: () => ir('intro', 2) }] });
  } else {
    const [txt, condicion] = t('Intro1-2').split(/\n\n/);
    relato({ etiqueta: 'Antes de zarpar', titulo: linea(txt), texto: condicion, img: 'eleccion_ruta',
      botones: [{ texto: 'Empezar el viaje', accion: () => ir('prima') }] });
  }
};

// ============================================================ Prima: ¿qué buscamos en el viaje?
const MOTIVOS = [
  { clave: 'Fortuna', texto: 'Prima-2', anim: 'prima_fortuna', cuadros: 6 },
  { clave: 'Novità', texto: 'Prima-3', anim: 'prima_novedad', cuadros: 3 },
  { clave: 'Avventura', texto: 'Prima-4', anim: 'prima_aventura', cuadros: 2 },
  { clave: 'Giustizia', texto: 'Prima-5', anim: 'prima_justicia', cuadros: 5 },
  { clave: 'Un Ideale', texto: 'Prima-6', anim: 'prima_ideal', cuadros: 4 },
  { clave: 'Felicità', texto: 'Prima-7', anim: 'prima_felicidad', cuadros: 5 },
  { clave: 'Cambiare vita', texto: 'Prima-8', anim: 'prima_cambiar', cuadros: 12 },
];
// PrimaCal 8: puntos según la 1.ª y la 2.ª elección (la 3.ª no puntúa).
// Nota: en el original "Felicidad" como 1.ª elección no sumaba por una errata ("Felicità'"); aquí sí suma.
const PUNTOS_PRIMA = {
  'Avventura': [{ effi: 4, idea: 4 }, { effi: 2, idea: 2 }],
  'Giustizia': [{ idea: 3 }, { idea: 6 }],
  'Felicità': [{ idea: 1 }, { idea: 2 }],
  'Un Ideale': [{ idea: 4 }, { idea: 2 }],
  'Novità': [{ crea: 2, effi: 2 }, { crea: 1, effi: 1 }],
  'Fortuna': [{ effi: 6 }, { effi: 3 }],
  'Cambiare vita': [{ crea: 4 }, { crea: 2 }],
};

ESCENAS.prima = () => {
  Sonido.tocar('soldier');
  const elegidos = [];
  const huecos = [0, 1, 2].map((i) => h('div', { class: 'hueco' }, h('b', null, i + 1 + 'º'), h('span', null, 'Sin elegir')));
  const continuar = h('button', { class: 'boton', type: 'button', disabled: true, onclick: () => {
    Sonido.click();
    elegidos.slice(0, 2).forEach((m, i) => sumar(PUNTOS_PRIMA[m.clave][i]));
    anotar('Un viaje en busca de', elegidos.map((m) => t(m.texto)).join(', '));
    ir('eleccion');
  } }, 'Continuar', flecha());
  const reiniciar = h('button', { class: 'boton secundario', type: 'button', disabled: true, onclick: () => { Sonido.click(); ir('prima'); } }, 'Volver a elegir');

  const tarjetas = MOTIVOS.map((m, i) => {
    const im = imagen(`${m.anim}_1`);
    let anim = null, cuadro = 1, paso = 1;
    const animar = () => {
      if (anim) return;
      anim = cada(() => {
        if (cuadro + paso > m.cuadros || cuadro + paso < 1) paso = -paso;
        cuadro += paso;
        im.src = `assets/img/${m.anim}_${cuadro}.png`;
      }, 110);
    };
    const parar = () => { if (anim) { clearInterval(anim); temporizadores.delete(anim); anim = null; } };
    const b = h('button', { class: 'motivo', type: 'button' }, h('div', { class: 'anim' }, im), h('div', { class: 'nombre' }, capital(t(m.texto))));
    b.addEventListener('mouseenter', animar); b.addEventListener('focus', animar);
    b.addEventListener('mouseleave', parar); b.addEventListener('blur', parar);
    const elegir = () => {
      if (b.disabled || elegidos.length >= 3) return;
      Sonido.click();
      elegidos.push(m);
      b.disabled = true;
      b.classList.add('elegido');
      const hu = huecos[elegidos.length - 1];
      hu.classList.add('lleno');
      hu.replaceChildren(h('b', null, elegidos.length + 'º'), imagen(`${m.anim}_1`), h('span', null, capital(t(m.texto))));
      reiniciar.disabled = false;
      if (elegidos.length === 3) {
        tarjetas.forEach((x) => { x.disabled = true; });
        continuar.disabled = false;
        continuar.focus();
      }
    };
    b.addEventListener('click', elegir);
    return b;
  });
  teclas = Object.fromEntries(tarjetas.map((b, i) => [String(i + 1), () => b.click()]));
  teclas.Enter = () => { if (!continuar.disabled) continuar.click(); };
  montar(lienzoSolo(
    cabecera('Motivación', t('Prima-1')),
    h('p', { class: 'nota' }, BARRA.prima + ', en orden de importancia.'),
    h('div', { class: 'motivos' }, tarjetas),
    h('div', { class: 'huecos' }, huecos),
    h('div', { class: 'botonera' }, continuar, reiniciar)));
};

// ============================================================ Elección principal (Scelta)
const PARTES = [
  { id: 'Barca', texto: 'Scelta1-2', img: 'eleccion_barco', hecha: () => S.barca > 0, escena: 'barcos' },
  { id: 'Rotta', texto: 'Scelta1-3', img: 'eleccion_ruta', hecha: () => S.rotta > 0, escena: 'rutas' },
  { id: 'Cambusa', texto: 'Scelta1-4', img: 'eleccion_provisiones', hecha: () => S.cambusa > 0, escena: 'bodega' },
  { id: 'Equipaggio', texto: 'Scelta1-5', img: 'eleccion_tripulacion', hecha: () => S.elia > 0, escena: 'tripulacion' },
];
const barcoCompatible = () => S.rotta === S.barca || S.barca === 4 || S.rotta === 4;

ESCENAS.eleccion = () => {
  if (S.scelta >= 4) return ir(barcoCompatible() ? 'botadura' : 'reintentar');
  Sonido.tocar(S.visitasEleccion++ ? 'pan8' : 'pan21');
  const items = PARTES.map((p) => {
    const orden = S.lScelta.indexOf(p.id);
    return {
      nombre: t(p.texto), imagen: p.img, hecha: p.hecha(), sello: p.hecha() ? `✓ ${orden + 1}º` : null,
      elegir: () => { S.lScelta.push(p.id); ir(p.escena); },
    };
  });
  montar(lienzoSolo(
    cabecera('Preparación', t('Scelta1-1')),
    h('p', { class: 'nota' }, 'Prepara el viaje empezando por lo que el equipo considera más importante: el orden en que completes cada parte también cuenta.'),
    rejillaTarjetas(items)));
};

// ============================================================ El barco
const BARCOS = [null,
  { titulo: 'Barche1-2', desc: 'barche2-1', img: 'barco_1' },
  { titulo: 'Barche1-5', desc: 'barche2-3', img: 'barco_2' },
  { titulo: 'Barche1-4', desc: 'barche2-4', img: 'barco_3' },
  { titulo: 'Barche1-3', desc: 'barche2-6', img: 'barco_4' },
];

ESCENAS.barcos = () => {
  Sonido.tocar('craga45');
  const piz = pizarra();
  montar(lienzoSolo(
    cabecera('Preparación · El barco', t('Barche1-1')),
    rejillaTarjetas([1, 2, 3, 4].map((n) => ({
      nombre: t(BARCOS[n].titulo), imagen: BARCOS[n].img, detalle: t(BARCOS[n].desc),
      elegir: () => ir('barco', n),
    })), { pizarra: piz }),
    piz));
};

ESCENAS.barco = (n) => {
  const b = BARCOS[n];
  const area = n === 4 ? h('textarea', { id: 'caracteristicas', maxlength: '300', placeholder: 'Por ejemplo: rápido, con espacio para todos, fácil de reparar…' }) : null;
  if (area) area.value = S.caracteristicas;
  const elegir = () => {
    S.barca = n;
    S.scelta += 1;
    if (n === 4) {
      S.caracteristicas = area.value.trim();
      if (S.caracteristicas) S.crea += 3; // BarcheCal 6
    }
    anotar('Barco', linea(t(b.titulo)) + (n === 4 && S.caracteristicas ? ` (${S.caracteristicas})` : ''));
    ir('financiacion');
  };
  teclas = { Enter: () => { if (document.activeElement !== area) { Sonido.click(); elegir(); } } };
  montar(lienzo(ventana(b.img), h('div', { class: 'panel' },
    cabecera('Preparación · El barco', linea(t(b.titulo))),
    h('div', { class: 'contexto' }, parrafos(n === 4 ? 'Un barco a la medida de vuestro equipo.' : t(b.desc))),
    area && h('div', { class: 'campo' }, h('label', { for: 'caracteristicas' }, t(b.desc)), area),
    h('div', { class: 'botonera' },
      h('button', { class: 'boton', type: 'button', onclick: () => { Sonido.click(); elegir(); } }, t('Barche1-7'), flecha()),
      h('button', { class: 'boton secundario', type: 'button', onclick: () => { Sonido.click(); ir('barcos'); } }, `${t('barche2-2')} opción`)))));
};

ESCENAS.financiacion = () => {
  const auto = t('Barche3-2').replace(/:\s*$/, '');
  const op = (texto, ef) => ({ texto, elegir: () => { sumar(ef); anotar('Financiación del barco', texto); ir('eleccion'); } });
  decision({
    etiqueta: 'Preparación · El barco', pregunta: t('Barche3-1'), img: BARCOS[S.barca].img,
    opciones: [
      op(`${auto} ${t('Barche3-3')}`, { idea: 3 }),
      op(`${auto} ${t('Barche3-4')}`, { idea: 2 }),
      op(`${auto} ${t('Barche3-5')}`, { idea: 1, effi: 1 }),
      op(`${auto} ${t('Barche3-6')}`, { effi: 2 }),
      op(t('Barche3-7'), { effi: 3 }),
    ],
  });
};

// ============================================================ La ruta
const RUTAS = [null,
  { titulo: 'Rotte2-1', desc: 'Rotte2-2', img: 'ruta_1', snd: 'sciacqu' },
  { titulo: 'Rotte4-1', desc: 'Rotte4-2', img: 'ruta_2', snd: 'vento' },
  { titulo: 'rotte3-1', desc: 'rotte3-2', img: 'ruta_3', snd: 'tempesta' },
  { titulo: 'Rotte5-1', desc: 'Rotte5-2', img: 'ruta_4', snd: 'mockbird' },
];

ESCENAS.rutas = () => {
  Sonido.tocar('vento');
  const piz = pizarra();
  montar(lienzoSolo(
    cabecera('Preparación · La ruta', t('Rotte1-1')),
    rejillaTarjetas([1, 2, 3, 4].map((n) => ({
      nombre: t(RUTAS[n].titulo), imagen: RUTAS[n].img, detalle: t(RUTAS[n].desc),
      elegir: () => ir('ruta', n),
    })), { pizarra: piz }),
    piz));
};

ESCENAS.ruta = (n) => {
  const r = RUTAS[n];
  Sonido.tocar(r.snd);
  relato({
    etiqueta: 'Preparación · La ruta', titulo: t(r.titulo), texto: t(r.desc), img: r.img,
    botones: [
      { texto: 'Elijo esta ruta', accion: () => {
        S.scelta += 1; // RotteCal
        S.rotta = n;
        if (n === 4) sumar({ crea: 2, idea: 2 });
        anotar('Ruta', t(r.titulo));
        ir('eleccion');
      } },
      { texto: `${t('barche2-2')} ruta`, accion: () => ir('rutas') },
    ],
  });
};

// ============================================================ La bodega (Cambusa): Autonomía, Igualdad, Solidaridad
const VALORES = {
  L: { nombre: 'Cambusa1-3', desc: 'Cambusa2-1', niveles: ['Cambusa4-1', 'Cambusa4-2', 'Cambusa4-3'], cal: [{ effi: 3 }, { idea: 2 }, { idea: 3 }], final: [{ effi: 3 }, { effi: 2 }, { effi: 1 }] },
  U: { nombre: 'Cambusa1-4', desc: 'Cambusa2-3', niveles: ['Cambusa5-3', 'Cambusa5-2', 'Cambusa5-1'], cal: [{}, { idea: 2 }, { idea: 3, errore: 1 }], final: [{ idea: 3 }, { idea: 2 }, { idea: 1 }] },
  F: { nombre: 'Cambusa1-5', desc: 'Cambusa2-6', niveles: ['Cambusa3-1', 'Cambusa3-2', 'Cambusa3-3'], cal: [{ effi: 3, errore: 1 }, { idea: 2 }, { idea: 3 }], final: [{ idea: 6 }, { idea: 4 }, { idea: 2 }] },
};
const NIVELES = [
  { nombre: 'Poca', img: 'bodega_poca', carga: 1, snd: 'do' },
  { nombre: 'Bastante', img: 'bodega_media', carga: 2, snd: 'mi' },
  { nombre: 'Mucha', img: 'bodega_mucha', carga: 3, snd: 'sol' },
];
const LIMITE_CARGA = 7;

function medidorCarga() {
  const pct = clamp(S.carico / 10 * 100, 0, 100);
  const cargados = Object.keys(S.lufNivel).map((k) => h('span', { class: 'chip' }, `${t(VALORES[k].nombre)}: ${NIVELES[S.lufNivel[k]].nombre.toLowerCase()}`));
  return h('div', { class: 'medidor' },
    h('div', { class: 'fila' }, h('span', null, 'Carga del barco'), h('span', null, `${S.carico} / ${LIMITE_CARGA}`)),
    h('div', { class: 'barra-carga', role: 'img', 'aria-label': `Carga ${S.carico} de ${LIMITE_CARGA}` }, h('span', { style: `width:${pct}%` })),
    cargados.length > 0 && h('div', { class: 'valores-cargados' }, cargados));
}

ESCENAS.bodega = () => {
  if (!S.respaldo) { S.respaldo = { effi: S.effi, idea: S.idea, carico: S.carico, errore: S.errore }; S.luf = {}; S.lufNivel = {}; }
  const rango = Object.keys(S.luf).length;
  const sinNivel = Object.keys(S.luf).find((k) => S.lufNivel[k] == null);
  if (sinNivel) return ir('bodegaNivel', sinNivel);
  if (rango === 2) { // el tercer valor queda en último lugar automáticamente
    const resto = ['L', 'U', 'F'].find((k) => !S.luf[k]);
    S.luf[resto] = 3;
    return ir('bodegaNivel', resto);
  }
  if (rango === 3) {
    if (S.carico > LIMITE_CARGA) return ir('bodegaExceso');
    completarBodega();
    return ir('eleccion');
  }
  if (rango === 0) Sonido.tocar('quick');
  const quedan = ['L', 'U', 'F'].filter((k) => !S.luf[k]);
  decision({
    etiqueta: 'Preparación · La bodega',
    pregunta: `${t('Cambusa1-1')} ${t('Cambusa1-2')}`,
    nota: rango === 0 ? 'Elige primero el valor que más importa al equipo.' : 'Ahora, el siguiente en importancia.',
    img: 'bodega_mucha', vent: { clara: true }, conPizarra: true,
    opciones: quedan.map((k) => ({
      texto: t(VALORES[k].nombre), detalle: t(VALORES[k].desc),
      elegir: () => { S.luf[k] = rango + 1; ir('bodegaNivel', k); },
    })),
    extra: medidorCarga(),
  });
};

ESCENAS.bodegaNivel = (k) => {
  const v = VALORES[k];
  const piz = pizarra('Pasa el ratón por encima de cada caja para ver qué significa.');
  montar(lienzoSolo(
    cabecera('Preparación · La bodega', `¿Cuánta ${t(v.nombre).toLowerCase()} cargamos?`),
    rejillaTarjetas(NIVELES.map((n, i) => ({
      nombre: n.nombre, imagen: n.img, detalle: linea(t(v.niveles[i])), pie: `+${n.carga} de carga`,
      elegir: () => {
        Sonido.tocar(n.snd);
        S.carico += n.carga;
        sumar(v.cal[i]);
        S.lufNivel[k] = i;
        anotar(t(v.nombre), linea(t(v.niveles[i])));
        ir('bodega');
      },
    })), { pizarra: piz, clase: 'niveles' }),
    piz,
    medidorCarga()));
};

// CambusaCal 10: puntos según el orden de importancia elegido
function completarBodega() {
  for (const k of ['L', 'U', 'F']) if (S.luf[k]) sumar(VALORES[k].final[S.luf[k] - 1]);
  S.cambusa = 1;
  S.scelta += 1;
  S.respaldo = null;
  const orden = ['L', 'U', 'F'].sort((a, b) => S.luf[a] - S.luf[b]).map((k) => t(VALORES[k].nombre));
  anotar('Orden de los valores', orden.join(' › '));
}

ESCENAS.bodegaExceso = () => {
  Sonido.tocar('drop');
  relato({
    etiqueta: 'Preparación · La bodega', titulo: t('Cambusa6-1'), texto: `${t('Cambusa6-2')}\n\n${t('Cambusa6-3')}`,
    img: 'bodega_mucha', vent: { clara: true },
    botones: [
      { texto: t('Cambusa6-5'), accion: () => { completarBodega(); ir('eleccion'); } },
      { texto: t('Cambusa6-4'), accion: () => { Object.assign(S, S.respaldo); S.luf = {}; S.lufNivel = {}; ir('bodega'); } },
    ],
  });
};

// ============================================================ La tripulación (Equipe) y las decisiones (Dec)
const VIDA = [
  { texto: 'equipe2-1', img: 'tripulacion_1', snd: 'wolf', ef: { effi: 2 } },
  { texto: 'equipe2-2', img: 'tripulacion_5', snd: 'squadra', ef: { effi: 3 } },
  { texto: 'equipe2-3', img: 'tripulacion_4', snd: 'sveglia', ef: { effi: 3, idea: 3 } },
  { texto: 'equipe2-4', img: 'tripulacion_2', snd: 'samici', ef: { idea: 2 } },
  { texto: 'equipe2-5', img: 'tripulacion_3', snd: 'fldrhimo', ef: { idea: 2 } },
];

ESCENAS.tripulacion = () => {
  montar(lienzoSolo(
    cabecera('Preparación · La tripulación', t('Equipe1-1')),
    rejillaTarjetas(VIDA.map((v) => ({
      nombre: linea(t(v.texto)), imagen: v.img,
      elegir: () => { sumar(v.ef); anotar('La vida a bordo', linea(t(v.texto))); Sonido.tocar(v.snd, () => ir('grupo')); },
    })))));
};

ESCENAS.grupo = () => {
  const op = (k, ef) => ({ texto: t(k), elegir: () => { sumar(ef); anotar('El grupo', t(k)); ir('decisiones'); } });
  decision({
    etiqueta: 'Preparación · La tripulación', pregunta: t('Equipe3-1'), img: 'eleccion_tripulacion', vent: { clara: true },
    opciones: [op('Equipe3-2', { effi: 3 }), op('Equipe3-3', { effi: 3, crea: 2 }), op('Equipe3-4', { idea: 2 })],
  });
};

ESCENAS.decisiones = () => {
  Sonido.tocar('vivappl1');
  const op = (k, imagenHover, ef, siguiente) => ({ texto: t(k), imagen: imagenHover, elegir: () => { sumar(ef); anotar('Las decisiones se toman', t(k)); ir(siguiente); } });
  decision({
    etiqueta: 'Preparación · La tripulación', pregunta: t('Dec1-1'), img: 'lider_reunion',
    opciones: [
      op('Dec1-2', 'decide_todos', { idea: 3 }, 'lider'),
      op('Dec1-3', 'decide_uno', { effi: 3 }, 'lider'),
      op('Dec1-4', 'decide_grupo', { effi: 1, idea: 2 }, 'lider'),
      op('Dec1-5', 'decide_cada', { idea: 3 }, 'lider'),
      op('Dec1-6', 'decide_niveles', { effi: 2, crea: 2 }, 'responsabilidades'),
    ],
  });
};

// Affido: matriz de responsabilidades (12 tareas × 3 órganos)
const TAREAS = ['Affido-5', 'Affido-7', 'Affido-8', 'Affido-9', 'Affido-10', 'Affido-11', 'Affido-12', 'Affido-13', 'Affido-14', 'Affido-15', 'Affido-16', 'Affido-17'];
const ORGANOS = ['Affido-2', 'Affido-3', 'Affido-4'];
// AffidoCal 8: qué cálculo aplica cada combinación fila/columna
const AFFIDO_CAL = [[1, 2, 3], [1, 2, 3], [4, 2, 6], [4, 2, 6], [1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 5, 6], [1, 2, 3], [1, 2, 3], [1, 10, 7], [1, 2, 3]];
function affidoCal(n) {
  const sm = S.somma;
  if (n === 1) sm[0]++;
  else if (n === 2) sm[1]++;
  else if (n === 3) sm[2]++;
  else if (n === 4) { sm[0]++; S.effi += 3; }
  else if (n === 5) { sm[1]++; S.effi += 2; }
  else if (n === 6) { sm[2]++; S.carico += 1; }
  else if (n === 7) { sm[2]++; S.carico += 3; }
  else if (n === 10) { sm[1]++; S.carico += 1; }
}

ESCENAS.responsabilidades = () => {
  const elegido = new Array(TAREAS.length).fill(-1);
  const contador = h('span', { class: 'nota' });
  const confirmar = h('button', { class: 'boton', type: 'button', disabled: true }, 'Confirmar', flecha());
  const refrescar = () => {
    const n = elegido.filter((x) => x >= 0).length;
    contador.textContent = `${n} de ${TAREAS.length} tareas asignadas`;
    confirmar.disabled = n < TAREAS.length;
  };
  const filas = TAREAS.map((k, r) => h('tr', null,
    h('th', { scope: 'row' }, t(k)),
    ORGANOS.map((o, c) => h('td', null, h('input', {
      type: 'radio', name: `tarea${r}`, 'aria-label': `${t(k)}: ${linea(t(o))}`,
      onchange: (e) => { elegido[r] = c; e.target.closest('tr').classList.add('completa'); Sonido.click(); refrescar(); },
    })))));
  confirmar.addEventListener('click', () => {
    Sonido.click();
    S.somma = [0, 0, 0];
    elegido.forEach((c, r) => affidoCal(AFFIDO_CAL[r][c]));
    if (S.somma[0] > 5) S.errore++; // AffidoCal 9
    if (S.somma[1] > 6) S.errore++;
    if (S.somma[2] > 3) S.errore++;
    anotar('Responsabilidades', ORGANOS.map((o, i) => `${linea(t(o)).replace(' Director', '/Director')}: ${S.somma[i]}`).join(' · '));
    ir('lider');
  });
  refrescar();
  montar(lienzoSolo(
    cabecera('Preparación · La tripulación', t('Affido-1')),
    h('p', { class: 'nota' }, 'Para cada tarea, marca quién debe hacerse cargo.'),
    h('div', { class: 'matriz-envoltura' }, h('table', { class: 'matriz' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Tarea'), ORGANOS.map((o) => h('th', { scope: 'col' }, linea(t(o)).replace(' Director', ' / Director'))))),
      h('tbody', null, filas))),
    h('div', { class: 'botonera' }, confirmar, contador)));
};

ESCENAS.lider = () => {
  Sonido.tocar('pickup');
  const conLider = (ef, valor, k) => ({ texto: t(k), elegir: () => { sumar(ef); S.leader = valor; anotar('El líder', t(k)); ir('liderComo'); } });
  decision({
    etiqueta: 'Preparación · La tripulación', pregunta: t('Dec2-1'), img: 'lider_reunion',
    opciones: [
      conLider({ effi: 3 }, 'si', 'Dec2-3'),
      conLider({ effi: 2, crea: 2 }, 'si', 'Dec2-4'),
      { texto: linea(t('Dec2-2')), elegir: () => {
        S.idea += 3;
        S.leader = 'no';
        anotar('El líder', linea(t('Dec2-2')));
        Sonido.tocar('riattacc');
        S.elia = 1; // Dec 6
        S.scelta += 1;
        aviso('La tripulación navegará sin líder');
        ir('eleccion');
      } },
    ],
  });
};

const COMO = [
  ['Dec3-2', { idea: 1 }], ['Dec3-3', { idea: 3, effi: 1 }], ['Dec3-4', { idea: 2, effi: 2, crea: 3 }], ['Dec3-5', { idea: 2 }],
  ['Dec3-6', { idea: 1, effi: 1 }], ['Dec3-7', { effi: 2 }], ['Dec3-8', { effi: 3 }], ['Dec3-9', { effi: 3 }],
];
ESCENAS.liderComo = () => {
  decision({
    etiqueta: S.leader === 'nosi' ? 'Travesía · Confusión a bordo' : 'Preparación · La tripulación',
    pregunta: t('Dec3-1'), img: 'lider_circulo', columnas: true,
    opciones: COMO.map(([k, ef]) => ({ texto: capital(t(k)), elegir: () => {
      sumar(ef);
      anotar('El líder debería ser como', t(k));
      if (S.leader === 'nosi') return eventoRuta(true); // Dec 5, caso "nosi"
      S.elia = 1;
      S.scelta += 1;
      ir('eleccion');
    } })),
  });
};

// ============================================================ Botadura
ESCENAS.reintentar = () => {
  Sonido.tocar('wrngansr');
  const barcoGrande = S.barca > S.rotta;
  relato({
    etiqueta: 'Botadura', titulo: 'El barco y la ruta no encajan',
    texto: barcoGrande ? t('Scelta3-1') : t('Scelta3-3'),
    nota: `Barco: ${linea(t(BARCOS[S.barca].titulo))} · Ruta: ${t(RUTAS[S.rotta].titulo)}`,
    img: BARCOS[S.barca].img,
    botones: [{ texto: t('Scelta3-2'), accion: () => {
      Object.assign(S, { rotta: 0, barca: 0, scelta: 2 }); // Scelta3-2
      sumar({ effi: -2, idea: -2 });
      ir('eleccion');
    } }],
  });
};

ESCENAS.botadura = () => {
  Sonido.tocar('pan21');
  const [felicidades, ...resto] = t('Scelta2-1').split('\n');
  const v = ventana('botella_1', { clara: true });
  const campo = h('input', { id: 'nombre-barco', type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'Nombre del barco', value: S.nombre });
  const botar = h('button', { class: 'boton', type: 'button', disabled: !S.nombre || null }, '¡Botar el barco!', flecha());
  campo.addEventListener('input', () => { botar.disabled = !campo.value.trim(); });
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !botar.disabled) botar.click(); });
  botar.addEventListener('click', () => {
    botar.disabled = true;
    campo.disabled = true;
    S.nombre = campo.value.trim();
    Sonido.tocar('crasha2');
    let cuadro = 1;
    v.img.classList.add('choque');
    cada(() => { if (cuadro < 6) v.cambiar(`botella_${++cuadro}`); }, 110);
    luego(() => {
      // SceltaCal 1: puntos según el orden en que se prepararon barco, ruta, tripulación y bodega
      const [p1, p2] = S.lScelta;
      if (p1 === 'Equipaggio') S.idea += 4; else if (p1 === 'Rotta') S.effi += 4; else if (p1 === 'Barca') S.carico += 1;
      if (p2 === 'Equipaggio') S.idea += 2; else if (p2 === 'Rotta') S.effi += 2;
      anotar('Nombre del barco', S.nombre);
      ir('evento', S.idea >= S.effi ? 'confusion' : 'ingresos'); // Scelta 6
    }, 1700);
  });
  montar(lienzo(v, h('div', { class: 'panel' },
    cabecera('Botadura', felicidades),
    h('div', { class: 'contexto' }, parrafos(resto.join(' '))),
    h('div', { class: 'campo' }, h('label', { for: 'nombre-barco' }, 'Nombre del barco'), campo),
    h('div', { class: 'botonera' }, botar))));
  luego(() => campo.focus(), 400);
};

// ============================================================ La travesía: eventos
// Confus 3: elige el evento según la ruta (y la carga, que puede provocar una crisis)
function eventoRuta(conCrisis) {
  if (conCrisis && S.carico > 3) return ir('evento', 'crisis');
  S.random = Math.random() < 0.5 ? 1 : 2;
  const par = S.rotta === 1 ? ['saturacion', 'tormenta'] : S.rotta === 2 ? ['piratas', 'naufragos'] : ['competencia', 'isla'];
  ir('evento', par[S.random - 1]);
}
const alFinal = () => ir('velas');

const EVENTOS = {
  confusion: {
    titulo: 'Confusión a bordo', img: 'ev_confus', snd: 'pan2', intro: 'Confus1-1',
    opciones: () => (S.leader === 'si'
      ? [['Confus2-1', { idea: 1 }], ['Confus2-2', { idea: 3, carico: 3 }], ['Confus2-3', { effi: 3 }]]
      : [['Confus2-4', { effi: 3, idea: -3 }], ['Confus2-5', { effi: 2, idea: 2 }],
        ['Confus2-6', { effi: 1, carico: 3, errore: 1 }, () => { S.leader = 'nosi'; ir('liderComo'); }]]),
    despues: () => eventoRuta(true),
  },
  ingresos: {
    titulo: 'Las ganancias no llegan', img: 'grafico', intro: 'Inso1-1',
    opciones: () => [['Inso2-1', { effi: 2 }], ['Inso2-2', { effi: 3, carico: 3 }], ['Inso2-3', { carico: 3, crea: 3 }], ['Inso2-4', { idea: 2, carico: 1 }]],
    despues: () => eventoRuta(true),
  },
  crisis: {
    titulo: 'Momento de crisis', img: 'ev_crisi', snd: 'thunderc', intro: 'Crisi1-1',
    opciones: () => [['Crisi2-1', { effi: 3, idea: 3 }], ['Crisi2-2', { effi: 3, carico: 3 }]],
    despues: () => eventoRuta(false),
  },
  saturacion: {
    titulo: 'Una ruta muy transitada', img: 'ev_affoll', snd: 'pan3', intro: 'Affoll1-1',
    opciones: () => [['Affoll2-1', { effi: 1 }], ['Affoll2-2', { effi: 3 }], ['Affoll2-3', { effi: 2 }], ['Affoll2-4', { effi: 2, idea: 2 }], ['Affoll2-5', { crea: -2, errore: 1 }]],
    despues: () => (S.random === 2 ? alFinal() : ir('evento', 'tormenta')),
  },
  tormenta: {
    titulo: 'La tempestad', img: 'ev_tempor', snd: 'thunderc', intro: 'tempor1-1',
    opciones: () => [['tempor2-1', { effi: 1 }], ['tempor2-2', { crea: -2, effi: -2 }], ['tempor2-3', { effi: 2 }]],
    despues: () => (S.random === 1 ? alFinal() : ir('evento', 'saturacion')),
  },
  piratas: {
    titulo: 'Una propuesta tentadora', img: 'ev_pirati', vent: { clara: true }, snd: 'pan8', intro: 'Pirati1-1',
    opciones: () => [['Pirati2-1', { effi: 2 }], ['Pirati2-2', { idea: 1 }], ['Pirati2-3', { effi: 2, crea: 2, idea: -1 }]],
    despues: () => (S.random === 2 ? alFinal() : ir('evento', 'naufragos')),
  },
  naufragos: {
    titulo: 'Náufragos a la vista', img: 'ev_naufra', snd: 'risacca', intro: 'Naufra1-1',
    opciones: () => [['Naufra2-1', { carico: 2, effi: -1, idea: 3 }], ['Naufra2-2', { effi: 2, idea: 1 }], ['Naufra2-3', { effi: 3 }]],
    despues: () => (S.random === 2 ? ir('evento', 'piratas') : alFinal()),
  },
  competencia: {
    titulo: 'Un competidor gigante', img: 'ev_conc3', snd: 'pan4', intro: 'Conc31-1',
    opciones: () => [['Conc32-1', { effi: 3, idea: -2 }], ['Conc32-2', { effi: 3, idea: -3 }], ['Conc32-3', { carico: 3 }]],
    despues: () => (S.random === 2 ? alFinal() : ir('evento', 'isla')),
  },
  isla: {
    titulo: 'La isla', img: 'ev_isola', snd: 'tamburi', intro: 'Isola1-1',
    // Nota: en el original la 3.ª opción aplicaba por error la puntuación de la 1.ª; aquí usa la suya (IsolaCal 3).
    opciones: () => [['Isola2-1', { effi: 2, idea: -1 }], ['Isola2-2', { idea: -2, effi: 3 }], ['Isola2-3', { idea: 2 }]],
    despues: () => (S.random === 2 ? ir('evento', 'competencia') : alFinal()),
  },
};

ESCENAS.evento = (id) => {
  const e = EVENTOS[id];
  if (e.snd) Sonido.tocar(e.snd);
  decision({
    etiqueta: 'Travesía', pregunta: e.titulo, contexto: linea(t(e.intro)), nota: '¿Qué decidimos?',
    img: e.img, vent: e.vent,
    opciones: e.opciones().map(([k, ef, propio]) => ({
      texto: linea(t(k)),
      elegir: () => { sumar(ef); anotar(e.titulo, linea(t(k))); (propio || e.despues)(); },
    })),
  });
};

// ============================================================ Llegada: las velas ganadas (Ultima)
function calcularViaje() {
  const pE = Math.trunc(S.effi * 100 / 67);
  const pI = Math.trunc(S.idea * 100 / 58);
  const millas = S.effi + S.idea + S.crea;
  return {
    pE, pI,
    verPragmatismo: !(pI - pE > 20),
    verCoherencia: !(pE - pI > 20),
    verCreatividad: S.crea >= 12,
    viaje: Math.trunc(millas * 100 / 80),
    recorrido: millas * (S.rotta === 1 ? 1 : S.rotta === 2 ? 5 : 100),
  };
}

function velero(v) {
  const alto = (p) => 40 + 190 * clamp(p, 0, 110) / 110;
  const hP = alto(v.pE), hC = alto(v.pI), hF = alto(S.crea * 100 / 20);
  const base = 288;
  const vela = (d, color, visible, retraso) => s('path', { d, fill: color, class: 'vela' + (visible ? '' : ' oculta'), style: `animation-delay:${retraso}s`, stroke: 'rgba(255,255,255,.35)', 'stroke-width': '1.5' });
  return s('svg', { class: 'velero', viewBox: '0 0 520 400', role: 'img', 'aria-label': 'Barco con las velas ganadas' },
    s('defs', null, s('linearGradient', { id: 'casco', x1: '0', x2: '0', y1: '0', y2: '1' }, s('stop', { offset: '0', 'stop-color': '#ffffff' }), s('stop', { offset: '1', 'stop-color': '#c9d6e3' }))),
    s('path', { d: 'M20 372 C 140 352 380 392 500 368', stroke: 'rgba(248,188,8,.35)', 'stroke-width': '3', fill: 'none' }),
    s('line', { x1: 210, y1: 300, x2: 210, y2: 40, stroke: '#8a5a2b', 'stroke-width': 6, 'stroke-linecap': 'round' }),
    s('line', { x1: 340, y1: 300, x2: 340, y2: 70, stroke: '#8a5a2b', 'stroke-width': 5, 'stroke-linecap': 'round' }),
    vela(`M206 ${base - hP} L206 ${base} L80 ${base} Q 130 ${base - hP * 0.45} 206 ${base - hP} Z`, COLOR.naranja, v.verPragmatismo, 0.1),
    vela(`M336 ${base - hC} L336 ${base} L232 ${base} Q 270 ${base - hC * 0.45} 336 ${base - hC} Z`, COLOR.dorado, v.verCoherencia, 0.35),
    vela(`M346 ${base - hF} L346 ${base} L470 ${base + 8} Z`, COLOR.crema, v.verCreatividad, 0.6),
    vela(`M346 ${base - hF * 0.55} L346 ${base} L430 ${base + 4} Z`, COLOR.blanco, v.verCreatividad, 0.75),
    s('path', { d: 'M50 300 L490 300 L452 350 Q 270 374 96 350 Z', fill: 'url(#casco)' }),
    s('path', { d: 'M58 312 L482 312', stroke: COLOR.naranja, 'stroke-width': 5 }),
    S.nombre && s('text', { x: 270, y: 338, 'text-anchor': 'middle', fill: COLOR.marino, 'font-family': 'Outfit, sans-serif', 'font-weight': 600, 'font-size': 18 }, S.nombre));
}

function indicador(nombre, color, valor, texto, visible) {
  return h('div', { class: 'indicador' },
    h('span', { class: 'color', style: `background:${color}` }),
    h('span', null, nombre, !visible && h('span', { class: 'nota' }, ' — sin velas')),
    h('span', { class: 'valor' }, texto),
    h('div', { class: 'barra-ind' }, h('span', { style: `width:${clamp(valor, 2, 100)}%;background:${color}` })));
}

ESCENAS.velas = () => {
  Sonido.tocar('martell');
  const v = calcularViaje();
  anotar('Velas ganadas', `Pragmatismo ${v.pE} % · Coherencia ${v.pI} % · Creatividad ${S.crea} puntos`);
  teclas = { Enter: () => ir('despedida') };
  montar(h('div', { class: 'resultado' },
    velero(v),
    h('div', { class: 'panel' },
      cabecera('Llegada', 'Las velas ganadas'),
      h('p', { class: 'contexto' }, t('Ultima2-4')),
      h('div', { class: 'leyenda' },
        indicador(t('Ultima2-1'), COLOR.naranja, v.pE, `${v.pE} %`, v.verPragmatismo),
        indicador(t('Ultima2-2'), COLOR.dorado, v.pI, `${v.pI} %`, v.verCoherencia),
        indicador(t('Ultima2-3'), COLOR.crema, S.crea * 5, `${S.crea} pts`, v.verCreatividad)),
      h('p', { class: 'millas' }, 'Han permitido recorrer ', h('b', null, v.recorrido.toLocaleString('es')), ' millas, es decir, el ', h('b', null, `${v.viaje} %`), ' de tu objetivo.'),
      h('div', { class: 'botonera' },
        h('button', { class: 'boton', type: 'button', onclick: () => { Sonido.click(); ir('despedida'); } }, 'Continuar', flecha()),
        h('button', { class: 'boton secundario', type: 'button', onclick: imprimirDiario }, BARRA.imprimir)))));
};

ESCENAS.despedida = () => {
  Sonido.tocar('applausi');
  const otraVez = () => { Sonido.click(); S = nuevoEstado(); borrarPartida(); ir('prima'); };
  teclas = { Enter: otraVez };
  montar(lienzoSolo(
    h('p', { class: 'etiqueta' }, 'Fin del viaje'),
    h('h1', { class: 'pregunta' }, '¡' + capital(linea(t('Indir2-1'))) + '!'),
    h('div', { class: 'contexto' }, parrafos(MARCA.contacto.length ? t('Indir1-1') : t('Indir1-1').split(';')[0] + '.')),
    MARCA.contacto.length > 0 && h('div', { class: 'pizarra' }, h('p', null, h('strong', null, capital(t('Indir2-2')))), MARCA.contacto.map((c) => h('div', null, c))),
    h('div', { class: 'botonera' },
      h('button', { class: 'boton', type: 'button', onclick: otraVez }, 'Jugar otra vez', flecha()),
      h('button', { class: 'boton secundario', type: 'button', onclick: imprimirDiario }, BARRA.imprimir),
      h('button', { class: 'boton secundario', type: 'button', onclick: () => { Sonido.click(); ir('portada'); } }, 'Volver al inicio'))));
};

// ============================================================ Ventanas: situación, salir, diario
function abrirModal(contenido) {
  const m = $('#modal');
  m.replaceChildren(h('div', { class: 'caja', role: 'dialog', 'aria-modal': 'true' }, contenido));
  m.hidden = false;
  const b = m.querySelector('button');
  if (b) b.focus();
}
function cerrarModal() { $('#modal').hidden = true; $('#escena').focus({ preventScroll: true }); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') cerrarModal(); });

function tiempoJugado() {
  const min = Math.floor(S.tiempo / 60), seg = S.tiempo % 60;
  return `Has navegado durante ${min} ${min === 1 ? 'minuto' : 'minutos'} y ${seg} ${seg === 1 ? 'segundo' : 'segundos'}`;
}

// Punto: equilibrio entre pragmatismo y coherencia, carga, recorrido y tiempo
function abrirSituacion() {
  Sonido.click();
  const v = calcularViaje();
  const mayor = Math.max(v.pE, v.pI), menor = Math.min(v.pE, v.pI);
  const scarto = mayor > 0 ? 100 - Math.trunc(menor * 100 / mayor) : 0;
  const nivel = scarto > 48 ? 5 : scarto > 36 ? 4 : scarto > 24 ? 3 : scarto > 12 ? 2 : 1;
  const giro = (v.pE === v.pI ? 0 : v.pE > v.pI ? -1 : 1) * (nivel - 1) * 5;
  const estado = ['Muy equilibrado', 'Bastante equilibrado', 'Algo desequilibrado', 'Desequilibrado', 'Muy desequilibrado'][nivel - 1];
  const balanza = s('svg', { class: 'balanza', viewBox: '0 0 320 110', role: 'img', 'aria-label': estado },
    s('path', { d: 'M160 44 L140 100 H180 Z', fill: '#21466b' }),
    s('g', { class: 'brazo', style: `transform: rotate(${giro}deg)` },
      s('rect', { x: 30, y: 38, width: 260, height: 6, rx: 3, fill: '#a3b8cc' }),
      s('circle', { cx: 40, cy: 54, r: 14, fill: COLOR.naranja }), s('circle', { cx: 280, cy: 54, r: 14, fill: COLOR.dorado })),
    s('text', { x: 40, y: 18, 'text-anchor': 'middle', fill: COLOR.naranja, 'font-size': 12 }, 'Pragmatismo'),
    s('text', { x: 280, y: 18, 'text-anchor': 'middle', fill: COLOR.dorado, 'font-size': 12 }, 'Coherencia'));
  const recorrido = clamp(v.viaje, 0, 100);
  const dato = (nombre, valor, pct) => h('div', { class: 'dato' },
    h('div', { class: 'fila' }, h('span', null, nombre), h('span', null, valor)),
    pct != null && h('div', { class: 'medidor' }, h('div', { class: 'barra-carga' }, h('span', { style: `width:${pct}%` }))));
  abrirModal([
    h('h2', null, BARRA.situacion),
    h('div', { class: 'situacion' },
      h('div', { class: 'dato' }, h('div', { class: 'fila' }, h('span', null, BARRA.equilibrio), h('span', null, estado)), balanza),
      dato(BARRA.carga, String(S.carico), clamp(S.carico * 10, 0, 100)),
      dato(BARRA.recorrido, `${recorrido} %`, recorrido),
      h('p', { class: 'nota' }, tiempoJugado() + '.')),
    h('div', { class: 'botonera' }, h('button', { class: 'boton', type: 'button', onclick: cerrarModal }, 'Seguir navegando')),
  ]);
}

function abrirSalir() {
  Sonido.click();
  abrirModal([
    h('h2', null, t('Quit-1')),
    h('p', { class: 'nota' }, 'Tu viaje queda guardado: podrás continuarlo la próxima vez desde la pantalla de inicio.'),
    h('div', { class: 'botonera' },
      h('button', { class: 'boton', type: 'button', onclick: cerrarModal }, t('Quit-3')),
      h('button', { class: 'boton secundario', type: 'button', onclick: salirApp }, t('Quit-2'))),
  ]);
}

function salirApp() {
  if (!SIN_BARRA.has(S.escena)) guardar();
  Sonido.tocar('pan8');
  setTimeout(() => {
    window.close();
    setTimeout(() => { cerrarModal(); aviso('Ya puedes cerrar esta ventana.'); }, 300);
  }, 500);
}

// _Stampa: diario de a bordo para imprimir
function imprimirDiario() {
  Sonido.click();
  const v = calcularViaje();
  const fila = (a, b) => h('tr', null, h('th', null, a), h('td', null, b));
  $('#diario').replaceChildren(
    h('h1', null, 'Diario de a bordo'),
    h('p', { class: 'sub' }, `${MARCA.producto} · ${MARCA.nombre} · ${new Date().toLocaleDateString('es')}`),
    h('table', null,
      fila('Nombre del barco', S.nombre || '—'),
      fila('Tipo de barco', S.barca ? linea(t(BARCOS[S.barca].titulo)) : '—'),
      fila('Ruta elegida', S.rotta ? t(RUTAS[S.rotta].titulo) : '—'),
      fila('Tiempo de juego', tiempoJugado().replace('Has navegado durante ', ''))),
    h('h2', null, 'Decisiones del viaje'),
    h('table', null, S.respuestas.map((r) => fila(r.tema, r.eleccion))),
    h('h2', null, 'Resultado'),
    h('table', null,
      fila(t('Ultima2-1'), `${v.pE} %`),
      fila(t('Ultima2-2'), `${v.pI} %`),
      fila(t('Ultima2-3'), `${S.crea} puntos`),
      fila('Millas recorridas', `${v.recorrido.toLocaleString('es')} (${v.viaje} % del objetivo)`)));
  window.print();
}

// ============================================================ Arranque
$('#btn-sonido').addEventListener('click', () => Sonido.alternar());
$('#btn-situacion').addEventListener('click', abrirSituacion);
$('#btn-salir').addEventListener('click', abrirSalir);
$('#btn-pantalla').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
});
pintarBotonSonido();

document.addEventListener('keydown', (e) => {
  if (!$('#modal').hidden) { if (e.key === 'Escape') cerrarModal(); return; }
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'Escape' && !SIN_BARRA.has(S.escena)) { e.preventDefault(); abrirSalir(); return; }
  const fn = teclas && teclas[e.key];
  if (fn && !e.repeat) { e.preventDefault(); fn(); }
});

// Tiempo de juego (Ltempi en el original)
setInterval(() => {
  if (SIN_BARRA.has(S.escena) || S.escena === 'despedida' || document.visibilityState !== 'visible') return;
  S.tiempo++;
  if (S.tiempo % 15 === 0) guardar();
}, 1000);

// Acceso para las pruebas automáticas
window.TW = { ir, estado: () => S, fijar: (o) => Object.assign(S, o), abrirSituacion, abrirSalir, cerrarModal };

ir('portada');
