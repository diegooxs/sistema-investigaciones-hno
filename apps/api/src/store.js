import bcrypt from 'bcryptjs';
import { calculateWeightedScore, REQUIRED_DOCUMENT_TYPES, REVIEW_RECOMMENDATIONS, validateRubricCriteria } from './review-logic.js';

const roles = [
  { id: 1, code: 'ADMINISTRADOR', name: 'Administrador' },
  { id: 2, code: 'ADMIN_INVESTIGADOR', name: 'Administrador Investigador' },
  { id: 3, code: 'INVESTIGADOR', name: 'Investigador' },
  { id: 4, code: 'COMITE', name: 'Integrante de comité' }
];
const now = () => new Date().toISOString();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const hasAnyRole = (user, allowed) => user.roles.some((role) => allowed.includes(role));

export function createStore() {
  let nextUserId = 5, nextCommitteeId = 4, nextResearchId = 1, nextDocumentId = 1;
  let nextRoundId = 1, nextAssignmentId = 1, nextRubricId = 1, nextCriterionId = 1, nextEvaluationId = 1, nextHistoryId = 1;
  let nextDecisionId = 1, nextNotificationId = 1, nextPublicationId = 1;
  const users = [
    { id: 1, name: 'Administrador del sistema', email: 'admin@hno.local', passwordHash: bcrypt.hashSync('Admin2027!', 10), active: true, roles: ['ADMINISTRADOR'] },
    { id: 2, name: 'Responsable de investigación', email: 'investigacion@hno.local', passwordHash: bcrypt.hashSync('Investiga2027!', 10), active: true, roles: ['ADMIN_INVESTIGADOR'] },
    { id: 3, name: 'Investigador de demostración', email: 'investigador@hno.local', passwordHash: bcrypt.hashSync('Investigador2027!', 10), active: true, roles: ['INVESTIGADOR'] },
    { id: 4, name: 'Revisor del Comité de Ética', email: 'comite@hno.local', passwordHash: bcrypt.hashSync('Comite2027!', 10), active: true, roles: ['COMITE'] }
  ];
  const committees = [
    { id: 1, name: 'Comité de Ética en Investigación', type: 'ETICA', active: true, memberIds: [4] },
    { id: 2, name: 'Comité de Investigación', type: 'INVESTIGACION', active: true, memberIds: [] },
    { id: 3, name: 'Comité de Bioseguridad', type: 'BIOSEGURIDAD', active: true, memberIds: [] }
  ];
  const catalogs = {
    committeeTypes: ['ETICA', 'INVESTIGACION', 'BIOSEGURIDAD', 'OTRO'],
    researchStates: ['BORRADOR', 'EN_REVISION', 'CON_OBSERVACIONES', 'APROBADA', 'RECHAZADA', 'PUBLICADA'],
    documentTypes: ['ANEXO_A', 'ANEXO_E', 'ANEXO_G', 'ANEXO_I', 'INVESTIGACION_PDF', 'OTRO'],
    roundStates: ['ABIERTA', 'EN_EVALUACION', 'CERRADA'],
    assignmentStates: ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA'],
    reviewRecommendations: REVIEW_RECOMMENDATIONS
  };
  const investigations = [], documents = [], rounds = [], assignments = [], rubrics = [], criteria = [], evaluations = [], evaluationScores = [], history = [];
  const committeeDecisions = [], notifications = [], publications = [];
  const publicUser = (user) => { if (!user) return null; const { passwordHash, ...safe } = user; return safe; };
  const isManager = (user) => hasAnyRole(user, ['ADMINISTRADOR', 'ADMIN_INVESTIGADOR']);
  const researchWithOwner = (research) => ({ ...research, investigator: publicUser(users.find((user) => user.id === research.investigatorId)), documentCount: documents.filter((document) => document.researchId === research.id && document.current).length });
  const canManageResearch = (research, user) => isManager(user) || research.investigatorId === user.id;
  const changeResearchState = (research, nextState, user, reason) => {
    if (research.state === nextState) return;
    history.push({ id: nextHistoryId++, researchId: research.id, previousState: research.state, nextState, changedBy: user.id, reason, createdAt: now() });
    research.state = nextState; research.updatedAt = now();
  };
  const notify = (userId, researchId, title, message) => {
    notifications.push({ id: nextNotificationId++, userId, researchId, title, message, read: false, createdAt: now() });
  };
  const evaluationFor = (assignmentId) => evaluations.find((item) => item.assignmentId === Number(assignmentId));
  const evaluationDto = (evaluation) => evaluation && ({ ...evaluation, scores: evaluationScores.filter((item) => item.evaluationId === evaluation.id).map(({ evaluationId, ...item }) => item) });
  const assignmentDto = (assignment) => ({ ...assignment, committee: committees.find((item) => item.id === assignment.committeeId), member: publicUser(users.find((item) => item.id === assignment.memberId)), evaluation: evaluationDto(evaluationFor(assignment.id)) });
  const roundDto = (round, user) => {
    const research = investigations.find((item) => item.id === round.researchId);
    const related = assignments.filter((item) => item.roundId === round.id);
    const visible = isManager(user) ? related : user.roles.includes('COMITE') ? related.filter((item) => item.memberId === user.id) : [];
    return { ...round, research: researchWithOwner(research), assignmentCount: related.length, completedCount: related.filter((item) => item.state === 'COMPLETADA').length, assignments: visible.map(assignmentDto) };
  };
  const rubricDto = (rubric) => ({ ...rubric, committee: committees.find((item) => item.id === rubric.committeeId), criteria: criteria.filter((item) => item.rubricId === rubric.id) });

  return {
    kind: 'memory', roles, catalogs,
    async health() { return true; },
    findUserByEmail(email) { return users.find((user) => user.email.toLowerCase() === String(email).toLowerCase()); },
    findUserById(id) { return users.find((user) => user.id === Number(id)); },
    listUsers() { return users.map(publicUser); },
    listResearchers() { return users.filter((user) => user.active && hasAnyRole(user, ['ADMIN_INVESTIGADOR', 'INVESTIGADOR'])).map(publicUser); },
    listCommitteeReviewers() { return users.filter((user) => user.active && user.roles.includes('COMITE')).map(publicUser); },
    createUser(input) {
      if (this.findUserByEmail(input.email)) fail('El correo ya está registrado', 409);
      const invalidRole = input.roles?.find((code) => !roles.some((role) => role.code === code));
      if (invalidRole) fail(`Rol no válido: ${invalidRole}`);
      const user = { id: nextUserId++, name: input.name, email: input.email.toLowerCase(), passwordHash: bcrypt.hashSync(input.password, 10), active: true, roles: input.roles ?? [] };
      users.push(user); return publicUser(user);
    },
    updateUser(id, changes) {
      const user = this.findUserById(id); if (!user) fail('Usuario no encontrado', 404);
      if (changes.name !== undefined) user.name = String(changes.name).trim();
      if (changes.active !== undefined) user.active = Boolean(changes.active);
      if (changes.roles !== undefined) { const invalid = changes.roles.find((code) => !roles.some((role) => role.code === code)); if (invalid) fail(`Rol no válido: ${invalid}`); user.roles = changes.roles; }
      if (changes.password !== undefined) user.passwordHash = bcrypt.hashSync(String(changes.password), 10);
      return publicUser(user);
    },
    listCommittees() { return committees.map((item) => ({ ...item, memberIds: [...item.memberIds] })); },
    createCommittee(input) { const item = { id: nextCommitteeId++, name: input.name, type: input.type, active: true, memberIds: (input.memberIds ?? []).map(Number) }; committees.push(item); return item; },
    updateCommitteeMembers(id, memberIds) {
      const committee = committees.find((item) => item.id === Number(id)); if (!committee) fail('Comité no encontrado', 404);
      const unique = [...new Set(memberIds.map(Number))];
      for (const memberId of unique) { const member = users.find((item) => item.id === memberId); if (!member?.active || !member.roles.includes('COMITE')) fail('Todos los integrantes deben ser usuarios activos con rol de comité'); }
      committee.memberIds = unique; return { ...committee, memberIds: [...unique] };
    },
    listInvestigations(user) { return investigations.filter((item) => isManager(user) || item.investigatorId === user.id).map(researchWithOwner); },
    findInvestigation(id) { return investigations.find((item) => item.id === Number(id)); },
    getInvestigation(id, user) { const item = this.findInvestigation(id); if (!item) fail('Investigación no encontrada', 404); if (!canManageResearch(item, user)) fail('No tienes permiso para consultar esta investigación', 403); return researchWithOwner(item); },
    createInvestigation(input, user) {
      const createdAt = now(); const owner = isManager(user) && input.investigatorId ? this.findUserById(input.investigatorId) : user;
      if (!owner?.active || !hasAnyRole(owner, ['ADMIN_INVESTIGADOR', 'INVESTIGADOR'])) fail('Selecciona un responsable de investigación activo');
      const item = { id: nextResearchId++, investigatorId: owner.id, title: input.title.trim(), summary: input.summary?.trim() ?? '', area: input.area?.trim() ?? '', category: input.category?.trim() ?? '', state: 'BORRADOR', createdAt, updatedAt: createdAt };
      investigations.push(item); return researchWithOwner(item);
    },
    updateInvestigation(id, changes, user) {
      const item = this.findInvestigation(id); if (!item) fail('Investigación no encontrada', 404); if (!canManageResearch(item, user)) fail('No tienes permiso para modificar esta investigación', 403);
      if (!['BORRADOR', 'CON_OBSERVACIONES'].includes(item.state)) fail('Solo pueden modificarse investigaciones en borrador o con observaciones', 409);
      for (const key of ['title', 'summary', 'area', 'category']) if (changes[key] !== undefined) item[key] = String(changes[key]).trim();
      if (!item.title) fail('El título es obligatorio'); item.updatedAt = now(); return researchWithOwner(item);
    },
    listDocuments(researchId, user) { this.getInvestigation(researchId, user); return documents.filter((item) => item.researchId === Number(researchId)).map(({ content, ...item }) => item); },
    addDocument(researchId, input, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404); if (!canManageResearch(research, user)) fail('No tienes permiso para cargar documentos', 403);
      if (!['BORRADOR', 'CON_OBSERVACIONES'].includes(research.state)) fail('Solo pueden cargarse documentos en borrador o durante una corrección', 409);
      if (!catalogs.documentTypes.includes(input.type)) fail('Tipo documental no válido');
      const related = documents.filter((item) => item.researchId === research.id && item.type === input.type); related.forEach((item) => { item.current = false; });
      const item = { id: nextDocumentId++, researchId: research.id, type: input.type, originalName: input.originalName, mimeType: input.mimeType, size: input.content.length, version: related.length + 1, current: true, uploadedBy: user.id, uploadedByName: user.name, createdAt: now(), content: input.content };
      documents.push(item); research.updatedAt = now(); const { content, ...metadata } = item; return metadata;
    },
    getDocument(documentId, user) { const item = documents.find((value) => value.id === Number(documentId)); if (!item) fail('Documento no encontrado', 404); this.getInvestigation(item.researchId, user); return item; },
    listRounds(user) {
      return rounds.filter((round) => { const research = investigations.find((item) => item.id === round.researchId); return isManager(user) || research?.investigatorId === user.id || assignments.some((item) => item.roundId === round.id && item.memberId === user.id); }).map((round) => roundDto(round, user)).sort((a, b) => b.id - a.id);
    },
    getRound(id, user) {
      const round = rounds.find((item) => item.id === Number(id)); if (!round) fail('Ronda de revisión no encontrada', 404);
      const research = investigations.find((item) => item.id === round.researchId);
      if (!(isManager(user) || research?.investigatorId === user.id || assignments.some((item) => item.roundId === round.id && item.memberId === user.id))) fail('No tienes permiso para consultar esta ronda', 403);
      return roundDto(round, user);
    },
    createRound(researchId, input, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404); if (research.state !== 'BORRADOR') fail('La primera ronda solamente puede abrirse desde un expediente en borrador', 409);
      const current = new Set(documents.filter((item) => item.researchId === research.id && item.current).map((item) => item.type)); const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !current.has(type));
      if (missing.length) fail(`El expediente está incompleto. Faltan: ${missing.join(', ')}`, 409);
      if (!input.assignments?.length) fail('Selecciona al menos un integrante de comité');
      const dueAt = input.dueAt ? new Date(input.dueAt) : null; if (!dueAt || Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) fail('La fecha de vencimiento debe ser posterior a la fecha actual');
      const unique = new Set();
      for (const selected of input.assignments) {
        const committee = committees.find((item) => item.id === Number(selected.committeeId) && item.active); const member = users.find((item) => item.id === Number(selected.memberId) && item.active); const key = `${selected.committeeId}:${selected.memberId}`;
        if (!committee || !member?.roles.includes('COMITE') || !committee.memberIds.includes(member.id)) fail('Cada asignación debe corresponder a un integrante activo del comité seleccionado');
        if (unique.has(key)) fail('No repitas una asignación para el mismo comité e integrante'); unique.add(key);
      }
      const number = Math.max(0, ...rounds.filter((item) => item.researchId === research.id).map((item) => item.number)) + 1;
      const round = { id: nextRoundId++, researchId: research.id, number, state: 'ABIERTA', startsAt: now(), dueAt: dueAt.toISOString() }; rounds.push(round);
      for (const selected of input.assignments) assignments.push({ id: nextAssignmentId++, roundId: round.id, committeeId: Number(selected.committeeId), memberId: Number(selected.memberId), state: 'PENDIENTE', assignedAt: now() });
      changeResearchState(research, 'EN_REVISION', user, `Apertura de la ronda de revisión ${number}`); return roundDto(round, user);
    },
    updateAssignmentStatus(id, status, user) {
      const item = assignments.find((value) => value.id === Number(id)); if (!item) fail('Asignación no encontrada', 404); if (!isManager(user) && item.memberId !== user.id) fail('No tienes permiso para actualizar esta asignación', 403);
      if (item.state === 'COMPLETADA') fail('La asignación ya fue completada', 409); if (status !== 'EN_PROCESO') fail('El único cambio manual permitido es iniciar la revisión');
      item.state = status; rounds.find((round) => round.id === item.roundId).state = 'EN_EVALUACION'; return assignmentDto(item);
    },
    listRubrics(user) { const allowed = isManager(user) ? null : committees.filter((item) => item.memberIds.includes(user.id)).map((item) => item.id); return rubrics.filter((item) => !allowed || allowed.includes(item.committeeId)).map(rubricDto); },
    createRubric(input) {
      const committee = committees.find((item) => item.id === Number(input.committeeId) && item.active); if (!committee) fail('Selecciona un comité activo');
      const validationError = validateRubricCriteria(input.criteria); if (validationError) fail(validationError);
      rubrics.filter((item) => item.committeeId === committee.id).forEach((item) => { item.active = false; }); const version = Math.max(0, ...rubrics.filter((item) => item.committeeId === committee.id).map((item) => item.version)) + 1;
      const rubric = { id: nextRubricId++, committeeId: committee.id, name: String(input.name).trim(), version, active: true }; rubrics.push(rubric);
      for (const item of input.criteria) criteria.push({ id: nextCriterionId++, rubricId: rubric.id, description: String(item.description).trim(), weight: Number(item.weight), maximumScore: Number(item.maximumScore) });
      return rubricDto(rubric);
    },
    getEvaluation(assignmentId, user) { const item = assignments.find((value) => value.id === Number(assignmentId)); if (!item) fail('Asignación no encontrada', 404); if (!isManager(user) && item.memberId !== user.id) fail('No tienes permiso para consultar esta evaluación', 403); return evaluationDto(evaluationFor(item.id)); },
    saveEvaluation(assignmentId, input, user) {
      const assignment = assignments.find((item) => item.id === Number(assignmentId)); if (!assignment) fail('Asignación no encontrada', 404); if (assignment.memberId !== user.id || !user.roles.includes('COMITE')) fail('Solo el integrante asignado puede registrar la evaluación', 403);
      const round = rounds.find((item) => item.id === assignment.roundId); if (round.state === 'CERRADA') fail('La ronda ya está cerrada', 409);
      const rubric = rubrics.find((item) => item.id === Number(input.rubricId) && item.active && item.committeeId === assignment.committeeId); if (!rubric) fail('Selecciona una rúbrica activa del comité');
      if (!REVIEW_RECOMMENDATIONS.includes(input.recommendation)) fail('Selecciona una recomendación válida');
      const calculated = calculateWeightedScore(criteria.filter((item) => item.rubricId === rubric.id), input.scores);
      let evaluation = evaluationFor(assignment.id);
      const values = { rubricId: rubric.id, score: calculated.total, recommendation: input.recommendation, generalObservation: String(input.generalObservation ?? '').trim(), evaluatedAt: now() };
      if (!evaluation) { evaluation = { id: nextEvaluationId++, assignmentId: assignment.id, ...values }; evaluations.push(evaluation); } else Object.assign(evaluation, values);
      for (let i = evaluationScores.length - 1; i >= 0; i--) if (evaluationScores[i].evaluationId === evaluation.id) evaluationScores.splice(i, 1);
      calculated.scores.forEach((item) => evaluationScores.push({ evaluationId: evaluation.id, ...item })); assignment.state = 'COMPLETADA'; round.state = 'EN_EVALUACION';
      const research = investigations.find((item) => item.id === round.researchId); const roundEvaluations = assignments.filter((item) => item.roundId === round.id).map((item) => evaluationFor(item.id)).filter(Boolean); const needsCorrection = roundEvaluations.some((item) => item.recommendation !== 'APROBADA');
      changeResearchState(research, needsCorrection ? 'CON_OBSERVACIONES' : 'EN_REVISION', user, needsCorrection ? 'Evaluación con observaciones o correcciones' : 'Evaluación registrada sin observaciones pendientes');
      return evaluationDto(evaluation);
    },
    getFeedback(researchId, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404); if (!canManageResearch(research, user)) fail('No tienes permiso para consultar las observaciones', 403);
      return rounds.filter((round) => round.researchId === research.id).flatMap((round) => assignments.filter((assignment) => assignment.roundId === round.id).map((assignment) => {
        const evaluation = evaluationFor(assignment.id); if (!evaluation) return null; const rubric = rubrics.find((item) => item.id === evaluation.rubricId);
        return { roundId: round.id, roundNumber: round.number, committee: committees.find((item) => item.id === assignment.committeeId), score: evaluation.score, recommendation: evaluation.recommendation, generalObservation: evaluation.generalObservation, evaluatedAt: evaluation.evaluatedAt, criteria: evaluationScores.filter((item) => item.evaluationId === evaluation.id).map((item) => ({ ...item, criterion: criteria.find((criterion) => criterion.id === item.criterionId) })), rubricName: rubric?.name ?? '' };
      })).filter(Boolean);
    },
    resubmitCorrections(researchId, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404); if (!canManageResearch(research, user)) fail('No tienes permiso para reenviar esta investigación', 403); if (research.state !== 'CON_OBSERVACIONES') fail('La investigación no tiene correcciones pendientes', 409);
      if (!documents.some((item) => item.researchId === research.id && item.current && item.version > 1)) fail('Carga al menos una nueva versión documental antes de reenviar las correcciones', 409);
      const previous = rounds.filter((item) => item.researchId === research.id).sort((a, b) => b.number - a.number)[0]; const previousAssignments = assignments.filter((item) => item.roundId === previous?.id); if (!previous || !previousAssignments.length) fail('No existe una ronda anterior para reenviar', 409);
      previous.state = 'CERRADA'; const dueAt = new Date(); dueAt.setDate(dueAt.getDate() + 14); const round = { id: nextRoundId++, researchId: research.id, number: previous.number + 1, state: 'ABIERTA', startsAt: now(), dueAt: dueAt.toISOString() }; rounds.push(round);
      previousAssignments.forEach((item) => assignments.push({ id: nextAssignmentId++, roundId: round.id, committeeId: item.committeeId, memberId: item.memberId, state: 'PENDIENTE', assignedAt: now() })); changeResearchState(research, 'EN_REVISION', user, `Correcciones enviadas a la ronda ${round.number}`); return roundDto(round, user);
    },
    getDecisionSummary(researchId, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404);
      const relatedRounds = rounds.filter((item) => item.researchId === research.id).sort((a, b) => b.number - a.number);
      const round = relatedRounds[0];
      if (!round) fail('La investigación todavía no tiene una ronda de revisión', 409);
      const related = assignments.filter((item) => item.roundId === round.id);
      const allowed = isManager(user) || research.investigatorId === user.id || related.some((item) => item.memberId === user.id);
      if (!allowed) fail('No tienes permiso para consultar el dictamen', 403);
      const committeeIds = [...new Set(related.map((item) => item.committeeId))];
      const decisions = committeeIds.map((committeeId) => {
        const committeeAssignments = related.filter((item) => item.committeeId === committeeId);
        const decision = committeeDecisions.find((item) => item.roundId === round.id && item.committeeId === committeeId);
        return { committee: committees.find((item) => item.id === committeeId), assignmentCount: committeeAssignments.length, completedCount: committeeAssignments.filter((item) => item.state === 'COMPLETADA').length, recommendations: committeeAssignments.map((item) => evaluationFor(item.id)?.recommendation).filter(Boolean), decision: decision ?? null };
      });
      return { research: researchWithOwner(research), round: { id: round.id, number: round.number, state: round.state }, committees: decisions, allAssignmentsCompleted: related.length > 0 && related.every((item) => item.state === 'COMPLETADA'), allCommitteesApproved: decisions.length > 0 && decisions.every((item) => item.decision?.decision === 'APROBADA'), canAuthorize: isManager(user) && research.state === 'EN_REVISION' && decisions.length > 0 && decisions.every((item) => item.decision?.decision === 'APROBADA') };
    },
    saveCommitteeDecision(researchId, input, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404); if (!isManager(user)) fail('No tienes permiso para registrar el dictamen', 403);
      const round = rounds.filter((item) => item.researchId === research.id).sort((a, b) => b.number - a.number)[0]; if (!round) fail('No existe una ronda para dictaminar', 409);
      const related = assignments.filter((item) => item.roundId === round.id && item.committeeId === Number(input.committeeId)); if (!related.length) fail('El comité no participa en la ronda', 400);
      if (!related.every((item) => item.state === 'COMPLETADA')) fail('Todas las evaluaciones del comité deben estar completadas', 409);
      let item = committeeDecisions.find((value) => value.roundId === round.id && value.committeeId === Number(input.committeeId));
      const values = { researchId: research.id, roundId: round.id, committeeId: Number(input.committeeId), decision: input.decision, observations: String(input.observations ?? '').trim(), decidedBy: user.id, decidedAt: now() };
      if (item) Object.assign(item, values); else { item = { id: nextDecisionId++, ...values }; committeeDecisions.push(item); }
      if (input.decision !== 'APROBADA') changeResearchState(research, input.decision === 'RECHAZADA' ? 'RECHAZADA' : 'CON_OBSERVACIONES', user, `Dictamen ${input.decision} del comité`);
      notify(research.investigatorId, research.id, 'Dictamen registrado', `Se registró el dictamen ${input.decision} para ${research.title}.`);
      return this.getDecisionSummary(researchId, user);
    },
    authorizeInvestigation(researchId, reason, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404); if (!isManager(user)) fail('No tienes permiso para autorizar', 403);
      const summary = this.getDecisionSummary(researchId, user); if (!summary.allCommitteesApproved) fail('Todos los comités deben contar con dictamen aprobado', 409); if (!summary.canAuthorize) fail('La investigación debe estar en revisión para ser autorizada', 409);
      if (!documents.some((item) => item.researchId === research.id && item.type === 'INVESTIGACION_PDF' && item.current)) fail('No existe un PDF vigente para autorizar', 409);
      const round = rounds.find((item) => item.id === summary.round.id); round.state = 'CERRADA'; changeResearchState(research, 'APROBADA', user, String(reason ?? '').trim() || 'Autorización institucional');
      notify(research.investigatorId, research.id, 'Investigación autorizada', `${research.title} fue autorizada institucionalmente.`);
      return researchWithOwner(research);
    },
    listHistory(researchId, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404);
      const canView = isManager(user) || research.investigatorId === user.id || assignments.some((item) => rounds.some((round) => round.id === item.roundId && round.researchId === research.id) && item.memberId === user.id);
      if (!canView) fail('No tienes permiso para consultar el historial', 403);
      return history.filter((item) => item.researchId === research.id).map((item) => ({ ...item, changedByName: users.find((value) => value.id === item.changedBy)?.name ?? '' })).sort((a, b) => b.id - a.id);
    },
    listNotifications(user) { return notifications.filter((item) => item.userId === user.id).sort((a, b) => b.id - a.id); },
    markNotificationRead(id, user) { const item = notifications.find((value) => value.id === Number(id) && value.userId === user.id); if (!item) fail('Notificación no encontrada', 404); item.read = true; return item; },
    publishInvestigation(researchId, user) {
      const research = this.findInvestigation(researchId); if (!research) fail('Investigación no encontrada', 404); if (!isManager(user)) fail('No tienes permiso para publicar', 403); if (research.state !== 'APROBADA') fail('Solo puede publicarse una investigación autorizada', 409);
      const document = documents.filter((item) => item.researchId === research.id && item.type === 'INVESTIGACION_PDF' && item.current).sort((a, b) => b.version - a.version)[0]; if (!document) fail('No existe un PDF vigente para publicar', 409);
      publications.filter((item) => item.researchId === research.id && item.active).forEach((item) => { item.active = false; item.replacedAt = now(); });
      const publication = { id: nextPublicationId++, researchId: research.id, documentId: document.id, publishedBy: user.id, active: true, publishedAt: now() }; publications.push(publication); changeResearchState(research, 'PUBLICADA', user, 'Publicación institucional');
      notify(research.investigatorId, research.id, 'Investigación publicada', `${research.title} ya está disponible para consulta institucional.`);
      return { ...publication, research: researchWithOwner(research), document: { ...document, content: undefined } };
    },
    listPublications(filters = {}) {
      const query = String(filters.query ?? '').toLowerCase(); const area = String(filters.area ?? '').toLowerCase(); const category = String(filters.category ?? '').toLowerCase();
      return publications.filter((item) => item.active).map((item) => { const research = investigations.find((value) => value.id === item.researchId); const document = documents.find((value) => value.id === item.documentId); return { ...item, research: researchWithOwner(research), document: { id: document.id, originalName: document.originalName, version: document.version, size: document.size } }; }).filter((item) => (!query || `${item.research.title} ${item.research.summary}`.toLowerCase().includes(query)) && (!area || item.research.area.toLowerCase().includes(area)) && (!category || item.research.category.toLowerCase().includes(category))).sort((a, b) => b.id - a.id);
    },
    getPublishedDocument(publicationId) { const publication = publications.find((item) => item.id === Number(publicationId) && item.active); if (!publication) fail('Publicación no encontrada', 404); return documents.find((item) => item.id === publication.documentId); },
    getExecutiveReport(filters = {}) {
      const from = filters.from ? new Date(filters.from) : null; const to = filters.to ? new Date(filters.to) : null;
      const data = investigations.filter((item) => (!from || new Date(item.createdAt) >= from) && (!to || new Date(item.createdAt) <= to));
      const group = (field) => Object.entries(data.reduce((acc, item) => { const key = item[field] || 'Sin especificar'; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).map(([label, total]) => ({ label, total }));
      return { generatedAt: now(), filters: { from: filters.from ?? '', to: filters.to ?? '' }, totals: { investigations: data.length, published: data.filter((item) => item.state === 'PUBLICADA').length, authorized: data.filter((item) => ['APROBADA', 'PUBLICADA'].includes(item.state)).length, inReview: data.filter((item) => item.state === 'EN_REVISION').length }, byState: group('state'), byArea: group('area'), byCategory: group('category') };
    }
  };
}
