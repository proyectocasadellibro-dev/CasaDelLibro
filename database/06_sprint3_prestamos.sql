-- SPRINT 3: PRESTAMOS Y DEVOLUCIONES

USE casadellibro;

CREATE INDEX idx_prestamos_lector_estado
ON prestamos (id_lector, estado);

CREATE INDEX idx_prestamos_libro_estado
ON prestamos (id_libro, estado);

CREATE INDEX idx_prestamos_fecha_limite
ON prestamos (fecha_limite);