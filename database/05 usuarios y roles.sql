-- =====================================================================
-- USUARIOS DEL SISTEMA Y ROLES (solo Administrador)
--
-- * Quita la restricción que limitaba los roles a Administrador, Gerente
--   y Empleado, para poder crear roles nuevos.
-- * sp_ListarRoles / sp_GuardarRol            (id 0 crea, id > 0 modifica)
-- * sp_ListarUsuarios / sp_ConsultarUsuario
-- * sp_GuardarUsuario                          (id 0 crea, id > 0 modifica)
-- * sp_CambiarEstadoUsuario                    (activar / desactivar)
--
-- Si el id no existe, los "Guardar" devuelven Codigo = NULL.
-- Reglas: no se puede dejar al sistema sin un Administrador activo, y los
-- tres roles base no se pueden renombrar.
-- =====================================================================

USE casadellibro;

-- ---------------------------------------------------------------------
-- Quitar el CHECK de roles (solo si todavía existe)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS tmp_quitar_check_roles;
DELIMITER $$
CREATE PROCEDURE tmp_quitar_check_roles()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
              WHERE CONSTRAINT_SCHEMA = DATABASE()
                AND TABLE_NAME = 'roles'
                AND CONSTRAINT_NAME = 'ck_roles'
                AND CONSTRAINT_TYPE = 'CHECK') THEN
    ALTER TABLE roles DROP CHECK ck_roles;
  END IF;
END$$
DELIMITER ;

CALL tmp_quitar_check_roles();
DROP PROCEDURE tmp_quitar_check_roles;

-- ---------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ListarRoles;
DELIMITER $$
CREATE PROCEDURE sp_ListarRoles()
BEGIN
  SELECT r.id_rol      AS IdRol,
         r.nombre_rol  AS Nombre,
         r.descripcion AS Descripcion,
         (SELECT COUNT(*) FROM usuarios_sistema u WHERE u.id_rol = r.id_rol) AS Usuarios
  FROM roles r
  ORDER BY r.id_rol;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_GuardarRol;
DELIMITER $$
CREATE PROCEDURE sp_GuardarRol(
  IN p_id_rol      INT,
  IN p_nombre      VARCHAR(100),
  IN p_descripcion VARCHAR(300)
)
proc: BEGIN
  DECLARE v_nombre_actual VARCHAR(30);

  DECLARE EXIT HANDLER FOR 1062
    SELECT 3 AS Codigo, 'Ya existe un rol con ese nombre.' AS Mensaje;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al guardar el rol.' AS Mensaje;

  IF p_id_rol IS NULL OR p_id_rol < 0 THEN
    SELECT 1 AS Codigo, 'El id del rol no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  -- id > 0 que no existe: la base de datos devuelve NULL
  IF p_id_rol > 0 THEN
    SELECT nombre_rol INTO v_nombre_actual FROM roles WHERE id_rol = p_id_rol;
    IF v_nombre_actual IS NULL THEN
      SELECT NULL AS Codigo, NULL AS Mensaje, NULL AS IdRol;
      LEAVE proc;
    END IF;
  END IF;

  SET p_nombre      = TRIM(p_nombre);
  SET p_descripcion = NULLIF(TRIM(p_descripcion), '');

  IF p_nombre IS NULL OR p_nombre = '' THEN
    SELECT 1 AS Codigo, 'El nombre del rol es obligatorio.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF CHAR_LENGTH(p_nombre) > 30 THEN
    SELECT 1 AS Codigo, 'El nombre del rol no puede tener más de 30 caracteres.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_descripcion IS NOT NULL AND CHAR_LENGTH(p_descripcion) > 200 THEN
    SELECT 1 AS Codigo, 'La descripción no puede tener más de 200 caracteres.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_rol > 0
     AND v_nombre_actual IN ('Administrador', 'Gerente', 'Empleado')
     AND p_nombre <> v_nombre_actual THEN
    SELECT 4 AS Codigo, 'Los roles base (Administrador, Gerente y Empleado) no se pueden renombrar.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF EXISTS (SELECT 1 FROM roles WHERE nombre_rol = p_nombre AND id_rol <> p_id_rol) THEN
    SELECT 3 AS Codigo, 'Ya existe un rol con ese nombre.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_rol = 0 THEN
    INSERT INTO roles (nombre_rol, descripcion) VALUES (p_nombre, p_descripcion);
    SELECT 0 AS Codigo, 'Rol registrado correctamente.' AS Mensaje, LAST_INSERT_ID() AS IdRol;
  ELSE
    UPDATE roles SET nombre_rol = p_nombre, descripcion = p_descripcion WHERE id_rol = p_id_rol;
    SELECT 0 AS Codigo, 'Rol actualizado correctamente.' AS Mensaje, p_id_rol AS IdRol;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- USUARIOS (nunca se devuelve password_hash ni salt)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ListarUsuarios;
DELIMITER $$
CREATE PROCEDURE sp_ListarUsuarios(
  IN p_termino VARCHAR(100),
  IN p_id_rol  INT,
  IN p_activo  INT
)
BEGIN
  SET p_termino = TRIM(p_termino);

  SELECT u.id_usuario      AS IdUsuario,
         u.nombre_completo AS NombreCompleto,
         u.nombre_usuario  AS Usuario,
         u.correo          AS Correo,
         u.id_rol          AS IdRol,
         r.nombre_rol      AS Rol,
         u.activo          AS Activo,
         u.fecha_registro  AS FechaRegistro
  FROM usuarios_sistema u
  INNER JOIN roles r ON r.id_rol = u.id_rol
  WHERE (p_termino IS NULL OR p_termino = ''
         OR u.nombre_completo LIKE CONCAT('%', p_termino, '%')
         OR u.nombre_usuario  LIKE CONCAT('%', p_termino, '%')
         OR u.correo          LIKE CONCAT('%', p_termino, '%'))
    AND (p_id_rol IS NULL OR u.id_rol = p_id_rol)
    AND (p_activo IS NULL OR u.activo = p_activo)
  ORDER BY u.nombre_completo;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_ConsultarUsuario;
DELIMITER $$
CREATE PROCEDURE sp_ConsultarUsuario(IN p_id_usuario INT)
BEGIN
  SELECT u.id_usuario      AS IdUsuario,
         u.nombre_completo AS NombreCompleto,
         u.nombre_usuario  AS Usuario,
         u.correo          AS Correo,
         u.id_rol          AS IdRol,
         r.nombre_rol      AS Rol,
         u.activo          AS Activo,
         u.fecha_registro  AS FechaRegistro
  FROM usuarios_sistema u
  INNER JOIN roles r ON r.id_rol = u.id_rol
  WHERE u.id_usuario = p_id_usuario;
END$$
DELIMITER ;

-- id = 0 crea (la contraseña es obligatoria)
-- id > 0 modifica (la contraseña es opcional: vacía = se conserva la actual)
DROP PROCEDURE IF EXISTS sp_GuardarUsuario;
DELIMITER $$
CREATE PROCEDURE sp_GuardarUsuario(
  IN p_id_usuario      INT,
  IN p_id_rol          INT,
  IN p_nombre_completo VARCHAR(150),
  IN p_nombre_usuario  VARCHAR(60),
  IN p_correo          VARCHAR(150),
  IN p_password        VARCHAR(150)
)
proc: BEGIN
  DECLARE v_salt          CHAR(36);
  DECLARE v_rol_actual    VARCHAR(30);
  DECLARE v_rol_nuevo     VARCHAR(30);
  DECLARE v_activo_actual TINYINT;

  DECLARE EXIT HANDLER FOR 1062
    SELECT 3 AS Codigo, 'El nombre de usuario o el correo ya están registrados.' AS Mensaje;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al guardar el usuario.' AS Mensaje;

  IF p_id_usuario IS NULL OR p_id_usuario < 0 THEN
    SELECT 1 AS Codigo, 'El id del usuario no es válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  -- id > 0 que no existe: la base de datos devuelve NULL
  IF p_id_usuario > 0 THEN
    SELECT r.nombre_rol, u.activo
      INTO v_rol_actual, v_activo_actual
    FROM usuarios_sistema u
    INNER JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = p_id_usuario;

    IF v_rol_actual IS NULL THEN
      SELECT NULL AS Codigo, NULL AS Mensaje, NULL AS IdUsuario;
      LEAVE proc;
    END IF;
  END IF;

  SET p_nombre_completo = TRIM(p_nombre_completo);
  SET p_nombre_usuario  = TRIM(p_nombre_usuario);
  SET p_correo          = TRIM(p_correo);
  SET p_password        = NULLIF(p_password, '');

  IF p_nombre_completo IS NULL OR p_nombre_completo = ''
     OR p_nombre_usuario IS NULL OR p_nombre_usuario = ''
     OR p_correo IS NULL OR p_correo = '' THEN
    SELECT 1 AS Codigo, 'El nombre, el usuario y el correo son obligatorios.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF CHAR_LENGTH(p_nombre_completo) > 100 THEN
    SELECT 1 AS Codigo, 'El nombre no puede tener más de 100 caracteres.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_nombre_usuario NOT REGEXP '^[A-Za-z0-9._-]{3,30}$' THEN
    SELECT 1 AS Codigo, 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF CHAR_LENGTH(p_correo) > 100 OR p_correo NOT REGEXP '^[^@ ]+@[^@ ]+[.][^@ ]+$' THEN
    SELECT 1 AS Codigo, 'El correo no tiene un formato válido.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_usuario = 0 AND p_password IS NULL THEN
    SELECT 1 AS Codigo, 'La contraseña es obligatoria para un usuario nuevo.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_password IS NOT NULL AND (CHAR_LENGTH(p_password) < 8 OR CHAR_LENGTH(p_password) > 100) THEN
    SELECT 1 AS Codigo, 'La contraseña debe tener entre 8 y 100 caracteres.' AS Mensaje;
    LEAVE proc;
  END IF;

  SELECT nombre_rol INTO v_rol_nuevo FROM roles WHERE id_rol = p_id_rol;
  IF v_rol_nuevo IS NULL THEN
    SELECT 2 AS Codigo, 'El rol no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF EXISTS (SELECT 1 FROM usuarios_sistema
              WHERE nombre_usuario = p_nombre_usuario AND id_usuario <> p_id_usuario) THEN
    SELECT 3 AS Codigo, 'Ya existe un usuario con ese nombre de usuario.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF EXISTS (SELECT 1 FROM usuarios_sistema
              WHERE correo = p_correo AND id_usuario <> p_id_usuario) THEN
    SELECT 3 AS Codigo, 'Ya existe un usuario con ese correo.' AS Mensaje;
    LEAVE proc;
  END IF;

  -- No dejar al sistema sin un Administrador activo
  IF p_id_usuario > 0
     AND v_rol_actual = 'Administrador' AND v_activo_actual = 1
     AND v_rol_nuevo <> 'Administrador'
     AND NOT EXISTS (SELECT 1
                       FROM usuarios_sistema u
                       INNER JOIN roles r ON r.id_rol = u.id_rol
                      WHERE r.nombre_rol = 'Administrador'
                        AND u.activo = 1
                        AND u.id_usuario <> p_id_usuario) THEN
    SELECT 4 AS Codigo, 'No se puede cambiar el rol del único administrador activo.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_id_usuario = 0 THEN
    SET v_salt = UUID();

    INSERT INTO usuarios_sistema (id_rol, nombre_completo, nombre_usuario, correo, password_hash, salt)
    VALUES (p_id_rol, p_nombre_completo, p_nombre_usuario, p_correo,
            SHA2(CONCAT(p_password, v_salt), 512), v_salt);

    SELECT 0 AS Codigo, 'Usuario registrado correctamente.' AS Mensaje, LAST_INSERT_ID() AS IdUsuario;
  ELSE
    UPDATE usuarios_sistema
       SET id_rol          = p_id_rol,
           nombre_completo = p_nombre_completo,
           nombre_usuario  = p_nombre_usuario,
           correo          = p_correo
     WHERE id_usuario = p_id_usuario;

    IF p_password IS NOT NULL THEN
      SET v_salt = UUID();
      UPDATE usuarios_sistema
         SET salt = v_salt,
             password_hash = SHA2(CONCAT(p_password, v_salt), 512)
       WHERE id_usuario = p_id_usuario;
    END IF;

    SELECT 0 AS Codigo, 'Usuario actualizado correctamente.' AS Mensaje, p_id_usuario AS IdUsuario;
  END IF;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_CambiarEstadoUsuario;
DELIMITER $$
CREATE PROCEDURE sp_CambiarEstadoUsuario(
  IN p_id_usuario INT,
  IN p_activo     INT
)
proc: BEGIN
  DECLARE v_rol VARCHAR(30);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
    SELECT 99 AS Codigo, 'Error inesperado al cambiar el estado del usuario.' AS Mensaje;

  IF p_activo IS NULL OR p_activo NOT IN (0, 1) THEN
    SELECT 1 AS Codigo, 'Estado inválido.' AS Mensaje;
    LEAVE proc;
  END IF;

  SELECT r.nombre_rol INTO v_rol
  FROM usuarios_sistema u
  INNER JOIN roles r ON r.id_rol = u.id_rol
  WHERE u.id_usuario = p_id_usuario;

  IF v_rol IS NULL THEN
    SELECT 2 AS Codigo, 'El usuario no existe.' AS Mensaje;
    LEAVE proc;
  END IF;

  IF p_activo = 0 AND v_rol = 'Administrador'
     AND NOT EXISTS (SELECT 1
                       FROM usuarios_sistema u
                       INNER JOIN roles r ON r.id_rol = u.id_rol
                      WHERE r.nombre_rol = 'Administrador'
                        AND u.activo = 1
                        AND u.id_usuario <> p_id_usuario) THEN
    SELECT 4 AS Codigo, 'No se puede desactivar al único administrador activo.' AS Mensaje;
    LEAVE proc;
  END IF;

  UPDATE usuarios_sistema SET activo = p_activo WHERE id_usuario = p_id_usuario;

  SELECT 0 AS Codigo,
         IF(p_activo = 1, 'Usuario activado.', 'Usuario desactivado.') AS Mensaje;
END$$
DELIMITER ;

-- PRUEBAS RÁPIDAS
-- CALL sp_ListarRoles();
-- CALL sp_GuardarRol(0, 'Auxiliar', 'Apoyo en catalogación');          -- crea
-- CALL sp_GuardarRol(1, 'Admin', NULL);                                 -- Codigo 4 (rol base)
-- CALL sp_GuardarRol(999, 'No existe', NULL);                           -- NULL, NULL, NULL
-- CALL sp_ListarUsuarios('', NULL, NULL);
-- CALL sp_GuardarUsuario(0, 3, 'Prueba Uno', 'prueba1', 'prueba1@correo.com', 'Clave12345*');
-- CALL sp_GuardarUsuario(999, 3, 'No existe', 'noexiste', 'x@correo.com', NULL);   -- NULL, NULL, NULL
-- CALL sp_CambiarEstadoUsuario(1, 0);                                   -- Codigo 4 si es el único admin