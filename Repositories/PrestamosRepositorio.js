const { pool } = require('../db');

// Consultar préstamos activos e historial.
async function buscar(termino = '', estado = '') {
  const condiciones = [];
  const valores = [];

  if (termino) {
    condiciones.push(
      '(l.nombre LIKE ? OR b.titulo LIKE ? OR CAST(p.id_prestamo AS CHAR) LIKE ?)'
    );
    valores.push(`%${termino}%`, `%${termino}%`, `%${termino}%`);
  }

  if (estado === 'Activo') {
    condiciones.push(
      "p.estado = 'Activo' AND p.fecha_limite >= NOW()"
    );
  } else if (estado === 'Vencido') {
    condiciones.push(
      "p.estado = 'Activo' AND p.fecha_limite < NOW()"
    );
  } else if (estado === 'Devuelto') {
    condiciones.push("p.estado = 'Devuelto'");
  }

  const where = condiciones.length
    ? `WHERE ${condiciones.join(' AND ')}`
    : '';

  const [filas] = await pool.query(`
    SELECT
      p.id_prestamo AS IdPrestamo,
      p.id_lector AS IdLector,
      p.id_libro AS IdLibro,
      p.fecha_prestamo AS FechaPrestamo,
      p.fecha_limite AS FechaLimite,
      p.fecha_devolucion AS FechaDevolucion,
      p.estado AS Estado,
      l.nombre AS Lector,
      l.matricula AS Matricula,
      b.titulo AS Libro,
      b.estado AS EstadoLibro,
      CASE
        WHEN p.estado = 'Activo'
          AND p.fecha_limite < NOW()
        THEN 'Vencido'
        ELSE p.estado
      END AS EstadoVisible
    FROM prestamos p
    INNER JOIN lectores l
      ON l.id_lector = p.id_lector
    INNER JOIN libros b
      ON b.id_libro = p.id_libro
    ${where}
    ORDER BY
      CASE WHEN p.estado = 'Activo' THEN 0 ELSE 1 END,
      p.fecha_limite ASC,
      p.fecha_prestamo DESC
  `, valores);

  return filas;
}

// Obtener lectores y libros para los formularios.
async function opciones() {
  const [lectores] = await pool.query(`
    SELECT
      id_lector AS IdLector,
      nombre AS Nombre,
      matricula AS Matricula
    FROM lectores
    WHERE estado = 'Activo'
    ORDER BY nombre
  `);

  const [libros] = await pool.query(`
    SELECT
      id_libro AS IdLibro,
      titulo AS Titulo,
      autor AS Autor,
      ejemplares_disponibles AS Disponibles
    FROM libros
    WHERE estado = 'Disponible'
      AND ejemplares_disponibles > 0
    ORDER BY titulo
  `);

  return { lectores, libros };
}

// Registrar préstamo y descontar un ejemplar.
async function registrar({
  idLector,
  idLibro,
  idUsuario,
  fechaLimite
}) {
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    const [lectores] = await conexion.query(
      `SELECT id_lector
       FROM lectores
       WHERE id_lector = ? AND estado = 'Activo'
       FOR UPDATE`,
      [idLector]
    );

    if (!lectores.length) {
      throw new Error('El lector no existe o no está activo.');
    }

    const [libros] = await conexion.query(
      `SELECT id_libro, ejemplares_disponibles, estado
       FROM libros
       WHERE id_libro = ?
       FOR UPDATE`,
      [idLibro]
    );

    if (!libros.length) {
      throw new Error('El libro seleccionado no existe.');
    }

    if (
      libros[0].estado !== 'Disponible' ||
      libros[0].ejemplares_disponibles < 1
    ) {
      throw new Error(
        'No hay ejemplares disponibles para préstamo.'
      );
    }

    const [duplicado] = await conexion.query(
      `SELECT id_prestamo
       FROM prestamos
       WHERE id_lector = ?
         AND id_libro = ?
         AND estado = 'Activo'
       LIMIT 1
       FOR UPDATE`,
      [idLector, idLibro]
    );

    if (duplicado.length) {
      throw new Error(
        'Este lector ya tiene ese libro prestado.'
      );
    }

    const [usuario] = await conexion.query(
      `SELECT id_usuario
       FROM usuarios_sistema
       WHERE id_usuario = ? AND activo = 1`,
      [idUsuario]
    );

    if (!usuario.length) {
      throw new Error(
        'La sesión no corresponde a un usuario activo.'
      );
    }

    const fecha = `${fechaLimite} 23:59:59`;

    const [insertado] = await conexion.query(
      `INSERT INTO prestamos
       (id_lector, id_libro, id_usuario,
        fecha_prestamo, fecha_limite, estado)
       VALUES (?, ?, ?, NOW(), ?, 'Activo')`,
      [idLector, idLibro, idUsuario, fecha]
    );

    await conexion.query(
      `UPDATE libros
       SET ejemplares_disponibles =
           ejemplares_disponibles - 1
       WHERE id_libro = ?`,
      [idLibro]
    );

    await conexion.commit();

    return insertado.insertId;

  } catch (error) {
    await conexion.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error(
        'Este lector ya tiene ese libro prestado.'
      );
    }

    throw error;

  } finally {
    conexion.release();
  }
}

// Registrar devolución y actualizar disponibilidad.
async function devolver(idPrestamo) {
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    const [filas] = await conexion.query(
      `SELECT id_prestamo, id_libro, estado
       FROM prestamos
       WHERE id_prestamo = ?
       FOR UPDATE`,
      [idPrestamo]
    );

    if (!filas.length) {
      throw new Error('No se encontró el préstamo.');
    }

    if (filas[0].estado !== 'Activo') {
      throw new Error(
        'Este préstamo ya fue devuelto o no está activo.'
      );
    }

    await conexion.query(
      `UPDATE prestamos
       SET estado = 'Devuelto',
           fecha_devolucion = NOW()
       WHERE id_prestamo = ?`,
      [idPrestamo]
    );

    await conexion.query(
      `UPDATE libros
       SET ejemplares_disponibles =
         LEAST(total_ejemplares, ejemplares_disponibles + 1)
       WHERE id_libro = ?
         AND estado = 'Disponible'`,
      [filas[0].id_libro]
    );

    await conexion.commit();

  } catch (error) {
    await conexion.rollback();
    throw error;

  } finally {
    conexion.release();
  }
}

// Marcar un libro como dañado o extraviado.
async function registrarIncidencia(idLibro, estado) {
  if (!['Dañado', 'Extraviado'].includes(estado)) {
    throw new Error('El estado de incidencia no es válido.');
  }

  const [resultado] = await pool.query(
    `UPDATE libros
     SET estado = ?,
         ejemplares_disponibles = 0
     WHERE id_libro = ?`,
    [estado, idLibro]
  );

  if (!resultado.affectedRows) {
    throw new Error('No se encontró el libro.');
  }
}

module.exports = {
  buscar,
  opciones,
  registrar,
  devolver,
  registrarIncidencia
};