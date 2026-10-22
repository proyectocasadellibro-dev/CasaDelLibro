// Repositories/usuariosRepositorio.js
// Aquí SOLO se llaman procedimientos almacenados. Nada de lógica de HTTP.
const { pool } = require('../db');

// Devuelve la fila del procedimiento (Codigo, Mensaje, IdUsuario, NombreCompleto, Rol) o null
async function iniciarSesion(usuario, password) {
  const [resultados] = await pool.query('CALL sp_IniciarSesion(?, ?)', [usuario, password]);
  return resultados[0][0] || null;
}

// Arreglo de usuarios (vacío si no hay coincidencias). idRol y activo son opcionales.
async function listar(termino, idRol, activo) {
  const [resultados] = await pool.query(
    'CALL sp_ListarUsuarios(?, ?, ?)',
    [termino ?? '', idRol ?? null, activo ?? null]
  );
  return resultados[0];
}

// Devuelve un usuario o null si no existe
async function obtenerPorId(idUsuario) {
  const [resultados] = await pool.query('CALL sp_ConsultarUsuario(?)', [idUsuario]);
  return resultados[0][0] || null;
}

// idUsuario = 0 -> crea | idUsuario > 0 -> modifica (password vacío = no se cambia)
// Si el id no existe, el procedimiento devuelve Codigo = null.
async function guardar({ idUsuario, idRol, nombreCompleto, usuario, correo, password }) {
  const [resultados] = await pool.query(
    'CALL sp_GuardarUsuario(?, ?, ?, ?, ?, ?)',
    [idUsuario, idRol, nombreCompleto ?? null, usuario ?? null, correo ?? null, password ?? null]
  );
  return resultados[0][0] || null;
}

// activo: 1 = activar, 0 = desactivar
async function cambiarEstado(idUsuario, activo) {
  const [resultados] = await pool.query('CALL sp_CambiarEstadoUsuario(?, ?)', [idUsuario, activo]);
  return resultados[0][0] || null;
}

module.exports = { iniciarSesion, listar, obtenerPorId, guardar, cambiarEstado };