-- =====================================================================
-- SPRINT 3 (ajuste) - Libros dañados o extraviados
--
-- 1) Al registrar una devolución se indica el estado del libro:
--      Buen estado | Con daños | Extraviado
--    y queda guardado en el préstamo, así que en el historial del lector
--    aparece "Devuelto con daños" o "Extraviado".
-- 2) Se puede reportar un libro dañado o extraviado que NO estaba prestado
--    (ejemplares que están en la biblioteca).
-- 3) Todo queda en la tabla incidencias_libros.
--
-- Efecto en el inventario: el ejemplar dañado o extraviado sale del total
-- de ejemplares del libro (total_ejemplares baja), por lo que ya no se puede prestar.
--
-- Cambia sp_RegistrarDevolucion (ahora recibe condición, observaciones y el
-- usuario que la registra) y sp_ListarPrestamos (agrega columnas).
-- Ejecútalo DESPUÉS de 06_sprint3_prestamos.sql.
--
-- Códigos: 0 correcto | 1 dato inválido | 2 no encontrado | 4 regla de negocio | 99 error
-- =====================================================================

USE casadellibro;

-- ---------------------------------------------------------------------
-- Columnas nuevas en prestamos (solo si todavía no existen)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS tmp_agregar_columnas_prestamos;
DELIMITER $$
CREATE PROCEDURE tmp_agregar_columnas_prestamos()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prestamos'
                    AND COLUMN_NAME = 'condicion_devolucion') THEN
    ALTER TABLE prestamos ADD COLUMN condicion_devolucion VARCHAR(15) NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prestamos'
                    AND COLUMN_NAME = 'observaciones') THEN
    ALTER TABLE prestamos ADD COLUMN observaciones VARCHAR(300) NULL;
  END IF;
END$$
DELIMITER ;

CALL tmp_agregar_columnas_prestamos();
DROP PROCEDURE tmp_agregar_columnas_prestamos;

-- ---------------------------------------------------------------------
-- Tabla de incidencias (libros dañados o extraviados)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidencias_libros (
  id_incidencia INT AUTO_INCREMENT PRIMARY KEY,
  id_libro      INT NOT NULL,
  id_prestamo   INT NULL,                 -- si el libro lo tenía un lector
  tipo          VARCHAR(15) NOT NULL,
  cantidad      INT NOT NULL DEFAULT 1,
  observaciones VARCHAR(300) NULL,
  id_usuario    INT NOT NULL,             -- quién lo registró
  fecha         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_libro)    REFERENCES libros(id_libro),
  FOREIGN KEY (id_prestamo) REFERENCES prestamos(id_prestamo),
  FOREIGN KEY (id_usuario)  REFERENCES usuarios_sistema(id_usuario),
  CONSTRAINT ck_incidencias_tipo     CHECK (tipo IN ('Dañado', 'Extraviado')),
  CONSTRAINT ck_incidencias_cantidad CHECK (cantidad >= 1),
  INDEX ix_incidencias_fecha (fecha)
);

-- ---------------------------------------------------------------------
-- Devolución con condición del libro
--   p_condicion: 'Buen estado' | 'Con daños' | 'Extraviado'  (NULL = Buen estado)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_RegistrarDevolucion;
DELIMITER $$
CREATE PROCEDURE sp_RegistrarDevolucion(
  IN p_id_prestamo   INT,
  IN p_condicion     VARCHAR(15),
  IN p_observaciones VARCHAR(400),
  IN p_id_usuario    INT
)
proc: BEGIN
  DECLARE v_id_libro      INT;
  DECLARE v_estado        VARCHAR(15);
  DECLARE v_fecha_limite  DATETIME;
  DECLARE v_retraso       INT DEFAULT 0;
  DECLARE v_mensaje       VARCHAR(200);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SELECT 99 AS Codigo, 'Error inesperado al registrar la devolución.' AS Mensaje;
  END;

  SET p_condicion     = IFNULL(NULLIF(TRIM(p_condicion), ''), 'Buen estado');
  SET p_observaciones = NULLIF(TRIM(p_observaciones), '');

  IF p_id_prestamo IS NULL OR p_id_prestamo < 1 THEN
    SELECT 1 AS Codigo, 'El id del préstamo no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_condicion NOT IN ('Buen estado', 'Con daños', 'Extraviado') THEN
    SELECT 1 AS Codigo, 'El estado del libro no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_observaciones IS NOT NULL AND CHAR_LENGTH(p_observaciones) > 300 THEN
    SELECT 1 AS Codigo, 'Las observaciones no pueden tener más de 300 caracteres.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_usuario IS NULL
     OR NOT EXISTS (SELECT 1 FROM usuarios_sistema WHERE id_usuario = p_id_usuario AND activo = 1) THEN
    SELECT 2 AS Codigo, 'El usuario que registra la devolución no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  START TRANSACTION;

  SELECT id_libro, estado, fecha_limite
    INTO v_id_libro, v_estado, v_fecha_limite
  FROM prestamos
  WHERE id_prestamo = p_id_prestamo
  FOR UPDATE;

  IF v_id_libro IS NULL THEN
    ROLLBACK;
    SELECT 2 AS Codigo, 'El préstamo no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF v_estado <> 'Activo' THEN
    ROLLBACK;
    SELECT 4 AS Codigo, 'Este préstamo ya fue devuelto.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF NOW() > v_fecha_limite THEN
    SET v_retraso = GREATEST(CEIL(TIMESTAMPDIFF(MINUTE, v_fecha_limite, NOW()) / 1440), 1);
  END IF;

  UPDATE prestamos
     SET estado               = 'Devuelto',
         fecha_devolucion     = NOW(),
         condicion_devolucion = p_condicion,
         observaciones        = p_observaciones
   WHERE id_prestamo = p_id_prestamo;

  IF p_condicion = 'Buen estado' THEN
    -- El ejemplar vuelve a estar disponible
    UPDATE libros
       SET ejemplares_disponibles = LEAST(ejemplares_disponibles + 1, total_ejemplares),
           estado = IF(estado = 'No disponible', 'Disponible', estado)
     WHERE id_libro = v_id_libro;

    SET v_mensaje = IF(v_retraso > 0,
                       CONCAT('Devolución registrada con ', v_retraso, ' día(s) de retraso.'),
                       'Devolución registrada correctamente.');
  ELSE
    -- El ejemplar sale del inventario (dañado o extraviado)
    UPDATE libros
       SET total_ejemplares = total_ejemplares - 1,
           estado = IF(estado IN ('Disponible', 'No disponible'),
                       IF(ejemplares_disponibles > 0, 'Disponible', 'No disponible'),
                       estado)
     WHERE id_libro = v_id_libro;

    INSERT INTO incidencias_libros (id_libro, id_prestamo, tipo, cantidad, observaciones, id_usuario)
    VALUES (v_id_libro, p_id_prestamo,
            IF(p_condicion = 'Extraviado', 'Extraviado', 'Dañado'),
            1, p_observaciones, p_id_usuario);

    SET v_mensaje = IF(p_condicion = 'Extraviado',
                       'Se registró el libro como extraviado y se retiró del inventario.',
                       'Devolución registrada con daños. El ejemplar se retiró del inventario.');
  END IF;

  COMMIT;

  SELECT 0 AS Codigo, v_mensaje AS Mensaje, v_retraso AS DiasRetraso, p_condicion AS Condicion;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Reportar libros dañados o extraviados que NO estaban prestados
-- (ejemplares que están en la biblioteca). Los que tenía un lector se
-- reportan al registrar su devolución.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReportarIncidenciaLibro;
DELIMITER $$
CREATE PROCEDURE sp_ReportarIncidenciaLibro(
  IN p_id_libro      INT,
  IN p_tipo          VARCHAR(15),    -- 'Dañado' | 'Extraviado'
  IN p_cantidad      INT,            -- NULL = 1
  IN p_observaciones VARCHAR(400),
  IN p_id_usuario    INT
)
proc: BEGIN
  DECLARE v_estado       VARCHAR(20);
  DECLARE v_disponibles  INT;
  DECLARE v_nuevos_disp  INT;
  DECLARE v_id_incidencia INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SELECT 99 AS Codigo, 'Error inesperado al registrar el reporte.' AS Mensaje;
  END;

  SET p_tipo          = TRIM(p_tipo);
  SET p_cantidad      = IFNULL(p_cantidad, 1);
  SET p_observaciones = NULLIF(TRIM(p_observaciones), '');

  IF p_id_libro IS NULL OR p_id_libro < 1 THEN
    SELECT 1 AS Codigo, 'Selecciona un libro.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_tipo IS NULL OR p_tipo NOT IN ('Dañado', 'Extraviado') THEN
    SELECT 1 AS Codigo, 'El tipo de reporte debe ser Dañado o Extraviado.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_cantidad < 1 THEN
    SELECT 1 AS Codigo, 'La cantidad debe ser de al menos 1.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_observaciones IS NOT NULL AND CHAR_LENGTH(p_observaciones) > 300 THEN
    SELECT 1 AS Codigo, 'Las observaciones no pueden tener más de 300 caracteres.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_usuario IS NULL
     OR NOT EXISTS (SELECT 1 FROM usuarios_sistema WHERE id_usuario = p_id_usuario AND activo = 1) THEN
    SELECT 2 AS Codigo, 'El usuario que registra el reporte no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  START TRANSACTION;

  SELECT estado, ejemplares_disponibles
    INTO v_estado, v_disponibles
  FROM libros
  WHERE id_libro = p_id_libro
  FOR UPDATE;

  IF v_estado IS NULL THEN
    ROLLBACK;
    SELECT 2 AS Codigo, 'El libro no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF v_estado = 'Baja' THEN
    ROLLBACK;
    SELECT 4 AS Codigo, 'El libro ya está dado de baja.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_cantidad > v_disponibles THEN
    ROLLBACK;
    SELECT 4 AS Codigo,
           CONCAT('Solo hay ', v_disponibles,
                  ' ejemplar(es) disponible(s) en la biblioteca para reportar. ',
                  'Si el libro lo tiene un lector, regístralo al recibir su devolución.') AS Mensaje;
    LEAVE proc;
  END IF;

  SET v_nuevos_disp = v_disponibles - p_cantidad;

  UPDATE libros
     SET total_ejemplares       = total_ejemplares - p_cantidad,
         ejemplares_disponibles = v_nuevos_disp,
         estado = IF(estado IN ('Disponible', 'No disponible'),
                     IF(v_nuevos_disp > 0, 'Disponible', 'No disponible'),
                     estado)
   WHERE id_libro = p_id_libro;

  INSERT INTO incidencias_libros (id_libro, id_prestamo, tipo, cantidad, observaciones, id_usuario)
  VALUES (p_id_libro, NULL, p_tipo, p_cantidad, p_observaciones, p_id_usuario);

  SET v_id_incidencia = LAST_INSERT_ID();

  COMMIT;

  SELECT 0 AS Codigo,
         CONCAT('Reporte registrado. Se retiraron ', p_cantidad, ' ejemplar(es) del inventario.') AS Mensaje,
         v_id_incidencia AS IdIncidencia;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Lista de libros dañados o extraviados (incluye el lector si lo tenía prestado)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ListarIncidencias;
DELIMITER $$
CREATE PROCEDURE sp_ListarIncidencias(
  IN p_termino VARCHAR(100),
  IN p_tipo    VARCHAR(15)
)
BEGIN
  SET p_termino = TRIM(p_termino);

  SELECT i.id_incidencia   AS IdIncidencia,
         i.fecha           AS Fecha,
         i.tipo            AS Tipo,
         i.cantidad        AS Cantidad,
         i.id_libro        AS IdLibro,
         b.titulo          AS Libro,
         b.autor           AS Autor,
         i.id_prestamo     AS IdPrestamo,
         l.nombre          AS Lector,
         l.matricula       AS Matricula,
         i.observaciones   AS Observaciones,
         u.nombre_completo AS RegistradoPor
  FROM incidencias_libros i
  INNER JOIN libros b           ON b.id_libro   = i.id_libro
  INNER JOIN usuarios_sistema u ON u.id_usuario = i.id_usuario
  LEFT  JOIN prestamos p        ON p.id_prestamo = i.id_prestamo
  LEFT  JOIN lectores l         ON l.id_lector   = p.id_lector
  WHERE (p_termino IS NULL OR p_termino = ''
         OR b.titulo    LIKE CONCAT('%', p_termino, '%')
         OR b.autor     LIKE CONCAT('%', p_termino, '%')
         OR l.nombre    LIKE CONCAT('%', p_termino, '%')
         OR l.matricula LIKE CONCAT('%', p_termino, '%'))
    AND (p_tipo IS NULL OR p_tipo = '' OR i.tipo = p_tipo)
  ORDER BY i.fecha DESC
  LIMIT 200;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Lista de préstamos: ahora el Estado también puede ser
-- "Devuelto con daños" o "Extraviado".
--   p_estado: NULL o '' = todos | 'Pendientes' = activos + vencidos
--             | 'Activo' | 'Vencido' | 'Devuelto'
--             | 'Incidencias' = devueltos con daños + extraviados
--             | 'Devuelto con daños' | 'Extraviado'
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ListarPrestamos;
DELIMITER $$
CREATE PROCEDURE sp_ListarPrestamos(
  IN p_termino   VARCHAR(100),
  IN p_estado    VARCHAR(20),
  IN p_id_lector INT
)
BEGIN
  SET p_termino = TRIM(p_termino);

  SELECT *
  FROM (
    SELECT p.id_prestamo      AS IdPrestamo,
           p.id_lector        AS IdLector,
           l.matricula        AS Matricula,
           l.folio            AS Folio,
           l.nombre           AS Lector,
           p.id_libro         AS IdLibro,
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
           p.condicion_devolucion AS Condicion,
           p.observaciones        AS Observaciones,
           CASE
             WHEN p.fecha_devolucion IS NOT NULL AND p.fecha_devolucion > p.fecha_limite
               THEN GREATEST(CEIL(TIMESTAMPDIFF(MINUTE, p.fecha_limite, p.fecha_devolucion) / 1440), 1)
             WHEN p.fecha_devolucion IS NULL AND p.fecha_limite < NOW()
               THEN GREATEST(CEIL(TIMESTAMPDIFF(MINUTE, p.fecha_limite, NOW()) / 1440), 1)
             ELSE 0
           END AS DiasRetraso,
           u.nombre_completo  AS RegistradoPor
    FROM prestamos p
    INNER JOIN lectores l         ON l.id_lector   = p.id_lector
    INNER JOIN libros b           ON b.id_libro    = p.id_libro
    INNER JOIN usuarios_sistema u ON u.id_usuario  = p.id_usuario
    WHERE (p_id_lector IS NULL OR p.id_lector = p_id_lector)
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
  ORDER BY (t.Estado = 'Vencido') DESC, t.FechaPrestamo DESC;
END$$
DELIMITER ;

-- =====================================================================
-- PRUEBAS RÁPIDAS
-- =====================================================================
-- CALL sp_RegistrarPrestamo(2, 3, 1, 7);                                 -- Dilan pide Clean Code
-- CALL sp_ListarPrestamos('', 'Pendientes', NULL);                       -- anota el IdPrestamo
-- CALL sp_RegistrarDevolucion(2, 'Con daños', 'Hojas arrancadas', 1);    -- devuelto con daños
-- CALL sp_RegistrarDevolucion(2, 'Buen estado', NULL, 1);                -- Codigo 4 (ya devuelto)
-- CALL sp_ReportarIncidenciaLibro(5, 'Extraviado', 1, 'No aparece en el estante', 1);
-- CALL sp_ReportarIncidenciaLibro(5, 'Dañado', 99, NULL, 1);             -- Codigo 4 (no hay tantos)
-- CALL sp_ListarIncidencias('', NULL);
-- CALL sp_ListarPrestamos('', 'Incidencias', NULL);                      -- historial con daños/extraviados
-- SELECT titulo, total_ejemplares, ejemplares_disponibles, estado FROM libros;