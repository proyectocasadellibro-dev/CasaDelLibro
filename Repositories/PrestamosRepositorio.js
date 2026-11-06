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

// Registra la devolución con el estado del libro.
// condicion: 'Buen estado' | 'Con daños' | 'Extraviado'
// Devuelve { Codigo, Mensaje, DiasRetraso, Condicion } o null
async function devolver({ idPrestamo, condicion, observaciones, idUsuario }) {
  const [resultados] = await pool.query(
    'CALL sp_RegistrarDevolucion(?, ?, ?, ?)',
    [idPrestamo, condicion ?? null, observaciones ?? null, idUsuario]
  );
  return resultados[0][0] || null;
}

// estado: null | 'Pendientes' | 'Activo' | 'Vencido' | 'Devuelto'
//         | 'Incidencias' | 'Devuelto con daños' | 'Extraviado'
async function listar(termino, estado, idLector) {
  const [resultados] = await pool.query(
    'CALL sp_ListarPrestamos(?, ?, ?)',
    [termino ?? '', estado || null, idLector ?? null]
  );
  return resultados[0];
}

module.exports = { registrar, devolver, listar };