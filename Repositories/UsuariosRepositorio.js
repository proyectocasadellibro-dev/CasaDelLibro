// repositorios/usuariosRepositorio.js
// Aquí SOLO se llaman procedimientos almacenados. Nada de lógica de HTTP.
const { pool } = require('../db');

// Devuelve la fila del procedimiento (Codigo, Mensaje, IdUsuario, NombreCompleto, Rol) o null
async function iniciarSesion(usuario, password) {
  const [resultados] = await pool.query('CALL sp_IniciarSesion(?, ?)', [usuario, password]);
  return resultados[0][0] || null;
}

module.exports = { iniciarSesion };