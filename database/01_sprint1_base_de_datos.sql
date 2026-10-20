-- =====================================================================
-- SPRINT 1 - La Casa Del Libro (MySQL)
-- Scripts 1 y 2 de la guía unidos en un solo archivo:
--   * Acceso: roles, usuarios_sistema y sp_IniciarSesion
--   * Negocio: categorias, lectores, libros y prestamos
--
-- Diferencias con la guía (para poder compartirlo por Git sin borrar datos):
--   - NO borra la base de datos (se quitó DROP DATABASE).
--   - Las tablas usan CREATE TABLE IF NOT EXISTS.
--   - Los datos de prueba usan INSERT IGNORE / NOT EXISTS, así que se puede
--     ejecutar más de una vez sin duplicar nada.
--
-- Usuarios de prueba:
--   admin    / Admin12345*     (Administrador)
--   gerente  / Gerente12345*   (Gerente)
--   empleado / Empleado12345*  (Empleado)
--   Cámbialas antes de entregar el sistema.
--
-- Para empezar de cero en tu equipo: DROP DATABASE casadellibro;
-- y luego npm run db:migrar
-- =====================================================================

CREATE DATABASE IF NOT EXISTS casadellibro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE casadellibro;

-- ---------------------------------------------------------------------
-- ACCESO AL SISTEMA (HU01 a HU04)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre_rol VARCHAR(30) NOT NULL UNIQUE,
  descripcion VARCHAR(200),
  CONSTRAINT ck_roles CHECK (nombre_rol IN ('Administrador','Gerente','Empleado'))
);

CREATE TABLE IF NOT EXISTS usuarios_sistema (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  id_rol INT NOT NULL,
  nombre_completo VARCHAR(100) NOT NULL,
  nombre_usuario VARCHAR(30) NOT NULL UNIQUE,
  correo VARCHAR(100) NOT NULL UNIQUE,
  password_hash CHAR(128) NOT NULL,
  salt CHAR(36) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

INSERT IGNORE INTO roles (nombre_rol, descripcion) VALUES
('Administrador','Gestiona usuarios, roles y configuración'),
('Gerente','Consulta reportes y supervisa la operación'),
('Empleado','Opera préstamos, devoluciones, lectores y catálogo');

SET @s1 = UUID();
SET @s2 = UUID();
SET @s3 = UUID();

INSERT IGNORE INTO usuarios_sistema (id_rol, nombre_completo, nombre_usuario, correo, password_hash, salt) VALUES
((SELECT id_rol FROM roles WHERE nombre_rol='Administrador'), 'Administrador General', 'admin', 'admin@casadellibro.com', SHA2(CONCAT('Admin12345*', @s1), 512), @s1),
((SELECT id_rol FROM roles WHERE nombre_rol='Gerente'), 'Gerente de Biblioteca', 'gerente', 'gerente@casadellibro.com', SHA2(CONCAT('Gerente12345*', @s2), 512), @s2),
((SELECT id_rol FROM roles WHERE nombre_rol='Empleado'), 'Empleado de Circulación', 'empleado', 'empleado@casadellibro.com', SHA2(CONCAT('Empleado12345*', @s3), 512), @s3);

DROP PROCEDURE IF EXISTS sp_IniciarSesion;

DELIMITER $$
CREATE PROCEDURE sp_IniciarSesion(IN p_usuario VARCHAR(30), IN p_password VARCHAR(100))
BEGIN
  DECLARE v_id INT;
  DECLARE v_activo TINYINT;
  DECLARE v_salt CHAR(36);
  DECLARE v_hash CHAR(128);
  DECLARE v_rol VARCHAR(30);
  DECLARE v_nombre VARCHAR(100);
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id = NULL;

  SELECT u.id_usuario, u.activo, u.salt, u.password_hash, r.nombre_rol, u.nombre_completo
    INTO v_id, v_activo, v_salt, v_hash, v_rol, v_nombre
  FROM usuarios_sistema u
  INNER JOIN roles r ON r.id_rol = u.id_rol
  WHERE u.nombre_usuario = p_usuario;

  IF v_id IS NULL OR SHA2(CONCAT(p_password, v_salt), 512) <> v_hash THEN
    SELECT 1 AS Codigo, 'Usuario o contraseña incorrectos.' AS Mensaje;
  ELSEIF v_activo = 0 THEN
    SELECT 2 AS Codigo, 'La cuenta está desactivada. Contacte al administrador.' AS Mensaje;
  ELSE
    SELECT 0 AS Codigo, 'Inicio de sesión exitoso.' AS Mensaje,
           v_id AS IdUsuario, v_nombre AS NombreCompleto, v_rol AS Rol;
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- TABLAS DE NEGOCIO: categorías, lectores, libros y préstamos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  descripcion VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS lectores (
  id_lector INT AUTO_INCREMENT PRIMARY KEY,
  matricula VARCHAR(20) NOT NULL UNIQUE,
  folio VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(100),
  telefono VARCHAR(20),
  estado VARCHAR(15) NOT NULL DEFAULT 'Activo',
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_lectores_estado CHECK (estado IN ('Activo','Suspendido','Baja'))
);

CREATE TABLE IF NOT EXISTS libros (
  id_libro INT AUTO_INCREMENT PRIMARY KEY,
  isbn VARCHAR(20),
  titulo VARCHAR(200) NOT NULL,
  autor VARCHAR(120) NOT NULL,
  id_categoria INT,
  total_ejemplares INT NOT NULL DEFAULT 1,
  ejemplares_disponibles INT NOT NULL DEFAULT 1,
  estado VARCHAR(20) NOT NULL DEFAULT 'Disponible',
  fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria),
  CONSTRAINT ck_libros_ejemplares CHECK (total_ejemplares >= 0 AND ejemplares_disponibles >= 0 AND ejemplares_disponibles <= total_ejemplares),
  CONSTRAINT ck_libros_estado CHECK (estado IN ('Disponible','No disponible','Dañado','Extraviado','Baja')),
  INDEX ix_libros_titulo (titulo),
  INDEX ix_libros_autor (autor)
);

-- La columna clave_activa impide que un lector tenga el mismo libro activo dos veces
-- (resuelve el problema de préstamos duplicados del caso de estudio).
CREATE TABLE IF NOT EXISTS prestamos (
  id_prestamo INT AUTO_INCREMENT PRIMARY KEY,
  id_lector INT NOT NULL,
  id_libro INT NOT NULL,
  id_usuario INT NOT NULL,
  fecha_prestamo DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_limite DATETIME NOT NULL,
  fecha_devolucion DATETIME NULL,
  estado VARCHAR(15) NOT NULL DEFAULT 'Activo',
  clave_activa VARCHAR(30) GENERATED ALWAYS AS (IF(estado = 'Activo', CONCAT(id_lector, '-', id_libro), NULL)) STORED,
  UNIQUE KEY ux_prestamo_activo (clave_activa),
  FOREIGN KEY (id_lector) REFERENCES lectores(id_lector),
  FOREIGN KEY (id_libro) REFERENCES libros(id_libro),
  FOREIGN KEY (id_usuario) REFERENCES usuarios_sistema(id_usuario),
  CONSTRAINT ck_prestamos_estado CHECK (estado IN ('Activo','Devuelto','Vencido')),
  CONSTRAINT ck_prestamos_fechas CHECK (fecha_limite >= fecha_prestamo),
  INDEX ix_prestamos_estado (estado, fecha_limite)
);

-- ---------------------------------------------------------------------
-- DATOS DE PRUEBA
-- ---------------------------------------------------------------------
INSERT IGNORE INTO categorias (nombre) VALUES
('Ciencias'), ('Literatura'), ('Tecnología'), ('Historia'), ('Matemáticas');

INSERT INTO libros (isbn, titulo, autor, id_categoria, total_ejemplares, ejemplares_disponibles)
SELECT '9780307474728', 'Cien años de soledad', 'Gabriel García Márquez',
       (SELECT id_categoria FROM categorias WHERE nombre='Literatura'), 3, 3
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM libros WHERE isbn = '9780307474728');

INSERT INTO libros (isbn, titulo, autor, id_categoria, total_ejemplares, ejemplares_disponibles)
SELECT '9786073145480', 'Pedro Páramo', 'Juan Rulfo',
       (SELECT id_categoria FROM categorias WHERE nombre='Literatura'), 2, 2
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM libros WHERE isbn = '9786073145480');

INSERT INTO libros (isbn, titulo, autor, id_categoria, total_ejemplares, ejemplares_disponibles)
SELECT '9780132350884', 'Clean Code', 'Robert C. Martin',
       (SELECT id_categoria FROM categorias WHERE nombre='Tecnología'), 2, 2
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM libros WHERE isbn = '9780132350884');

INSERT INTO libros (isbn, titulo, autor, id_categoria, total_ejemplares, ejemplares_disponibles)
SELECT '9780553380163', 'Breve historia del tiempo', 'Stephen Hawking',
       (SELECT id_categoria FROM categorias WHERE nombre='Ciencias'), 1, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM libros WHERE isbn = '9780553380163');

INSERT INTO libros (isbn, titulo, autor, id_categoria, total_ejemplares, ejemplares_disponibles)
SELECT '9786071607393', 'Historia de México', 'Luis González',
       (SELECT id_categoria FROM categorias WHERE nombre='Historia'), 2, 2
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM libros WHERE isbn = '9786071607393');

INSERT IGNORE INTO lectores (matricula, folio, nombre, correo, telefono) VALUES
('23020622', 'F-0001', 'Ángel Gabriel Valdez Luna', 'angel@correo.com', '6681000001'),
('23020087', 'F-0002', 'Dilan Miguel Mendoza Borbolla', 'dilan@correo.com', '6681000002'),
('23021259', 'F-0003', 'María Monserrat Vidal de la Cruz', 'monse@correo.com', '6681000003');

-- Préstamo de ejemplo: Ángel tiene "Pedro Páramo" activo
SET @id_libro = (SELECT id_libro FROM libros WHERE isbn = '9786073145480');

INSERT INTO prestamos (id_lector, id_libro, id_usuario, fecha_prestamo, fecha_limite)
SELECT (SELECT id_lector FROM lectores WHERE matricula = '23020622'),
       @id_libro,
       (SELECT id_usuario FROM usuarios_sistema WHERE nombre_usuario = 'empleado'),
       NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prestamos WHERE id_libro = @id_libro AND estado = 'Activo');

-- Solo descuenta el ejemplar si el libro aún tiene todos sus ejemplares libres
UPDATE libros SET ejemplares_disponibles = ejemplares_disponibles - 1
WHERE id_libro = @id_libro AND ejemplares_disponibles = total_ejemplares;