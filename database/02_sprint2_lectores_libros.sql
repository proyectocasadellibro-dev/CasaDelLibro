-- =====================================================================
-- SPRINT 2 - La Casa Del Libro (MySQL)
-- Gestión de lectores y libros: SOLO procedimientos almacenados
--
-- Cómo usarlo:
--   1. Ya debes haber ejecutado el Script 1 y el Script 2 de la guía.
--   2. Abre una pestaña nueva en MySQL Workbench (Ctrl + T).
--   3. Pega TODO este archivo y ejecútalo con el rayo (Ctrl + Shift + Enter).
--
-- Convención de respuesta:
--   * Procedimientos que modifican datos -> Codigo (0 = correcto) y Mensaje
--   * Procedimientos de consulta         -> devuelven directamente las filas
--
-- Códigos de error comunes:
--   1 = dato faltante o inválido     2 = registro no encontrado
--   3 = duplicado                    4 = regla de negocio no cumplida
--  99 = error inesperado
-- =====================================================================

USE casadellibro;

-- ---------------------------------------------------------------------
-- HISTORIAS DE USUARIO: HU05 a HU10 (LECTORES)
-- ---------------------------------------------------------------------

-- HU05 · Registrar lector (el folio se genera solo: F-0001, F-0002...)
DROP PROCEDURE IF EXISTS sp_RegistrarLector;
DELIMITER $$
CREATE PROCEDURE sp_RegistrarLector(
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
    SELECT 99 AS Codigo, 'Error inesperado al registrar el lector.' AS Mensaje;

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

  IF EXISTS (SELECT 1 FROM lectores WHERE matricula = p_matricula) THEN
    SELECT 3 AS Codigo, 'Ya existe un lector con esa matrícula.' AS Mensaje;
    LEAVE proc;
  END IF;

  SELECT IFNULL(MAX(CAST(SUBSTRING(folio, 3) AS UNSIGNED)), 0) + 1
    INTO v_num
  FROM lectores
  WHERE folio REGEXP '^F-[0-9]+$';

  SET v_folio = CONCAT('F-', LPAD(v_num, 4, '0'));

  INSERT INTO lectores (matricula, folio, nombre, correo, telefono)
  VALUES (p_matricula, v_folio, p_nombre, p_correo, p_telefono);

  SELECT 0 AS Codigo, 'Lector registrado correctamente.' AS Mensaje,
         LAST_INSERT_ID() AS IdLector, v_folio AS Folio;
END$$
DELIMITER ;

-- HU06 · Consultar los datos de un lector (incluye cuántos préstamos activos tiene)
DROP PROCEDURE IF EXISTS sp_ConsultarLector;
DELIMITER $$
CREATE PROCEDURE sp_ConsultarLector(IN p_id_lector INT)
BEGIN
  SELECT l.id_lector       AS IdLector,
         l.matricula       AS Matricula,
         l.folio           AS Folio,
         l.nombre          AS Nombre,
         l.correo          AS Correo,
         l.telefono        AS Telefono,
         l.estado          AS Estado,
         l.fecha_registro  AS FechaRegistro,
         (SELECT COUNT(*) FROM prestamos p
           WHERE p.id_lector = l.id_lector AND p.estado = 'Activo') AS PrestamosActivos
  FROM lectores l
  WHERE l.id_lector = p_id_lector;
END$$
DELIMITER ;

-- HU07 · Modificar la información de un lector
DROP PROCEDURE IF EXISTS sp_ModificarLector;
DELIMITER $$
CREATE PROCEDURE sp_ModificarLector(
  IN p_id_lector INT,
  IN p_matricula VARCHAR(20),
  IN p_nombre    VARCHAR(100),
  IN p_correo    VARCHAR(100),
  IN p_telefono  VARCHAR(20)
)
proc: BEGIN
  DECLARE EXIT HANDLER FOR 1062
    SELECT 3 AS Codigo, 'La matrícula ya pertenece a otro lector.' AS Mensaje;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al modificar el lector.' AS Mensaje;

  SET p_matricula = TRIM(p_matricula);
  SET p_nombre    = TRIM(p_nombre);
  SET p_correo    = NULLIF(TRIM(p_correo), '');
  SET p_telefono  = NULLIF(TRIM(p_telefono), '');

  IF NOT EXISTS (SELECT 1 FROM lectores WHERE id_lector = p_id_lector) THEN
    SELECT 2 AS Codigo, 'El lector no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_matricula IS NULL OR p_matricula = '' OR p_nombre IS NULL OR p_nombre = '' THEN
    SELECT 1 AS Codigo, 'La matrícula y el nombre son obligatorios.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_correo IS NOT NULL AND p_correo NOT REGEXP '^[^@ ]+@[^@ ]+[.][^@ ]+$' THEN
    SELECT 1 AS Codigo, 'El correo no tiene un formato válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF EXISTS (SELECT 1 FROM lectores
              WHERE matricula = p_matricula AND id_lector <> p_id_lector) THEN
    SELECT 3 AS Codigo, 'La matrícula ya pertenece a otro lector.' AS Mensaje;
    LEAVE proc;
  END IF;

  UPDATE lectores
     SET matricula = p_matricula,
         nombre    = p_nombre,
         correo    = p_correo,
         telefono  = p_telefono
   WHERE id_lector = p_id_lector;

  SELECT 0 AS Codigo, 'Lector actualizado correctamente.' AS Mensaje;
END$$
DELIMITER ;

-- HU08 · Buscar lectores por nombre, matrícula o folio
--        (término vacío = todos; estado vacío = cualquier estado)
DROP PROCEDURE IF EXISTS sp_BuscarLectores;
DELIMITER $$
CREATE PROCEDURE sp_BuscarLectores(
  IN p_termino VARCHAR(100),
  IN p_estado  VARCHAR(15)
)
BEGIN
  SET p_termino = TRIM(p_termino);

  SELECT id_lector      AS IdLector,
         matricula      AS Matricula,
         folio          AS Folio,
         nombre         AS Nombre,
         correo         AS Correo,
         telefono       AS Telefono,
         estado         AS Estado,
         fecha_registro AS FechaRegistro
  FROM lectores
  WHERE (p_termino IS NULL OR p_termino = ''
         OR nombre    LIKE CONCAT('%', p_termino, '%')
         OR matricula LIKE CONCAT('%', p_termino, '%')
         OR folio     LIKE CONCAT('%', p_termino, '%'))
    AND (p_estado IS NULL OR p_estado = '' OR estado = p_estado)
  ORDER BY nombre;
END$$
DELIMITER ;

-- HU10 · Suspender, dar de baja o reactivar un lector
--        Regla: no se puede dar de baja a un lector con préstamos activos.
DROP PROCEDURE IF EXISTS sp_CambiarEstadoLector;
DELIMITER $$
CREATE PROCEDURE sp_CambiarEstadoLector(
  IN p_id_lector INT,
  IN p_estado    VARCHAR(15)
)
proc: BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al cambiar el estado del lector.' AS Mensaje;

  SET p_estado = TRIM(p_estado);

  IF p_estado IS NULL OR p_estado NOT IN ('Activo', 'Suspendido', 'Baja') THEN
    SELECT 1 AS Codigo, 'Estado inválido. Use Activo, Suspendido o Baja.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM lectores WHERE id_lector = p_id_lector) THEN
    SELECT 2 AS Codigo, 'El lector no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_estado = 'Baja' AND EXISTS (SELECT 1 FROM prestamos
                                    WHERE id_lector = p_id_lector AND estado = 'Activo') THEN
    SELECT 4 AS Codigo, 'No se puede dar de baja: el lector tiene préstamos activos.' AS Mensaje;
    LEAVE proc;
  END IF;

  UPDATE lectores SET estado = p_estado WHERE id_lector = p_id_lector;

  SELECT 0 AS Codigo, CONCAT('Estado del lector cambiado a ', p_estado, '.') AS Mensaje;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- HISTORIAS DE USUARIO: HU11 a HU15 (LIBROS)
-- ---------------------------------------------------------------------

-- Apoyo para el formulario de libros: llena la lista desplegable de categorías
DROP PROCEDURE IF EXISTS sp_ListarCategorias;
DELIMITER $$
CREATE PROCEDURE sp_ListarCategorias()
BEGIN
  SELECT id_categoria AS IdCategoria,
         nombre       AS Nombre,
         descripcion  AS Descripcion
  FROM categorias
  ORDER BY nombre;
END$$
DELIMITER ;

-- HU11 / HU12 · Registrar libro con título, autor, categoría y ejemplares
DROP PROCEDURE IF EXISTS sp_RegistrarLibro;
DELIMITER $$
CREATE PROCEDURE sp_RegistrarLibro(
  IN p_isbn         VARCHAR(20),
  IN p_titulo       VARCHAR(200),
  IN p_autor        VARCHAR(120),
  IN p_id_categoria INT,
  IN p_total        INT
)
proc: BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al registrar el libro.' AS Mensaje;

  SET p_isbn   = NULLIF(TRIM(p_isbn), '');
  SET p_titulo = TRIM(p_titulo);
  SET p_autor  = TRIM(p_autor);

  IF p_titulo IS NULL OR p_titulo = '' OR p_autor IS NULL OR p_autor = '' THEN
    SELECT 1 AS Codigo, 'El título y el autor son obligatorios.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_total IS NULL OR p_total < 1 THEN
    SELECT 1 AS Codigo, 'Debe registrar al menos un ejemplar.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_categoria IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM categorias WHERE id_categoria = p_id_categoria) THEN
    SELECT 2 AS Codigo, 'La categoría no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_isbn IS NOT NULL AND EXISTS (SELECT 1 FROM libros WHERE isbn = p_isbn) THEN
    SELECT 3 AS Codigo, 'Ya existe un libro con ese ISBN. Modifique sus ejemplares en lugar de registrarlo de nuevo.' AS Mensaje;
    LEAVE proc;
  END IF;

  INSERT INTO libros (isbn, titulo, autor, id_categoria, total_ejemplares, ejemplares_disponibles, estado)
  VALUES (p_isbn, p_titulo, p_autor, p_id_categoria, p_total, p_total, 'Disponible');

  SELECT 0 AS Codigo, 'Libro registrado correctamente.' AS Mensaje, LAST_INSERT_ID() AS IdLibro;
END$$
DELIMITER ;

-- HU13 · Modificar información de un libro
--        Si cambia el total de ejemplares, se recalculan los disponibles
--        sin tocar los que están prestados.
DROP PROCEDURE IF EXISTS sp_ModificarLibro;
DELIMITER $$
CREATE PROCEDURE sp_ModificarLibro(
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
    SELECT 99 AS Codigo, 'Error inesperado al modificar el libro.' AS Mensaje;

  SET p_isbn   = NULLIF(TRIM(p_isbn), '');
  SET p_titulo = TRIM(p_titulo);
  SET p_autor  = TRIM(p_autor);

  SELECT total_ejemplares, ejemplares_disponibles, estado
    INTO v_total_actual, v_disp_actual, v_estado
  FROM libros
  WHERE id_libro = p_id_libro;

  IF v_total_actual IS NULL THEN
    SELECT 2 AS Codigo, 'El libro no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_titulo IS NULL OR p_titulo = '' OR p_autor IS NULL OR p_autor = '' THEN
    SELECT 1 AS Codigo, 'El título y el autor son obligatorios.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_total IS NULL OR p_total < 0 THEN
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

  SELECT 0 AS Codigo, 'Libro actualizado correctamente.' AS Mensaje;
END$$
DELIMITER ;

-- Consultar un libro por su id (para llenar el formulario de edición)
DROP PROCEDURE IF EXISTS sp_ConsultarLibro;
DELIMITER $$
CREATE PROCEDURE sp_ConsultarLibro(IN p_id_libro INT)
BEGIN
  SELECT b.id_libro               AS IdLibro,
         b.isbn                   AS Isbn,
         b.titulo                 AS Titulo,
         b.autor                  AS Autor,
         b.id_categoria           AS IdCategoria,
         c.nombre                 AS Categoria,
         b.total_ejemplares       AS TotalEjemplares,
         b.ejemplares_disponibles AS EjemplaresDisponibles,
         b.estado                 AS Estado,
         b.fecha_registro         AS FechaRegistro
  FROM libros b
  LEFT JOIN categorias c ON c.id_categoria = b.id_categoria
  WHERE b.id_libro = p_id_libro;
END$$
DELIMITER ;

-- HU15 · Buscar libros por título, autor, categoría o ISBN
--        (término vacío = todos; categoría NULL = todas; no muestra libros dados de baja)
DROP PROCEDURE IF EXISTS sp_BuscarLibros;
DELIMITER $$
CREATE PROCEDURE sp_BuscarLibros(
  IN p_termino      VARCHAR(100),
  IN p_id_categoria INT
)
BEGIN
  SET p_termino = TRIM(p_termino);

  SELECT b.id_libro               AS IdLibro,
         b.isbn                   AS Isbn,
         b.titulo                 AS Titulo,
         b.autor                  AS Autor,
         b.id_categoria           AS IdCategoria,
         c.nombre                 AS Categoria,
         b.total_ejemplares       AS TotalEjemplares,
         b.ejemplares_disponibles AS EjemplaresDisponibles,
         b.estado                 AS Estado
  FROM libros b
  LEFT JOIN categorias c ON c.id_categoria = b.id_categoria
  WHERE b.estado <> 'Baja'
    AND (p_termino IS NULL OR p_termino = ''
         OR b.titulo LIKE CONCAT('%', p_termino, '%')
         OR b.autor  LIKE CONCAT('%', p_termino, '%')
         OR c.nombre LIKE CONCAT('%', p_termino, '%')
         OR b.isbn   LIKE CONCAT('%', p_termino, '%'))
    AND (p_id_categoria IS NULL OR b.id_categoria = p_id_categoria)
  ORDER BY b.titulo;
END$$
DELIMITER ;

-- HU14 · Consultar disponibilidad de ejemplares
--        EstadoDisponibilidad: Disponible, Prestado (sin ejemplares libres)
--        o No disponible (dañado, extraviado o dado de baja).
DROP PROCEDURE IF EXISTS sp_ConsultarDisponibilidad;
DELIMITER $$
CREATE PROCEDURE sp_ConsultarDisponibilidad(IN p_termino VARCHAR(100))
BEGIN
  SET p_termino = TRIM(p_termino);

  SELECT b.id_libro                          AS IdLibro,
         b.titulo                            AS Titulo,
         b.autor                             AS Autor,
         c.nombre                            AS Categoria,
         b.total_ejemplares                  AS TotalEjemplares,
         b.ejemplares_disponibles            AS EjemplaresDisponibles,
         b.total_ejemplares - b.ejemplares_disponibles AS EjemplaresPrestados,
         CASE
           WHEN b.estado IN ('Dañado', 'Extraviado', 'Baja') THEN 'No disponible'
           WHEN b.ejemplares_disponibles > 0 THEN 'Disponible'
           ELSE 'Prestado'
         END                                 AS EstadoDisponibilidad
  FROM libros b
  LEFT JOIN categorias c ON c.id_categoria = b.id_categoria
  WHERE p_termino IS NULL OR p_termino = ''
        OR b.titulo LIKE CONCAT('%', p_termino, '%')
        OR b.autor  LIKE CONCAT('%', p_termino, '%')
        OR c.nombre LIKE CONCAT('%', p_termino, '%')
  ORDER BY b.titulo;
END$$
DELIMITER ;

-- =====================================================================
-- PERMISOS: el usuario de la aplicación solo puede ejecutar procedimientos.
-- Los procedimientos nuevos ya quedan cubiertos por este GRANT.
-- (Quita los comentarios si todavía no lo has ejecutado.)
-- =====================================================================
-- REVOKE ALL PRIVILEGES ON casadellibro.* FROM 'casalibro_app'@'localhost';
-- GRANT EXECUTE ON casadellibro.* TO 'casalibro_app'@'localhost';
-- FLUSH PRIVILEGES;

-- =====================================================================
-- PRUEBAS RÁPIDAS (ejecútalas una por una, seleccionando cada línea)
-- =====================================================================
-- CALL sp_RegistrarLector('23099999', 'Lector de Prueba', 'prueba@correo.com', '6681234567');
-- CALL sp_RegistrarLector('23099999', 'Duplicado', NULL, NULL);          -- Codigo 3
-- CALL sp_BuscarLectores('Ángel', NULL);
-- CALL sp_BuscarLectores('F-000', 'Activo');
-- CALL sp_ConsultarLector(1);
-- CALL sp_ModificarLector(1, '23020622', 'Ángel Gabriel Valdez Luna', 'angel@correo.com', '6681000009');
-- CALL sp_CambiarEstadoLector(2, 'Suspendido');
-- CALL sp_CambiarEstadoLector(1, 'Baja');                                 -- Codigo 4 (tiene préstamo activo)
--
-- CALL sp_ListarCategorias();
-- CALL sp_RegistrarLibro('9780000000001', 'Libro de Prueba', 'Autor Prueba', 3, 4);
-- CALL sp_BuscarLibros('García', NULL);
-- CALL sp_BuscarLibros('', 3);                                            -- solo Tecnología
-- CALL sp_ConsultarLibro(1);
-- CALL sp_ModificarLibro(2, '9786073145480', 'Pedro Páramo', 'Juan Rulfo', 2, 1);  -- Codigo 4 (1 ya prestado)
-- CALL sp_ConsultarDisponibilidad('');