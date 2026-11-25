-- =====================================================================
-- INICIO - Resumen de la biblioteca (solo consulta; no cambia tablas)
--
-- sp_ResumenInicio devuelve UNA fila con los números de las tarjetas del Inicio:
--   PrestamosActivos      préstamos sin devolver (vigentes + vencidos)
--   PrestamosVencidos     de esos, los que ya pasaron su fecha límite
--   LectoresRegistrados   todos los lectores
--   LectoresActivos       lectores en estado Activo
--   LibrosDisponibles     ejemplares que se pueden prestar ahora
--   TitulosDisponibles    títulos con al menos un ejemplar disponible
--
-- Los ejemplares de libros dañados, extraviados o dados de baja no se cuentan.
-- Ejecútalo DESPUÉS de 08_sprint4_reportes.sql.
-- =====================================================================

USE casadellibro;

DROP PROCEDURE IF EXISTS sp_ResumenInicio;
DELIMITER $$
CREATE PROCEDURE sp_ResumenInicio()
BEGIN
  SELECT
    (SELECT COUNT(*) FROM prestamos WHERE estado = 'Activo')                              AS PrestamosActivos,
    (SELECT COUNT(*) FROM prestamos WHERE estado = 'Activo' AND fecha_limite < NOW())     AS PrestamosVencidos,
    (SELECT COUNT(*) FROM lectores)                                                       AS LectoresRegistrados,
    (SELECT COUNT(*) FROM lectores WHERE estado = 'Activo')                               AS LectoresActivos,
    (SELECT CAST(IFNULL(SUM(ejemplares_disponibles), 0) AS SIGNED)
       FROM libros WHERE estado NOT IN ('Dañado', 'Extraviado', 'Baja'))                  AS LibrosDisponibles,
    (SELECT COUNT(*)
       FROM libros WHERE estado NOT IN ('Dañado', 'Extraviado', 'Baja')
                     AND ejemplares_disponibles > 0)                                      AS TitulosDisponibles;
END$$
DELIMITER ;

-- PRUEBA RÁPIDA
-- CALL sp_ResumenInicio();