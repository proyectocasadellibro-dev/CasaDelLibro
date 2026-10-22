// Controllers/usuariosController.js
const usuariosRepo = require('../Repositories/usuariosRepositorio');
const { estadoHttp, leerId } = require('./helpers');

// GET /api/usuarios?q=texto&rol=2&estado=1     (estado: 1 activos, 0 inactivos)
async function listar(req, res) {
  try {
    const idRol = Number(req.query.rol) || null;
    const activo = req.query.estado === '1' ? 1 : req.query.estado === '0' ? 0 : null;

    const usuarios = await usuariosRepo.listar(req.query.q, idRol, activo);
    res.json({ ok: true, usuarios });
  } catch (err) {
    console.error('Error al listar usuarios:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// GET /api/usuarios/:id
async function obtener(req, res) {
  try {
    const id = leerId(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'El id del usuario no es válido.' });
    }

    const usuario = await usuariosRepo.obtenerPorId(id);
    if (!usuario) {
      return res.status(404).json({ ok: false, mensaje: 'El usuario no existe.' });
    }

    res.json({ ok: true, usuario });
  } catch (err) {
    console.error('Error al consultar usuario:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// POST /api/usuarios
// Body: { idUsuario, idRol, nombreCompleto, usuario, correo, password }
//   idUsuario = 0 (o sin enviar) -> crea
//   idUsuario > 0                -> modifica; si no existe responde "no existe"
async function guardar(req, res) {
  try {
    const { idUsuario, idRol, nombreCompleto, usuario, correo, password } = req.body || {};

    const id = leerId(idUsuario);
    if (id === null) {
      return res.status(400).json({ ok: false, mensaje: 'El id del usuario no es válido.' });
    }

    const rolId = Number(idRol);
    if (!Number.isInteger(rolId) || rolId <= 0) {
      return res.status(400).json({ ok: false, mensaje: 'Selecciona un rol.' });
    }

    const fila = await usuariosRepo.guardar({
      idUsuario: id,
      idRol: rolId,
      nombreCompleto,
      usuario,
      correo,
      password
    });

    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo guardar el usuario.' });
    }
    // La base de datos devolvió NULL: el id no existe
    if (fila.Codigo === null) {
      return res.status(404).json({ ok: false, mensaje: 'El usuario no existe.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.status(id === 0 ? 201 : 200).json({
      ok: true,
      mensaje: fila.Mensaje,
      idUsuario: fila.IdUsuario
    });
  } catch (err) {
    console.error('Error al guardar usuario:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// PATCH /api/usuarios/:id/estado    Body: { activo: 1 | 0 }
async function cambiarEstado(req, res) {
  try {
    const id = leerId(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'El id del usuario no es válido.' });
    }

    const activo = Number((req.body || {}).activo);
    if (![0, 1].includes(activo)) {
      return res.status(400).json({ ok: false, mensaje: 'Estado inválido.' });
    }

    // Nadie puede desactivar su propia cuenta
    if (activo === 0 && req.session.usuario && req.session.usuario.id === id) {
      return res.status(409).json({ ok: false, mensaje: 'No puedes desactivar tu propia cuenta.' });
    }

    const fila = await usuariosRepo.cambiarEstado(id, activo);
    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo cambiar el estado.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.json({ ok: true, mensaje: fila.Mensaje });
  } catch (err) {
    console.error('Error al cambiar estado del usuario:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

module.exports = { listar, obtener, guardar, cambiarEstado };