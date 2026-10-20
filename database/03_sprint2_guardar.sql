-- =====================================================================
-- SPRINT 2 (ajuste) - Un solo procedimiento "Guardar" por tabla
--
--   id = 0  -> crea un registro nuevo
--   id > 0  -> si el id existe, modifica ese registro
--              si el id NO existe, devuelve NULL (el código en Node
--              se encarga de mostrar "no existe")
--
-- Reemplaza a sp_RegistrarLector, sp_ModificarLector,
-- sp_RegistrarLibro y sp_ModificarLibro (este script las borra).
-- Ejecútalo DESPUÉS de sprint2_casadellibro.sql.
--
-- Respuesta:
--   OK / error de validación -> Codigo, Mensaje (+ IdLector/IdLibro si fue OK)
--   id inexistente           -> Codigo = NULL, Mensaje = NULL, Id = NULL
-- =====================================================================

USE casadellibro;

DROP PROCEDURE IF EXISTS sp_RegistrarLector;
DROP PROCEDURE IF EXISTS sp_ModificarLector;
DROP PROCEDURE IF EXISTS sp_RegistrarLibro;
DROP PROCEDURE IF EXISTS sp_ModificarLibro;

-- ---------------------------------------------------------------------
-- LECTORES
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GuardarLector;
DELIMITER $$
CREATE PROCEDURE sp_GuardarLector(
  IN p_id_lector INT,
  IN p_matricula VARCHAR(20),
  IN p_nombre    VARCHAR(100),
  IN p_correo    VARCHAR(100),
  IN p_telefono  VARCHAR(20)
)
proc: BEGIN
  DECLARE v_num   INT;
  DECLARE v_folio VARCHAR(20);

  DECLARE EXIT HANDLER FOR 1062
    SELECT 3 AS Codigo, 'La matrícula o el folio ya está registrado.' AS Mensaje;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al guardar el lector.' AS Mensaje;

  IF p_id_lector IS NULL OR p_id_lector < 0 THEN
    SELECT 1 AS Codigo, 'El id del lector no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  -- id > 0 que no existe: la base de datos devuelve NULL
  IF p_id_lector > 0
     AND NOT EXISTS (SELECT 1 FROM lectores WHERE id_lector = p_id_lector) THEN
    SELECT NULL AS Codigo, NULL AS Mensaje, NULL AS IdLector;
    LEAVE proc;
  END IF;

  SET p_matricula = TRIM(p_matricula);
  SET p_nombre    = TRIM(p_nombre);
  SET p_correo    = NULLIF(TRIM(p_correo), '');
  SET p_telefono  = NULLIF(TRIM(p_telefono), '');

  IF p_matricula IS NULL OR p_matricula = '' THEN
    SELECT 1 AS Codigo, 'La matrícula es obligatoria.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_nombre IS NULL OR p_nombre = '' THEN
    SELECT 1 AS Codigo, 'El nombre es obligatorio.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_correo IS NOT NULL AND p_correo NOT REGEXP '^[^@ ]+@[^@ ]+[.][^@ ]+$' THEN
    SELECT 1 AS Codigo, 'El correo no tiene un formato válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF EXISTS (SELECT 1 FROM lectores
              WHERE matricula = p_matricula AND id_lector <> p_id_lector) THEN
    SELECT 3 AS Codigo, 'Ya existe un lector con esa matrícula.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_lector = 0 THEN
    -- CREAR
    SELECT IFNULL(MAX(CAST(SUBSTRING(folio, 3) AS UNSIGNED)), 0) + 1
      INTO v_num
    FROM lectores
    WHERE folio REGEXP '^F-[0-9]+$';

    SET v_folio = CONCAT('F-', LPAD(v_num, 4, '0'));

    INSERT INTO lectores (matricula, folio, nombre, correo, telefono)
    VALUES (p_matricula, v_folio, p_nombre, p_correo, p_telefono);

    SELECT 0 AS Codigo, 'Lector registrado correctamente.' AS Mensaje,
           LAST_INSERT_ID() AS IdLector, v_folio AS Folio;
  ELSE
    -- MODIFICAR
    UPDATE lectores
       SET matricula = p_matricula,
           nombre    = p_nombre,
           correo    = p_correo,
           telefono  = p_telefono
     WHERE id_lector = p_id_lector;

    SELECT 0 AS Codigo, 'Lector actualizado correctamente.' AS Mensaje,
           p_id_lector AS IdLector,
           (SELECT folio FROM lectores WHERE id_lector = p_id_lector) AS Folio;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- LIBROS
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GuardarLibro;
DELIMITER $$
CREATE PROCEDURE sp_GuardarLibro(
  IN p_id_libro     INT,
  IN p_isbn         VARCHAR(20),
  IN p_titulo       VARCHAR(200),
  IN p_autor        VARCHAR(120),
  IN p_id_categoria INT,
  IN p_total        INT
)
proc: BEGIN
  DECLARE v_total_actual INT;
  DECLARE v_disp_actual  INT;
  DECLARE v_estado       VARCHAR(20);
  DECLARE v_prestados    INT;
  DECLARE v_nuevos_disp  INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al guardar el libro.' AS Mensaje;

  IF p_id_libro IS NULL OR p_id_libro < 0 THEN
    SELECT 1 AS Codigo, 'El id del libro no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  -- id > 0: leer el libro actual; si no existe, devolver NULL
  IF p_id_libro > 0 THEN
    SELECT total_ejemplares, ejemplares_disponibles, estado
      INTO v_total_actual, v_disp_actual, v_estado
    FROM libros
    WHERE id_libro = p_id_libro;

    IF v_total_actual IS NULL THEN
      SELECT NULL AS Codigo, NULL AS Mensaje, NULL AS IdLibro;
      LEAVE proc;
    END IF;
  END IF;

  SET p_isbn   = NULLIF(TRIM(p_isbn), '');
  SET p_titulo = TRIM(p_titulo);
  SET p_autor  = TRIM(p_autor);

  IF p_titulo IS NULL OR p_titulo = '' OR p_autor IS NULL OR p_autor = '' THEN
    SELECT 1 AS Codigo, 'El título y el autor son obligatorios.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_total IS NULL OR p_total < 0 OR (p_id_libro = 0 AND p_total < 1) THEN
    SELECT 1 AS Codigo, 'El total de ejemplares no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_categoria IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM categorias WHERE id_categoria = p_id_categoria) THEN
    SELECT 2 AS Codigo, 'La categoría no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_isbn IS NOT NULL AND EXISTS (SELECT 1 FROM libros
                                     WHERE isbn = p_isbn AND id_libro <> p_id_libro) THEN
    SELECT 3 AS Codigo, 'Ese ISBN ya pertenece a otro libro.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_libro = 0 THEN
    -- CREAR
    INSERT INTO libros (isbn, titulo, autor, id_categoria, total_ejemplares, ejemplares_disponibles, estado)
    VALUES (p_isbn, p_titulo, p_autor, p_id_categoria, p_total, p_total, 'Disponible');

    SELECT 0 AS Codigo, 'Libro registrado correctamente.' AS Mensaje, LAST_INSERT_ID() AS IdLibro;
  ELSE
    -- MODIFICAR (recalcula disponibles sin tocar los prestados)
    SET v_prestados   = v_total_actual - v_disp_actual;
    SET v_nuevos_disp = p_total - v_prestados;

    IF v_nuevos_disp < 0 THEN
      SELECT 4 AS Codigo,
             CONCAT('No se puede reducir a ', p_total, ' ejemplares: hay ', v_prestados, ' prestados.') AS Mensaje;
      LEAVE proc;
    END IF;

    UPDATE libros
       SET isbn                   = p_isbn,
           titulo                 = p_titulo,
           autor                  = p_autor,
           id_categoria           = p_id_categoria,
           total_ejemplares       = p_total,
           ejemplares_disponibles = v_nuevos_disp,
           estado = CASE
                      WHEN v_estado IN ('Disponible', 'No disponible')
                        THEN IF(v_nuevos_disp > 0, 'Disponible', 'No disponible')
                      ELSE v_estado
                    END
     WHERE id_libro = p_id_libro;

    SELECT 0 AS Codigo, 'Libro actualizado correctamente.' AS Mensaje, p_id_libro AS IdLibro;
  END IF;
END$$
DELIMITER ;

-- =====================================================================
-- PRUEBAS RÁPIDAS
-- =====================================================================
-- CALL sp_GuardarLector(0, '23088888', 'Lector Nuevo', 'nuevo@correo.com', '6680000000');   -- crea
-- CALL sp_GuardarLector(1, '23020622', 'Ángel G. Valdez Luna', 'angel@correo.com', NULL);   -- modifica
-- CALL sp_GuardarLector(999, '23077777', 'No existe', NULL, NULL);                           -- NULL, NULL, NULL
--
-- CALL sp_GuardarLibro(0, '9780000000002', 'Libro Nuevo', 'Autor', 3, 2);                    -- crea
-- CALL sp_GuardarLibro(3, '9780132350884', 'Clean Code', 'Robert C. Martin', 3, 5);          -- modifica
-- CALL sp_GuardarLibro(999, NULL, 'No existe', 'Nadie', NULL, 1);                            -- NULL, NULL, NULL