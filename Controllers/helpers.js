// controller/helpers.js

// Convierte el Codigo que devuelve la base de datos en un estado HTTP
function estadoHttp(codigo) {
  const tabla = { 1: 400, 2: 404, 3: 409, 4: 409 };
  return tabla[codigo] || 500;
}

// Convierte el id recibido en número. Devuelve null si no es un entero >= 0
function leerId(valor, porDefecto = 0) {
  const n = Number(valor ?? porDefecto);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

module.exports = { estadoHttp, leerId };