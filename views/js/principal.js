// views/js/principal.js
(async function () {
  const usuario = await iniciarPagina('inicio');
  if (!usuario) return;

  $('#saludo').textContent = `Hola, ${usuario.nombre}`;
  $('#avisoConsulta').hidden = usuario.puedeEditar;
  $('#opcionReportes').hidden = !['Administrador', 'Gerente'].includes(usuario.rol);
  $('#opcionUsuarios').hidden = usuario.rol !== 'Administrador';

  // ---------- Gráfica: los 3 libros más solicitados ----------
  const grafica = $('#grafica');

  function isoLocal(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function pintarGrafica(libros) {
    if (libros.length === 0) {
      grafica.innerHTML = '<p class="vacio">Todavía no hay préstamos registrados en este periodo.</p>';
      return;
    }

    const valores = libros.map((l) => Number(l.Prestamos) || 0);
    const maximo = Math.max(...valores, 1);
    const total = valores.reduce((suma, v) => suma + v, 0);

    const columnas = libros.map((l, i) => `
      <div class="columna" title="${esc(l.Libro)}: ${valores[i]} préstamo(s)">
        <div class="valor">${valores[i]}</div>
        <div class="barra-g" data-altura="${Math.max((valores[i] / maximo) * 86, 3)}"></div>
      </div>`).join('');

    const etiquetas = libros.map((l, i) => `
      <div>
        <strong>#${i + 1} ${esc(l.Libro)}</strong>
        <small>${esc(l.Autor)}</small>
      </div>`).join('');

    grafica.innerHTML = `
      <div class="grafica-area" role="img"
           aria-label="Gráfica de barras de los libros más solicitados">${columnas}</div>
      <div class="grafica-etiquetas">${etiquetas}</div>
      <p class="grafica-pie">Préstamos de estos libros: ${total}. La altura de cada barra es la cantidad de veces que se prestó.</p>`;

    // Las barras crecen con una pequeña animación
    requestAnimationFrame(() => requestAnimationFrame(() => {
      grafica.querySelectorAll('.barra-g').forEach((barra) => {
        barra.style.height = barra.dataset.altura + '%';
      });
    }));
  }

  async function cargarGrafica() {
    const parametros = new URLSearchParams({ limite: '3' });
    const dias = Number($('#periodo').value);
    if (dias) {
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      parametros.set('desde', isoLocal(desde));
    }

    const r = await api('/api/estadisticas/libros-mas-solicitados?' + parametros.toString());
    if (!r.ok) {
      grafica.innerHTML = `<p class="vacio">${esc(r.mensaje || 'No se pudo cargar la gráfica.')}</p>`;
      return;
    }
    pintarGrafica(r.libros);
  }

  $('#periodo').addEventListener('change', cargarGrafica);
  cargarGrafica();
})();