// Controllers/incidenciasController.js
// Libros dañados o extraviados.
const incidenciasRepo = require('../Repositories/incidenciasRepositorio');
const { estadoHttp, leerId } = require('./helpers');

const TIPOS = ['Dañado', 'Extraviado'];

// GET /api/incidencias?q=texto&tipo=Dañado
async function listar(req, res) {
  try {
    const tipo = TIPOS.includes(req.query.tipo) ? req.query.tipo : null;
    const incidencias = await incidenciasRepo.listar(req.query.q, tipo);
    res.json({ ok: true, incidencias });
  } catch (err) {
    console.error('Error al listar incidencias:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// POST /api/incidencias
// Body: { idLibro, tipo, cantidad, observaciones }
// Para ejemplares que están en la biblioteca. Los que tenía un lector se reportan
// al registrar su devolución.
async function registrar(req, res) {
  try {
    const { idLibro, tipo, cantidad, observaciones } = req.body || {};

    const libroId = leerId(idLibro);
    if (!libroId) {
      return res.status(400).json({ ok: false, mensaje: 'Selecciona un libro.' });
    }
    if (!TIPOS.includes(tipo)) {
      return res.status(400).json({ ok: false, mensaje: 'El tipo debe ser Dañado o Extraviado.' });
    }

    const piezas = cantidad === undefined || cantidad === '' ? 1 : Number(cantidad);
    if (!Number.isInteger(piezas) || piezas < 1) {
      return res.status(400).json({ ok: false, mensaje: 'La cantidad debe ser de al menos 1.' });
    }
    if (observaciones && String(observaciones).length > 300) {
      return res.status(400).json({ ok: false, mensaje: 'Las observaciones no pueden tener más de 300 caracteres.' });
    }

    const fila = await incidenciasRepo.registrar({
      idLibro: libroId,
      tipo,
      cantidad: piezas,
      observaciones: observaciones ? String(observaciones) : null,
      idUsuario: req.session.usuario.id
    });

    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo registrar el reporte.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.status(201).json({ ok: true, mensaje: fila.Mensaje, idIncidencia: fila.IdIncidencia });
  } catch (err) {
    console.error('Error al registrar incidencia:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

module.exports = { listar, registrar };