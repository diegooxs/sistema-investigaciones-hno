import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createMariaDbStore } from '../src/mariadb-store.js';

test('MariaDB conserva una investigación y sus versiones documentales', async (context) => {
  const store = createMariaDbStore();
  let researchId;
  context.after(async () => {
    if (researchId) {
      await store.pool.query('DELETE FROM documentos WHERE investigacion_id = ?', [researchId]);
      await store.pool.query('DELETE FROM investigaciones WHERE id = ?', [researchId]);
    }
    await store.close();
  });
  await store.health();
  const app = createApp({ store });
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'investigador@hno.local', password: 'Investigador2027!'
  });
  assert.equal(login.status, 200);
  const auth = { Authorization: `Bearer ${login.body.token}` };
  const title = `Verificación MariaDB ${Date.now()}`;
  const created = await request(app).post('/api/v1/investigations').set(auth).send({
    title, summary: 'Registro de integración', area: 'Pediatría', category: 'Prueba'
  });
  assert.equal(created.status, 201);
  researchId = created.body.data.id;
  const upload = (content, name) => request(app)
    .post(`/api/v1/investigations/${researchId}/documents`).set(auth)
    .set('Content-Type', 'application/octet-stream')
    .set('X-Document-Type', 'ANEXO_A')
    .set('X-File-Name', encodeURIComponent(name))
    .set('X-File-Mime', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(Buffer.from(content));
  assert.equal((await upload('primera versión', 'anexo-v1.rtf')).status, 201);
  const second = await upload('segunda versión persistente', 'anexo-v2.rtf');
  assert.equal(second.status, 201);
  assert.equal(second.body.data.version, 2);
  const list = await request(app).get(`/api/v1/investigations/${researchId}/documents`).set(auth);
  assert.deepEqual(list.body.data.map((item) => item.current), [false, true]);
  const downloaded = await request(app).get(`/api/v1/documents/${second.body.data.id}/download`).set(auth);
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.text, 'segunda versión persistente');
});

test('MariaDB conserva usuarios, roles y contraseñas administradas desde la API', async (context) => {
  const store = createMariaDbStore();
  const email = `usuario.prueba.${Date.now()}@hno.local`;
  let userId;
  context.after(async () => {
    if (userId) {
      await store.pool.query('DELETE FROM usuario_roles WHERE usuario_id = ?', [userId]);
      await store.pool.query('DELETE FROM usuarios WHERE id = ?', [userId]);
    }
    await store.close();
  });
  const app = createApp({ store });
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: 'admin@hno.local', password: 'Admin2027!' });
  const auth = { Authorization: `Bearer ${adminLogin.body.token}` };
  const created = await request(app).post('/api/v1/users').set(auth).send({
    name: 'Usuario temporal de integración', email, password: 'Temporal2027!', roles: ['INVESTIGADOR']
  });
  assert.equal(created.status, 201);
  userId = created.body.data.id;
  assert.deepEqual(created.body.data.roles, ['INVESTIGADOR']);
  const reset = await request(app).patch(`/api/v1/users/${userId}`).set(auth).send({ password: 'Renovada2027!' });
  assert.equal(reset.status, 200);
  const userLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'Renovada2027!' });
  assert.equal(userLogin.status, 200);
});

test('MariaDB ejecuta y persiste el flujo institucional de los Sprints 4 a 7', async (context) => {
  const store = createMariaDbStore();
  let researchId;
  let rubricId;
  context.after(async () => {
    if (researchId) {
      await store.pool.query('DELETE FROM notificaciones WHERE investigacion_id = ?', [researchId]);
      await store.pool.query('DELETE FROM publicaciones_versiones WHERE investigacion_id = ?', [researchId]);
      await store.pool.query('DELETE FROM dictamenes_comite WHERE investigacion_id = ?', [researchId]);
      await store.pool.query(`DELETE ec FROM evaluacion_criterios ec JOIN evaluaciones e ON e.id = ec.evaluacion_id JOIN asignaciones_revision ar ON ar.id = e.asignacion_id JOIN rondas_revision rr ON rr.id = ar.ronda_id WHERE rr.investigacion_id = ?`, [researchId]);
      await store.pool.query(`DELETE e FROM evaluaciones e JOIN asignaciones_revision ar ON ar.id = e.asignacion_id JOIN rondas_revision rr ON rr.id = ar.ronda_id WHERE rr.investigacion_id = ?`, [researchId]);
      await store.pool.query(`DELETE ar FROM asignaciones_revision ar JOIN rondas_revision rr ON rr.id = ar.ronda_id WHERE rr.investigacion_id = ?`, [researchId]);
      await store.pool.query('DELETE FROM rondas_revision WHERE investigacion_id = ?', [researchId]);
      await store.pool.query('DELETE FROM historial_estados WHERE investigacion_id = ?', [researchId]);
      await store.pool.query('DELETE FROM documentos WHERE investigacion_id = ?', [researchId]);
      await store.pool.query('DELETE FROM investigaciones WHERE id = ?', [researchId]);
    }
    if (rubricId) {
      await store.pool.query('DELETE FROM criterios_rubrica WHERE rubrica_id = ?', [rubricId]);
      await store.pool.query('DELETE FROM rubricas WHERE id = ?', [rubricId]);
    }
    await store.close();
  });
  const app = createApp({ store });
  const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: 'admin@hno.local', password: 'Admin2027!' });
  const researcherLogin = await request(app).post('/api/v1/auth/login').send({ email: 'investigador@hno.local', password: 'Investigador2027!' });
  const reviewerLogin = await request(app).post('/api/v1/auth/login').send({ email: 'etica@hno.local', password: 'Comite2027!' });
  assert.equal(adminLogin.status, 200);
  assert.equal(researcherLogin.status, 200);
  assert.equal(reviewerLogin.status, 200);
  const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };
  const reviewerAuth = { Authorization: `Bearer ${reviewerLogin.body.token}` };

  const created = await request(app).post('/api/v1/investigations').set(adminAuth).send({
    title: `Integración de revisión ${Date.now()}`, investigatorId: researcherLogin.body.user.id
  });
  assert.equal(created.status, 201);
  researchId = created.body.data.id;
  for (const type of ['ANEXO_A', 'ANEXO_E', 'ANEXO_G', 'ANEXO_I', 'INVESTIGACION_PDF']) {
    const pdf = type === 'INVESTIGACION_PDF';
    const upload = await request(app).post(`/api/v1/investigations/${researchId}/documents`).set(adminAuth)
      .set('Content-Type', 'application/octet-stream').set('X-Document-Type', type)
      .set('X-File-Name', pdf ? 'protocolo.pdf' : `${type}.docx`)
      .set('X-File-Mime', pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .send(Buffer.from(type));
    assert.equal(upload.status, 201);
  }
  const committees = await request(app).get('/api/v1/committees').set(adminAuth);
  const ethics = committees.body.data.find((item) => item.type === 'ETICA');
  assert.ok(ethics.memberIds.includes(reviewerLogin.body.user.id));

  const round = await request(app).post(`/api/v1/investigations/${researchId}/rounds`).set(adminAuth).send({
    dueAt: '2099-04-01T23:59:00.000Z',
    assignments: [{ committeeId: ethics.id, memberId: reviewerLogin.body.user.id }]
  });
  assert.equal(round.status, 201);
  const rubric = await request(app).post('/api/v1/rubrics').set(adminAuth).send({
    committeeId: ethics.id, name: `Rúbrica de integración ${Date.now()}`,
    criteria: [{ description: 'Rigor', weight: 50, maximumScore: 10 }, { description: 'Ética', weight: 50, maximumScore: 10 }]
  });
  assert.equal(rubric.status, 201);
  rubricId = rubric.body.data.id;
  const assignmentId = round.body.data.assignments[0].id;
  const evaluated = await request(app).put(`/api/v1/assignments/${assignmentId}/evaluation`).set(reviewerAuth).send({
    rubricId, scores: rubric.body.data.criteria.map((criterion) => ({ criterionId: criterion.id, score: 9 })),
    recommendation: 'APROBADA', generalObservation: 'Cumple los criterios científicos y éticos.'
  });
  assert.equal(evaluated.status, 200);
  assert.equal(evaluated.body.data.score, 90);
  const persisted = await store.pool.query('SELECT COUNT(*) AS total FROM evaluacion_criterios WHERE evaluacion_id = ?', [evaluated.body.data.id]);
  assert.equal(Number(persisted[0].total), 2);
  const decision = await request(app).post(`/api/v1/investigations/${researchId}/committee-decisions`).set(adminAuth).send({
    committeeId: ethics.id, decision: 'APROBADA', observations: 'Dictamen institucional favorable.'
  });
  assert.equal(decision.status, 201);
  assert.equal(decision.body.data.canAuthorize, true);
  const authorized = await request(app).post(`/api/v1/investigations/${researchId}/authorize`).set(adminAuth).send({ reason: 'Autorización de integración' });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.data.state, 'APROBADA');
  const published = await request(app).post(`/api/v1/investigations/${researchId}/publish`).set(adminAuth);
  assert.equal(published.status, 201);
  const publicationRows = await store.pool.query('SELECT activo FROM publicaciones_versiones WHERE investigacion_id = ?', [researchId]);
  assert.equal(publicationRows.length, 1);
  assert.equal(Boolean(publicationRows[0].activo), true);
  const report = await request(app).get('/api/v1/reports/executive').set(adminAuth);
  assert.equal(report.status, 200);
  assert.ok(report.body.data.totals.published >= 1);
});
