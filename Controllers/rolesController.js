// Controllers/rolesController.js
const rolesRepo = require('../Repositories/rolesRepositorio');
const { estadoHttp, leerId } = require('./helpers');

// GET /api/roles
async function listar(req, res) {
  try {
    const roles = await rolesRepo.listar();
    res.json({ ok: true, roles });
  } catch (err) {
    console.error('Error al listar roles:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// POST /api/roles
// Body: { idRol, nombre, descripcion }
//   idRol = 0 (o sin enviar) -> crea
//   idRol > 0                -> modifica; si no existe responde "no existe"
async function guardar(req, res) {
  try {
    const { idRol, nombre, descripcion } = req.body || {};

    const id = leerId(idRol);
    if (id === null) {
      return res.status(400).json({ ok: false, mensaje: 'El id del rol no es válido.' });
    }

    const fila = await rolesRepo.guardar({ idRol: id, nombre, descripcion });

    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo guardar el rol.' });
    }
    // La base de datos devolvió NULL: el id no existe
    if (fila.Codigo === null) {
      return res.status(404).json({ ok: false, mensaje: 'El rol no existe.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.status(id === 0 ? 201 : 200).json({
      ok: true,
      mensaje: fila.Mensaje,
      idRol: fila.IdRol
    });
  } catch (err) {
    console.error('Error al guardar rol:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

module.exports = { listar, guardar };