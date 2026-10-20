const librosRepo = require('../Repositories/LibrosRepositorio');
const { estadoHttp, leerId } = require('./helpers');

// POST /api/libros
// Body: { idLibro, isbn, titulo, autor, idCategoria, total }
//   idLibro = 0 (o sin enviar) -> crea
//   idLibro > 0                -> modifica; si no existe responde "no existe"
async function guardar(req, res) {
  try {
    const { idLibro, isbn, titulo, autor, idCategoria, total } = req.body || {};

    const id = leerId(idLibro);
    if (id === null) {
      return res.status(400).json({ ok: false, mensaje: 'El id del libro no es válido.' });
    }

    const fila = await librosRepo.guardar({
      idLibro: id,
      isbn,
      titulo,
      autor,
      idCategoria: idCategoria ? Number(idCategoria) : null,
      total: Number(total)
    });

    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo guardar el libro.' });
    }
    // La base de datos devolvió NULL: el id no existe
    if (fila.Codigo === null) {
      return res.status(404).json({ ok: false, mensaje: 'El libro no existe.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.status(id === 0 ? 201 : 200).json({
      ok: true,
      mensaje: fila.Mensaje,
      idLibro: fila.IdLibro
    });
  } catch (err) {
    console.error('Error al guardar libro:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// GET /api/libros/:id
async function obtener(req, res) {
  try {
    const id = leerId(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'El id del libro no es válido.' });
    }

    const libro = await librosRepo.obtenerPorId(id);
    if (!libro) {
      return res.status(404).json({ ok: false, mensaje: 'El libro no existe.' });
    }

    res.json({ ok: true, libro });
  } catch (err) {
    console.error('Error al consultar libro:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// GET /api/libros?q=texto&categoria=3
async function buscar(req, res) {
  try {
    const libros = await librosRepo.buscar(req.query.q, Number(req.query.categoria) || null);
    res.json({ ok: true, libros });
  } catch (err) {
    console.error('Error al buscar libros:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// GET /api/libros/disponibilidad?q=texto
async function disponibilidad(req, res) {
  try {
    const libros = await librosRepo.consultarDisponibilidad(req.query.q);
    res.json({ ok: true, libros });
  } catch (err) {
    console.error('Error al consultar disponibilidad:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// GET /api/categorias
async function categorias(req, res) {
  try {
    const lista = await librosRepo.listarCategorias();
    res.json({ ok: true, categorias: lista });
  } catch (err) {
    console.error('Error al listar categorías:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

module.exports = { guardar, obtener, buscar, disponibilidad, categorias };