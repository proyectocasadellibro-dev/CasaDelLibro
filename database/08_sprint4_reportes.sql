-- =====================================================================
-- SPRINT 4 - Reportes (solo consultas: no cambia ninguna tabla)
--
-- * sp_ReporteMovimientos        movimientos de préstamos por fechas
-- * sp_ReportePrestamos          préstamos por periodo
-- * sp_ReporteLibrosMasSolicitados
-- * sp_ReporteLectoresConAdeudos lectores con préstamos vencidos y multa estimada
--
-- Fechas: p_desde y p_hasta son DATE y se incluyen completas (el día final entra
-- hasta las 23:59:59). NULL = sin límite.
--
-- Multa estimada = días de retraso x tarifa por día (p_multa_dia, 5.00 si es NULL).
-- Es una estimación: el sistema todavía no guarda multas ni cobros; la tarifa
-- oficial se configurará en el Sprint 5 junto con las reglas de préstamo.
--
-- Ejecútalo DESPUÉS de 07_sprint3_danados_extraviados.sql.
-- =====================================================================

USE casadellibro;

-- ---------------------------------------------------------------------
-- Movimientos de préstamos (préstamos, devoluciones y reportes de libros
-- dañados o extraviados), ordenados del más reciente al más antiguo.
--   p_tipo: NULL o '' = todos | 'Prestamos' | 'Devoluciones' | 'Incidencias'
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReporteMovimientos;
DELIMITER $$
CREATE PROCEDURE sp_ReporteMovimientos(
  IN p_desde   DATE,
  IN p_hasta   DATE,
  IN p_tipo    VARCHAR(20),
  IN p_termino VARCHAR(100)
)
BEGIN
  SET p_termino = TRIM(p_termino);

  SELECT m.Fecha, m.Movimiento, m.Matricula, m.Lector, m.Libro, m.Autor, m.Detalle
  FROM (
    -- Préstamos
    SELECT p.fecha_prestamo AS Fecha,
           'P'              AS Clase,
           'Préstamo'       AS Movimiento,
           l.matricula      AS Matricula,
           l.nombre         AS Lector,
           b.titulo         AS Libro,
           b.autor          AS Autor,
           CONCAT('Vence el ', DATE_FORMAT(p.fecha_limite, '%d/%m/%Y'),
                  ' · Registró: ', u.nombre_completo) AS Detalle
    FROM prestamos p
    INNER JOIN lectores l         ON l.id_lector  = p.id_lector
    INNER JOIN libros b           ON b.id_libro   = p.id_libro
    INNER JOIN usuarios_sistema u ON u.id_usuario = p.id_usuario

    UNION ALL

    -- Devoluciones (en buen estado, con daños o libro extraviado)
    SELECT p.fecha_devolucion,
           IF(p.condicion_devolucion IN ('Con daños', 'Extraviado'), 'DI', 'D'),
           CASE p.condicion_devolucion
             WHEN 'Con daños'   THEN 'Devolución con daños'
             WHEN 'Extraviado'  THEN 'Libro extraviado'
             ELSE 'Devolución'
           END,
           l.matricula,
           l.nombre,
           b.titulo,
           b.autor,
           p.observaciones
    FROM prestamos p
    INNER JOIN lectores l ON l.id_lector = p.id_lector
    INNER JOIN libros b   ON b.id_libro  = p.id_libro
    WHERE p.fecha_devolucion IS NOT NULL

    UNION ALL

    -- Reportes de libros dañados o extraviados que no estaban prestados
    SELECT i.fecha,
           'RI',
           CONCAT('Reporte ', LOWER(i.tipo)),
           NULL,
           NULL,
           b.titulo,
           b.autor,
           CONCAT(IFNULL(CONCAT(i.observaciones, ' · '), ''),
                  i.cantidad, ' ejemplar(es) · Registró: ', u.nombre_completo)
    FROM incidencias_libros i
    INNER JOIN libros b           ON b.id_libro   = i.id_libro
    INNER JOIN usuarios_sistema u ON u.id_usuario = i.id_usuario
    WHERE i.id_prestamo IS NULL
  ) m
  WHERE (p_desde IS NULL OR m.Fecha >= p_desde)
    AND (p_hasta IS NULL OR m.Fecha < DATE_ADD(p_hasta, INTERVAL 1 DAY))
    AND (p_tipo IS NULL OR p_tipo = ''
         OR (p_tipo = 'Prestamos'    AND m.Clase = 'P')
         OR (p_tipo = 'Devoluciones' AND m.Clase IN ('D', 'DI'))
         OR (p_tipo = 'Incidencias'  AND m.Clase IN ('DI', 'RI')))
    AND (p_termino IS NULL OR p_termino = ''
         OR m.Lector    LIKE CONCAT('%', p_termino, '%')
         OR m.Matricula LIKE CONCAT('%', p_termino, '%')
         OR m.Libro     LIKE CONCAT('%', p_termino, '%')
         OR m.Autor     LIKE CONCAT('%', p_termino, '%'))
  ORDER BY m.Fecha DESC;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Préstamos por periodo (según la fecha en que se hizo el préstamo)
--   p_estado: NULL o '' = todos | 'Pendientes' | 'Activo' | 'Vencido' | 'Devuelto'
--             | 'Incidencias' | 'Devuelto con daños' | 'Extraviado'
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReportePrestamos;
DELIMITER $$
CREATE PROCEDURE sp_ReportePrestamos(
  IN p_desde   DATE,
  IN p_hasta   DATE,
  IN p_estado  VARCHAR(20),
  IN p_termino VARCHAR(100)
)
BEGIN
  SET p_termino = TRIM(p_termino);

  SELECT *
  FROM (
    SELECT p.id_prestamo      AS IdPrestamo,
           l.matricula        AS Matricula,
           l.nombre           AS Lector,
           b.titulo           AS Libro,
           b.autor            AS Autor,
           p.fecha_prestamo   AS FechaPrestamo,
           p.fecha_limite     AS FechaLimite,
           p.fecha_devolucion AS FechaDevolucion,
           CASE
             WHEN p.estado = 'Activo' AND p.fecha_limite < NOW() THEN 'Vencido'
             WHEN p.estado = 'Devuelto' AND p.condicion_devolucion = 'Con daños' THEN 'Devuelto con daños'
             WHEN p.estado = 'Devuelto' AND p.condicion_devolucion = 'Extraviado' THEN 'Extraviado'
             ELSE p.estado
           END AS Estado,
           CAST(CASE
             WHEN p.fecha_devolucion IS NOT NULL AND p.fecha_devolucion > p.fecha_limite
               THEN GREATEST(CEIL(TIMESTAMPDIFF(MINUTE, p.fecha_limite, p.fecha_devolucion) / 1440), 1)
             WHEN p.fecha_devolucion IS NULL AND p.fecha_limite < NOW()
               THEN GREATEST(CEIL(TIMESTAMPDIFF(MINUTE, p.fecha_limite, NOW()) / 1440), 1)
             ELSE 0
           END AS SIGNED) AS DiasRetraso,
           u.nombre_completo  AS RegistradoPor
    FROM prestamos p
    INNER JOIN lectores l         ON l.id_lector  = p.id_lector
    INNER JOIN libros b           ON b.id_libro   = p.id_libro
    INNER JOIN usuarios_sistema u ON u.id_usuario = p.id_usuario
    WHERE (p_desde IS NULL OR p.fecha_prestamo >= p_desde)
      AND (p_hasta IS NULL OR p.fecha_prestamo < DATE_ADD(p_hasta, INTERVAL 1 DAY))
      AND (p_termino IS NULL OR p_termino = ''
           OR l.nombre    LIKE CONCAT('%', p_termino, '%')
           OR l.matricula LIKE CONCAT('%', p_termino, '%')
           OR l.folio     LIKE CONCAT('%', p_termino, '%')
           OR b.titulo    LIKE CONCAT('%', p_termino, '%')
           OR b.autor     LIKE CONCAT('%', p_termino, '%'))
  ) t
  WHERE p_estado IS NULL OR p_estado = ''
        OR (p_estado = 'Pendientes'  AND t.Estado IN ('Activo', 'Vencido'))
        OR (p_estado = 'Incidencias' AND t.Estado IN ('Devuelto con daños', 'Extraviado'))
        OR t.Estado = p_estado
  ORDER BY t.FechaPrestamo DESC;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Libros más solicitados (cantidad de préstamos en el periodo)
--   p_limite: cuántos mostrar (1 a 100; NULL = 10)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReporteLibrosMasSolicitados;
DELIMITER $$
CREATE PROCEDURE sp_ReporteLibrosMasSolicitados(
  IN p_desde  DATE,
  IN p_hasta  DATE,
  IN p_limite INT
)
BEGIN
  SET p_limite = IFNULL(p_limite, 10);
  IF p_limite < 1 THEN SET p_limite = 1; END IF;
  IF p_limite > 100 THEN SET p_limite = 100; END IF;

  SELECT b.id_libro                    AS IdLibro,
         b.titulo                      AS Libro,
         b.autor                       AS Autor,
         c.nombre                      AS Categoria,
         COUNT(*)                      AS Prestamos,
         COUNT(DISTINCT p.id_lector)   AS Lectores,
         MAX(p.fecha_prestamo)         AS UltimoPrestamo
  FROM prestamos p
  INNER JOIN libros b     ON b.id_libro      = p.id_libro
  LEFT  JOIN categorias c ON c.id_categoria  = b.id_categoria
  WHERE (p_desde IS NULL OR p.fecha_prestamo >= p_desde)
    AND (p_hasta IS NULL OR p.fecha_prestamo < DATE_ADD(p_hasta, INTERVAL 1 DAY))
  GROUP BY b.id_libro, b.titulo, b.autor, c.nombre
  ORDER BY Prestamos DESC, b.titulo
  LIMIT p_limite;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Lectores con préstamos vencidos (adeudos pendientes) y multa estimada
--   p_multa_dia: tarifa por día de retraso (NULL = 5.00)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReporteLectoresConAdeudos;
DELIMITER $$
CREATE PROCEDURE sp_ReporteLectoresConAdeudos(IN p_multa_dia DECIMAL(10,2))
BEGIN
  SET p_multa_dia = IFNULL(p_multa_dia, 5.00);
  IF p_multa_dia < 0 THEN SET p_multa_dia = 0; END IF;

  SELECT l.id_lector   AS IdLector,
         l.matricula   AS Matricula,
         l.folio       AS Folio,
         l.nombre      AS Lector,
         l.correo      AS Correo,
         l.telefono    AS Telefono,
         COUNT(*)      AS PrestamosVencidos,
         GROUP_CONCAT(b.titulo ORDER BY d.fecha_limite SEPARATOR ' · ') AS Libros,
         CAST(MAX(d.dias) AS SIGNED)  AS MaxDiasRetraso,
         CAST(SUM(d.dias) AS SIGNED)  AS TotalDiasRetraso,
         ROUND(SUM(d.dias) * p_multa_dia, 2) AS MultaEstimada
  FROM (
    SELECT id_lector, id_libro, fecha_limite,
           GREATEST(CEIL(TIMESTAMPDIFF(MINUTE, fecha_limite, NOW()) / 1440), 1) AS dias
    FROM prestamos
    WHERE estado = 'Activo' AND fecha_limite < NOW()
  ) d
  INNER JOIN lectores l ON l.id_lector = d.id_lector
  INNER JOIN libros b   ON b.id_libro  = d.id_libro
  GROUP BY l.id_lector, l.matricula, l.folio, l.nombre, l.correo, l.telefono
  ORDER BY MultaEstimada DESC, l.nombre;
END$$
DELIMITER ;

-- =====================================================================
-- PRUEBAS RÁPIDAS
-- =====================================================================
-- CALL sp_ReporteMovimientos(NULL, NULL, NULL, NULL);                -- todo el historial
-- CALL sp_ReporteMovimientos('2026-11-01', '2026-11-30', 'Prestamos', NULL);
-- CALL sp_ReporteMovimientos(NULL, NULL, 'Incidencias', 'Clean');
-- CALL sp_ReportePrestamos('2026-11-01', CURDATE(), 'Pendientes', NULL);
-- CALL sp_ReporteLibrosMasSolicitados(NULL, NULL, 10);
-- CALL sp_ReporteLectoresConAdeudos(5.00);