// views/js/principal.js
(async function () {
  const usuario = await iniciarPagina('inicio');
  if (!usuario) return;

  // Ayudantes: si algún elemento no existe en el HTML, se omite en lugar de romper todo el script
  const escribir = (selector, texto) => { const e = $(selector); if (e) e.textContent = texto; };
  const mostrar = (selector, visible) => { const e = $(selector); if (e) e.hidden = !visible; };

  const num = (v) => Number(v) || 0;
  const entero = new Intl.NumberFormat('es-MX');

  // ---------- Barra lateral y avisos según el rol ----------
  mostrar('#avisoConsulta', !usuario.puedeEditar);
  mostrar('#opcionReportes', ['Administrador', 'Gerente'].includes(usuario.rol));
  mostrar('#opcionUsuarios', usuario.rol === 'Administrador');

  // ---------- Tarjetas de métricas ----------
  async function cargarResumen() {
    const r = await api('/api/estadisticas/resumen');
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo cargar el resumen.', 'error');
      return;
    }

    const d = r.resumen;
    const vencidos = num(d.PrestamosVencidos);

    escribir('#valPrestamos', entero.format(num(d.PrestamosActivos)));
    escribir('#subPrestamos', vencidos > 0 ? `${vencidos} vencido(s)` : 'Ninguno vencido');

    escribir('#valLectores', entero.format(num(d.LectoresRegistrados)));
    escribir('#subLectores', `${entero.format(num(d.LectoresActivos))} activo(s)`);

    escribir('#valLibros', entero.format(num(d.LibrosDisponibles)));
    escribir('#subLibros', `ejemplares en ${entero.format(num(d.TitulosDisponibles))} título(s)`);
  }

  // ---------- Gráfica: libros más solicitados ----------
  const grafica = $('#grafica');

  function isoLocal(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function textoPeriodo() {
    const opcion = $('#periodo').value;
    if (opcion === '30') return 'últimos 30 días';
    if (opcion === '90') return 'últimos 90 días';
    if (opcion === '365') return 'último año';
    return 'todo el historial';
  }

  function pintarGrafica(libros) {
    if (libros.length === 0) {
      grafica.innerHTML = '<p class="vacio">Todavía no hay préstamos registrados en este periodo.</p>';
      return;
    }

    const valores = libros.map((l) => num(l.Prestamos));
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
      <p class="grafica-pie">Periodo: ${textoPeriodo()} · Préstamos de estos libros: ${total}</p>`;

    // Las barras crecen con una pequeña animación
    requestAnimationFrame(() => requestAnimationFrame(() => {
      grafica.querySelectorAll('.barra-g').forEach((barra) => {
        barra.style.height = barra.dataset.altura + '%';
      });
    }));
  }

  async function cargarGrafica() {
    if (!grafica) return;

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

  const periodo = $('#periodo');
  if (periodo) periodo.addEventListener('change', cargarGrafica);

  // Cada bloque va por separado: si uno falla, el otro sigue cargando
  cargarResumen().catch((err) => console.error('Resumen del inicio:', err));
  cargarGrafica().catch((err) => console.error('Gráfica del inicio:', err));
})();