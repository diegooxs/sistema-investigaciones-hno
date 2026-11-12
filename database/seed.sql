USE hno_investigaciones;

INSERT INTO roles (codigo, nombre, activo) VALUES
('ADMINISTRADOR', 'Administrador', TRUE),
('ADMIN_INVESTIGADOR', 'Administrador Investigador', TRUE),
('INVESTIGADOR', 'Investigador', TRUE),
('COMITE', 'Integrante de comité', TRUE)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), activo = TRUE;

INSERT INTO comites (nombre, tipo, activo)
SELECT 'Comité de Ética en Investigación', 'ETICA', TRUE
WHERE NOT EXISTS (SELECT 1 FROM comites WHERE nombre = 'Comité de Ética en Investigación');
INSERT INTO comites (nombre, tipo, activo)
SELECT 'Comité de Investigación', 'INVESTIGACION', TRUE
WHERE NOT EXISTS (SELECT 1 FROM comites WHERE nombre = 'Comité de Investigación');
INSERT INTO comites (nombre, tipo, activo)
SELECT 'Comité de Bioseguridad', 'BIOSEGURIDAD', TRUE
WHERE NOT EXISTS (SELECT 1 FROM comites WHERE nombre = 'Comité de Bioseguridad');

INSERT INTO usuarios (nombre, correo, password_hash, activo) VALUES
('Administrador del sistema', 'admin@hno.local', '$2b$10$GEJ9K0tTzFiGr2UdfoVdo.L7RB5frUUVFS2iS0KV8eaX.85cKwPRO', TRUE),
('Responsable de investigación', 'investigacion@hno.local', '$2b$10$f7.KmSCkcjG57as1U/Ps1O55cDv8o8AnN5K9nz6M.x9KdOOHvtwQy', TRUE),
('Investigador de demostración', 'investigador@hno.local', '$2b$10$5KGB86CZnCBXVf0d8kYya.BmV9jjoT7aW3xg8T5RHYjaoSi4yxCg.', TRUE),
('Revisora del Comité de Ética', 'etica@hno.local', '$2b$10$yirqY24FfrGjM0KeLCRSAOi6AwJwNU4lsfLFdmG1w7xRSBUc4RID6', TRUE),
('Revisor del Comité de Investigación', 'comite.investigacion@hno.local', '$2b$10$LMa7CzsqTvIpo0yj5LtEf.hAVm/arS6BGXU3hZ8jrGyOWiwTy5itq', TRUE),
('Revisora del Comité de Bioseguridad', 'bioseguridad@hno.local', '$2b$10$2Wo6/BAQ1aFNn0i6wnQkLO7Hoyzg.nvldQ9GF/2mESLi/nKf9Ystu', TRUE)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), password_hash = VALUES(password_hash), activo = TRUE;

INSERT IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT u.id, r.id FROM usuarios u JOIN roles r ON r.codigo = 'ADMINISTRADOR' WHERE u.correo = 'admin@hno.local';
INSERT IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT u.id, r.id FROM usuarios u JOIN roles r ON r.codigo = 'ADMIN_INVESTIGADOR' WHERE u.correo = 'investigacion@hno.local';
INSERT IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT u.id, r.id FROM usuarios u JOIN roles r ON r.codigo = 'INVESTIGADOR' WHERE u.correo = 'investigador@hno.local';
INSERT IGNORE INTO usuario_roles (usuario_id, rol_id)
SELECT u.id, r.id FROM usuarios u JOIN roles r ON r.codigo = 'COMITE'
WHERE u.correo IN ('etica@hno.local', 'comite.investigacion@hno.local', 'bioseguridad@hno.local');

INSERT IGNORE INTO comite_integrantes (comite_id, usuario_id)
SELECT c.id, u.id FROM comites c JOIN usuarios u ON u.correo = 'etica@hno.local'
WHERE c.nombre = 'Comité de Ética en Investigación';
INSERT IGNORE INTO comite_integrantes (comite_id, usuario_id)
SELECT c.id, u.id FROM comites c JOIN usuarios u ON u.correo = 'comite.investigacion@hno.local'
WHERE c.nombre = 'Comité de Investigación';
INSERT IGNORE INTO comite_integrantes (comite_id, usuario_id)
SELECT c.id, u.id FROM comites c JOIN usuarios u ON u.correo = 'bioseguridad@hno.local'
WHERE c.nombre = 'Comité de Bioseguridad';
