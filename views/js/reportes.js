// views/js/reportes.js
// Reportes: se hace una consulta y el botón "Generar reporte" crea el documento
// imprimible (o PDF) con exactamente lo que se está viendo en la tabla.
(async function () {
  const usuario = await iniciarPagina('reportes', ['Administrador', 'Gerente']);
  if (!usuario) return;

  const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  const num = (v) => Number(v) || 0;
  const suave = 'style="color:var(--texto-suave)"';
  const fecha = (v) => (v ? new Date(v).toLocaleDateString('es-MX') : '—');
  const fechaHora = (v) =>
    (v ? new Date(v).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const fechaIso = (iso) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };
  const textoOpcion = (selector) => $(selector).selectedOptions[0].textContent;

  function isoLocal(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // Cuenta cuántas filas cumplen una condición
  const contar = (filas, condicion) => filas.filter(condicion).length;

  // ---------- Definición de los reportes ----------
  // columnas: valor() = texto plano (se usa en el reporte impreso)
  //           html()  = versión con formato para la pantalla (opcional)
  const REPORTES = {
    movimientos: {
      titulo: 'Movimientos de préstamos',
      descripcion: 'Préstamos, devoluciones y reportes de libros dañados o extraviados dentro del periodo.',
      ruta: '/api/reportes/movimientos',
      clave: 'movimientos',
      filtros: ['desde', 'hasta', 'tipo', 'texto'],
      columnas: [
        { titulo: 'Fecha', valor: (f) => fechaHora(f.Fecha) },
        { titulo: 'Movimiento', valor: (f) => f.Movimiento, html: (f) => badge(f.Movimiento) },
        {
          titulo: 'Lector',
          valor: (f) => (f.Lector ? `${f.Lector} (${f.Matricula})` : '—'),
          html: (f) => (f.Lector
            ? `${esc(f.Lector)}<br><small ${suave}>${esc(f.Matricula)}</small>` : '—')
        },
        {
          titulo: 'Libro',
          valor: (f) => `${f.Libro} — ${f.Autor}`,
          html: (f) => `<strong>${esc(f.Libro)}</strong><br><small ${suave}>${esc(f.Autor)}</small>`
        },
        { titulo: 'Detalle', valor: (f) => f.Detalle || '—' }
      ],
      resumen: (filas) => [
        { etiqueta: 'Movimientos', valor: filas.length, clase: '' },
        { etiqueta: 'Préstamos', valor: contar(filas, (f) => f.Movimiento === 'Préstamo'), clase: 'verde' },
        { etiqueta: 'Devoluciones', valor: contar(filas, (f) => f.Movimiento.startsWith('Devolución')), clase: '' },
        {
          etiqueta: 'Con daños o extraviados',
          valor: contar(filas, (f) => /daños|extraviado|^Reporte/.test(f.Movimiento)),
          clase: 'rojo'
        }
      ]
    },

    prestamos: {
      titulo: 'Préstamos por periodo',
      descripcion: 'Préstamos realizados en el periodo, con su estado actual (según la fecha del préstamo).',
      ruta: '/api/reportes/prestamos',
      clave: 'prestamos',
      filtros: ['desde', 'hasta', 'estado', 'texto'],
      columnas: [
        { titulo: 'Fecha', valor: (f) => fecha(f.FechaPrestamo) },
        {
          titulo: 'Lector',
          valor: (f) => `${f.Lector} (${f.Matricula})`,
          html: (f) => `${esc(f.Lector)}<br><small ${suave}>${esc(f.Matricula)}</small>`
        },
        {
          titulo: 'Libro',
          valor: (f) => `${f.Libro} — ${f.Autor}`,
          html: (f) => `<strong>${esc(f.Libro)}</strong><br><small ${suave}>${esc(f.Autor)}</small>`
        },
        { titulo: 'Fecha límite', valor: (f) => fecha(f.FechaLimite) },
        { titulo: 'Devolución', valor: (f) => fecha(f.FechaDevolucion) },
        {
          titulo: 'Estado',
          valor: (f) => f.Estado + (num(f.DiasRetraso) > 0 ? ` · ${num(f.DiasRetraso)} día(s) de retraso` : ''),
          html: (f) => badge(f.Estado) + (num(f.DiasRetraso) > 0
            ? `<br><small style="color:var(--rojo)">${num(f.DiasRetraso)} día(s) de retraso</small>` : '')
        },
        { titulo: 'Registró', valor: (f) => f.RegistradoPor }
      ],
      resumen: (filas) => [
        { etiqueta: 'Préstamos en el periodo', valor: filas.length, clase: '' },
        { etiqueta: 'Vigentes', valor: contar(filas, (f) => f.Estado === 'Activo'), clase: 'verde' },
        { etiqueta: 'Vencidos', valor: contar(filas, (f) => f.Estado === 'Vencido'), clase: 'amarillo' },
        { etiqueta: 'Devueltos', valor: contar(filas, (f) => f.Estado === 'Devuelto'), clase: '' },
        {
          etiqueta: 'Con daños o extraviados',
          valor: contar(filas, (f) => f.Estado === 'Devuelto con daños' || f.Estado === 'Extraviado'),
          clase: 'rojo'
        }
      ]
    },

    libros: {
      titulo: 'Libros más solicitados',
      descripcion: 'Ranking de los libros con más préstamos en el periodo.',
      ruta: '/api/reportes/libros-mas-solicitados',
      clave: 'libros',
      filtros: ['desde', 'hasta', 'limite'],
      columnas: [
        { titulo: '#', valor: (f, i) => i + 1, num: true },
        {
          titulo: 'Libro',
          valor: (f) => `${f.Libro} — ${f.Autor}`,
          html: (f) => `<strong>${esc(f.Libro)}</strong><br><small ${suave}>${esc(f.Autor)}</small>`
        },
        { titulo: 'Categoría', valor: (f) => f.Categoria || '—' },
        { titulo: 'Préstamos', valor: (f) => num(f.Prestamos), num: true },
        { titulo: 'Lectores distintos', valor: (f) => num(f.Lectores), num: true },
        { titulo: 'Último préstamo', valor: (f) => fecha(f.UltimoPrestamo) }
      ],
      resumen: (filas) => [
        { etiqueta: 'Libros en el ranking', valor: filas.length, clase: '' },
        { etiqueta: 'Préstamos de estos libros', valor: filas.reduce((t, f) => t + num(f.Prestamos), 0), clase: 'verde' }
      ]
    },

    adeudos: {
      titulo: 'Préstamos vencidos y multas',
      descripcion: 'Lectores con préstamos vencidos que aún no han devuelto el libro, con una multa estimada.',
      ruta: '/api/reportes/adeudos',
      clave: 'lectores',
      filtros: ['multa'],
      nota: 'La multa es una estimación: días de retraso multiplicados por la tarifa por día indicada arriba. '
          + 'El sistema todavía no registra cobros de multas.',
      columnas: [
        {
          titulo: 'Lector',
          valor: (f) => `${f.Lector} (${f.Matricula} · ${f.Folio})`,
          html: (f) => `<strong>${esc(f.Lector)}</strong><br><small ${suave}>${esc(f.Matricula)} · ${esc(f.Folio)}</small>`
        },
        {
          titulo: 'Contacto',
          valor: (f) => [f.Correo, f.Telefono].filter(Boolean).join(' · ') || '—'
        },
        { titulo: 'Libros pendientes', valor: (f) => f.Libros },
        { titulo: 'Vencidos', valor: (f) => num(f.PrestamosVencidos), num: true },
        { titulo: 'Mayor retraso (días)', valor: (f) => num(f.MaxDiasRetraso), num: true },
        { titulo: 'Total días de retraso', valor: (f) => num(f.TotalDiasRetraso), num: true },
        { titulo: 'Multa estimada', valor: (f) => dinero.format(num(f.MultaEstimada)), num: true }
      ],
      resumen: (filas) => [
        { etiqueta: 'Lectores con adeudo', valor: filas.length, clase: '' },
        { etiqueta: 'Préstamos vencidos', valor: filas.reduce((t, f) => t + num(f.PrestamosVencidos), 0), clase: 'amarillo' },
        {
          etiqueta: 'Multa estimada total',
          valor: dinero.format(filas.reduce((t, f) => t + num(f.MultaEstimada), 0)),
          clase: 'rojo'
        }
      ]
    }
  };

  let actual = 'movimientos';
  let ultimo = null;   // la última consulta mostrada: de aquí sale el reporte

  // ---------- Filtros ----------
  function construirParametros(rep) {
    const p = new URLSearchParams();
    const f = rep.filtros;
    if (f.includes('desde') && $('#fDesde').value) p.set('desde', $('#fDesde').value);
    if (f.includes('hasta') && $('#fHasta').value) p.set('hasta', $('#fHasta').value);
    if (f.includes('tipo') && $('#fTipo').value) p.set('tipo', $('#fTipo').value);
    if (f.includes('estado') && $('#fEstado').value) p.set('estado', $('#fEstado').value);
    if (f.includes('texto') && $('#fTexto').value.trim()) p.set('q', $('#fTexto').value.trim());
    if (f.includes('limite') && $('#fLimite').value) p.set('limite', $('#fLimite').value);
    if (f.includes('multa') && $('#fMulta').value !== '') p.set('multa', $('#fMulta').value);
    return p;
  }

  // Frases que describen la consulta; salen en el encabezado del reporte
  function describirFiltros(rep) {
    const f = rep.filtros;
    const d = [];

    if (f.includes('desde') || f.includes('hasta')) {
      const desde = $('#fDesde').value;
      const hasta = $('#fHasta').value;
      if (desde && hasta) d.push(`Periodo: del ${fechaIso(desde)} al ${fechaIso(hasta)}`);
      else if (desde) d.push(`Periodo: desde el ${fechaIso(desde)}`);
      else if (hasta) d.push(`Periodo: hasta el ${fechaIso(hasta)}`);
      else d.push('Periodo: todo el historial');
    }
    if (f.includes('tipo') && $('#fTipo').value) d.push('Movimiento: ' + textoOpcion('#fTipo'));
    if (f.includes('estado') && $('#fEstado').value) d.push('Estado: ' + textoOpcion('#fEstado'));
    if (f.includes('texto') && $('#fTexto').value.trim()) d.push(`Búsqueda: "${$('#fTexto').value.trim()}"`);
    if (f.includes('limite')) d.push('Se muestran los primeros ' + $('#fLimite').value + ' libros');
    if (f.includes('multa')) d.push('Multa por día de retraso: ' + dinero.format(num($('#fMulta').value)));
    return d;
  }

  // ---------- Pantalla ----------
  function pintar() {
    const rep = REPORTES[actual];

    $('#resumen').innerHTML = ultimo
      ? ultimo.resumen.map((r) => `<div class="dato ${r.clase}">
          <div class="numero">${esc(r.valor)}</div><div class="etiqueta">${esc(r.etiqueta)}</div></div>`).join('')
      : '';

    $('#theadTabla').innerHTML = '<tr>' + rep.columnas
      .map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.titulo)}</th>`).join('') + '</tr>';

    const filas = ultimo ? ultimo.filas : [];
    $('#cuerpo').innerHTML = filas.map((f, i) => '<tr>' + rep.columnas.map((c) => {
      const contenido = c.html ? c.html(f, i) : esc(c.valor(f, i));
      return `<td class="${c.num ? 'num' : ''}${c.html ? '' : ' ancho'}">${contenido}</td>`;
    }).join('') + '</tr>').join('');

    $('#vacio').hidden = !ultimo || filas.length > 0;
    $('#nota').hidden = !rep.nota;
    $('#nota').textContent = rep.nota || '';
    $('#btnGenerar').disabled = !ultimo || filas.length === 0;
  }

  async function consultar() {
    const clave = actual;
    const rep = REPORTES[clave];

    const desde = $('#fDesde').value;
    const hasta = $('#fHasta').value;
    if (rep.filtros.includes('desde') && desde && hasta && desde > hasta) {
      toast('La fecha inicial no puede ser mayor que la fecha final.', 'error');
      return;
    }

    $('#btnConsultar').disabled = true;
    const r = await api(rep.ruta + '?' + construirParametros(rep).toString());
    $('#btnConsultar').disabled = false;

    if (clave !== actual) return;   // se cambió de pestaña mientras cargaba

    if (!r.ok) {
      toast(r.mensaje || 'No se pudo hacer la consulta.', 'error');
      return;
    }

    const filas = r[rep.clave] || [];
    ultimo = {
      titulo: rep.titulo,
      columnas: rep.columnas,
      filas,
      resumen: rep.resumen(filas),
      filtros: describirFiltros(rep),
      nota: rep.nota || ''
    };
    pintar();
  }

  function cambiarPestana(clave) {
    actual = clave;
    ultimo = null;

    document.querySelectorAll('.pestana').forEach((b) =>
      b.classList.toggle('activa', b.dataset.reporte === clave));

    const rep = REPORTES[clave];
    $('#descripcion').textContent = rep.descripcion;
    document.querySelectorAll('label[data-filtro]').forEach((l) => {
      l.hidden = !rep.filtros.includes(l.dataset.filtro);
    });

    pintar();
    consultar();
  }

  // ---------- Generar el reporte (ventana imprimible / PDF) ----------
  function htmlReporte(rep) {
    const encabezados = rep.columnas
      .map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.titulo)}</th>`).join('');

    const filas = rep.filas.map((f, i) => '<tr>' + rep.columnas
      .map((c) => `<td class="${c.num ? 'num' : ''}">${esc(c.valor(f, i))}</td>`).join('') + '</tr>').join('');

    const resumen = rep.resumen
      .map((r) => `<div class="r"><b>${esc(r.valor)}</b><span>${esc(r.etiqueta)}</span></div>`).join('');

    const filtros = rep.filtros.map((t) => `<div>${esc(t)}</div>`).join('');
    const generado = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(rep.titulo)} · La Casa Del Libro</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #2b2326; margin: 0; padding: 24px; font-size: 12px; }
  .cab { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
         border-bottom: 3px solid #8e1f43; padding-bottom: 10px; margin-bottom: 14px; }
  .marca { font-size: 13px; font-weight: 700; color: #8e1f43; }
  h1 { margin: 2px 0 0; font-size: 22px; }
  .meta { font-size: 11px; color: #6d6266; line-height: 1.55; text-align: right; }
  .consulta { font-size: 11.5px; line-height: 1.6; margin-bottom: 4px; }
  .consulta div::before { content: "• "; color: #8e1f43; }
  .resumen { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
  .r { border: 1px solid #d9d0cc; border-radius: 6px; padding: 8px 14px; min-width: 130px; }
  .r b { display: block; font-size: 18px; }
  .r span { color: #6d6266; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #d9d0cc; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: #f3eeec; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
  td.num, th.num { text-align: right; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .nota { margin-top: 10px; font-size: 10.5px; color: #6d6266; }
  .pie { margin-top: 14px; font-size: 10.5px; color: #6d6266; }
  .acciones { margin-bottom: 14px; }
  .acciones button { font: inherit; padding: 8px 16px; border-radius: 6px; border: 1px solid #8e1f43;
                     background: #8e1f43; color: #fff; cursor: pointer; font-weight: 600; }
  @media print { .acciones { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="acciones">
    <button type="button" onclick="window.print()">Imprimir o guardar como PDF</button>
  </div>
  <div class="cab">
    <div>
      <div class="marca">📚 La Casa Del Libro · Sistema de registros bibliotecaria</div>
      <h1>${esc(rep.titulo)}</h1>
    </div>
    <div class="meta">Generado el ${esc(generado)}<br>Por: ${esc(usuario.nombre)} (${esc(usuario.rol)})</div>
  </div>
  <div class="consulta">${filtros}</div>
  <div class="resumen">${resumen}</div>
  <table>
    <thead><tr>${encabezados}</tr></thead>
    <tbody>${filas}</tbody>
  </table>
  ${rep.nota ? `<div class="nota">${esc(rep.nota)}</div>` : ''}
  <div class="pie">Total de registros en este reporte: ${rep.filas.length}</div>
  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });
  <\/script>
</body>
</html>`;
  }

  function generarReporte() {
    if (!ultimo || ultimo.filas.length === 0) return;

    // La ventana se abre aquí, al hacer clic, para que el navegador no la bloquee
    const ventana = window.open('', '_blank');
    if (!ventana) {
      toast('El navegador bloqueó la ventana del reporte. Permite las ventanas emergentes de este sitio.', 'error');
      return;
    }
    ventana.document.write(htmlReporte(ultimo));
    ventana.document.close();
  }

  // ---------- Eventos ----------
  document.querySelectorAll('.pestana').forEach((b) =>
    b.addEventListener('click', () => cambiarPestana(b.dataset.reporte)));
  $('#btnConsultar').addEventListener('click', consultar);
  $('#btnGenerar').addEventListener('click', generarReporte);
  $('#fTexto').addEventListener('keydown', (e) => { if (e.key === 'Enter') consultar(); });

  // Periodo inicial: del primer día del mes actual a hoy
  const hoy = new Date();
  $('#fDesde').value = isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  $('#fHasta').value = isoLocal(hoy);

  cambiarPestana('movimientos');
})();