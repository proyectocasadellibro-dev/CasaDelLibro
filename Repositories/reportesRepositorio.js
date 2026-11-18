// Repositories/reportesRepositorio.js
// Consultas de los reportes. Solo llama procedimientos almacenados.
// Las fechas llegan como texto 'AAAA-MM-DD' (o null = sin límite).
const { pool } = require('../db');

// tipo: null | 'Prestamos' | 'Devoluciones' | 'Incidencias'
async function movimientos({ desde, hasta, tipo, termino }) {
  const [resultados] = await pool.query(
    'CALL sp_ReporteMovimientos(?, ?, ?, ?)',
    [desde ?? null, hasta ?? null, tipo ?? null, termino ?? '']
  );
  return resultados[0];
}

// estado: null | 'Pendientes' | 'Activo' | 'Vencido' | 'Devuelto'
//         | 'Incidencias' | 'Devuelto con daños' | 'Extraviado'
async function prestamos({ desde, hasta, estado, termino }) {
  const [resultados] = await pool.query(
    'CALL sp_ReportePrestamos(?, ?, ?, ?)',
    [desde ?? null, hasta ?? null, estado ?? null, termino ?? '']
  );
  return resultados[0];
}

async function librosMasSolicitados({ desde, hasta, limite }) {
  const [resultados] = await pool.query(
    'CALL sp_ReporteLibrosMasSolicitados(?, ?, ?)',
    [desde ?? null, hasta ?? null, limite ?? null]
  );
  return resultados[0];
}

// multaDia: tarifa por día de retraso (null = la que trae el procedimiento)
async function lectoresConAdeudos({ multaDia }) {
  const [resultados] = await pool.query(
    'CALL sp_ReporteLectoresConAdeudos(?)',
    [multaDia ?? null]
  );
  return resultados[0];
}

module.exports = { movimientos, prestamos, librosMasSolicitados, lectoresConAdeudos };