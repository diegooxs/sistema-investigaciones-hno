import bcrypt from 'bcryptjs';
import { createDatabasePool } from './database.js';
import { calculateWeightedScore, REQUIRED_DOCUMENT_TYPES, REVIEW_RECOMMENDATIONS, validateRubricCriteria } from './review-logic.js';

const roles = [
  { id: 1, code: 'ADMINISTRADOR', name: 'Administrador' },
  { id: 2, code: 'ADMIN_INVESTIGADOR', name: 'Administrador Investigador' },
  { id: 3, code: 'INVESTIGADOR', name: 'Investigador' },
  { id: 4, code: 'COMITE', name: 'Integrante de comité' }
];

const catalogs = Object.freeze({
  committeeTypes: ['ETICA', 'INVESTIGACION', 'BIOSEGURIDAD', 'OTRO'],
  researchStates: ['BORRADOR', 'EN_REVISION', 'CON_OBSERVACIONES', 'APROBADA', 'RECHAZADA', 'PUBLICADA'],
  documentTypes: ['ANEXO_A', 'ANEXO_E', 'ANEXO_G', 'ANEXO_I', 'INVESTIGACION_PDF', 'OTRO'],
  roundStates: ['ABIERTA', 'EN_EVALUACION', 'CERRADA'],
  assignmentStates: ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA'],
  reviewRecommendations: REVIEW_RECOMMENDATIONS
});

const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
const roleList = (value) => value ? String(value).split(',').filter(Boolean) : [];
const iso = (value) => value instanceof Date ? value.toISOString() : value;
const publicUser = (row) => row && ({
  id: Number(row.id), name: row.name, email: row.email,
  active: Boolean(row.active), roles: roleList(row.roles)
});
const authUser = (row) => row && ({ ...publicUser(row), passwordHash: row.passwordHash });
const committeeDto = (row) => ({
  id: Number(row.id), name: row.name, type: row.type,
  active: Boolean(row.active), memberIds: row.memberIds ? String(row.memberIds).split(',').map(Number) : []
});
const documentDto = (row, includeContent = false) => ({
  id: Number(row.id), researchId: Number(row.researchId), type: row.type,
  originalName: row.originalName, mimeType: row.mimeType,
  size: Number(row.size), version: Number(row.version), current: Boolean(row.current),
  uploadedBy: Number(row.uploadedBy), uploadedByName: row.uploadedByName ?? '', createdAt: iso(row.createdAt),
  ...(includeContent ? { content: row.content } : {})
});
const researchDto = (row) => ({
  id: Number(row.id), investigatorId: Number(row.investigatorId),
  title: row.title, summary: row.summary ?? '', area: row.area ?? '', category: row.category ?? '',
  state: row.state, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
  investigator: {
    id: Number(row.investigatorId), name: row.investigatorName,
    email: row.investigatorEmail, active: Boolean(row.investigatorActive),
    roles: roleList(row.investigatorRoles)
  },
  documentCount: Number(row.documentCount ?? 0)
});

const userSelect = `
  SELECT u.id, u.nombre AS name, u.correo AS email, u.password_hash AS passwordHash,
         u.activo AS active, GROUP_CONCAT(r.codigo ORDER BY r.id) AS roles
  FROM usuarios u
  LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
  LEFT JOIN roles r ON r.id = ur.rol_id`;

const researchSelect = `
  SELECT i.id, i.investigador_id AS investigatorId, i.titulo AS title,
         i.resumen AS summary, i.area, i.categoria AS category, i.estado AS state,
         i.creado_en AS createdAt, i.actualizado_en AS updatedAt,
         u.nombre AS investigatorName, u.correo AS investigatorEmail,
         u.activo AS investigatorActive,
         GROUP_CONCAT(DISTINCT r.codigo ORDER BY r.id) AS investigatorRoles,
         COUNT(DISTINCT CASE WHEN d.vigente = TRUE THEN d.id END) AS documentCount
  FROM investigaciones i
  JOIN usuarios u ON u.id = i.investigador_id
  LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
  LEFT JOIN roles r ON r.id = ur.rol_id
  LEFT JOIN documentos d ON d.investigacion_id = i.id`;

function canSeeAll(user) {
  return user.roles.some((role) => ['ADMINISTRADOR', 'ADMIN_INVESTIGADOR'].includes(role));
}

function canManageReviews(user) {
  return user.roles.some((role) => ['ADMINISTRADOR', 'ADMIN_INVESTIGADOR'].includes(role));
}

async function replaceUserRoles(connection, userId, roleCodes) {
  const codes = roleCodes ?? [];
  const invalid = codes.find((code) => !roles.some((role) => role.code === code));
  if (invalid) fail(`Rol no válido: ${invalid}`, 400);
  await connection.query('DELETE FROM usuario_roles WHERE usuario_id = ?', [userId]);
  for (const code of codes) {
    const result = await connection.query(
      'INSERT INTO usuario_roles (usuario_id, rol_id) SELECT ?, id FROM roles WHERE codigo = ?',
      [userId, code]
    );
    if (!result.affectedRows) fail(`Rol no encontrado en la base de datos: ${code}`, 500);
  }
}

export function createMariaDbStore({ pool = createDatabasePool() } = {}) {
  const store = {
    kind: 'mariadb', pool, roles, catalogs,
    async health() { await pool.query('SELECT 1'); return true; },

    async findUserByEmail(email) {
      const rows = await pool.query(`${userSelect} WHERE LOWER(u.correo) = LOWER(?) GROUP BY u.id`, [String(email ?? '')]);
      return authUser(rows[0]);
    },
    async findUserById(id) {
      const rows = await pool.query(`${userSelect} WHERE u.id = ? GROUP BY u.id`, [Number(id)]);
      return authUser(rows[0]);
    },
    async listUsers() {
      const rows = await pool.query(`${userSelect} GROUP BY u.id ORDER BY u.nombre`);
      return rows.map(publicUser);
    },
    async listResearchers() {
      const rows = await pool.query(`${userSelect}
        WHERE u.activo = TRUE AND r.codigo IN ('ADMIN_INVESTIGADOR', 'INVESTIGADOR')
        GROUP BY u.id ORDER BY u.nombre`);
      return rows.map(publicUser);
    },
    async listCommitteeReviewers() {
      const rows = await pool.query(`${userSelect}
        WHERE u.activo = TRUE AND r.codigo = 'COMITE'
        GROUP BY u.id ORDER BY u.nombre`);
      return rows.map(publicUser);
    },
    async createUser(input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const existing = await connection.query('SELECT id FROM usuarios WHERE LOWER(correo) = LOWER(?)', [input.email]);
        if (existing.length) fail('El correo ya está registrado', 409);
        const result = await connection.query(
          'INSERT INTO usuarios (nombre, correo, password_hash, activo) VALUES (?, LOWER(?), ?, TRUE)',
          [input.name, input.email, bcrypt.hashSync(input.password, 10)]
        );
        await replaceUserRoles(connection, result.insertId, input.roles ?? []);
        await connection.commit();
        return publicUser(await this.findUserById(result.insertId));
      } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') fail('El correo ya está registrado', 409);
        throw error;
      } finally { connection.release(); }
    },
    async updateUser(id, changes) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const found = await connection.query('SELECT id FROM usuarios WHERE id = ?', [Number(id)]);
        if (!found.length) fail('Usuario no encontrado', 404);
        if (changes.name !== undefined) await connection.query('UPDATE usuarios SET nombre = ? WHERE id = ?', [String(changes.name).trim(), Number(id)]);
        if (changes.active !== undefined) await connection.query('UPDATE usuarios SET activo = ? WHERE id = ?', [Boolean(changes.active), Number(id)]);
        if (changes.roles !== undefined) await replaceUserRoles(connection, Number(id), changes.roles);
        if (changes.password !== undefined) await connection.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(String(changes.password), 10), Number(id)]);
        await connection.commit();
        return publicUser(await this.findUserById(id));
      } catch (error) {
        await connection.rollback(); throw error;
      } finally { connection.release(); }
    },
    async listCommittees() {
      const rows = await pool.query(`
        SELECT c.id, c.nombre AS name, c.tipo AS type, c.activo AS active,
               GROUP_CONCAT(ci.usuario_id ORDER BY ci.usuario_id) AS memberIds
        FROM comites c LEFT JOIN comite_integrantes ci ON ci.comite_id = c.id
        GROUP BY c.id ORDER BY c.id`);
      return rows.map(committeeDto);
    },
    async createCommittee(input) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await connection.query('INSERT INTO comites (nombre, tipo, activo) VALUES (?, ?, TRUE)', [input.name, input.type]);
        for (const memberId of input.memberIds ?? []) {
          await connection.query('INSERT INTO comite_integrantes (comite_id, usuario_id) VALUES (?, ?)', [result.insertId, Number(memberId)]);
        }
        await connection.commit();
        return { id: result.insertId, name: input.name, type: input.type, active: true, memberIds: (input.memberIds ?? []).map(Number) };
      } catch (error) {
        await connection.rollback(); throw error;
      } finally { connection.release(); }
    },
    async updateCommitteeMembers(id, memberIds) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const committee = await connection.query('SELECT id FROM comites WHERE id = ? AND activo = TRUE', [Number(id)]);
        if (!committee.length) fail('Comité no encontrado', 404);
        const unique = [...new Set(memberIds.map(Number))];
        for (const memberId of unique) {
          const valid = await connection.query(`
            SELECT u.id FROM usuarios u
            JOIN usuario_roles ur ON ur.usuario_id = u.id
            JOIN roles r ON r.id = ur.rol_id
            WHERE u.id = ? AND u.activo = TRUE AND r.codigo = 'COMITE'`, [memberId]);
          if (!valid.length) fail('Todos los integrantes deben ser usuarios activos con rol de comité', 400);
        }
        await connection.query('DELETE FROM comite_integrantes WHERE comite_id = ?', [Number(id)]);
        for (const memberId of unique) await connection.query('INSERT INTO comite_integrantes (comite_id, usuario_id) VALUES (?, ?)', [Number(id), memberId]);
        await connection.commit();
        return (await this.listCommittees()).find((item) => item.id === Number(id));
      } catch (error) {
        await connection.rollback(); throw error;
      } finally { connection.release(); }
    },
    async listInvestigations(user) {
      const where = canSeeAll(user) ? '' : ' WHERE i.investigador_id = ?';
      const params = canSeeAll(user) ? [] : [user.id];
      const rows = await pool.query(`${researchSelect}${where} GROUP BY i.id ORDER BY i.actualizado_en DESC`, params);
      return rows.map(researchDto);
    },
    async findInvestigation(id) {
      const rows = await pool.query('SELECT id, investigador_id AS investigatorId, estado AS state FROM investigaciones WHERE id = ?', [Number(id)]);
      return rows[0] && { id: Number(rows[0].id), investigatorId: Number(rows[0].investigatorId), state: rows[0].state };
    },
    async getInvestigation(id, user) {
      const access = canSeeAll(user) ? '' : ' AND i.investigador_id = ?';
      const params = canSeeAll(user) ? [Number(id)] : [Number(id), user.id];
      const rows = await pool.query(`${researchSelect} WHERE i.id = ?${access} GROUP BY i.id`, params);
      if (!rows.length) {
        const exists = await this.findInvestigation(id);
        if (exists) fail('No tienes permiso para consultar esta investigación', 403);
        fail('Investigación no encontrada', 404);
      }
      return researchDto(rows[0]);
    },
    async createInvestigation(input, user) {
      const canAssign = canSeeAll(user);
      const owner = canAssign && input.investigatorId ? await this.findUserById(input.investigatorId) : user;
      if (!owner?.active || !owner.roles.some((role) => ['ADMIN_INVESTIGADOR', 'INVESTIGADOR'].includes(role))) {
        fail('Selecciona un responsable de investigación activo', 400);
      }
      const result = await pool.query(
        'INSERT INTO investigaciones (investigador_id, titulo, resumen, area, categoria, estado) VALUES (?, ?, ?, ?, ?, \'BORRADOR\')',
        [owner.id, input.title.trim(), input.summary?.trim() ?? '', input.area?.trim() ?? '', input.category?.trim() ?? '']
      );
      return this.getInvestigation(result.insertId, user);
    },
    async updateInvestigation(id, changes, user) {
      const research = await this.findInvestigation(id);
      if (!research) fail('Investigación no encontrada', 404);
      if (!canSeeAll(user) && research.investigatorId !== user.id) fail('No tienes permiso para modificar esta investigación', 403);
      if (!['BORRADOR', 'CON_OBSERVACIONES'].includes(research.state)) fail('Solo pueden modificarse investigaciones en borrador o con observaciones', 409);
      const current = await this.getInvestigation(id, user);
      const values = {};
      for (const key of ['title', 'summary', 'area', 'category']) values[key] = changes[key] === undefined ? current[key] : String(changes[key]).trim();
      if (!values.title) fail('El título es obligatorio', 400);
      await pool.query(
        'UPDATE investigaciones SET titulo = ?, resumen = ?, area = ?, categoria = ? WHERE id = ?',
        [values.title, values.summary, values.area, values.category, Number(id)]
      );
      return this.getInvestigation(id, user);
    },
    async listDocuments(researchId, user) {
      await this.getInvestigation(researchId, user);
      const rows = await pool.query(`
        SELECT d.id, d.investigacion_id AS researchId, d.tipo AS type, d.nombre_original AS originalName,
               d.mime_type AS mimeType, d.tamano AS size, d.version, d.vigente AS current,
               d.cargado_por AS uploadedBy, u.nombre AS uploadedByName, d.creado_en AS createdAt
        FROM documentos d JOIN usuarios u ON u.id = d.cargado_por
        WHERE d.investigacion_id = ? ORDER BY d.tipo, d.version`, [Number(researchId)]);
      return rows.map((row) => documentDto(row));
    },
    async addDocument(researchId, input, user) {
      const research = await this.findInvestigation(researchId);
      if (!research) fail('Investigación no encontrada', 404);
      if (!canSeeAll(user) && research.investigatorId !== user.id) fail('No tienes permiso para cargar documentos', 403);
      if (!['BORRADOR', 'CON_OBSERVACIONES'].includes(research.state)) fail('Solo pueden cargarse documentos en borrador o durante una corrección', 409);
      if (!catalogs.documentTypes.includes(input.type)) fail('Tipo documental no válido', 400);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const versions = await connection.query(
          'SELECT COALESCE(MAX(version), 0) AS lastVersion FROM documentos WHERE investigacion_id = ? AND tipo = ? FOR UPDATE',
          [Number(researchId), input.type]
        );
        await connection.query('UPDATE documentos SET vigente = FALSE WHERE investigacion_id = ? AND tipo = ?', [Number(researchId), input.type]);
        const version = Number(versions[0].lastVersion) + 1;
        const result = await connection.query(`
          INSERT INTO documentos
            (investigacion_id, tipo, nombre_original, mime_type, tamano, contenido, version, vigente, cargado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
          [Number(researchId), input.type, input.originalName, input.mimeType, input.content.length, input.content, version, user.id]
        );
        await connection.query('UPDATE investigaciones SET actualizado_en = CURRENT_TIMESTAMP WHERE id = ?', [Number(researchId)]);
        await connection.commit();
        const rows = await pool.query(`
          SELECT d.id, d.investigacion_id AS researchId, d.tipo AS type, d.nombre_original AS originalName,
                 d.mime_type AS mimeType, d.tamano AS size, d.version, d.vigente AS current,
                 d.cargado_por AS uploadedBy, u.nombre AS uploadedByName, d.creado_en AS createdAt
          FROM documentos d JOIN usuarios u ON u.id = d.cargado_por WHERE d.id = ?`, [result.insertId]);
        return documentDto(rows[0]);
      } catch (error) {
        await connection.rollback(); throw error;
      } finally { connection.release(); }
    },
    async getDocument(documentId, user) {
      const rows = await pool.query(`
        SELECT d.id, d.investigacion_id AS researchId, d.tipo AS type, d.nombre_original AS originalName,
               d.mime_type AS mimeType, d.tamano AS size, d.version, d.vigente AS current,
               d.cargado_por AS uploadedBy, u.nombre AS uploadedByName, d.creado_en AS createdAt, d.contenido AS content
        FROM documentos d JOIN usuarios u ON u.id = d.cargado_por WHERE d.id = ?`, [Number(documentId)]);
      if (!rows.length) fail('Documento no encontrado', 404);
      await this.getInvestigation(rows[0].researchId, user);
      return documentDto(rows[0], true);
    },
    async listRounds(user) {
      const rows = await pool.query(`
        SELECT DISTINCT rr.id
        FROM rondas_revision rr
        JOIN investigaciones i ON i.id = rr.investigacion_id
        LEFT JOIN asignaciones_revision ar ON ar.ronda_id = rr.id
        WHERE ? = TRUE OR i.investigador_id = ? OR ar.integrante_id = ?
        ORDER BY rr.id DESC`, [canManageReviews(user), user.id, user.id]);
      return Promise.all(rows.map((row) => this.getRound(row.id, user)));
    },
    async getRound(id, user) {
      const rows = await pool.query(`
        SELECT rr.id, rr.investigacion_id AS researchId, rr.numero AS number,
               rr.estado AS state, rr.inicia_en AS startsAt, rr.vence_en AS dueAt,
               i.investigador_id AS investigatorId, i.titulo AS researchTitle,
               i.resumen AS researchSummary, i.area, i.categoria AS category,
               i.estado AS researchState, i.creado_en AS researchCreatedAt,
               i.actualizado_en AS researchUpdatedAt,
               u.nombre AS investigatorName, u.correo AS investigatorEmail, u.activo AS investigatorActive
        FROM rondas_revision rr
        JOIN investigaciones i ON i.id = rr.investigacion_id
        JOIN usuarios u ON u.id = i.investigador_id
        WHERE rr.id = ?`, [Number(id)]);
      if (!rows.length) fail('Ronda de revisión no encontrada', 404);
      const row = rows[0];
      const ownAssignment = await pool.query('SELECT id FROM asignaciones_revision WHERE ronda_id = ? AND integrante_id = ?', [Number(id), user.id]);
      if (!canManageReviews(user) && Number(row.investigatorId) !== user.id && !ownAssignment.length) fail('No tienes permiso para consultar esta ronda', 403);
      const assignmentRows = await pool.query(`
        SELECT ar.id, ar.ronda_id AS roundId, ar.comite_id AS committeeId,
               ar.integrante_id AS memberId, ar.estado AS state, ar.asignado_en AS assignedAt,
               c.nombre AS committeeName, c.tipo AS committeeType,
               u.nombre AS memberName, u.correo AS memberEmail,
               e.id AS evaluationId, e.calificacion AS score, e.dictamen AS recommendation,
               e.observacion_general AS generalObservation, e.evaluado_en AS evaluatedAt
        FROM asignaciones_revision ar
        JOIN comites c ON c.id = ar.comite_id
        JOIN usuarios u ON u.id = ar.integrante_id
        LEFT JOIN evaluaciones e ON e.asignacion_id = ar.id
        WHERE ar.ronda_id = ? ORDER BY c.nombre, u.nombre`, [Number(id)]);
      const related = assignmentRows;
      const visible = canManageReviews(user) ? related : user.roles.includes('COMITE') ? related.filter((item) => Number(item.memberId) === user.id) : [];
      return {
        id: Number(row.id), researchId: Number(row.researchId), number: Number(row.number),
        state: row.state, startsAt: iso(row.startsAt), dueAt: iso(row.dueAt),
        research: {
          id: Number(row.researchId), investigatorId: Number(row.investigatorId), title: row.researchTitle,
          summary: row.researchSummary ?? '', area: row.area ?? '', category: row.category ?? '', state: row.researchState,
          createdAt: iso(row.researchCreatedAt), updatedAt: iso(row.researchUpdatedAt),
          investigator: { id: Number(row.investigatorId), name: row.investigatorName, email: row.investigatorEmail, active: Boolean(row.investigatorActive), roles: [] }
        },
        assignmentCount: related.length,
        completedCount: related.filter((item) => item.state === 'COMPLETADA').length,
        assignments: visible.map((item) => ({
          id: Number(item.id), roundId: Number(item.roundId), committeeId: Number(item.committeeId), memberId: Number(item.memberId),
          state: item.state, assignedAt: iso(item.assignedAt),
          committee: { id: Number(item.committeeId), name: item.committeeName, type: item.committeeType },
          member: { id: Number(item.memberId), name: item.memberName, email: item.memberEmail, active: true, roles: ['COMITE'] },
          evaluation: item.evaluationId ? { id: Number(item.evaluationId), assignmentId: Number(item.id), score: Number(item.score), recommendation: item.recommendation, generalObservation: item.generalObservation ?? '', evaluatedAt: iso(item.evaluatedAt) } : null
        }))
      };
    },
    async createRound(researchId, input, user) {
      const dueAt = new Date(input.dueAt);
      if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) fail('La fecha de vencimiento debe ser posterior a la fecha actual', 400);
      if (!input.assignments?.length) fail('Selecciona al menos un integrante de comité', 400);
      const connection = await pool.getConnection();
      let roundId;
      try {
        await connection.beginTransaction();
        const researchRows = await connection.query('SELECT id, estado AS state FROM investigaciones WHERE id = ? FOR UPDATE', [Number(researchId)]);
        if (!researchRows.length) fail('Investigación no encontrada', 404);
        if (researchRows[0].state !== 'BORRADOR') fail('La primera ronda solamente puede abrirse desde un expediente en borrador', 409);
        const documentRows = await connection.query('SELECT DISTINCT tipo FROM documentos WHERE investigacion_id = ? AND vigente = TRUE', [Number(researchId)]);
        const currentTypes = new Set(documentRows.map((item) => item.tipo));
        const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !currentTypes.has(type));
        if (missing.length) fail(`El expediente está incompleto. Faltan: ${missing.join(', ')}`, 409);
        const selected = new Set();
        for (const assignment of input.assignments) {
          const committeeId = Number(assignment.committeeId); const memberId = Number(assignment.memberId);
          const valid = await connection.query(`
            SELECT ci.usuario_id FROM comite_integrantes ci
            JOIN comites c ON c.id = ci.comite_id AND c.activo = TRUE
            JOIN usuarios u ON u.id = ci.usuario_id AND u.activo = TRUE
            JOIN usuario_roles ur ON ur.usuario_id = u.id
            JOIN roles r ON r.id = ur.rol_id AND r.codigo = 'COMITE'
            WHERE ci.comite_id = ? AND ci.usuario_id = ?`, [committeeId, memberId]);
          const key = `${committeeId}:${memberId}`;
          if (!valid.length) fail('Cada asignación debe corresponder a un integrante activo del comité seleccionado', 400);
          if (selected.has(key)) fail('No repitas una asignación para el mismo comité e integrante', 400);
          selected.add(key);
        }
        const numbers = await connection.query('SELECT COALESCE(MAX(numero), 0) AS lastNumber FROM rondas_revision WHERE investigacion_id = ? FOR UPDATE', [Number(researchId)]);
        const number = Number(numbers[0].lastNumber) + 1;
        const result = await connection.query('INSERT INTO rondas_revision (investigacion_id, numero, estado, inicia_en, vence_en) VALUES (?, ?, \'ABIERTA\', NOW(), ?)', [Number(researchId), number, dueAt]);
        roundId = Number(result.insertId);
        for (const assignment of input.assignments) await connection.query('INSERT INTO asignaciones_revision (ronda_id, comite_id, integrante_id, estado) VALUES (?, ?, ?, \'PENDIENTE\')', [roundId, Number(assignment.committeeId), Number(assignment.memberId)]);
        await connection.query('UPDATE investigaciones SET estado = \'EN_REVISION\' WHERE id = ?', [Number(researchId)]);
        await connection.query('INSERT INTO historial_estados (investigacion_id, estado_anterior, estado_nuevo, cambiado_por, motivo) VALUES (?, \'BORRADOR\', \'EN_REVISION\', ?, ?)', [Number(researchId), user.id, `Apertura de la ronda de revisión ${number}`]);
        await connection.commit();
      } catch (error) {
        await connection.rollback(); throw error;
      } finally { connection.release(); }
      return this.getRound(roundId, user);
    },
    async updateAssignmentStatus(id, status, user) {
      const rows = await pool.query('SELECT id, ronda_id AS roundId, integrante_id AS memberId, estado AS state FROM asignaciones_revision WHERE id = ?', [Number(id)]);
      if (!rows.length) fail('Asignación no encontrada', 404);
      const assignment = rows[0];
      if (!canManageReviews(user) && Number(assignment.memberId) !== user.id) fail('No tienes permiso para actualizar esta asignación', 403);
      if (assignment.state === 'COMPLETADA') fail('La asignación ya fue completada', 409);
      if (status !== 'EN_PROCESO') fail('El único cambio manual permitido es iniciar la revisión', 400);
      await pool.query('UPDATE asignaciones_revision SET estado = ? WHERE id = ?', [status, Number(id)]);
      await pool.query('UPDATE rondas_revision SET estado = \'EN_EVALUACION\' WHERE id = ?', [Number(assignment.roundId)]);
      const round = await this.getRound(assignment.roundId, user);
      return round.assignments.find((item) => item.id === Number(id));
    },
    async listRubrics(user) {
      const where = canManageReviews(user) ? '' : ` WHERE EXISTS (
        SELECT 1 FROM comite_integrantes ci WHERE ci.comite_id = r.comite_id AND ci.usuario_id = ?)`;
      const params = canManageReviews(user) ? [] : [user.id];
      const rows = await pool.query(`
        SELECT r.id, r.comite_id AS committeeId, r.nombre AS name, r.version, r.activa AS active,
               c.nombre AS committeeName, c.tipo AS committeeType
        FROM rubricas r JOIN comites c ON c.id = r.comite_id${where}
        ORDER BY c.nombre, r.version DESC`, params);
      const result = [];
      for (const row of rows) {
        const criterionRows = await pool.query('SELECT id, rubrica_id AS rubricId, descripcion AS description, ponderacion AS weight, puntaje_maximo AS maximumScore FROM criterios_rubrica WHERE rubrica_id = ? ORDER BY id', [Number(row.id)]);
        result.push({ id: Number(row.id), committeeId: Number(row.committeeId), name: row.name, version: Number(row.version), active: Boolean(row.active), committee: { id: Number(row.committeeId), name: row.committeeName, type: row.committeeType }, criteria: criterionRows.map((item) => ({ id: Number(item.id), rubricId: Number(item.rubricId), description: item.description, weight: Number(item.weight), maximumScore: Number(item.maximumScore) })) });
      }
      return result;
    },
    async createRubric(input) {
      const validationError = validateRubricCriteria(input.criteria);
      if (validationError) fail(validationError, 400);
      const connection = await pool.getConnection();
      let rubricId;
      try {
        await connection.beginTransaction();
        const committee = await connection.query('SELECT id FROM comites WHERE id = ? AND activo = TRUE', [Number(input.committeeId)]);
        if (!committee.length) fail('Selecciona un comité activo', 400);
        const versions = await connection.query('SELECT COALESCE(MAX(version), 0) AS lastVersion FROM rubricas WHERE comite_id = ? FOR UPDATE', [Number(input.committeeId)]);
        await connection.query('UPDATE rubricas SET activa = FALSE WHERE comite_id = ?', [Number(input.committeeId)]);
        const result = await connection.query('INSERT INTO rubricas (comite_id, nombre, version, activa) VALUES (?, ?, ?, TRUE)', [Number(input.committeeId), String(input.name).trim(), Number(versions[0].lastVersion) + 1]);
        rubricId = Number(result.insertId);
        for (const criterion of input.criteria) await connection.query('INSERT INTO criterios_rubrica (rubrica_id, descripcion, ponderacion, puntaje_maximo) VALUES (?, ?, ?, ?)', [rubricId, String(criterion.description).trim(), Number(criterion.weight), Number(criterion.maximumScore)]);
        await connection.commit();
      } catch (error) {
        await connection.rollback(); throw error;
      } finally { connection.release(); }
      const rubrics = await this.listRubrics({ id: 0, roles: ['ADMINISTRADOR'] });
      return rubrics.find((item) => item.id === rubricId);
    },
    async getEvaluation(assignmentId, user) {
      const assignmentRows = await pool.query('SELECT id, integrante_id AS memberId FROM asignaciones_revision WHERE id = ?', [Number(assignmentId)]);
      if (!assignmentRows.length) fail('Asignación no encontrada', 404);
      if (!canManageReviews(user) && Number(assignmentRows[0].memberId) !== user.id) fail('No tienes permiso para consultar esta evaluación', 403);
      const rows = await pool.query('SELECT id, asignacion_id AS assignmentId, calificacion AS score, dictamen AS recommendation, observacion_general AS generalObservation, evaluado_en AS evaluatedAt FROM evaluaciones WHERE asignacion_id = ?', [Number(assignmentId)]);
      if (!rows.length) return null;
      const evaluation = rows[0];
      const scoreRows = await pool.query('SELECT criterio_id AS criterionId, puntaje AS score FROM evaluacion_criterios WHERE evaluacion_id = ?', [Number(evaluation.id)]);
      return { id: Number(evaluation.id), assignmentId: Number(evaluation.assignmentId), score: Number(evaluation.score), recommendation: evaluation.recommendation, generalObservation: evaluation.generalObservation ?? '', evaluatedAt: iso(evaluation.evaluatedAt), scores: scoreRows.map((item) => ({ criterionId: Number(item.criterionId), score: Number(item.score) })) };
    },
    async saveEvaluation(assignmentId, input, user) {
      const connection = await pool.getConnection();
      let researchId;
      try {
        await connection.beginTransaction();
        const assignmentRows = await connection.query(`
          SELECT ar.id, ar.ronda_id AS roundId, ar.comite_id AS committeeId, ar.integrante_id AS memberId,
                 rr.investigacion_id AS researchId, rr.estado AS roundState
          FROM asignaciones_revision ar JOIN rondas_revision rr ON rr.id = ar.ronda_id
          WHERE ar.id = ? FOR UPDATE`, [Number(assignmentId)]);
        if (!assignmentRows.length) fail('Asignación no encontrada', 404);
        const assignment = assignmentRows[0]; researchId = Number(assignment.researchId);
        if (Number(assignment.memberId) !== user.id || !user.roles.includes('COMITE')) fail('Solo el integrante asignado puede registrar la evaluación', 403);
        if (assignment.roundState === 'CERRADA') fail('La ronda ya está cerrada', 409);
        if (!REVIEW_RECOMMENDATIONS.includes(input.recommendation)) fail('Selecciona una recomendación válida', 400);
        const rubricRows = await connection.query('SELECT id FROM rubricas WHERE id = ? AND comite_id = ? AND activa = TRUE', [Number(input.rubricId), Number(assignment.committeeId)]);
        if (!rubricRows.length) fail('Selecciona una rúbrica activa del comité', 400);
        const criterionRows = await connection.query('SELECT id, descripcion AS description, ponderacion AS weight, puntaje_maximo AS maximumScore FROM criterios_rubrica WHERE rubrica_id = ? ORDER BY id', [Number(input.rubricId)]);
        const rubricCriteria = criterionRows.map((item) => ({ id: Number(item.id), description: item.description, weight: Number(item.weight), maximumScore: Number(item.maximumScore) }));
        const calculated = calculateWeightedScore(rubricCriteria, input.scores);
        await connection.query(`
          INSERT INTO evaluaciones (asignacion_id, calificacion, dictamen, observacion_general, evaluado_en)
          VALUES (?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE calificacion = VALUES(calificacion), dictamen = VALUES(dictamen), observacion_general = VALUES(observacion_general), evaluado_en = NOW()`,
          [Number(assignmentId), calculated.total, input.recommendation, String(input.generalObservation ?? '').trim()]);
        const evaluationRows = await connection.query('SELECT id FROM evaluaciones WHERE asignacion_id = ?', [Number(assignmentId)]);
        const evaluationId = Number(evaluationRows[0].id);
        await connection.query('DELETE FROM evaluacion_criterios WHERE evaluacion_id = ?', [evaluationId]);
        for (const score of calculated.scores) await connection.query('INSERT INTO evaluacion_criterios (evaluacion_id, criterio_id, puntaje) VALUES (?, ?, ?)', [evaluationId, score.criterionId, score.score]);
        await connection.query('UPDATE asignaciones_revision SET estado = \'COMPLETADA\' WHERE id = ?', [Number(assignmentId)]);
        await connection.query('UPDATE rondas_revision SET estado = \'EN_EVALUACION\' WHERE id = ?', [Number(assignment.roundId)]);
        const negative = await connection.query(`
          SELECT COUNT(*) AS total FROM evaluaciones e
          JOIN asignaciones_revision ar ON ar.id = e.asignacion_id
          WHERE ar.ronda_id = ? AND e.dictamen <> 'APROBADA'`, [Number(assignment.roundId)]);
        const nextState = Number(negative[0].total) > 0 ? 'CON_OBSERVACIONES' : 'EN_REVISION';
        const currentState = await connection.query('SELECT estado AS state FROM investigaciones WHERE id = ? FOR UPDATE', [researchId]);
        if (currentState[0].state !== nextState) {
          await connection.query('UPDATE investigaciones SET estado = ? WHERE id = ?', [nextState, researchId]);
          await connection.query('INSERT INTO historial_estados (investigacion_id, estado_anterior, estado_nuevo, cambiado_por, motivo) VALUES (?, ?, ?, ?, ?)', [researchId, currentState[0].state, nextState, user.id, nextState === 'CON_OBSERVACIONES' ? 'Evaluación con observaciones o correcciones' : 'Evaluación registrada sin observaciones pendientes']);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback(); throw error;
      } finally { connection.release(); }
      return this.getEvaluation(assignmentId, user);
    },
    async getFeedback(researchId, user) {
      await this.getInvestigation(researchId, user);
      const rows = await pool.query(`
        SELECT e.id, rr.id AS roundId, rr.numero AS roundNumber,
               c.id AS committeeId, c.nombre AS committeeName, c.tipo AS committeeType,
               r.nombre AS rubricName, e.calificacion AS score, e.dictamen AS recommendation,
               e.observacion_general AS generalObservation, e.evaluado_en AS evaluatedAt
        FROM evaluaciones e
        JOIN asignaciones_revision ar ON ar.id = e.asignacion_id
        JOIN rondas_revision rr ON rr.id = ar.ronda_id
        JOIN comites c ON c.id = ar.comite_id
        LEFT JOIN evaluacion_criterios ec ON ec.evaluacion_id = e.id
        LEFT JOIN criterios_rubrica cr ON cr.id = ec.criterio_id
        LEFT JOIN rubricas r ON r.id = cr.rubrica_id
        WHERE rr.investigacion_id = ?
        GROUP BY e.id, rr.id, c.id, r.id ORDER BY rr.numero DESC, c.nombre`, [Number(researchId)]);
      const feedback = [];
      for (const row of rows) {
        const criterionRows = await pool.query(`
          SELECT ec.criterio_id AS criterionId, ec.puntaje AS score,
                 cr.descripcion AS description, cr.ponderacion AS weight, cr.puntaje_maximo AS maximumScore
          FROM evaluacion_criterios ec JOIN criterios_rubrica cr ON cr.id = ec.criterio_id
          WHERE ec.evaluacion_id = ? ORDER BY cr.id`, [Number(row.id)]);
        feedback.push({ roundId: Number(row.roundId), roundNumber: Number(row.roundNumber), committee: { id: Number(row.committeeId), name: row.committeeName, type: row.committeeType }, rubricName: row.rubricName ?? '', score: Number(row.score), recommendation: row.recommendation, generalObservation: row.generalObservation ?? '', evaluatedAt: iso(row.evaluatedAt), criteria: criterionRows.map((item) => ({ criterionId: Number(item.criterionId), score: Number(item.score), criterion: { id: Number(item.criterionId), description: item.description, weight: Number(item.weight), maximumScore: Number(item.maximumScore) } })) });
      }
      return feedback;
    },
    async resubmitCorrections(researchId, user) {
      const connection = await pool.getConnection();
      let roundId;
      try {
        await connection.beginTransaction();
        const researchRows = await connection.query('SELECT id, investigador_id AS investigatorId, estado AS state FROM investigaciones WHERE id = ? FOR UPDATE', [Number(researchId)]);
        if (!researchRows.length) fail('Investigación no encontrada', 404);
        const research = researchRows[0];
        if (!canManageReviews(user) && Number(research.investigatorId) !== user.id) fail('No tienes permiso para reenviar esta investigación', 403);
        if (research.state !== 'CON_OBSERVACIONES') fail('La investigación no tiene correcciones pendientes', 409);
        const corrected = await connection.query('SELECT id FROM documentos WHERE investigacion_id = ? AND vigente = TRUE AND version > 1 LIMIT 1', [Number(researchId)]);
        if (!corrected.length) fail('Carga al menos una nueva versión documental antes de reenviar las correcciones', 409);
        const rounds = await connection.query('SELECT id, numero AS number FROM rondas_revision WHERE investigacion_id = ? ORDER BY numero DESC LIMIT 1 FOR UPDATE', [Number(researchId)]);
        if (!rounds.length) fail('No existe una ronda anterior para reenviar', 409);
        const previous = rounds[0];
        const previousAssignments = await connection.query('SELECT comite_id AS committeeId, integrante_id AS memberId FROM asignaciones_revision WHERE ronda_id = ?', [Number(previous.id)]);
        if (!previousAssignments.length) fail('La ronda anterior no tiene asignaciones', 409);
        await connection.query('UPDATE rondas_revision SET estado = \'CERRADA\' WHERE id = ?', [Number(previous.id)]);
        const result = await connection.query('INSERT INTO rondas_revision (investigacion_id, numero, estado, inicia_en, vence_en) VALUES (?, ?, \'ABIERTA\', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY))', [Number(researchId), Number(previous.number) + 1]);
        roundId = Number(result.insertId);
        for (const assignment of previousAssignments) await connection.query('INSERT INTO asignaciones_revision (ronda_id, comite_id, integrante_id, estado) VALUES (?, ?, ?, \'PENDIENTE\')', [roundId, Number(assignment.committeeId), Number(assignment.memberId)]);
        await connection.query('UPDATE investigaciones SET estado = \'EN_REVISION\' WHERE id = ?', [Number(researchId)]);
        await connection.query('INSERT INTO historial_estados (investigacion_id, estado_anterior, estado_nuevo, cambiado_por, motivo) VALUES (?, \'CON_OBSERVACIONES\', \'EN_REVISION\', ?, ?)', [Number(researchId), user.id, `Correcciones enviadas a la ronda ${Number(previous.number) + 1}`]);
        await connection.commit();
      } catch (error) {
        await connection.rollback(); throw error;
      } finally { connection.release(); }
      return this.getRound(roundId, user);
    },
    async getDecisionSummary(researchId, user) {
      const researchRows = await pool.query(`${researchSelect} WHERE i.id = ? GROUP BY i.id`, [Number(researchId)]);
      if (!researchRows.length) fail('Investigación no encontrada', 404);
      const research = researchDto(researchRows[0]);
      const roundRows = await pool.query('SELECT id, numero AS number, estado AS state FROM rondas_revision WHERE investigacion_id = ? ORDER BY numero DESC LIMIT 1', [Number(researchId)]);
      if (!roundRows.length) fail('La investigación todavía no tiene una ronda de revisión', 409);
      const round = roundRows[0];
      const allowed = canManageReviews(user) || research.investigatorId === user.id || (await pool.query('SELECT ar.id FROM asignaciones_revision ar WHERE ar.ronda_id = ? AND ar.integrante_id = ? LIMIT 1', [Number(round.id), user.id])).length;
      if (!allowed) fail('No tienes permiso para consultar el dictamen', 403);
      const rows = await pool.query(`
        SELECT c.id AS committeeId, c.nombre AS committeeName, c.tipo AS committeeType,
               COUNT(ar.id) AS assignmentCount,
               SUM(ar.estado = 'COMPLETADA') AS completedCount,
               GROUP_CONCAT(e.dictamen ORDER BY ar.id) AS recommendations,
               dc.id AS decisionId, dc.decision, dc.observaciones AS observations,
               dc.registrado_por AS decidedBy, dc.registrado_en AS decidedAt
        FROM asignaciones_revision ar
        JOIN comites c ON c.id = ar.comite_id
        LEFT JOIN evaluaciones e ON e.asignacion_id = ar.id
        LEFT JOIN dictamenes_comite dc ON dc.ronda_id = ar.ronda_id AND dc.comite_id = ar.comite_id
        WHERE ar.ronda_id = ?
        GROUP BY c.id, dc.id ORDER BY c.nombre`, [Number(round.id)]);
      const committees = rows.map((row) => ({
        committee: { id: Number(row.committeeId), name: row.committeeName, type: row.committeeType },
        assignmentCount: Number(row.assignmentCount), completedCount: Number(row.completedCount),
        recommendations: row.recommendations ? String(row.recommendations).split(',') : [],
        decision: row.decisionId ? { id: Number(row.decisionId), researchId: Number(researchId), roundId: Number(round.id), committeeId: Number(row.committeeId), decision: row.decision, observations: row.observations ?? '', decidedBy: Number(row.decidedBy), decidedAt: iso(row.decidedAt) } : null
      }));
      const allAssignmentsCompleted = committees.length > 0 && committees.every((item) => item.assignmentCount === item.completedCount);
      const allCommitteesApproved = committees.length > 0 && committees.every((item) => item.decision?.decision === 'APROBADA');
      return { research, round: { id: Number(round.id), number: Number(round.number), state: round.state }, committees, allAssignmentsCompleted, allCommitteesApproved, canAuthorize: canManageReviews(user) && research.state === 'EN_REVISION' && allCommitteesApproved };
    },
    async saveCommitteeDecision(researchId, input, user) {
      if (!canManageReviews(user)) fail('No tienes permiso para registrar el dictamen', 403);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const rounds = await connection.query('SELECT id FROM rondas_revision WHERE investigacion_id = ? ORDER BY numero DESC LIMIT 1 FOR UPDATE', [Number(researchId)]);
        if (!rounds.length) fail('No existe una ronda para dictaminar', 409);
        const roundId = Number(rounds[0].id);
        const counts = await connection.query(`SELECT COUNT(*) AS total, SUM(estado = 'COMPLETADA') AS completed FROM asignaciones_revision WHERE ronda_id = ? AND comite_id = ?`, [roundId, Number(input.committeeId)]);
        if (!Number(counts[0].total)) fail('El comité no participa en la ronda', 400);
        if (Number(counts[0].total) !== Number(counts[0].completed)) fail('Todas las evaluaciones del comité deben estar completadas', 409);
        await connection.query(`INSERT INTO dictamenes_comite (investigacion_id, ronda_id, comite_id, decision, observaciones, registrado_por)
          VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE decision=VALUES(decision), observaciones=VALUES(observaciones), registrado_por=VALUES(registrado_por), registrado_en=NOW()`,
          [Number(researchId), roundId, Number(input.committeeId), input.decision, String(input.observations ?? '').trim(), user.id]);
        const researchRows = await connection.query('SELECT investigador_id AS ownerId, titulo AS title, estado AS state FROM investigaciones WHERE id = ? FOR UPDATE', [Number(researchId)]);
        if (!researchRows.length) fail('Investigación no encontrada', 404);
        if (input.decision !== 'APROBADA') {
          const nextState = input.decision === 'RECHAZADA' ? 'RECHAZADA' : 'CON_OBSERVACIONES';
          if (researchRows[0].state !== nextState) {
            await connection.query('UPDATE investigaciones SET estado = ? WHERE id = ?', [nextState, Number(researchId)]);
            await connection.query('INSERT INTO historial_estados (investigacion_id, estado_anterior, estado_nuevo, cambiado_por, motivo) VALUES (?, ?, ?, ?, ?)', [Number(researchId), researchRows[0].state, nextState, user.id, `Dictamen ${input.decision} del comité`]);
          }
        }
        await connection.query('INSERT INTO notificaciones (usuario_id, investigacion_id, titulo, mensaje) VALUES (?, ?, ?, ?)', [Number(researchRows[0].ownerId), Number(researchId), 'Dictamen registrado', `Se registró el dictamen ${input.decision} para ${researchRows[0].title}.`]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
      return this.getDecisionSummary(researchId, user);
    },
    async authorizeInvestigation(researchId, reason, user) {
      if (!canManageReviews(user)) fail('No tienes permiso para autorizar', 403);
      const summary = await this.getDecisionSummary(researchId, user);
      if (!summary.allCommitteesApproved) fail('Todos los comités deben contar con dictamen aprobado', 409);
      if (!summary.canAuthorize) fail('La investigación debe estar en revisión para ser autorizada', 409);
      const pdf = await pool.query("SELECT id FROM documentos WHERE investigacion_id = ? AND tipo = 'INVESTIGACION_PDF' AND vigente = TRUE LIMIT 1", [Number(researchId)]);
      if (!pdf.length) fail('No existe un PDF vigente para autorizar', 409);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const rows = await connection.query('SELECT investigador_id AS ownerId, titulo AS title, estado AS state FROM investigaciones WHERE id = ? FOR UPDATE', [Number(researchId)]);
        if (!rows.length) fail('Investigación no encontrada', 404);
        await connection.query("UPDATE rondas_revision SET estado='CERRADA' WHERE id = ?", [summary.round.id]);
        await connection.query("UPDATE investigaciones SET estado='APROBADA' WHERE id = ?", [Number(researchId)]);
        if (rows[0].state !== 'APROBADA') await connection.query('INSERT INTO historial_estados (investigacion_id, estado_anterior, estado_nuevo, cambiado_por, motivo) VALUES (?, ?, \'APROBADA\', ?, ?)', [Number(researchId), rows[0].state, user.id, String(reason ?? '').trim() || 'Autorización institucional']);
        await connection.query('INSERT INTO notificaciones (usuario_id, investigacion_id, titulo, mensaje) VALUES (?, ?, ?, ?)', [Number(rows[0].ownerId), Number(researchId), 'Investigación autorizada', `${rows[0].title} fue autorizada institucionalmente.`]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
      return this.getInvestigation(researchId, user);
    },
    async listHistory(researchId, user) {
      const researchRows = await pool.query('SELECT investigador_id AS ownerId FROM investigaciones WHERE id = ?', [Number(researchId)]);
      if (!researchRows.length) fail('Investigación no encontrada', 404);
      const related = await pool.query('SELECT ar.id FROM asignaciones_revision ar JOIN rondas_revision rr ON rr.id=ar.ronda_id WHERE rr.investigacion_id=? AND ar.integrante_id=? LIMIT 1', [Number(researchId), user.id]);
      if (!canManageReviews(user) && Number(researchRows[0].ownerId) !== user.id && !related.length) fail('No tienes permiso para consultar el historial', 403);
      const rows = await pool.query(`SELECT he.id, he.investigacion_id AS researchId, he.estado_anterior AS previousState, he.estado_nuevo AS nextState, he.cambiado_por AS changedBy, u.nombre AS changedByName, he.motivo AS reason, he.creado_en AS createdAt FROM historial_estados he JOIN usuarios u ON u.id=he.cambiado_por WHERE he.investigacion_id=? ORDER BY he.id DESC`, [Number(researchId)]);
      return rows.map((row) => ({ ...row, id: Number(row.id), researchId: Number(row.researchId), changedBy: Number(row.changedBy), createdAt: iso(row.createdAt) }));
    },
    async listNotifications(user) {
      const rows = await pool.query('SELECT id, usuario_id AS userId, investigacion_id AS researchId, titulo AS title, mensaje AS message, leida AS `read`, creado_en AS createdAt FROM notificaciones WHERE usuario_id=? ORDER BY creado_en DESC, id DESC LIMIT 100', [user.id]);
      return rows.map((row) => ({ ...row, id: Number(row.id), userId: Number(row.userId), researchId: row.researchId ? Number(row.researchId) : null, read: Boolean(row.read), createdAt: iso(row.createdAt) }));
    },
    async markNotificationRead(id, user) {
      const result = await pool.query('UPDATE notificaciones SET leida=TRUE WHERE id=? AND usuario_id=?', [Number(id), user.id]);
      if (!result.affectedRows) fail('Notificación no encontrada', 404);
      return (await this.listNotifications(user)).find((item) => item.id === Number(id));
    },
    async publishInvestigation(researchId, user) {
      if (!canManageReviews(user)) fail('No tienes permiso para publicar', 403);
      const connection = await pool.getConnection(); let publicationId;
      try {
        await connection.beginTransaction();
        const rows = await connection.query('SELECT investigador_id AS ownerId, titulo AS title, estado AS state FROM investigaciones WHERE id=? FOR UPDATE', [Number(researchId)]);
        if (!rows.length) fail('Investigación no encontrada', 404);
        if (rows[0].state !== 'APROBADA') fail('Solo puede publicarse una investigación autorizada', 409);
        const docs = await connection.query("SELECT id FROM documentos WHERE investigacion_id=? AND tipo='INVESTIGACION_PDF' AND vigente=TRUE ORDER BY version DESC LIMIT 1", [Number(researchId)]);
        if (!docs.length) fail('No existe un PDF vigente para publicar', 409);
        await connection.query('UPDATE publicaciones_versiones SET activo=FALSE, sustituido_en=NOW() WHERE investigacion_id=? AND activo=TRUE', [Number(researchId)]);
        const result = await connection.query('INSERT INTO publicaciones_versiones (investigacion_id, documento_id, publicado_por) VALUES (?, ?, ?)', [Number(researchId), Number(docs[0].id), user.id]); publicationId=Number(result.insertId);
        await connection.query("UPDATE investigaciones SET estado='PUBLICADA' WHERE id=?", [Number(researchId)]);
        await connection.query("INSERT INTO historial_estados (investigacion_id, estado_anterior, estado_nuevo, cambiado_por, motivo) VALUES (?, 'APROBADA', 'PUBLICADA', ?, 'Publicación institucional')", [Number(researchId), user.id]);
        await connection.query('INSERT INTO notificaciones (usuario_id, investigacion_id, titulo, mensaje) VALUES (?, ?, ?, ?)', [Number(rows[0].ownerId), Number(researchId), 'Investigación publicada', `${rows[0].title} ya está disponible para consulta institucional.`]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
      return (await this.listPublications({}, user)).find((item) => item.id === publicationId);
    },
    async listPublications(filters = {}) {
      const query = `%${String(filters.query ?? '').trim()}%`; const area = `%${String(filters.area ?? '').trim()}%`; const category = `%${String(filters.category ?? '').trim()}%`;
      const rows = await pool.query(`SELECT pv.id, pv.investigacion_id AS researchId, pv.documento_id AS documentId, pv.publicado_por AS publishedBy, pv.publicado_en AS publishedAt, i.titulo AS title, i.resumen AS summary, i.area, i.categoria AS category, i.estado AS state, i.investigador_id AS investigatorId, u.nombre AS investigatorName, u.correo AS investigatorEmail, d.nombre_original AS originalName, d.version, d.tamano AS size FROM publicaciones_versiones pv JOIN investigaciones i ON i.id=pv.investigacion_id JOIN usuarios u ON u.id=i.investigador_id JOIN documentos d ON d.id=pv.documento_id WHERE pv.activo=TRUE AND (i.titulo LIKE ? OR i.resumen LIKE ?) AND i.area LIKE ? AND i.categoria LIKE ? ORDER BY pv.publicado_en DESC`, [query, query, area, category]);
      return rows.map((row) => ({ id:Number(row.id), researchId:Number(row.researchId), documentId:Number(row.documentId), publishedBy:Number(row.publishedBy), active:true, publishedAt:iso(row.publishedAt), research:{ id:Number(row.researchId), investigatorId:Number(row.investigatorId), title:row.title, summary:row.summary??'', area:row.area??'', category:row.category??'', state:row.state, investigator:{ id:Number(row.investigatorId), name:row.investigatorName, email:row.investigatorEmail, active:true, roles:[] } }, document:{ id:Number(row.documentId), originalName:row.originalName, version:Number(row.version), size:Number(row.size) } }));
    },
    async getPublishedDocument(publicationId) {
      const rows = await pool.query(`SELECT d.id, d.investigacion_id AS researchId, d.tipo AS type, d.nombre_original AS originalName, d.mime_type AS mimeType, d.tamano AS size, d.version, d.vigente AS current, d.cargado_por AS uploadedBy, d.creado_en AS createdAt, d.contenido AS content FROM publicaciones_versiones pv JOIN documentos d ON d.id=pv.documento_id WHERE pv.id=? AND pv.activo=TRUE`, [Number(publicationId)]);
      if (!rows.length) fail('Publicación no encontrada', 404); return documentDto(rows[0], true);
    },
    async getExecutiveReport(filters = {}) {
      const params=[]; const where=[];
      if (filters.from) { where.push('DATE(creado_en) >= ?'); params.push(filters.from); }
      if (filters.to) { where.push('DATE(creado_en) <= ?'); params.push(filters.to); }
      const clause=where.length?`WHERE ${where.join(' AND ')}`:'';
      const totals=(await pool.query(`SELECT COUNT(*) AS investigations, SUM(estado='PUBLICADA') AS published, SUM(estado IN ('APROBADA','PUBLICADA')) AS authorized, SUM(estado='EN_REVISION') AS inReview FROM investigaciones ${clause}`,params))[0];
      const groups=async(field)=>{ const rows=await pool.query(`SELECT COALESCE(NULLIF(${field},''),'Sin especificar') AS label, COUNT(*) AS total FROM investigaciones ${clause} GROUP BY label ORDER BY total DESC`,params); return rows.map((r)=>({label:r.label,total:Number(r.total)})); };
      return { generatedAt:new Date().toISOString(), filters:{from:filters.from??'',to:filters.to??''}, totals:{investigations:Number(totals.investigations),published:Number(totals.published),authorized:Number(totals.authorized),inReview:Number(totals.inReview)}, byState:await groups('estado'), byArea:await groups('area'), byCategory:await groups('categoria') };
    },
    async close() { await pool.end(); }
  };
  return store;
}
