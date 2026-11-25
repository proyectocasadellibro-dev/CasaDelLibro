// Controllers/estadisticasController.js
const estadisticasRepo = require('../Repositories/estadisticasRepositorio');

// GET /api/estadisticas/resumen
async function resumen(req, res) {
  try {
    const fila = await estadisticasRepo.resumenInicio();
    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo calcular el resumen.' });
    }
    res.json({ ok: true, resumen: fila });
  } catch (err) {
    console.error('Error al calcular el resumen del inicio:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

module.exports = { resumen };