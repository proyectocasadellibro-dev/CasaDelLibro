// views/js/prestamos.js
(async function () {
  const usuario = await iniciarPagina('prestamos');
  if (!usuario) return;

  const cuerpo = $('#cuerpo');
  const dlgPrestamo = $('#dlgPrestamo');

  // Texto de la lista -> id. Se conserva lo ya visto para poder validar lo que se escribió.
  const lectoresMapa = new Map();
  const librosMapa = new Map();

  if (usuario.puedeEditar) {
    $('#btnNuevo').hidden = false;
  } else {
    $('#thAcciones').hidden = true;
  }

  const suave = 'style="color:var(--texto-suave)"';
  const fecha = (valor) => (valor ? new Date(valor).toLocaleDateString('es-MX') : '—');

  function mostrarAlerta(elemento, mensaje) {
    elemento.textContent = mensaje;
    elemento.hidden = !mensaje;
  }

  // ---------- Lista de préstamos ----------
  function filaHtml(p) {
    const pendiente = p.Estado === 'Activo' || p.Estado === 'Vencido';
    const retraso = p.DiasRetraso > 0
      ? `<br><small style="color:var(--rojo)">${p.DiasRetraso} día(s) de retraso</small>`
      : '';

    const acciones = usuario.puedeEditar
      ? `<td class="acciones">${pendiente
          ? `<button type="button" class="btn chico" data-accion="devolver" data-id="${p.IdPrestamo}"
                     data-libro="${esc(p.Libro)}" data-lector="${esc(p.Lector)}">Registrar devolución</button>`
          : ''}</td>`
      : '';

    return `<tr>
      <td class="ancho">${esc(p.Lector)}<br><small ${suave}>${esc(p.Matricula)}</small></td>
      <td class="ancho"><strong>${esc(p.Libro)}</strong><br><small ${suave}>${esc(p.Autor)}</small></td>
      <td>${fecha(p.FechaPrestamo)}</td>
      <td>${fecha(p.FechaLimite)}</td>
      <td>${fecha(p.FechaDevolucion)}</td>
      <td>${badge(p.Estado)}${retraso}</td>
      ${acciones}
    </tr>`;
  }

  async function cargarResumen() {
    const r = await api('/api/prestamos?estado=Pendientes');
    if (!r.ok) return;
    const vencidos = r.prestamos.filter((p) => p.Estado === 'Vencido').length;
    $('#cntVencidos').textContent = vencidos;
    $('#cntActivos').textContent = r.prestamos.length - vencidos;
  }

  async function cargarPrestamos() {
    const parametros = new URLSearchParams();
    const texto = $('#buscar').value.trim();
    const estado = $('#filtroEstado').value;
    if (texto) parametros.set('q', texto);
    if (estado) parametros.set('estado', estado);

    const r = await api('/api/prestamos?' + parametros.toString());
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo cargar la lista de préstamos.', 'error');
      return;
    }

    cuerpo.innerHTML = r.prestamos.map(filaHtml).join('');
    $('#vacio').hidden = r.prestamos.length > 0;
  }

  $('#buscar').addEventListener('input', debounce(cargarPrestamos));
  $('#filtroEstado').addEventListener('change', cargarPrestamos);

  // ---------- Buscadores del formulario (lector y libro) ----------
  async function buscarLectores(texto) {
    const parametros = new URLSearchParams({ q: texto, estado: 'Activo' });
    const r = await api('/api/lectores?' + parametros.toString());
    if (!r.ok) return;

    $('#listaLectores').innerHTML = r.lectores.slice(0, 20).map((l) => {
      const etiqueta = `${l.Matricula} · ${l.Nombre}`;
      lectoresMapa.set(etiqueta, l.IdLector);
      return `<option value="${esc(etiqueta)}"></option>`;
    }).join('');
  }

  async function buscarLibros(texto) {
    const r = await api('/api/libros/disponibilidad?' + new URLSearchParams({ q: texto }).toString());
    if (!r.ok) return;

    const disponibles = r.libros.filter((b) => b.EstadoDisponibilidad === 'Disponible').slice(0, 20);
    $('#listaLibros').innerHTML = disponibles.map((b) => {
      const etiqueta = `${b.Titulo} — ${b.Autor} (${b.EjemplaresDisponibles} disp.)`;
      librosMapa.set(etiqueta, b.IdLibro);
      return `<option value="${esc(etiqueta)}"></option>`;
    }).join('');
  }

  $('#lector').addEventListener('input', debounce((e) => buscarLectores(e.target.value.trim())));
  $('#libro').addEventListener('input', debounce((e) => buscarLibros(e.target.value.trim())));

  // ---------- Nuevo préstamo ----------
  function abrirNuevo() {
    $('#formPrestamo').reset();
    $('#dias').value = '7';
    mostrarAlerta($('#alertaPrestamo'), '');
    buscarLectores('');
    buscarLibros('');
    dlgPrestamo.showModal();
    $('#lector').focus();
  }

  $('#btnNuevo').addEventListener('click', abrirNuevo);

  $('#formPrestamo').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const alerta = $('#alertaPrestamo');
    mostrarAlerta(alerta, '');

    const idLector = lectoresMapa.get($('#lector').value.trim());
    const idLibro = librosMapa.get($('#libro').value.trim());
    const dias = Number($('#dias').value);

    if (!idLector) {
      mostrarAlerta(alerta, 'Elige un lector de la lista.');
      return;
    }
    if (!idLibro) {
      mostrarAlerta(alerta, 'Elige un libro de la lista.');
      return;
    }
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) {
      mostrarAlerta(alerta, 'El plazo debe ser de 1 a 30 días.');
      return;
    }

    const boton = $('#btnGuardarPrestamo');
    boton.disabled = true;
    const r = await api('/api/prestamos', { method: 'POST', body: { idLector, idLibro, dias } });
    boton.disabled = false;

    if (!r.ok) {
      mostrarAlerta(alerta, r.mensaje || 'No se pudo registrar el préstamo.');
      return;
    }

    dlgPrestamo.close();
    toast(`${r.mensaje} Fecha límite: ${fecha(r.fechaLimite)}`);
    cargarPrestamos();
    cargarResumen();
  });

  // ---------- Devolución ----------
  async function devolver(id, libro, lector) {
    if (!window.confirm(`¿Registrar la devolución de "${libro}" de ${lector}?`)) return;

    const r = await api(`/api/prestamos/${id}/devolucion`, { method: 'PATCH' });
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo registrar la devolución.', 'error');
      cargarPrestamos();
      return;
    }

    toast(r.mensaje);
    cargarPrestamos();
    cargarResumen();
  }

  // ---------- Eventos de la tabla y de las ventanas ----------
  cuerpo.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion="devolver"]');
    if (boton) devolver(boton.dataset.id, boton.dataset.libro, boton.dataset.lector);
  });

  document.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close())
  );

  cargarPrestamos();
  cargarResumen();
})();
