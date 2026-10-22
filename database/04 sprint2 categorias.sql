-- =====================================================================
-- SPRINT 2 (ajuste) - Guardar categorías
--
-- Mismo patrón que lectores y libros:
--   id = 0  -> crea una categoría nueva
--   id > 0  -> si existe, la modifica; si NO existe devuelve NULL
--
-- Respuesta:
--   OK / error de validación -> Codigo, Mensaje (+ IdCategoria si fue OK)
--   id inexistente           -> Codigo = NULL, Mensaje = NULL, IdCategoria = NULL
-- =====================================================================

USE casadellibro;

DROP PROCEDURE IF EXISTS sp_GuardarCategoria;
DELIMITER $$
CREATE PROCEDURE sp_GuardarCategoria(
  IN p_id_categoria INT,
  IN p_nombre       VARCHAR(100),
  IN p_descripcion  VARCHAR(300)
)
proc: BEGIN
  DECLARE EXIT HANDLER FOR 1062
    SELECT 3 AS Codigo, 'Ya existe una categoría con ese nombre.' AS Mensaje;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al guardar la categoría.' AS Mensaje;

  IF p_id_categoria IS NULL OR p_id_categoria < 0 THEN
    SELECT 1 AS Codigo, 'El id de la categoría no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  -- id > 0 que no existe: la base de datos devuelve NULL
  IF p_id_categoria > 0
     AND NOT EXISTS (SELECT 1 FROM categorias WHERE id_categoria = p_id_categoria) THEN
    SELECT NULL AS Codigo, NULL AS Mensaje, NULL AS IdCategoria;
    LEAVE proc;
  END IF;

  SET p_nombre      = TRIM(p_nombre);
  SET p_descripcion = NULLIF(TRIM(p_descripcion), '');

  IF p_nombre IS NULL OR p_nombre = '' THEN
    SELECT 1 AS Codigo, 'El nombre de la categoría es obligatorio.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF CHAR_LENGTH(p_nombre) > 60 THEN
    SELECT 1 AS Codigo, 'El nombre no puede tener más de 60 caracteres.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_descripcion IS NOT NULL AND CHAR_LENGTH(p_descripcion) > 200 THEN
    SELECT 1 AS Codigo, 'La descripción no puede tener más de 200 caracteres.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF EXISTS (SELECT 1 FROM categorias
              WHERE nombre = p_nombre AND id_categoria <> p_id_categoria) THEN
    SELECT 3 AS Codigo, 'Ya existe una categoría con ese nombre.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_categoria = 0 THEN
    INSERT INTO categorias (nombre, descripcion) VALUES (p_nombre, p_descripcion);
    SELECT 0 AS Codigo, 'Categoría registrada correctamente.' AS Mensaje,
           LAST_INSERT_ID() AS IdCategoria;
  ELSE
    UPDATE categorias
       SET nombre = p_nombre, descripcion = p_descripcion
     WHERE id_categoria = p_id_categoria;
    SELECT 0 AS Codigo, 'Categoría actualizada correctamente.' AS Mensaje,
           p_id_categoria AS IdCategoria;
  END IF;
END$$
DELIMITER ;

-- PRUEBAS RÁPIDAS
-- CALL sp_GuardarCategoria(0, 'Arte', 'Pintura, música y diseño');   -- crea
-- CALL sp_GuardarCategoria(0, 'arte', NULL);                          -- Codigo 3 (duplicada)
-- CALL sp_GuardarCategoria(999, 'No existe', NULL);                   -- NULL, NULL, NULL