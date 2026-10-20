// repositorios/librosRepositorio.js
const { pool } = require('../db');

// idLibro = 0 -> crea | idLibro > 0 -> modifica
// Si el id no existe, el procedimiento devuelve Codigo = null.
async function guardar({ idLibro, isbn, titulo, autor, idCategoria, total }) {
  const [resultados] = await pool.query(
    'CALL sp_GuardarLibro(?, ?, ?, ?, ?, ?)',
    [idLibro, isbn ?? null, titulo, autor, idCategoria ?? null, total]
  );
  return resultados[0][0] || null;
}

// Devuelve un libro o null si no existe
async function obtenerPorId(idLibro) {
  const [resultados] = await pool.query('CALL sp_ConsultarLibro(?)', [idLibro]);
  return resultados[0][0] || null;
}

// Busca por título, autor, categoría o ISBN. idCategoria es opcional.
async function buscar(termino, idCategoria) {
  const [resultados] = await pool.query(
    'CALL sp_BuscarLibros(?, ?)',
    [termino ?? '', idCategoria || null]
  );
  return resultados[0];
}

// Disponible / Prestado / No disponible
async function consultarDisponibilidad(termino) {
  const [resultados] = await pool.query('CALL sp_ConsultarDisponibilidad(?)', [termino ?? '']);
  return resultados[0];
}

async function listarCategorias() {
  const [resultados] = await pool.query('CALL sp_ListarCategorias()');
  return resultados[0];
}

module.exports = { guardar, obtenerPorId, buscar, consultarDisponibilidad, listarCategorias };
