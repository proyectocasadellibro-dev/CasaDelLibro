// Repositories/estadisticasRepositorio.js
// Números para el Inicio. Solo llama procedimientos almacenados.
const { pool } = require('../db');

// Devuelve { PrestamosActivos, PrestamosVencidos, LectoresRegistrados,
//            LectoresActivos, LibrosDisponibles, TitulosDisponibles } o null
async function resumenInicio() {
  const [resultados] = await pool.query('CALL sp_ResumenInicio()');
  return resultados[0][0] || null;
}

module.exports = { resumenInicio };