-- =====================================================================
-- SPRINT 3 - Préstamos y devoluciones (HU17 a HU22)
--
-- * sp_RegistrarPrestamo   valida y registra un préstamo (transacción)
-- * sp_RegistrarDevolucion registra la devolución y libera el ejemplar
-- * sp_ListarPrestamos     préstamos activos, vencidos e historial
--
-- Reglas del préstamo (se verifican dentro del procedimiento):
--   - El lector debe existir y estar Activo (no suspendido ni dado de baja).
--   - El libro debe existir, no estar dañado/extraviado/de baja y tener
--     al menos un ejemplar disponible.
--   - Un lector no puede tener dos veces el mismo libro activo.
--   - Un lector con préstamos vencidos no puede pedir otro.
--   - Máximo 3 préstamos activos por lector (v_limite_prestamos).
--   - Plazo: 1 a 30 días (7 por defecto). Vence a las 23:59:59 del último día.
--
-- Un préstamo "Vencido" NO se guarda así: sigue como "Activo" en la tabla y
-- se calcula al consultar (fecha límite pasada). Así el índice que evita
-- préstamos duplicados sigue funcionando.
--
-- Respuesta de los procedimientos que modifican: Codigo (0 = correcto) y Mensaje.
--   1 = dato inválido   2 = no encontrado   3 = duplicado   4 = regla de negocio
--  99 = error inesperado
-- =====================================================================

USE casadellibro;

-- ---------------------------------------------------------------------
-- HU17 / HU19 / HU20 · Registrar préstamo
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_RegistrarPrestamo;
DELIMITER $$
CREATE PROCEDURE sp_RegistrarPrestamo(
  IN p_id_lector  INT,
  IN p_id_libro   INT,
  IN p_id_usuario INT,   -- empleado que registra el préstamo (viene de la sesión)
  IN p_dias       INT    -- plazo en días; NULL = 7
)
proc: BEGIN
  DECLARE v_limite_prestamos INT DEFAULT 3;

  DECLARE v_estado_lector VARCHAR(15);
  DECLARE v_estado_libro  VARCHAR(20);
  DECLARE v_disponibles   INT;
  DECLARE v_activos       INT DEFAULT 0;
  DECLARE v_vencidos      INT DEFAULT 0;
  DECLARE v_repetido      INT DEFAULT 0;
  DECLARE v_usuario_ok    INT DEFAULT 0;
  DECLARE v_codigo        INT DEFAULT 0;
  DECLARE v_mensaje       VARCHAR(200) DEFAULT NULL;
  DECLARE v_fecha_limite  DATETIME;
  DECLARE v_id_prestamo   INT;
  DECLARE v_nuevos_disp   INT;

  DECLARE EXIT HANDLER FOR 1062
  BEGIN
    ROLLBACK;
    SELECT 3 AS Codigo, 'El lector ya tiene este libro prestado.' AS Mensaje;
  END;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SELECT 99 AS Codigo, 'Error inesperado al registrar el préstamo.' AS Mensaje;
  END;

  SET p_dias = IFNULL(p_dias, 7);

  IF p_id_lector IS NULL OR p_id_libro IS NULL OR p_id_usuario IS NULL
     OR p_id_lector < 1 OR p_id_libro < 1 THEN
    SELECT 1 AS Codigo, 'Selecciona un lector y un libro.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_dias < 1 OR p_dias > 30 THEN
    SELECT 1 AS Codigo, 'El plazo debe ser de 1 a 30 días.' AS Mensaje;
    LEAVE proc;
  END IF;

  START TRANSACTION;

  -- Se bloquea la fila del libro para que dos préstamos simultáneos
  -- no se lleven el mismo último ejemplar.
  SELECT estado, ejemplares_disponibles
    INTO v_estado_libro, v_disponibles
  FROM libros
  WHERE id_libro = p_id_libro
  FOR UPDATE;

  SELECT estado INTO v_estado_lector FROM lectores WHERE id_lector = p_id_lector;

  SELECT COUNT(*) INTO v_usuario_ok
  FROM usuarios_sistema WHERE id_usuario = p_id_usuario AND activo = 1;

  SELECT COUNT(*) INTO v_activos
  FROM prestamos WHERE id_lector = p_id_lector AND estado = 'Activo';

  SELECT COUNT(*) INTO v_vencidos
  FROM prestamos
  WHERE id_lector = p_id_lector AND estado = 'Activo' AND fecha_limite < NOW();

  SELECT COUNT(*) INTO v_repetido
  FROM prestamos
  WHERE id_lector = p_id_lector AND id_libro = p_id_libro AND estado = 'Activo';

  IF v_estado_lector IS NULL THEN
    SET v_codigo = 2, v_mensaje = 'El lector no existe.';
  ELSEIF v_estado_libro IS NULL THEN
    SET v_codigo = 2, v_mensaje = 'El libro no existe.';
  ELSEIF v_usuario_ok = 0 THEN
    SET v_codigo = 2, v_mensaje = 'El usuario que registra el préstamo no es válido.';
  ELSEIF v_estado_lector <> 'Activo' THEN
    SET v_codigo = 4,
        v_mensaje = CONCAT('El lector no puede solicitar préstamos (estado: ', v_estado_lector, ').');
  ELSEIF v_estado_libro IN ('Dañado', 'Extraviado', 'Baja') THEN
    SET v_codigo = 4,
        v_mensaje = CONCAT('El libro no se puede prestar (estado: ', v_estado_libro, ').');
  ELSEIF v_disponibles < 1 THEN
    SET v_codigo = 4, v_mensaje = 'No hay ejemplares disponibles de este libro.';
  ELSEIF v_repetido > 0 THEN
    SET v_codigo = 3, v_mensaje = 'El lector ya tiene este libro prestado.';
  ELSEIF v_vencidos > 0 THEN
    SET v_codigo = 4, v_mensaje = 'El lector tiene préstamos vencidos. Debe devolverlos antes de pedir otro libro.';
  ELSEIF v_activos >= v_limite_prestamos THEN
    SET v_codigo = 4,
        v_mensaje = CONCAT('El lector alcanzó el límite de ', v_limite_prestamos, ' préstamos activos.');
  END IF;

  IF v_codigo <> 0 THEN
    ROLLBACK;
    SELECT v_codigo AS Codigo, v_mensaje AS Mensaje;
    LEAVE proc;
  END IF;

  SET v_fecha_limite = TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL p_dias DAY), '23:59:59');

  INSERT INTO prestamos (id_lector, id_libro, id_usuario, fecha_prestamo, fecha_limite)
  VALUES (p_id_lector, p_id_libro, p_id_usuario, NOW(), v_fecha_limite);

  SET v_id_prestamo = LAST_INSERT_ID();
  SET v_nuevos_disp = v_disponibles - 1;

  UPDATE libros
     SET ejemplares_disponibles = v_nuevos_disp,
         estado = IF(v_nuevos_disp = 0 AND estado = 'Disponible', 'No disponible', estado)
   WHERE id_libro = p_id_libro;

  COMMIT;

  SELECT 0 AS Codigo, 'Préstamo registrado correctamente.' AS Mensaje,
         v_id_prestamo AS IdPrestamo, v_fecha_limite AS FechaLimite;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- HU18 · Registrar devolución (libera el ejemplar automáticamente)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_RegistrarDevolucion;
DELIMITER $$
CREATE PROCEDURE sp_RegistrarDevolucion(IN p_id_prestamo INT)
proc: BEGIN
  DECLARE v_id_libro      INT;
  DECLARE v_estado        VARCHAR(15);
  DECLARE v_fecha_limite  DATETIME;
  DECLARE v_retraso       INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SELECT 99 AS Codigo, 'Error inesperado al registrar la devolución.' AS Mensaje;
  END;

  IF p_id_prestamo IS NULL OR p_id_prestamo < 1 THEN
    SELECT 1 AS Codigo, 'El id del préstamo no es válido.' AS Mensaje;
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
     SET estado = 'Devuelto', fecha_devolucion = NOW()
   WHERE id_prestamo = p_id_prestamo;

  UPDATE libros
     SET ejemplares_disponibles = LEAST(ejemplares_disponibles + 1, total_ejemplares),
         estado = IF(estado = 'No disponible', 'Disponible', estado)
   WHERE id_libro = v_id_libro;

  COMMIT;

  SELECT 0 AS Codigo,
         IF(v_retraso > 0,
            CONCAT('Devolución registrada con ', v_retraso, ' día(s) de retraso.'),
            'Devolución registrada correctamente.') AS Mensaje,
         v_retraso AS DiasRetraso;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- HU21 / HU22 · Préstamos activos, vencidos e historial
--   p_termino    texto: lector (nombre, matrícula, folio) o libro (título, autor)
--   p_estado     NULL o '' = todos | 'Pendientes' = activos + vencidos
--                | 'Activo' | 'Vencido' | 'Devuelto'
--   p_id_lector  NULL = todos (con un id sirve para el historial de un lector, HU09)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ListarPrestamos;
DELIMITER $$
CREATE PROCEDURE sp_ListarPrestamos(
  IN p_termino   VARCHAR(100),
  IN p_estado    VARCHAR(15),
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
           CASE WHEN p.estado = 'Activo' AND p.fecha_limite < NOW()
                THEN 'Vencido' ELSE p.estado END AS Estado,
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
        OR (p_estado = 'Pendientes' AND t.Estado IN ('Activo', 'Vencido'))
        OR t.Estado = p_estado
  ORDER BY (t.Estado = 'Vencido') DESC, t.FechaPrestamo DESC;
END$$
DELIMITER ;

-- =====================================================================
-- PRUEBAS RÁPIDAS (ejecútalas una por una)
-- =====================================================================
-- CALL sp_ListarPrestamos('', 'Pendientes', NULL);
-- CALL sp_RegistrarPrestamo(2, 3, 1, 7);        -- Dilan pide Clean Code por 7 días
-- CALL sp_RegistrarPrestamo(2, 3, 1, 7);        -- Codigo 3 (ya lo tiene prestado)
-- CALL sp_RegistrarPrestamo(999, 3, 1, 7);      -- Codigo 2 (lector no existe)
-- CALL sp_RegistrarDevolucion(1);               -- devuelve el préstamo de ejemplo
-- CALL sp_RegistrarDevolucion(1);               -- Codigo 4 (ya devuelto)
-- CALL sp_RegistrarDevolucion(999);             -- Codigo 2 (no existe)
-- CALL sp_ListarPrestamos('', NULL, NULL);      -- historial completo