// views/js/libros.js
(async function () {
  const usuario = await iniciarPagina('libros');
  if (!usuario) return;

  const cuerpo = $('#cuerpo');
  const dlgLibro = $('#dlgLibro');
  let libroActual = null;   // libro que se está editando: { total, disponibles }

  if (usuario.puedeEditar) {
    $('#btnNuevo').hidden = false;
    $('#btnNuevaCategoria').hidden = false;
  } else {
    $('#thAcciones').hidden = true;
  }

  // ---------- Categorías (filtro y formulario) ----------
  async function cargarCategorias() {
    const r = await api('/api/categorias');
    if (!r.ok) {
      toast(r.mensaje || 'No se pudieron cargar las categorías.', 'error');
      return;
    }
    const opciones = r.categorias
      .map((c) => `<option value="${c.IdCategoria}">${esc(c.Nombre)}</option>`)
      .join('');

    // Se vuelven a llenar las dos listas conservando su primera opción y la selección actual
    for (const lista of [$('#filtroCategoria'), $('#categoria')]) {
      const seleccionada = lista.value;
      while (lista.options.length > 1) lista.remove(1);
      lista.insertAdjacentHTML('beforeend', opciones);
      lista.value = seleccionada;
    }
  }

  // ---------- Lista y búsqueda ----------
  function filaHtml(b) {
    const acciones = usuario.puedeEditar
      ? `<td class="acciones">
           <button type="button" class="btn chico" data-accion="editar" data-id="${b.IdLibro}">Editar</button>
         </td>`
      : '';

    return `<tr>
      <td class="ancho"><strong>${esc(b.Titulo)}</strong></td>
      <td class="ancho">${esc(b.Autor)}</td>
      <td>${esc(b.Categoria || '—')}</td>
      <td>${esc(b.Isbn || '—')}</td>
      <td class="num">${b.EjemplaresDisponibles} / ${b.TotalEjemplares}</td>
      <td>${badge(b.Estado)}</td>
      ${acciones}
    </tr>`;
  }

  async function cargarLibros() {
    const parametros = new URLSearchParams();
    const texto = $('#buscar').value.trim();
    const categoria = $('#filtroCategoria').value;
    if (texto) parametros.set('q', texto);
    if (categoria) parametros.set('categoria', categoria);

    const r = await api('/api/libros?' + parametros.toString());
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo cargar el catálogo.', 'error');
      return;
    }

    cuerpo.innerHTML = r.libros.map(filaHtml).join('');
    $('#vacio').hidden = r.libros.length > 0;
  }

  $('#buscar').addEventListener('input', debounce(cargarLibros));
  $('#filtroCategoria').addEventListener('change', cargarLibros);

  // ---------- Formulario crear / modificar ----------
  function mostrarAlerta(elemento, mensaje) {
    elemento.textContent = mensaje;
    elemento.hidden = !mensaje;
  }

  // ---------- Libros dañados o extraviados (solo al editar) ----------
  // Cuántos ejemplares quedarían disponibles después de guardar los cambios del formulario
  function disponiblesTrasEditar() {
    if (!libroActual) return 0;
    const prestados = libroActual.total - libroActual.disponibles;
    const total = Number($('#total').value);
    return Number.isInteger(total) ? total - prestados : 0;
  }

  function actualizarReporte() {
    const tipo = $('#estadoReporte').value;
    const activo = tipo !== '';
    const resumen = $('#resumenReporte');

    for (const id of ['#cantidadReporte', '#menosCantidad', '#masCantidad', '#observacionesReporte']) {
      $(id).disabled = !activo;
    }

    if (!activo || !libroActual) {
      resumen.hidden = true;
      return;
    }

    const disponibles = disponiblesTrasEditar();
    const cantidad = Number($('#cantidadReporte').value);
    $('#cantidadReporte').max = String(Math.max(disponibles, 1));
    resumen.hidden = false;

    if (disponibles < 1) {
      resumen.className = 'alerta error';
      resumen.textContent = 'No hay ejemplares disponibles para reportar. Si el libro lo tiene un lector, '
        + 'regístralo al recibir su devolución en Préstamos.';
    } else if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > disponibles) {
      resumen.className = 'alerta error';
      resumen.textContent = `La cantidad debe ser de 1 a ${disponibles} (ejemplares disponibles).`;
    } else {
      const total = Number($('#total').value);
      resumen.className = 'alerta info';
      resumen.textContent = `Al guardar se restarán ${cantidad} ejemplar(es) del total y de los disponibles: `
        + `quedarán ${total - cantidad} en total y ${disponibles - cantidad} disponibles.`;
    }
  }

  function reiniciarReporte() {
    $('#estadoReporte').value = '';
    $('#cantidadReporte').value = '1';
    $('#observacionesReporte').value = '';
    actualizarReporte();
  }

  $('#estadoReporte').addEventListener('change', () => {
    $('#cantidadReporte').value = '1';          // el contador siempre empieza en 1
    actualizarReporte();
  });
  $('#cantidadReporte').addEventListener('input', actualizarReporte);
  $('#total').addEventListener('input', actualizarReporte);

  $('#menosCantidad').addEventListener('click', () => {
    $('#cantidadReporte').value = String(Math.max((Number($('#cantidadReporte').value) || 1) - 1, 1));
    actualizarReporte();
  });
  $('#masCantidad').addEventListener('click', () => {
    const limite = Math.max(disponiblesTrasEditar(), 1);
    $('#cantidadReporte').value = String(Math.min((Number($('#cantidadReporte').value) || 1) + 1, limite));
    actualizarReporte();
  });

  function abrirNuevo() {
    libroActual = null;
    $('#seccionReporte').hidden = true;
    reiniciarReporte();
    $('#formLibro').reset();
    $('#idLibro').value = '0';              // id 0 = crear
    $('#tituloLibro').textContent = 'Nuevo libro';
    $('#total').min = '1';
    $('#total').value = '1';
    $('#notaEjemplares').hidden = true;
    mostrarAlerta($('#alertaLibro'), '');
    dlgLibro.showModal();
    $('#titulo').focus();
  }

  async function abrirEditar(id) {
    const r = await api('/api/libros/' + id);
    if (!r.ok) {
      // Si el id no existe, el servidor responde 404 con "El libro no existe."
      toast(r.mensaje || 'No se pudo consultar el libro.', 'error');
      cargarLibros();
      return;
    }

    const b = r.libro;
    const prestados = b.TotalEjemplares - b.EjemplaresDisponibles;

    $('#formLibro').reset();
    $('#idLibro').value = String(b.IdLibro);   // id > 0 = modificar
    $('#tituloLibro').textContent = 'Modificar libro';
    $('#titulo').value = b.Titulo;
    $('#autor').value = b.Autor;
    $('#categoria').value = b.IdCategoria ? String(b.IdCategoria) : '';
    $('#isbn').value = b.Isbn || '';
    $('#total').min = String(prestados);
    $('#total').value = b.TotalEjemplares;

    const nota = $('#notaEjemplares');
    nota.hidden = prestados === 0;
    nota.textContent = `Hay ${prestados} ejemplar(es) prestado(s): el total no puede ser menor.`;

    libroActual = { total: b.TotalEjemplares, disponibles: b.EjemplaresDisponibles };
    $('#seccionReporte').hidden = false;
    reiniciarReporte();

    mostrarAlerta($('#alertaLibro'), '');
    dlgLibro.showModal();
  }

  $('#btnNuevo').addEventListener('click', abrirNuevo);

  $('#formLibro').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const alerta = $('#alertaLibro');
    mostrarAlerta(alerta, '');

    const datos = {
      idLibro: Number($('#idLibro').value),
      titulo: $('#titulo').value.trim(),
      autor: $('#autor').value.trim(),
      idCategoria: $('#categoria').value ? Number($('#categoria').value) : null,
      isbn: $('#isbn').value.trim(),
      total: Number($('#total').value)
    };

    if (!datos.titulo || !datos.autor) {
      mostrarAlerta(alerta, 'El título y el autor son obligatorios.');
      return;
    }
    if (!Number.isInteger(datos.total) || datos.total < Number($('#total').min)) {
      mostrarAlerta(alerta, 'El total de ejemplares no es válido.');
      return;
    }

    // ¿Se reportan ejemplares dañados o extraviados?
    const tipoReporte = libroActual ? $('#estadoReporte').value : '';
    const cantidad = Number($('#cantidadReporte').value);
    if (tipoReporte) {
      const disponibles = disponiblesTrasEditar();
      if (disponibles < 1) {
        mostrarAlerta(alerta, 'No hay ejemplares disponibles para reportar. Si el libro lo tiene un lector, '
          + 'regístralo al recibir su devolución en Préstamos.');
        return;
      }
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > disponibles) {
        mostrarAlerta(alerta, `La cantidad de ejemplares ${tipoReporte.toLowerCase()}s debe ser de 1 a ${disponibles}.`);
        return;
      }
    }

    const boton = $('#btnGuardarLibro');
    boton.disabled = true;
    const r = await api('/api/libros', { method: 'POST', body: datos });

    if (!r.ok) {
      boton.disabled = false;
      mostrarAlerta(alerta, r.mensaje || 'No se pudo guardar el libro.');
      if (r.estado === 404) cargarLibros();   // el libro ya no existe
      return;
    }

    // Con los datos guardados, se registran los ejemplares dañados o extraviados:
    // se restan del total y de los disponibles.
    if (tipoReporte) {
      const reporte = await api('/api/incidencias', {
        method: 'POST',
        body: {
          idLibro: datos.idLibro,
          tipo: tipoReporte,
          cantidad,
          observaciones: $('#observacionesReporte').value.trim()
        }
      });
      boton.disabled = false;
      dlgLibro.close();
      cargarLibros();

      if (!reporte.ok) {
        toast(`Los datos del libro se guardaron, pero el reporte no: ${reporte.mensaje || 'error desconocido'}`, 'error');
        return;
      }
      toast(`${r.mensaje} ${reporte.mensaje}`);
      return;
    }

    boton.disabled = false;
    dlgLibro.close();
    toast(r.mensaje);
    cargarLibros();
  });

  // ---------- Nueva categoría ----------
  const dlgCategoria = $('#dlgCategoria');

  $('#btnNuevaCategoria').addEventListener('click', () => {
    $('#formCategoria').reset();
    mostrarAlerta($('#alertaCategoria'), '');
    dlgCategoria.showModal();
    $('#nombreCategoria').focus();
  });

  $('#formCategoria').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const alerta = $('#alertaCategoria');
    mostrarAlerta(alerta, '');

    const datos = {
      idCategoria: 0,                                  // id 0 = crear
      nombre: $('#nombreCategoria').value.trim(),
      descripcion: $('#descripcionCategoria').value.trim()
    };

    if (!datos.nombre) {
      mostrarAlerta(alerta, 'El nombre de la categoría es obligatorio.');
      return;
    }

    const boton = $('#btnGuardarCategoria');
    boton.disabled = true;
    const r = await api('/api/categorias', { method: 'POST', body: datos });
    boton.disabled = false;

    if (!r.ok) {
      mostrarAlerta(alerta, r.mensaje || 'No se pudo guardar la categoría.');
      return;
    }

    dlgCategoria.close();
    toast(r.mensaje);
    await cargarCategorias();    // la nueva categoría aparece en el filtro y en el formulario
  });

  // ---------- Eventos de la tabla y de las ventanas ----------
  cuerpo.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion="editar"]');
    if (boton) abrirEditar(boton.dataset.id);
  });

  document.querySelectorAll('[data-cerrar]').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close())
  );

  await cargarCategorias();
  cargarLibros();
})();