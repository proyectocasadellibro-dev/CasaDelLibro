// Repositories/incidenciasRepositorio.js
// Libros dañados o extraviados.
const { pool } = require('../db');

// Reporta ejemplares dañados o extraviados que estaban en la biblioteca.
// tipo: 'Dañado' | 'Extraviado'
// Devuelve { Codigo, Mensaje, IdIncidencia } o null
async function registrar({ idLibro, tipo, cantidad, observaciones, idUsuario }) {
  const [resultados] = await pool.query(
    'CALL sp_ReportarIncidenciaLibro(?, ?, ?, ?, ?)',
    [idLibro, tipo, cantidad ?? 1, observaciones ?? null, idUsuario]
  );
  return resultados[0][0] || null;
}

// tipo opcional: 'Dañado' | 'Extraviado'
async function listar(termino, tipo) {
  const [resultados] = await pool.query(
    'CALL sp_ListarIncidencias(?, ?)',
    [termino ?? '', tipo || null]
  );
  return resultados[0];
}

module.exports = { registrar, listar };