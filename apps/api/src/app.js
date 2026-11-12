import cors from 'cors';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { config } from './config.js';
import { authenticate, authorize, issueToken, verifyPassword } from './auth.js';
import { createStore } from './store.js';

export const PRODUCT_GOAL = 'Centralizar el registro, revisión, evaluación, autorización, publicación y consulta de investigaciones científicas con trazabilidad documental.';

export const ROLES = Object.freeze([
  { code: 'ADMINISTRADOR', name: 'Administrador' },
  { code: 'ADMIN_INVESTIGADOR', name: 'Administrador Investigador' },
  { code: 'INVESTIGADOR', name: 'Investigador' },
  { code: 'COMITE', name: 'Integrante de comité' }
]);

export const TEMPLATES = Object.freeze([
  { code: 'ANEXO_A', name: 'Anexo A — Ficha de registro del protocolo de investigación', fileName: 'ANEXO_A.docx' },
  { code: 'ANEXO_E', name: 'Anexo E — Plantilla para la elaboración del protocolo', fileName: 'ANEXO_E.docx' },
  { code: 'ANEXO_G', name: 'Anexo G — Carta compromiso individual', fileName: 'ANEXO_G.docx' },
  { code: 'ANEXO_I', name: 'Anexo I — Carta de consentimiento informado', fileName: 'ANEXO_I.docx' }
]);

const SUPPORTED_DOCUMENT_EXTENSIONS = Object.freeze(['pdf', 'doc', 'docx', 'rtf', 'odt']);

function validateDocumentUpload({ type, originalName, mimeType }) {
  if (originalName.length > 255 || /[\\/\u0000-\u001f]/.test(originalName)) {
    return 'El nombre del archivo no es válido';
  }
  const extension = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : '';
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.includes(extension)) {
    return 'Formato no permitido. Utiliza PDF, DOC, DOCX, RTF u ODT';
  }
  if (type === 'INVESTIGACION_PDF' && (extension !== 'pdf' || mimeType !== 'application/pdf')) {
    return 'La investigación principal debe cargarse en formato PDF';
  }
  return null;
}

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function createApp({ store = createStore() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (config.environment === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === config.webOrigin) return callback(null, true);
      const isLocalViteOrigin = config.environment !== 'production'
        && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      return isLocalViteOrigin
        ? callback(null, true)
        : callback(new Error('Origen no permitido por CORS'));
    }
  }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', asyncRoute(async (_req, res) => {
    await store.health();
    res.status(200).json({ status: 'ok', service: 'hno-investigaciones-api', version: '0.1.0', storage: store.kind });
  }));

  app.get('/api/v1/meta/product-goal', (_req, res) => {
    res.status(200).json({ productGoal: PRODUCT_GOAL });
  });

  app.get('/api/v1/meta/roles', (_req, res) => {
    res.status(200).json({ data: ROLES });
  });

  app.post('/api/v1/auth/login', asyncRoute(async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await store.findUserByEmail(email);
    if (!user?.active || !verifyPassword(password ?? '', user.passwordHash)) return res.status(401).json({ error: 'Credenciales incorrectas' });
    res.json({ token: issueToken(user), user: { id: user.id, name: user.name, email: user.email, roles: user.roles } });
  }));

  const secured = authenticate(store);
  const administrator = authorize('ADMINISTRADOR');
  const reviewManager = authorize('ADMINISTRADOR', 'ADMIN_INVESTIGADOR');
  const reviewUsers = authorize('ADMINISTRADOR', 'ADMIN_INVESTIGADOR', 'INVESTIGADOR', 'COMITE');
  app.get('/api/v1/auth/me', secured, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, roles: req.user.roles } }));
  app.get('/api/v1/users', secured, administrator, asyncRoute(async (_req, res) => res.json({ data: await store.listUsers() })));
  app.post('/api/v1/users', secured, administrator, asyncRoute(async (req, res) => {
    const { name, email, password, roles } = req.body ?? {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
    if (!/^\S+@\S+\.\S+$/.test(String(email))) return res.status(400).json({ error: 'Ingresa un correo válido' });
    if (String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    if (!Array.isArray(roles) || roles.length === 0) return res.status(400).json({ error: 'Selecciona al menos un rol' });
    res.status(201).json({ data: await store.createUser({ name, email, password, roles }) });
  }));
  app.patch('/api/v1/users/:id', secured, administrator, asyncRoute(async (req, res) => {
    const changes = req.body ?? {};
    if (Number(req.params.id) === req.user.id && changes.active === false) return res.status(409).json({ error: 'No puedes desactivar tu propia cuenta' });
    if (Number(req.params.id) === req.user.id && Array.isArray(changes.roles) && !changes.roles.includes('ADMINISTRADOR')) return res.status(409).json({ error: 'No puedes retirar tu propio rol de administrador' });
    if (Array.isArray(changes.roles) && changes.roles.length === 0) return res.status(400).json({ error: 'El usuario debe conservar al menos un rol' });
    if (changes.password !== undefined && String(changes.password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    res.json({ data: await store.updateUser(req.params.id, changes) });
  }));
  app.get('/api/v1/committees', secured, asyncRoute(async (_req, res) => res.json({ data: await store.listCommittees() })));
  app.post('/api/v1/committees', secured, administrator, asyncRoute(async (req, res) => {
    const { name, type, memberIds } = req.body ?? {};
    if (!name || !store.catalogs.committeeTypes.includes(type)) return res.status(400).json({ error: 'Nombre y tipo de comité válidos son obligatorios' });
    res.status(201).json({ data: await store.createCommittee({ name, type, memberIds }) });
  }));
  app.get('/api/v1/reviewers', secured, reviewManager, asyncRoute(async (_req, res) => {
    res.json({ data: await store.listCommitteeReviewers() });
  }));
  app.patch('/api/v1/committees/:id/members', secured, reviewManager, asyncRoute(async (req, res) => {
    const memberIds = req.body?.memberIds;
    if (!Array.isArray(memberIds)) return res.status(400).json({ error: 'Envía la lista de integrantes del comité' });
    res.json({ data: await store.updateCommitteeMembers(req.params.id, memberIds) });
  }));
  app.get('/api/v1/catalogs', secured, (_req, res) => res.json({ data: store.catalogs }));

  const researchTeam = authorize('ADMINISTRADOR', 'ADMIN_INVESTIGADOR', 'INVESTIGADOR');
  app.get('/api/v1/researchers', secured, researchTeam, asyncRoute(async (req, res) => {
    const researchers = await store.listResearchers();
    const canAssign = req.user.roles.some((role) => ['ADMINISTRADOR', 'ADMIN_INVESTIGADOR'].includes(role));
    res.json({ data: canAssign ? researchers : researchers.filter((item) => item.id === req.user.id) });
  }));
  app.get('/api/v1/investigations', secured, researchTeam, asyncRoute(async (req, res) => {
    res.json({ data: await store.listInvestigations(req.user) });
  }));
  app.post('/api/v1/investigations', secured, researchTeam, asyncRoute(async (req, res) => {
    const { title, summary, area, category, investigatorId } = req.body ?? {};
    if (!String(title ?? '').trim()) return res.status(400).json({ error: 'El título es obligatorio' });
    res.status(201).json({ data: await store.createInvestigation({ title, summary, area, category, investigatorId }, req.user) });
  }));
  app.get('/api/v1/investigations/:id', secured, researchTeam, asyncRoute(async (req, res) => {
    res.json({ data: await store.getInvestigation(req.params.id, req.user) });
  }));
  app.patch('/api/v1/investigations/:id', secured, researchTeam, asyncRoute(async (req, res) => {
    res.json({ data: await store.updateInvestigation(req.params.id, req.body ?? {}, req.user) });
  }));
  app.get('/api/v1/investigations/:id/documents', secured, researchTeam, asyncRoute(async (req, res) => {
    res.json({ data: await store.listDocuments(req.params.id, req.user) });
  }));
  app.post('/api/v1/investigations/:id/documents', secured, researchTeam, express.raw({ type: 'application/octet-stream', limit: '10mb' }), asyncRoute(async (req, res) => {
    const type = String(req.headers['x-document-type'] ?? '');
    const originalName = decodeURIComponent(String(req.headers['x-file-name'] ?? ''));
    const mimeType = String(req.headers['x-file-mime'] ?? 'application/octet-stream');
    if (!originalName || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Selecciona un archivo válido' });
    const validationError = validateDocumentUpload({ type, originalName, mimeType });
    if (validationError) return res.status(400).json({ error: validationError });
    res.status(201).json({ data: await store.addDocument(req.params.id, { type, originalName, mimeType, content: req.body }, req.user) });
  }));
  app.get('/api/v1/documents/:id/download', secured, researchTeam, asyncRoute(async (req, res) => {
    const document = await store.getDocument(req.params.id, req.user);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`);
    res.send(document.content);
  }));
  app.get('/api/v1/templates', secured, researchTeam, (_req, res) => res.json({ data: TEMPLATES }));
  app.get('/api/v1/templates/:code/download', secured, researchTeam, asyncRoute(async (req, res) => {
    const template = TEMPLATES.find((item) => item.code === req.params.code);
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });
    const content = await readFile(new URL(`../assets/templates/${template.fileName}`, import.meta.url));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(template.fileName)}`);
    res.send(content);
  }));

  app.get('/api/v1/rounds', secured, reviewUsers, asyncRoute(async (req, res) => {
    res.json({ data: await store.listRounds(req.user) });
  }));
  app.get('/api/v1/rounds/:id', secured, reviewUsers, asyncRoute(async (req, res) => {
    res.json({ data: await store.getRound(req.params.id, req.user) });
  }));
  app.post('/api/v1/investigations/:id/rounds', secured, reviewManager, asyncRoute(async (req, res) => {
    const { dueAt, assignments } = req.body ?? {};
    if (!dueAt || !Array.isArray(assignments)) return res.status(400).json({ error: 'La fecha de vencimiento y las asignaciones son obligatorias' });
    res.status(201).json({ data: await store.createRound(req.params.id, { dueAt, assignments }, req.user) });
  }));
  app.patch('/api/v1/assignments/:id/status', secured, reviewUsers, asyncRoute(async (req, res) => {
    res.json({ data: await store.updateAssignmentStatus(req.params.id, req.body?.status, req.user) });
  }));
  app.get('/api/v1/rubrics', secured, reviewUsers, asyncRoute(async (req, res) => {
    res.json({ data: await store.listRubrics(req.user) });
  }));
  app.post('/api/v1/rubrics', secured, reviewManager, asyncRoute(async (req, res) => {
    const { committeeId, name, criteria } = req.body ?? {};
    if (!committeeId || !String(name ?? '').trim() || !Array.isArray(criteria)) return res.status(400).json({ error: 'Comité, nombre y criterios son obligatorios' });
    res.status(201).json({ data: await store.createRubric({ committeeId, name, criteria }, req.user) });
  }));
  app.get('/api/v1/assignments/:id/evaluation', secured, reviewUsers, asyncRoute(async (req, res) => {
    res.json({ data: await store.getEvaluation(req.params.id, req.user) });
  }));
  app.put('/api/v1/assignments/:id/evaluation', secured, reviewUsers, asyncRoute(async (req, res) => {
    const { rubricId, scores, recommendation, generalObservation } = req.body ?? {};
    if (!rubricId || !Array.isArray(scores) || !recommendation) return res.status(400).json({ error: 'Rúbrica, puntajes y recomendación son obligatorios' });
    res.json({ data: await store.saveEvaluation(req.params.id, { rubricId, scores, recommendation, generalObservation }, req.user) });
  }));
  app.get('/api/v1/investigations/:id/feedback', secured, researchTeam, asyncRoute(async (req, res) => {
    res.json({ data: await store.getFeedback(req.params.id, req.user) });
  }));
  app.post('/api/v1/investigations/:id/resubmit', secured, researchTeam, asyncRoute(async (req, res) => {
    res.status(201).json({ data: await store.resubmitCorrections(req.params.id, req.user) });
  }));

  app.get('/api/v1/investigations/:id/decision-summary', secured, reviewUsers, asyncRoute(async (req, res) => {
    res.json({ data: await store.getDecisionSummary(req.params.id, req.user) });
  }));
  app.post('/api/v1/investigations/:id/committee-decisions', secured, reviewManager, asyncRoute(async (req, res) => {
    const { committeeId, decision, observations } = req.body ?? {};
    if (!committeeId || !['APROBADA', 'CON_CORRECCIONES', 'RECHAZADA'].includes(decision)) return res.status(400).json({ error: 'Comité y decisión válida son obligatorios' });
    res.status(201).json({ data: await store.saveCommitteeDecision(req.params.id, { committeeId, decision, observations }, req.user) });
  }));
  app.post('/api/v1/investigations/:id/authorize', secured, reviewManager, asyncRoute(async (req, res) => {
    res.json({ data: await store.authorizeInvestigation(req.params.id, req.body?.reason, req.user) });
  }));
  app.get('/api/v1/investigations/:id/history', secured, reviewUsers, asyncRoute(async (req, res) => {
    res.json({ data: await store.listHistory(req.params.id, req.user) });
  }));
  app.get('/api/v1/notifications', secured, asyncRoute(async (req, res) => {
    res.json({ data: await store.listNotifications(req.user) });
  }));
  app.patch('/api/v1/notifications/:id/read', secured, asyncRoute(async (req, res) => {
    res.json({ data: await store.markNotificationRead(req.params.id, req.user) });
  }));
  app.get('/api/v1/publications', secured, asyncRoute(async (req, res) => {
    res.json({ data: await store.listPublications(req.query, req.user) });
  }));
  app.post('/api/v1/investigations/:id/publish', secured, reviewManager, asyncRoute(async (req, res) => {
    res.status(201).json({ data: await store.publishInvestigation(req.params.id, req.user) });
  }));
  app.get('/api/v1/publications/:id/download', secured, asyncRoute(async (req, res) => {
    const document = await store.getPublishedDocument(req.params.id, req.user);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`);
    res.send(document.content);
  }));
  app.get('/api/v1/reports/executive', secured, reviewManager, asyncRoute(async (req, res) => {
    res.json({ data: await store.getExecutiveReport(req.query, req.user) });
  }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));

  app.use((error, _req, res, _next) => {
    const databaseUnavailable = ['ER_GET_CONNECTION_TIMEOUT', 'ECONNREFUSED'].includes(error.code)
      || ['ER_GET_CONNECTION_TIMEOUT', 'ECONNREFUSED'].includes(error.cause?.code);
    if (databaseUnavailable) {
      return res.status(503).json({ error: 'La base de datos no está disponible. Inicia MariaDB con pnpm db:up y vuelve a intentarlo.' });
    }
    console.error(error);
    res.status(error.status ?? 500).json({ error: error.status ? error.message : 'Error interno del servidor' });
  });

  return app;
}
