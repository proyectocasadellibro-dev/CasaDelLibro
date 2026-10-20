// repositorios/lectoresRepositorio.js
const { pool } = require('../db');

// idLector = 0 -> crea | idLector > 0 -> modifica
// Si el id no existe, el procedimiento devuelve Codigo = null.
async function guardar({ idLector, matricula, nombre, correo, telefono }) {
  const [resultados] = await pool.query(
    'CALL sp_GuardarLector(?, ?, ?, ?, ?)',
    [idLector, matricula, nombre, correo ?? null, telefono ?? null]
  );
  return resultados[0][0] || null;
}

// Devuelve un lector o null si no existe
async function obtenerPorId(idLector) {
  const [resultados] = await pool.query('CALL sp_ConsultarLector(?)', [idLector]);
  return resultados[0][0] || null;
}

// Devuelve un arreglo (vacío si no hay coincidencias)
async function buscar(termino, estado) {
  const [resultados] = await pool.query(
    'CALL sp_BuscarLectores(?, ?)',
    [termino ?? '', estado || null]
  );
  return resultados[0];
}

// estado: 'Activo' | 'Suspendido' | 'Baja'
async function cambiarEstado(idLector, estado) {
  const [resultados] = await pool.query('CALL sp_CambiarEstadoLector(?, ?)', [idLector, estado]);
  return resultados[0][0] || null;
}

module.exports = { guardar, obtenerPorId, buscar, cambiarEstado };