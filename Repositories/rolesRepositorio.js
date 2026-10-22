// Repositories/rolesRepositorio.js
const { pool } = require('../db');

async function listar() {
  const [resultados] = await pool.query('CALL sp_ListarRoles()');
  return resultados[0];
}

// idRol = 0 -> crea | idRol > 0 -> modifica
// Si el id no existe, el procedimiento devuelve Codigo = null.
async function guardar({ idRol, nombre, descripcion }) {
  const [resultados] = await pool.query(
    'CALL sp_GuardarRol(?, ?, ?)',
    [idRol, nombre ?? null, descripcion ?? null]
  );
  return resultados[0][0] || null;
}

module.exports = { listar, guardar };