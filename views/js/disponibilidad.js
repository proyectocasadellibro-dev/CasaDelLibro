// views/js/disponibilidad.js
(async function () {
  const usuario = await iniciarPagina('disponibilidad');
  if (!usuario) return;

  let libros = [];   // resultado de la última búsqueda

  function filaHtml(b) {
    return `<tr>
      <td class="ancho"><strong>${esc(b.Titulo)}</strong></td>
      <td class="ancho">${esc(b.Autor)}</td>
      <td>${esc(b.Categoria || '—')}</td>
      <td class="num">${b.TotalEjemplares}</td>
      <td class="num">${b.EjemplaresDisponibles}</td>
      <td class="num">${b.EjemplaresPrestados}</td>
      <td>${badge(b.EstadoDisponibilidad)}</td>
    </tr>`;
  }

  function pintar() {
    // El resumen cuenta todos los resultados de la búsqueda de texto
    const cuenta = { 'Disponible': 0, 'Prestado': 0, 'No disponible': 0 };
    libros.forEach((b) => { cuenta[b.EstadoDisponibilidad] = (cuenta[b.EstadoDisponibilidad] || 0) + 1; });
    $('#cntDisponible').textContent = cuenta['Disponible'];
    $('#cntPrestado').textContent = cuenta['Prestado'];
    $('#cntNoDisponible').textContent = cuenta['No disponible'];

    // La tabla además aplica el filtro de estado
    const filtro = $('#filtroEstado').value;
    const visibles = filtro ? libros.filter((b) => b.EstadoDisponibilidad === filtro) : libros;

    $('#cuerpo').innerHTML = visibles.map(filaHtml).join('');
    $('#vacio').hidden = visibles.length > 0;
  }

  async function cargar() {
    const texto = $('#buscar').value.trim();
    const parametros = new URLSearchParams();
    if (texto) parametros.set('q', texto);

    const r = await api('/api/libros/disponibilidad?' + parametros.toString());
    if (!r.ok) {
      toast(r.mensaje || 'No se pudo consultar la disponibilidad.', 'error');
      return;
    }
    libros = r.libros;
    pintar();
  }

  $('#buscar').addEventListener('input', debounce(cargar));
  $('#filtroEstado').addEventListener('change', pintar);

  cargar();
})();