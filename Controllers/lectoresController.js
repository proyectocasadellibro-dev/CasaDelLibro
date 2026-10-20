// controller/lectoresController.js
const lectoresRepo = require('../Repositories/LectoresRepositorio');
const { estadoHttp, leerId } = require('./helpers');

// POST /api/lectores
// Body: { idLector, matricula, nombre, correo, telefono }
//   idLector = 0 (o sin enviar) -> crea
//   idLector > 0                -> modifica; si no existe responde "no existe"
async function guardar(req, res) {
  try {
    const { idLector, matricula, nombre, correo, telefono } = req.body || {};

    const id = leerId(idLector);
    if (id === null) {
      return res.status(400).json({ ok: false, mensaje: 'El id del lector no es válido.' });
    }

    const fila = await lectoresRepo.guardar({ idLector: id, matricula, nombre, correo, telefono });

    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo guardar el lector.' });
    }
    // La base de datos devolvió NULL: el id no existe
    if (fila.Codigo === null) {
      return res.status(404).json({ ok: false, mensaje: 'El lector no existe.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.status(id === 0 ? 201 : 200).json({
      ok: true,
      mensaje: fila.Mensaje,
      idLector: fila.IdLector,
      folio: fila.Folio
    });
  } catch (err) {
    console.error('Error al guardar lector:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// GET /api/lectores/:id
async function obtener(req, res) {
  try {
    const id = leerId(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'El id del lector no es válido.' });
    }

    const lector = await lectoresRepo.obtenerPorId(id);
    if (!lector) {
      return res.status(404).json({ ok: false, mensaje: 'El lector no existe.' });
    }

    res.json({ ok: true, lector });
  } catch (err) {
    console.error('Error al consultar lector:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// GET /api/lectores?q=texto&estado=Activo
async function buscar(req, res) {
  try {
    const lectores = await lectoresRepo.buscar(req.query.q, req.query.estado);
    res.json({ ok: true, lectores });
  } catch (err) {
    console.error('Error al buscar lectores:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// PATCH /api/lectores/:id/estado    Body: { estado: 'Activo' | 'Suspendido' | 'Baja' }
async function cambiarEstado(req, res) {
  try {
    const id = leerId(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'El id del lector no es válido.' });
    }

    const fila = await lectoresRepo.cambiarEstado(id, (req.body || {}).estado);
    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo cambiar el estado.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.json({ ok: true, mensaje: fila.Mensaje });
  } catch (err) {
    console.error('Error al cambiar estado del lector:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

module.exports = { guardar, obtener, buscar, cambiarEstado };