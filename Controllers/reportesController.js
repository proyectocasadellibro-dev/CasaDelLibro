// Controllers/reportesController.js
const reportesRepo = require('../Repositories/reportesRepositorio');

const TIPOS_MOVIMIENTO = ['Prestamos', 'Devoluciones', 'Incidencias'];
const ESTADOS_PRESTAMO = [
  'Pendientes', 'Activo', 'Vencido', 'Devuelto',
  'Incidencias', 'Devuelto con daños', 'Extraviado'
];

// Convierte 'AAAA-MM-DD' en una fecha válida. '' o undefined -> null. Formato inválido -> undefined.
function leerFecha(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;

  const fecha = new Date(valor + 'T00:00:00Z');
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) return undefined;
  return valor;
}

// Lee ?desde=&hasta= y valida el periodo. Devuelve { desde, hasta } o { error }.
function leerPeriodo(query) {
  const desde = leerFecha(query.desde);
  const hasta = leerFecha(query.hasta);

  if (desde === undefined || hasta === undefined) {
    return { error: 'Las fechas deben tener el formato AAAA-MM-DD.' };
  }
  if (desde && hasta && desde > hasta) {
    return { error: 'La fecha inicial no puede ser mayor que la fecha final.' };
  }
  return { desde, hasta };
}

function error500(res, texto, err) {
  console.error(texto, err.message);
  res.status(500).json({ ok: false, mensaje: 'Error en el servidor.' });
}

// GET /api/reportes/movimientos?desde=&hasta=&tipo=&q=
async function movimientos(req, res) {
  try {
    const periodo = leerPeriodo(req.query);
    if (periodo.error) return res.status(400).json({ ok: false, mensaje: periodo.error });

    const tipo = TIPOS_MOVIMIENTO.includes(req.query.tipo) ? req.query.tipo : null;
    const filas = await reportesRepo.movimientos({ ...periodo, tipo, termino: req.query.q });
    res.json({ ok: true, movimientos: filas });
  } catch (err) {
    error500(res, 'Error en reporte de movimientos:', err);
  }
}

// GET /api/reportes/prestamos?desde=&hasta=&estado=&q=
async function prestamos(req, res) {
  try {
    const periodo = leerPeriodo(req.query);
    if (periodo.error) return res.status(400).json({ ok: false, mensaje: periodo.error });

    const estado = ESTADOS_PRESTAMO.includes(req.query.estado) ? req.query.estado : null;
    const filas = await reportesRepo.prestamos({ ...periodo, estado, termino: req.query.q });
    res.json({ ok: true, prestamos: filas });
  } catch (err) {
    error500(res, 'Error en reporte de préstamos:', err);
  }
}

// GET /api/reportes/libros-mas-solicitados?desde=&hasta=&limite=10
async function librosMasSolicitados(req, res) {
  try {
    const periodo = leerPeriodo(req.query);
    if (periodo.error) return res.status(400).json({ ok: false, mensaje: periodo.error });

    let limite = 10;
    if (req.query.limite !== undefined && req.query.limite !== '') {
      limite = Number(req.query.limite);
      if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
        return res.status(400).json({ ok: false, mensaje: 'El límite debe ser un número de 1 a 100.' });
      }
    }

    const filas = await reportesRepo.librosMasSolicitados({ ...periodo, limite });
    res.json({ ok: true, libros: filas });
  } catch (err) {
    error500(res, 'Error en reporte de libros más solicitados:', err);
  }
}

// GET /api/reportes/adeudos?multa=5
async function adeudos(req, res) {
  try {
    let multaDia = null;
    if (req.query.multa !== undefined && req.query.multa !== '') {
      multaDia = Number(req.query.multa);
      if (!Number.isFinite(multaDia) || multaDia < 0 || multaDia > 100000) {
        return res.status(400).json({ ok: false, mensaje: 'La multa por día debe ser un número de 0 en adelante.' });
      }
    }

    const filas = await reportesRepo.lectoresConAdeudos({ multaDia });
    res.json({ ok: true, lectores: filas });
  } catch (err) {
    error500(res, 'Error en reporte de adeudos:', err);
  }
}

module.exports = { movimientos, prestamos, librosMasSolicitados, adeudos };