USE hno_investigaciones;

CREATE TABLE IF NOT EXISTS evaluacion_criterios (
  evaluacion_id BIGINT UNSIGNED NOT NULL,
  criterio_id BIGINT UNSIGNED NOT NULL,
  puntaje DECIMAL(7,2) NOT NULL,
  PRIMARY KEY (evaluacion_id, criterio_id),
  CONSTRAINT chk_ec_puntaje CHECK (puntaje >= 0),
  CONSTRAINT fk_ec_evaluacion FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones(id) ON DELETE CASCADE,
  CONSTRAINT fk_ec_criterio FOREIGN KEY (criterio_id) REFERENCES criterios_rubrica(id)
);
