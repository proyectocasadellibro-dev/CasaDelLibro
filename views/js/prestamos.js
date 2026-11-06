// views/js/prestamos.js
(async function () {
  const usuario = await iniciarPagina('prestamos');
  if (!usuario) return;

  const cuerpo = $('#cuerpo');
  const cuerpoIncidencias = $('#cuerpoIncidencias');
  const dlgPrestamo = $('#dlgPrestamo');
  const dlgDevolucion = $('#dlgDevolucion');
  const dlgIncidencia = $('#dlgIncidencia');

  // Texto de la lista -> id. Se conserva lo ya visto para poder validar lo que se escribió.
  const lectoresMapa = new Map();
  const librosMapa = new Map();
  const librosIncidenciaMapa = new Map();   // texto -> { id, disponibles }

  if (usuario.puedeEditar) {
    $('#btnNuevo').hidden = false;
    $('#btnIncidencia').hidden = false;
  } else {
    $('#thAcciones').hidden = true;
  }

  const suave = 'style="color:var(--texto-suave)"';
  const fecha = (valor) => (valor ? new Date(valor).toLocaleDateString('es-MX') : '—');
  const recortar = (texto, max) => (texto.length > max ? texto.slice(0, max) + '…' : texto);

  function mostrarAlerta(elemento, mensaje) {
    elemento.textContent = mensaje;
    elemento.hidden = !mensaje;
  }

  // ---------- Lista de préstamos ----------
  function filaHtml(p) {
    const pendiente = p.Estado === 'Activo' || p.Estado === 'Vencido';
    const conIncidencia = p.Estado === 'Devuelto con daños' || p.Estado === 'Extraviado';

    const retraso = p.DiasRetraso > 0
      ? `<br><small style="color:var(--rojo)">${p.DiasRetraso} día(s) de retraso</small>`
      : '';
    const nota = conIncidencia && p.Observaciones
      ? `<br><small ${suave} title="${esc(p.Observaciones)}">${esc(recortar(p.Observaciones, 60))}</small>`
      : '';

    const acciones = usuario.puedeEditar
      ? `<td class="acciones">${pendiente
          ? `<button type="button" class="btn chico" data-accion="devolver" data-id="${p.IdPrestamo}"
                     data-libro="${esc(p.Libro)}" data-lector="${esc(p.Lector)}"
                     data-limite="${esc(fecha(p.FechaLimite))}">Registrar devolución</button>`
          : ''}</td>`
      : '';

    return `<tr>
      <td class="ancho">${esc(p.Lector)}<br><small ${suave}>${esc(p.Matricula)}</small></td>
      <td class="ancho"><strong>${esc(p.Libro)}</strong><br><small ${suave}>${esc(p.Autor)}</small></td>
      <td>${fecha(p.FechaPrestamo)}</td>
      <td>${fecha(p.FechaLimite)}</td>
      <td>${fecha(p.FechaDevolucion)}</td>
      <td>${badge(p.Estado)}${retraso}${nota}</td>
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

  // ---------- Lista de libros dañados o extraviados ----------
  async function cargarIncidencias() {
    const r = await api('/api/incidencias');
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo cargar la lista de libros dañados o extraviados.', 'error');
      return;
    }

    cuerpoIncidencias.innerHTML = r.incidencias.map((i) => `<tr>
      <td>${fecha(i.Fecha)}</td>
      <td class="ancho"><strong>${esc(i.Libro)}</strong><br><small ${suave}>${esc(i.Autor)}</small></td>
      <td>${badge(i.Tipo)}</td>
      <td class="num">${i.Cantidad}</td>
      <td class="ancho">${i.Lector
        ? `${esc(i.Lector)}<br><small ${suave}>${esc(i.Matricula)}</small>`
        : '<span style="color:var(--texto-suave)">No estaba prestado</span>'}</td>
      <td class="ancho">${esc(i.Observaciones || '—')}</td>
      <td>${esc(i.RegistradoPor)}</td>
    </tr>`).join('');

    $('#vacioIncidencias').hidden = r.incidencias.length > 0;
    $('#cntIncidencias').textContent = r.incidencias.reduce((total, i) => total + i.Cantidad, 0);
  }

  function recargarTodo() {
    cargarPrestamos();
    cargarResumen();
    cargarIncidencias();
  }

  // ---------- Buscadores del formulario de préstamo ----------
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
  $('#btnNuevo').addEventListener('click', () => {
    $('#formPrestamo').reset();
    $('#dias').value = '7';
    mostrarAlerta($('#alertaPrestamo'), '');
    buscarLectores('');
    buscarLibros('');
    dlgPrestamo.showModal();
    $('#lector').focus();
  });

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
    recargarTodo();
  });

  // ---------- Registrar devolución ----------
  let prestamoActual = null;

  function actualizarAvisoCondicion() {
    const condicion = $('#condicion').value;
    const aviso = $('#avisoCondicion');

    if (condicion === 'Buen estado') {
      aviso.hidden = true;
      return;
    }

    aviso.hidden = false;
    aviso.className = 'alerta ' + (condicion === 'Extraviado' ? 'error' : 'info');
    aviso.textContent = condicion === 'Extraviado'
      ? 'El libro se registrará como extraviado y el ejemplar saldrá del inventario. Quedará anotado en el historial del lector.'
      : 'El ejemplar se retirará del inventario porque está dañado. Quedará anotado en el historial del lector.';
  }

  function abrirDevolucion(datos) {
    prestamoActual = datos;
    $('#devLector').textContent = datos.lector;
    $('#devLibro').textContent = datos.libro;
    $('#devLimite').textContent = datos.limite;
    $('#condicion').value = 'Buen estado';
    $('#observacionesDev').value = '';
    mostrarAlerta($('#alertaDevolucion'), '');
    actualizarAvisoCondicion();
    dlgDevolucion.showModal();
  }

  $('#condicion').addEventListener('change', actualizarAvisoCondicion);

  $('#formDevolucion').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!prestamoActual) return;

    const alerta = $('#alertaDevolucion');
    mostrarAlerta(alerta, '');

    const boton = $('#btnGuardarDevolucion');
    boton.disabled = true;
    const r = await api(`/api/prestamos/${prestamoActual.id}/devolucion`, {
      method: 'PATCH',
      body: {
        condicion: $('#condicion').value,
        observaciones: $('#observacionesDev').value.trim()
      }
    });
    boton.disabled = false;

    if (!r.ok) {
      mostrarAlerta(alerta, r.mensaje || 'No se pudo registrar la devolución.');
      return;
    }

    dlgDevolucion.close();
    toast(r.mensaje);
    recargarTodo();
  });

  // ---------- Reportar libro dañado o extraviado ----------
  async function buscarLibrosIncidencia(texto) {
    const r = await api('/api/libros?' + new URLSearchParams({ q: texto }).toString());
    if (!r.ok) return;

    const conEjemplares = r.libros.filter((b) => b.EjemplaresDisponibles > 0).slice(0, 20);
    $('#listaLibrosIncidencia').innerHTML = conEjemplares.map((b) => {
      const etiqueta = `${b.Titulo} — ${b.Autor} (${b.EjemplaresDisponibles} disp.)`;
      librosIncidenciaMapa.set(etiqueta, { id: b.IdLibro, disponibles: b.EjemplaresDisponibles });
      return `<option value="${esc(etiqueta)}"></option>`;
    }).join('');
  }

  $('#libroIncidencia').addEventListener('input',
    debounce((e) => buscarLibrosIncidencia(e.target.value.trim())));

  $('#btnIncidencia').addEventListener('click', () => {
    $('#formIncidencia').reset();
    $('#cantidadIncidencia').value = '1';
    mostrarAlerta($('#alertaIncidencia'), '');
    buscarLibrosIncidencia('');
    dlgIncidencia.showModal();
    $('#libroIncidencia').focus();
  });

  $('#formIncidencia').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const alerta = $('#alertaIncidencia');
    mostrarAlerta(alerta, '');

    const libro = librosIncidenciaMapa.get($('#libroIncidencia').value.trim());
    const cantidad = Number($('#cantidadIncidencia').value);

    if (!libro) {
      mostrarAlerta(alerta, 'Elige un libro de la lista.');
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      mostrarAlerta(alerta, 'La cantidad debe ser de al menos 1.');
      return;
    }
    if (cantidad > libro.disponibles) {
      mostrarAlerta(alerta, `Solo hay ${libro.disponibles} ejemplar(es) disponible(s) en la biblioteca.`);
      return;
    }

    const boton = $('#btnGuardarIncidencia');
    boton.disabled = true;
    const r = await api('/api/incidencias', {
      method: 'POST',
      body: {
        idLibro: libro.id,
        tipo: $('#tipoIncidencia').value,
        cantidad,
        observaciones: $('#observacionesIncidencia').value.trim()
      }
    });
    boton.disabled = false;

    if (!r.ok) {
      mostrarAlerta(alerta, r.mensaje || 'No se pudo registrar el reporte.');
      return;
    }

    dlgIncidencia.close();
    toast(r.mensaje);
    recargarTodo();
  });

  // ---------- Eventos de la tabla y de las ventanas ----------
  cuerpo.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion="devolver"]');
    if (!boton) return;
    abrirDevolucion({
      id: boton.dataset.id,
      libro: boton.dataset.libro,
      lector: boton.dataset.lector,
      limite: boton.dataset.limite
    });
  });

  document.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close())
  );

  recargarTodo();
})();