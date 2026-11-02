// Repositories/prestamosRepositorio.js
// Aquí SOLO se llaman procedimientos almacenados. Nada de lógica de HTTP.
const { pool } = require('../db');

// Registra un préstamo. dias es opcional (por defecto 7 en el procedimiento).
// Devuelve { Codigo, Mensaje, IdPrestamo, FechaLimite } o null
async function registrar({ idLector, idLibro, idUsuario, dias }) {
  const [resultados] = await pool.query(
    'CALL sp_RegistrarPrestamo(?, ?, ?, ?)',
    [idLector, idLibro, idUsuario, dias ?? null]
  );
  return resultados[0][0] || null;
}

// Registra la devolución. Devuelve { Codigo, Mensaje, DiasRetraso } o null
async function devolver(idPrestamo) {
  const [resultados] = await pool.query('CALL sp_RegistrarDevolucion(?)', [idPrestamo]);
  return resultados[0][0] || null;
}

// estado: null | 'Pendientes' | 'Activo' | 'Vencido' | 'Devuelto'
async function listar(termino, estado, idLector) {
  const [resultados] = await pool.query(
    'CALL sp_ListarPrestamos(?, ?, ?)',
    [termino ?? '', estado || null, idLector ?? null]
  );
  return resultados[0];
}

module.exports = { registrar, devolver, listar };