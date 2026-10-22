// views/js/comun.js
// Funciones compartidas por todas las pantallas: llamadas a la API,
// control de sesión y rol, menú superior y avisos.

// Si tu pantalla de inicio de sesión tiene otro nombre, cámbialo aquí:
const PAGINA_LOGIN = '/login.html';

// Qué roles pueden ver las pantallas y cuáles pueden modificar datos.
// (El frontend decide qué se muestra; cambia las listas si el equipo lo define distinto.)
const PERMISOS = {
  ver:    ['Administrador', 'Gerente', 'Empleado'],
  editar: ['Administrador', 'Empleado']
};

const MENU = [
  { pagina: 'inicio',         texto: 'Inicio',         url: '/principal' },
  { pagina: 'lectores',       texto: 'Lectores',       url: '/lectores.html' },
  { pagina: 'libros',         texto: 'Libros',         url: '/libros.html' },
  { pagina: 'disponibilidad', texto: 'Disponibilidad', url: '/disponibilidad.html' },
  { pagina: 'usuarios',       texto: 'Usuarios',       url: '/usuarios.html', roles: ['Administrador'] }
];

const $ = (selector, raiz = document) => raiz.querySelector(selector);

// Evita que un texto escrito por el usuario se interprete como HTML
function esc(valor) {
  const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor ?? '').replace(/[&<>"']/g, (c) => mapa[c]);
}

// Llamada a la API. Siempre devuelve { ok, estado, mensaje, ...datos } sin lanzar errores.
async function api(url, { method = 'GET', body } = {}) {
  const config = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  let respuesta;
  try {
    respuesta = await fetch(url, config);
  } catch (err) {
    return { ok: false, estado: 0, mensaje: 'No se pudo conectar con el servidor.' };
  }

  let datos = {};
  try { datos = await respuesta.json(); } catch (err) { /* respuesta sin JSON */ }

  return { ...datos, ok: respuesta.ok && datos.ok !== false, estado: respuesta.status };
}

function toast(mensaje, tipo = 'ok') {
  let contenedor = $('#toasts');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toasts';
    contenedor.className = 'toasts';
    document.body.appendChild(contenedor);
  }
  const aviso = document.createElement('div');
  aviso.className = 'toast' + (tipo === 'error' ? ' error' : '');
  aviso.textContent = mensaje;
  contenedor.appendChild(aviso);
  setTimeout(() => aviso.remove(), 4500);
}

function debounce(funcion, espera = 300) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcion(...args), espera);
  };
}

const CLASES_BADGE = {
  'Activo': 'verde', 'Suspendido': 'amarillo', 'Baja': 'rojo',
  'Disponible': 'verde', 'Prestado': 'amarillo', 'No disponible': 'rojo',
  'Dañado': 'rojo', 'Extraviado': 'rojo', 'Inactivo': 'rojo'
};

function badge(texto) {
  return `<span class="badge ${CLASES_BADGE[texto] || 'gris'}">${esc(texto)}</span>`;
}

function pintarEncabezado(usuario, paginaActiva) {
  const enlaces = MENU.filter((m) => !m.roles || m.roles.includes(usuario.rol)).map((m) =>
    `<a href="${m.url}" class="${m.pagina === paginaActiva ? 'activo' : ''}">${m.texto}</a>`
  ).join('');

  $('#encabezado').innerHTML = `
    <span class="marca">📚 La Casa Del Libro</span>
    <nav class="menu">${enlaces}</nav>
    <div class="usuario">
      <span>${esc(usuario.nombre)}</span>
      <span class="rol">${esc(usuario.rol)}</span>
      <button type="button" id="btnSalir">Cerrar sesión</button>
    </div>`;

  $('#btnSalir').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    window.location.href = PAGINA_LOGIN;
  });
}

// Se llama al abrir cada pantalla. Devuelve el usuario (con puedeEditar) o null
// si no hay sesión o el rol no tiene acceso.
// rolesPermitidos (opcional): limita la pantalla a esos roles, ej. ['Administrador'].
async function iniciarPagina(paginaActiva, rolesPermitidos) {
  const r = await api('/api/sesion');

  if (r.estado === 401) {
    window.location.href = PAGINA_LOGIN;
    return null;
  }
  if (!r.ok || !r.usuario) {
    document.body.innerHTML =
      `<main class="contenedor"><p class="alerta error">${esc(r.mensaje || 'No se pudo verificar la sesión.')}</p></main>`;
    return null;
  }

  const usuario = r.usuario;
  if (!(rolesPermitidos || PERMISOS.ver).includes(usuario.rol)) {
    document.body.innerHTML =
      '<main class="contenedor"><p class="alerta error">Tu rol no tiene acceso a esta página.</p></main>';
    return null;
  }

  usuario.puedeEditar = PERMISOS.editar.includes(usuario.rol);
  pintarEncabezado(usuario, paginaActiva);
  return usuario;
}