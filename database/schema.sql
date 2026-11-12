CREATE DATABASE IF NOT EXISTS hno_investigaciones CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hno_investigaciones;

CREATE TABLE IF NOT EXISTS roles (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(80) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuario_roles (
  usuario_id BIGINT UNSIGNED NOT NULL,
  rol_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (usuario_id, rol_id),
  CONSTRAINT fk_ur_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_ur_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS comites (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  tipo ENUM('ETICA','INVESTIGACION','BIOSEGURIDAD','OTRO') NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS comite_integrantes (
  comite_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  cargo VARCHAR(80) NULL,
  PRIMARY KEY (comite_id, usuario_id),
  CONSTRAINT fk_ci_comite FOREIGN KEY (comite_id) REFERENCES comites(id),
  CONSTRAINT fk_ci_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS investigaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigador_id BIGINT UNSIGNED NOT NULL,
  titulo VARCHAR(500) NOT NULL,
  resumen TEXT NULL,
  area VARCHAR(150) NULL,
  categoria VARCHAR(100) NULL,
  estado ENUM('BORRADOR','EN_REVISION','CON_OBSERVACIONES','APROBADA','RECHAZADA','PUBLICADA') NOT NULL DEFAULT 'BORRADOR',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_investigador FOREIGN KEY (investigador_id) REFERENCES usuarios(id),
  INDEX idx_inv_estado (estado),
  INDEX idx_inv_investigador (investigador_id)
);

CREATE TABLE IF NOT EXISTS documentos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigacion_id BIGINT UNSIGNED NOT NULL,
  tipo ENUM('ANEXO_A','ANEXO_E','ANEXO_G','ANEXO_I','INVESTIGACION_PDF','OTRO') NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  ruta_controlada VARCHAR(500) NULL,
  mime_type VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
  tamano BIGINT UNSIGNED NOT NULL DEFAULT 0,
  contenido LONGBLOB NOT NULL,
  version INT UNSIGNED NOT NULL,
  vigente BOOLEAN NOT NULL DEFAULT TRUE,
  cargado_por BIGINT UNSIGNED NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_documento_version (investigacion_id, tipo, version),
  CONSTRAINT fk_doc_investigacion FOREIGN KEY (investigacion_id) REFERENCES investigaciones(id),
  CONSTRAINT fk_doc_usuario FOREIGN KEY (cargado_por) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS rondas_revision (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigacion_id BIGINT UNSIGNED NOT NULL,
  numero INT UNSIGNED NOT NULL,
  estado ENUM('ABIERTA','EN_EVALUACION','CERRADA') NOT NULL DEFAULT 'ABIERTA',
  inicia_en DATETIME NOT NULL,
  vence_en DATETIME NULL,
  UNIQUE KEY uq_ronda (investigacion_id, numero),
  CONSTRAINT fk_ronda_investigacion FOREIGN KEY (investigacion_id) REFERENCES investigaciones(id)
);

CREATE TABLE IF NOT EXISTS asignaciones_revision (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ronda_id BIGINT UNSIGNED NOT NULL,
  comite_id BIGINT UNSIGNED NOT NULL,
  integrante_id BIGINT UNSIGNED NOT NULL,
  estado ENUM('PENDIENTE','EN_PROCESO','COMPLETADA') NOT NULL DEFAULT 'PENDIENTE',
  asignado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_asignacion (ronda_id, comite_id, integrante_id),
  CONSTRAINT fk_ar_ronda FOREIGN KEY (ronda_id) REFERENCES rondas_revision(id),
  CONSTRAINT fk_ar_comite FOREIGN KEY (comite_id) REFERENCES comites(id),
  CONSTRAINT fk_ar_integrante FOREIGN KEY (integrante_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS rubricas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  comite_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_rubrica_comite FOREIGN KEY (comite_id) REFERENCES comites(id)
);

CREATE TABLE IF NOT EXISTS criterios_rubrica (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rubrica_id BIGINT UNSIGNED NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  ponderacion DECIMAL(5,2) NOT NULL,
  puntaje_maximo DECIMAL(7,2) NOT NULL,
  CONSTRAINT chk_ponderacion CHECK (ponderacion > 0 AND ponderacion <= 100),
  CONSTRAINT fk_cr_rubrica FOREIGN KEY (rubrica_id) REFERENCES rubricas(id)
);

CREATE TABLE IF NOT EXISTS evaluaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asignacion_id BIGINT UNSIGNED NOT NULL UNIQUE,
  calificacion DECIMAL(7,2) NULL,
  dictamen ENUM('APROBADA','CON_CORRECCIONES','RECHAZADA') NULL,
  observacion_general TEXT NULL,
  evaluado_en DATETIME NULL,
  CONSTRAINT fk_eval_asignacion FOREIGN KEY (asignacion_id) REFERENCES asignaciones_revision(id)
);

CREATE TABLE IF NOT EXISTS evaluacion_criterios (
  evaluacion_id BIGINT UNSIGNED NOT NULL,
  criterio_id BIGINT UNSIGNED NOT NULL,
  puntaje DECIMAL(7,2) NOT NULL,
  PRIMARY KEY (evaluacion_id, criterio_id),
  CONSTRAINT chk_ec_puntaje CHECK (puntaje >= 0),
  CONSTRAINT fk_ec_evaluacion FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones(id) ON DELETE CASCADE,
  CONSTRAINT fk_ec_criterio FOREIGN KEY (criterio_id) REFERENCES criterios_rubrica(id)
);

CREATE TABLE IF NOT EXISTS historial_estados (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigacion_id BIGINT UNSIGNED NOT NULL,
  estado_anterior VARCHAR(40) NULL,
  estado_nuevo VARCHAR(40) NOT NULL,
  cambiado_por BIGINT UNSIGNED NOT NULL,
  motivo VARCHAR(500) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_he_investigacion FOREIGN KEY (investigacion_id) REFERENCES investigaciones(id),
  CONSTRAINT fk_he_usuario FOREIGN KEY (cambiado_por) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS publicaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigacion_id BIGINT UNSIGNED NOT NULL UNIQUE,
  documento_id BIGINT UNSIGNED NOT NULL,
  autorizado_por BIGINT UNSIGNED NOT NULL,
  publicado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pub_investigacion FOREIGN KEY (investigacion_id) REFERENCES investigaciones(id),
  CONSTRAINT fk_pub_documento FOREIGN KEY (documento_id) REFERENCES documentos(id),
  CONSTRAINT fk_pub_usuario FOREIGN KEY (autorizado_por) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS dictamenes_comite (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigacion_id BIGINT UNSIGNED NOT NULL,
  ronda_id BIGINT UNSIGNED NOT NULL,
  comite_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('APROBADA','CON_CORRECCIONES','RECHAZADA') NOT NULL,
  observaciones TEXT NULL,
  registrado_por BIGINT UNSIGNED NOT NULL,
  registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dictamen_ronda_comite (ronda_id, comite_id),
  CONSTRAINT fk_dc_investigacion FOREIGN KEY (investigacion_id) REFERENCES investigaciones(id),
  CONSTRAINT fk_dc_ronda FOREIGN KEY (ronda_id) REFERENCES rondas_revision(id),
  CONSTRAINT fk_dc_comite FOREIGN KEY (comite_id) REFERENCES comites(id),
  CONSTRAINT fk_dc_usuario FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  investigacion_id BIGINT UNSIGNED NULL,
  titulo VARCHAR(180) NOT NULL,
  mensaje VARCHAR(600) NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_not_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_not_investigacion FOREIGN KEY (investigacion_id) REFERENCES investigaciones(id),
  INDEX idx_not_usuario (usuario_id, leida, creado_en)
);

CREATE TABLE IF NOT EXISTS publicaciones_versiones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigacion_id BIGINT UNSIGNED NOT NULL,
  documento_id BIGINT UNSIGNED NOT NULL,
  publicado_por BIGINT UNSIGNED NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  publicado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sustituido_en TIMESTAMP NULL,
  CONSTRAINT fk_pv_investigacion FOREIGN KEY (investigacion_id) REFERENCES investigaciones(id),
  CONSTRAINT fk_pv_documento FOREIGN KEY (documento_id) REFERENCES documentos(id),
  CONSTRAINT fk_pv_usuario FOREIGN KEY (publicado_por) REFERENCES usuarios(id),
  INDEX idx_pv_activa (activo, publicado_en),
  INDEX idx_pv_investigacion (investigacion_id)
);
