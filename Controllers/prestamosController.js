// Controllers/prestamosController.js
const prestamosRepo = require('../Repositories/prestamosRepositorio');
const { estadoHttp, leerId } = require('./helpers');

const ESTADOS_VALIDOS = ['Pendientes', 'Activo', 'Vencido', 'Devuelto'];

// GET /api/prestamos?q=texto&estado=Pendientes&lector=3
async function listar(req, res) {
  try {
    const estado = ESTADOS_VALIDOS.includes(req.query.estado) ? req.query.estado : null;
    const idLector = Number(req.query.lector) || null;

    const prestamos = await prestamosRepo.listar(req.query.q, estado, idLector);
    res.json({ ok: true, prestamos });
  } catch (err) {
    console.error('Error al listar préstamos:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// POST /api/prestamos
// Body: { idLector, idLibro, dias }   (dias es opcional, de 1 a 30; por defecto 7)
// El empleado que registra el préstamo sale de la sesión.
async function registrar(req, res) {
  try {
    const { idLector, idLibro, dias } = req.body || {};

    const lectorId = leerId(idLector);
    const libroId = leerId(idLibro);
    if (!lectorId || !libroId) {
      return res.status(400).json({ ok: false, mensaje: 'Selecciona un lector y un libro.' });
    }

    let plazo = null;
    if (dias !== undefined && dias !== null && dias !== '') {
      plazo = Number(dias);
      if (!Number.isInteger(plazo) || plazo < 1 || plazo > 30) {
        return res.status(400).json({ ok: false, mensaje: 'El plazo debe ser de 1 a 30 días.' });
      }
    }

    const fila = await prestamosRepo.registrar({
      idLector: lectorId,
      idLibro: libroId,
      idUsuario: req.session.usuario.id,
      dias: plazo
    });

    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo registrar el préstamo.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.status(201).json({
      ok: true,
      mensaje: fila.Mensaje,
      idPrestamo: fila.IdPrestamo,
      fechaLimite: fila.FechaLimite
    });
  } catch (err) {
    console.error('Error al registrar préstamo:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

// PATCH /api/prestamos/:id/devolucion
async function devolver(req, res) {
  try {
    const id = leerId(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, mensaje: 'El id del préstamo no es válido.' });
    }

    const fila = await prestamosRepo.devolver(id);
    if (!fila) {
      return res.status(500).json({ ok: false, mensaje: 'No se pudo registrar la devolución.' });
    }
    if (fila.Codigo !== 0) {
      return res.status(estadoHttp(fila.Codigo)).json({ ok: false, mensaje: fila.Mensaje });
    }

    res.json({ ok: true, mensaje: fila.Mensaje, diasRetraso: fila.DiasRetraso });
  } catch (err) {
    console.error('Error al registrar devolución:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
  }
}

module.exports = { listar, registrar, devolver };