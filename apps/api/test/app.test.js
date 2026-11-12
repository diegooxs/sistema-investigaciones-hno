import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp, PRODUCT_GOAL } from '../src/app.js';

const app = createApp();

test('GET /api/health informa que la base ejecutable está disponible', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'ok', service: 'hno-investigaciones-api', version: '0.1.0', storage: 'memory'
  });
});

test('la API aplica encabezados básicos de seguridad', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.match(response.headers['permissions-policy'], /camera=\(\)/);
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('GET /api/v1/meta/product-goal publica el Objetivo del Producto', async () => {
  const response = await request(app).get('/api/v1/meta/product-goal');
  assert.equal(response.status, 200);
  assert.equal(response.body.productGoal, PRODUCT_GOAL);
});

test('GET /api/v1/meta/roles contiene los cuatro perfiles iniciales', async () => {
  const response = await request(app).get('/api/v1/meta/roles');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((role) => role.code), [
    'ADMINISTRADOR', 'ADMIN_INVESTIGADOR', 'INVESTIGADOR', 'COMITE'
  ]);
});

test('las rutas inexistentes de la API devuelven 404 controlado', async () => {
  const response = await request(app).get('/api/inexistente');
  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'Recurso no encontrado');
});

async function login(email = 'admin@hno.local', password = 'Admin2027!') {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

test('POST /api/v1/auth/login autentica credenciales válidas', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, 'admin@hno.local');
  assert.ok(response.body.token);
});

test('POST /api/v1/auth/login rechaza credenciales incorrectas', async () => {
  const response = await login('admin@hno.local', 'incorrecta');
  assert.equal(response.status, 401);
});

test('la API informa claramente cuando MariaDB no está disponible', async () => {
  const unavailableStore = {
    kind: 'mariadb', roles: [], catalogs: {},
    findUserByEmail() { throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }); }
  };
  const response = await request(createApp({ store: unavailableStore })).post('/api/v1/auth/login').send({ email: 'admin@hno.local', password: 'Admin2027!' });
  assert.equal(response.status, 503);
  assert.match(response.body.error, /pnpm db:up/);
});

test('las rutas administrativas exigen token y rol', async () => {
  assert.equal((await request(app).get('/api/v1/users')).status, 401);
  const loginResponse = await login('investigacion@hno.local', 'Investiga2027!');
  const response = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${loginResponse.body.token}`);
  assert.equal(response.status, 403);
});

test('el administrador consulta y registra usuarios', async () => {
  const loginResponse = await login();
  const auth = { Authorization: `Bearer ${loginResponse.body.token}` };
  const created = await request(app).post('/api/v1/users').set(auth).send({ name: 'Investigador de prueba', email: 'prueba@hno.local', password: 'Prueba2027!', roles: ['INVESTIGADOR'] });
  assert.equal(created.status, 201);
  const list = await request(app).get('/api/v1/users').set(auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((user) => user.email === 'prueba@hno.local'));
  assert.ok(list.body.data.every((user) => user.passwordHash === undefined));
  const reset = await request(app).patch(`/api/v1/users/${created.body.data.id}`).set(auth).send({ password: 'Nueva2027!' });
  assert.equal(reset.status, 200);
  assert.equal((await login('prueba@hno.local', 'Nueva2027!')).status, 200);
  const selfDeactivation = await request(app).patch(`/api/v1/users/${loginResponse.body.user.id}`).set(auth).send({ active: false });
  assert.equal(selfDeactivation.status, 409);
});

test('un usuario autenticado consulta comités y catálogos', async () => {
  const loginResponse = await login();
  const auth = { Authorization: `Bearer ${loginResponse.body.token}` };
  const committees = await request(app).get('/api/v1/committees').set(auth);
  const catalogs = await request(app).get('/api/v1/catalogs').set(auth);
  assert.equal(committees.status, 200);
  assert.equal(committees.body.data.length, 3);
  assert.equal(catalogs.status, 200);
  assert.ok(catalogs.body.data.researchStates.includes('PUBLICADA'));
});

test('CORS permite el puerto local asignado por Vite durante el desarrollo', async () => {
  const response = await request(app)
    .options('/api/v1/auth/login')
    .set('Origin', 'http://localhost:5175')
    .set('Access-Control-Request-Method', 'POST');
  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5175');
});

test('las investigaciones requieren autenticación', async () => {
  assert.equal((await request(app).get('/api/v1/investigations')).status, 401);
});

test('los perfiles administrativos consultan responsables activos para asignar expedientes', async () => {
  const loginResponse = await login();
  const response = await request(app).get('/api/v1/researchers').set('Authorization', `Bearer ${loginResponse.body.token}`);
  assert.equal(response.status, 200);
  assert.ok(response.body.data.some((user) => user.email === 'investigador@hno.local'));
  assert.ok(response.body.data.every((user) => user.active));
});

test('el equipo de investigación registra, consulta y actualiza un borrador', async () => {
  const loginResponse = await login();
  const auth = { Authorization: `Bearer ${loginResponse.body.token}` };
  const created = await request(app).post('/api/v1/investigations').set(auth).send({
    title: 'Estudio de prueba sobre salud infantil',
    summary: 'Protocolo utilizado para verificar el Sprint 3.',
    area: 'Pediatría',
    category: 'Investigación clínica',
    investigatorId: 3
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.state, 'BORRADOR');
  assert.equal(created.body.data.investigatorId, 3);
  const updated = await request(app).patch(`/api/v1/investigations/${created.body.data.id}`).set(auth).send({ area: 'Pediatría clínica' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.area, 'Pediatría clínica');
  const list = await request(app).get('/api/v1/investigations').set(auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((item) => item.title === 'Estudio de prueba sobre salud infantil'));
});

test('el control documental conserva versiones y marca una sola como vigente', async () => {
  const loginResponse = await login();
  const auth = { Authorization: `Bearer ${loginResponse.body.token}` };
  const created = await request(app).post('/api/v1/investigations').set(auth).send({ title: 'Expediente documental', investigatorId: 3 });
  const researchId = created.body.data.id;
  const upload = (content, name) => request(app).post(`/api/v1/investigations/${researchId}/documents`).set(auth).set('Content-Type', 'application/octet-stream').set('X-Document-Type', 'ANEXO_A').set('X-File-Name', encodeURIComponent(name)).set('X-File-Mime', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(Buffer.from(content));
  const first = await upload('version uno', 'anexo-1-v1.rtf');
  const second = await upload('version dos', 'anexo-1-v2.rtf');
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.body.data.version, 2);
  const list = await request(app).get(`/api/v1/investigations/${researchId}/documents`).set(auth);
  assert.deepEqual(list.body.data.map((item) => item.current), [false, true]);
  const downloaded = await request(app).get(`/api/v1/documents/${second.body.data.id}/download`).set(auth);
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.text, 'version dos');
});

test('la investigación principal solamente acepta archivos PDF', async () => {
  const loginResponse = await login();
  const auth = { Authorization: `Bearer ${loginResponse.body.token}` };
  const created = await request(app).post('/api/v1/investigations').set(auth).send({ title: 'Validación de PDF', investigatorId: 3 });
  const response = await request(app).post(`/api/v1/investigations/${created.body.data.id}/documents`).set(auth).set('Content-Type', 'application/octet-stream').set('X-Document-Type', 'INVESTIGACION_PDF').set('X-File-Name', 'investigacion.docx').set('X-File-Mime', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').send(Buffer.from('archivo'));
  assert.equal(response.status, 400);
});

test('la gestión documental rechaza extensiones no permitidas', async () => {
  const loginResponse = await login();
  const auth = { Authorization: `Bearer ${loginResponse.body.token}` };
  const created = await request(app).post('/api/v1/investigations').set(auth).send({ title: 'Validación de archivos', investigatorId: 3 });
  const response = await request(app).post(`/api/v1/investigations/${created.body.data.id}/documents`)
    .set(auth).set('Content-Type', 'application/octet-stream').set('X-Document-Type', 'OTRO')
    .set('X-File-Name', 'archivo.exe').set('X-File-Mime', 'application/octet-stream').send(Buffer.from('archivo'));
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Formato no permitido/);
});

test('las cuatro plantillas pueden consultarse y descargarse', async () => {
  const loginResponse = await login();
  const auth = { Authorization: `Bearer ${loginResponse.body.token}` };
  const list = await request(app).get('/api/v1/templates').set(auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 4);
  assert.deepEqual(list.body.data.map((template) => template.code), ['ANEXO_A', 'ANEXO_E', 'ANEXO_G', 'ANEXO_I']);
  const downloaded = await request(app).get('/api/v1/templates/ANEXO_A/download').set(auth);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers['content-type'], /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(downloaded.headers['content-disposition'], /ANEXO_A\.docx/);
  assert.ok(Number(downloaded.headers['content-length']) > 1_000_000);
});

test('el investigador consulta únicamente sus propios expedientes', async () => {
  const loginResponse = await login('investigador@hno.local', 'Investigador2027!');
  const auth = { Authorization: `Bearer ${loginResponse.body.token}` };
  const created = await request(app).post('/api/v1/investigations').set(auth).send({ title: 'Investigación del usuario responsable' });
  assert.equal(created.status, 201);
  const list = await request(app).get('/api/v1/investigations').set(auth);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.length > 0);
  assert.ok(list.body.data.every((item) => item.investigatorId === loginResponse.body.user.id));
});

test('los Sprints 4 y 5 cubren asignación, rúbrica, evaluación y reenvío de correcciones', async () => {
  const adminLogin = await login();
  const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };
  const investigatorLogin = await login('investigador@hno.local', 'Investigador2027!');
  const investigatorAuth = { Authorization: `Bearer ${investigatorLogin.body.token}` };
  const committeeLogin = await login('comite@hno.local', 'Comite2027!');
  const committeeAuth = { Authorization: `Bearer ${committeeLogin.body.token}` };

  const research = await request(app).post('/api/v1/investigations').set(adminAuth).send({
    title: 'Protocolo para validar las rondas Scrum',
    summary: 'Expediente de prueba para los incrementos de los Sprints 4 y 5.',
    area: 'Pediatría',
    category: 'Investigación clínica',
    investigatorId: investigatorLogin.body.user.id
  });
  assert.equal(research.status, 201);
  const researchId = research.body.data.id;

  for (const type of ['ANEXO_A', 'ANEXO_E', 'ANEXO_G', 'ANEXO_I', 'INVESTIGACION_PDF']) {
    const isPdf = type === 'INVESTIGACION_PDF';
    const upload = await request(app).post(`/api/v1/investigations/${researchId}/documents`)
      .set(adminAuth).set('Content-Type', 'application/octet-stream')
      .set('X-Document-Type', type)
      .set('X-File-Name', isPdf ? 'protocolo.pdf' : `${type}.docx`)
      .set('X-File-Mime', isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .send(Buffer.from(`contenido de ${type}`));
    assert.equal(upload.status, 201);
  }

  const round = await request(app).post(`/api/v1/investigations/${researchId}/rounds`).set(adminAuth).send({
    dueAt: '2099-03-19T23:59:00.000Z',
    assignments: [{ committeeId: 1, memberId: committeeLogin.body.user.id }]
  });
  assert.equal(round.status, 201);
  assert.equal(round.body.data.number, 1);
  assert.equal(round.body.data.assignmentCount, 1);
  assert.equal(round.body.data.research.state, 'EN_REVISION');

  const researcherCannotOpenRounds = await request(app).post(`/api/v1/investigations/${researchId}/rounds`).set(investigatorAuth).send({
    dueAt: '2099-03-20T23:59:00.000Z', assignments: [{ committeeId: 1, memberId: committeeLogin.body.user.id }]
  });
  assert.equal(researcherCannotOpenRounds.status, 403);

  const rubric = await request(app).post('/api/v1/rubrics').set(adminAuth).send({
    committeeId: 1,
    name: 'Rúbrica institucional de ética',
    criteria: [
      { description: 'Pertinencia y valor científico', weight: 40, maximumScore: 10 },
      { description: 'Protección de participantes', weight: 60, maximumScore: 10 }
    ]
  });
  assert.equal(rubric.status, 201);

  const assignmentId = round.body.data.assignments[0].id;
  const started = await request(app).patch(`/api/v1/assignments/${assignmentId}/status`).set(committeeAuth).send({ status: 'EN_PROCESO' });
  assert.equal(started.status, 200);
  const evaluation = await request(app).put(`/api/v1/assignments/${assignmentId}/evaluation`).set(committeeAuth).send({
    rubricId: rubric.body.data.id,
    scores: rubric.body.data.criteria.map((criterion, index) => ({ criterionId: criterion.id, score: index === 0 ? 8 : 9 })),
    recommendation: 'CON_CORRECCIONES',
    generalObservation: 'Precisar el consentimiento informado y actualizar el cronograma clínico.'
  });
  assert.equal(evaluation.status, 200);
  assert.equal(evaluation.body.data.score, 86);

  const feedback = await request(app).get(`/api/v1/investigations/${researchId}/feedback`).set(investigatorAuth);
  assert.equal(feedback.status, 200);
  assert.equal(feedback.body.data[0].recommendation, 'CON_CORRECCIONES');
  assert.match(feedback.body.data[0].generalObservation, /consentimiento informado/);
  assert.equal(feedback.body.data[0].member, undefined);

  const correctedDocument = await request(app).post(`/api/v1/investigations/${researchId}/documents`)
    .set(investigatorAuth).set('Content-Type', 'application/octet-stream')
    .set('X-Document-Type', 'ANEXO_A').set('X-File-Name', 'ANEXO_A_corregido.docx')
    .set('X-File-Mime', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    .send(Buffer.from('segunda versión corregida'));
  assert.equal(correctedDocument.status, 201);
  assert.equal(correctedDocument.body.data.version, 2);

  const resubmitted = await request(app).post(`/api/v1/investigations/${researchId}/resubmit`).set(investigatorAuth);
  assert.equal(resubmitted.status, 201);
  assert.equal(resubmitted.body.data.number, 2);
  assert.equal(resubmitted.body.data.research.state, 'EN_REVISION');
  assert.equal(resubmitted.body.data.assignmentCount, 1);
});

test('los Sprints 6 y 7 cubren dictamen, autorización, notificación, publicación y reporte', async () => {
  const adminLogin = await login();
  const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };
  const investigatorLogin = await login('investigador@hno.local', 'Investigador2027!');
  const investigatorAuth = { Authorization: `Bearer ${investigatorLogin.body.token}` };
  const committeeLogin = await login('comite@hno.local', 'Comite2027!');
  const committeeAuth = { Authorization: `Bearer ${committeeLogin.body.token}` };
  const research = await request(app).post('/api/v1/investigations').set(adminAuth).send({
    title: 'Investigación autorizada para publicación institucional',
    summary: 'Caso integral para comprobar la decisión y difusión del Sprint 7.',
    area: 'Oncología pediátrica', category: 'Investigación clínica',
    investigatorId: investigatorLogin.body.user.id
  });
  const researchId = research.body.data.id;
  for (const type of ['ANEXO_A', 'ANEXO_E', 'ANEXO_G', 'ANEXO_I', 'INVESTIGACION_PDF']) {
    const isPdf = type === 'INVESTIGACION_PDF';
    const uploaded = await request(app).post(`/api/v1/investigations/${researchId}/documents`)
      .set(adminAuth).set('Content-Type', 'application/octet-stream').set('X-Document-Type', type)
      .set('X-File-Name', isPdf ? 'investigacion-autorizada.pdf' : `${type}.docx`)
      .set('X-File-Mime', isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .send(Buffer.from(`archivo ${type}`));
    assert.equal(uploaded.status, 201);
  }
  const round = await request(app).post(`/api/v1/investigations/${researchId}/rounds`).set(adminAuth).send({
    dueAt: '2099-05-01T23:59:00.000Z', assignments: [{ committeeId: 1, memberId: committeeLogin.body.user.id }]
  });
  assert.equal(round.status, 201);
  const rubric = await request(app).post('/api/v1/rubrics').set(adminAuth).send({
    committeeId: 1, name: 'Rúbrica favorable de publicación',
    criteria: [{ description: 'Cumplimiento científico y ético', weight: 100, maximumScore: 10 }]
  });
  assert.equal(rubric.status, 201);
  const assignmentId = round.body.data.assignments[0].id;
  const evaluation = await request(app).put(`/api/v1/assignments/${assignmentId}/evaluation`).set(committeeAuth).send({
    rubricId: rubric.body.data.id,
    scores: [{ criterionId: rubric.body.data.criteria[0].id, score: 10 }],
    recommendation: 'APROBADA', generalObservation: 'Cumple los criterios para autorización.'
  });
  assert.equal(evaluation.status, 200);
  const decision = await request(app).post(`/api/v1/investigations/${researchId}/committee-decisions`).set(adminAuth).send({
    committeeId: 1, decision: 'APROBADA', observations: 'Dictamen favorable consolidado.'
  });
  assert.equal(decision.status, 201);
  assert.equal(decision.body.data.allCommitteesApproved, true);
  assert.equal(decision.body.data.canAuthorize, true);
  const authorized = await request(app).post(`/api/v1/investigations/${researchId}/authorize`).set(adminAuth).send({ reason: 'Aprobación institucional definitiva' });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.body.data.state, 'APROBADA');
  const publication = await request(app).post(`/api/v1/investigations/${researchId}/publish`).set(adminAuth);
  assert.equal(publication.status, 201);
  assert.equal(publication.body.data.research.state, 'PUBLICADA');
  const publications = await request(app).get('/api/v1/publications?query=autorizada').set(investigatorAuth);
  assert.equal(publications.status, 200);
  assert.ok(publications.body.data.some((item) => item.researchId === researchId));
  const downloaded = await request(app).get(`/api/v1/publications/${publication.body.data.id}/download`).set(investigatorAuth);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers['content-type'], /application\/pdf/);
  const history = await request(app).get(`/api/v1/investigations/${researchId}/history`).set(investigatorAuth);
  assert.equal(history.status, 200);
  assert.ok(history.body.data.some((item) => item.nextState === 'PUBLICADA'));
  const notifications = await request(app).get('/api/v1/notifications').set(investigatorAuth);
  assert.equal(notifications.status, 200);
  assert.ok(notifications.body.data.some((item) => item.researchId === researchId));
  const report = await request(app).get('/api/v1/reports/executive').set(adminAuth);
  assert.equal(report.status, 200);
  assert.ok(report.body.data.totals.published >= 1);
});
