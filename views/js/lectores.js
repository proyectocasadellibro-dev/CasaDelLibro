// views/js/lectores.js
(async function () {
  const usuario = await iniciarPagina('lectores');
  if (!usuario) return;

  const cuerpo = $('#cuerpo');
  const dlgLector = $('#dlgLector');
  const dlgEstado = $('#dlgEstado');

  if (usuario.puedeEditar) {
    $('#btnNuevo').hidden = false;
  } else {
    $('#thAcciones').hidden = true;
  }

  // ---------- Lista y búsqueda ----------
  function filaHtml(l) {
    const acciones = usuario.puedeEditar
      ? `<td class="acciones">
           <button type="button" class="btn chico" data-accion="editar" data-id="${l.IdLector}">Editar</button>
           <button type="button" class="btn chico claro" data-accion="estado"
                   data-id="${l.IdLector}" data-nombre="${esc(l.Nombre)}" data-estado="${esc(l.Estado)}">Estado</button>
         </td>`
      : '';

    return `<tr>
      <td>${esc(l.Matricula)}</td>
      <td>${esc(l.Folio)}</td>
      <td class="ancho">${esc(l.Nombre)}</td>
      <td>${esc(l.Correo || '—')}</td>
      <td>${esc(l.Telefono || '—')}</td>
      <td>${badge(l.Estado)}</td>
      ${acciones}
    </tr>`;
  }

  async function cargarLectores() {
    const parametros = new URLSearchParams();
    const texto = $('#buscar').value.trim();
    const estado = $('#filtroEstado').value;
    if (texto) parametros.set('q', texto);
    if (estado) parametros.set('estado', estado);

    const r = await api('/api/lectores?' + parametros.toString());
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo cargar la lista de lectores.', 'error');
      return;
    }

    cuerpo.innerHTML = r.lectores.map(filaHtml).join('');
    $('#vacio').hidden = r.lectores.length > 0;
  }

  $('#buscar').addEventListener('input', debounce(cargarLectores));
  $('#filtroEstado').addEventListener('change', cargarLectores);

  // ---------- Formulario crear / modificar ----------
  function mostrarAlerta(elemento, mensaje) {
    elemento.textContent = mensaje;
    elemento.hidden = !mensaje;
  }

  function abrirNuevo() {
    $('#formLector').reset();
    $('#idLector').value = '0';            // id 0 = crear
    $('#tituloLector').textContent = 'Nuevo lector';
    $('#grupoFolio').hidden = true;
    $('#notaFolio').hidden = false;
    mostrarAlerta($('#alertaLector'), '');
    dlgLector.showModal();
    $('#matricula').focus();
  }

  async function abrirEditar(id) {
    const r = await api('/api/lectores/' + id);
    if (!r.ok) {
      // Si el id no existe, el servidor responde 404 con "El lector no existe."
      toast(r.mensaje || 'No se pudo consultar el lector.', 'error');
      cargarLectores();
      return;
    }

    const l = r.lector;
    $('#formLector').reset();
    $('#idLector').value = String(l.IdLector);   // id > 0 = modificar
    $('#tituloLector').textContent = 'Modificar lector';
    $('#matricula').value = l.Matricula;
    $('#nombre').value = l.Nombre;
    $('#correo').value = l.Correo || '';
    $('#telefono').value = l.Telefono || '';
    $('#folio').value = l.Folio;
    $('#grupoFolio').hidden = false;
    $('#notaFolio').hidden = true;
    mostrarAlerta($('#alertaLector'), '');
    dlgLector.showModal();
  }

  $('#btnNuevo').addEventListener('click', abrirNuevo);

  $('#formLector').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const alerta = $('#alertaLector');
    mostrarAlerta(alerta, '');

    const datos = {
      idLector: Number($('#idLector').value),
      matricula: $('#matricula').value.trim(),
      nombre: $('#nombre').value.trim(),
      correo: $('#correo').value.trim(),
      telefono: $('#telefono').value.trim()
    };

    if (!datos.matricula || !datos.nombre) {
      mostrarAlerta(alerta, 'La matrícula y el nombre son obligatorios.');
      return;
    }

    const boton = $('#btnGuardarLector');
    boton.disabled = true;
    const r = await api('/api/lectores', { method: 'POST', body: datos });
    boton.disabled = false;

    if (!r.ok) {
      mostrarAlerta(alerta, r.mensaje || 'No se pudo guardar el lector.');
      if (r.estado === 404) cargarLectores();   // el lector ya no existe
      return;
    }

    dlgLector.close();
    toast(r.folio ? `${r.mensaje} Folio: ${r.folio}` : r.mensaje);
    cargarLectores();
  });

  // ---------- Cambiar estado ----------
  function abrirEstado(id, nombre, estadoActual) {
    $('#idEstado').value = id;
    $('#nombreEstado').textContent = nombre;
    $('#nuevoEstado').value = estadoActual;
    mostrarAlerta($('#alertaEstado'), '');
    dlgEstado.showModal();
  }

  $('#formEstado').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const alerta = $('#alertaEstado');
    mostrarAlerta(alerta, '');

    const boton = $('#btnGuardarEstado');
    boton.disabled = true;
    const r = await api(`/api/lectores/${$('#idEstado').value}/estado`, {
      method: 'PATCH',
      body: { estado: $('#nuevoEstado').value }
    });
    boton.disabled = false;

    if (!r.ok) {
      mostrarAlerta(alerta, r.mensaje || 'No se pudo cambiar el estado.');
      return;
    }

    dlgEstado.close();
    toast(r.mensaje);
    cargarLectores();
  });

  // ---------- Eventos de la tabla y de las ventanas ----------
  cuerpo.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton) return;

    if (boton.dataset.accion === 'editar') {
      abrirEditar(boton.dataset.id);
    } else if (boton.dataset.accion === 'estado') {
      abrirEstado(boton.dataset.id, boton.dataset.nombre, boton.dataset.estado);
    }
  });

  document.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close())
  );

  cargarLectores();
})();