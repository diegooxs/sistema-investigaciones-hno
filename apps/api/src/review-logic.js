export const REQUIRED_DOCUMENT_TYPES = Object.freeze([
  'ANEXO_A', 'ANEXO_E', 'ANEXO_G', 'ANEXO_I', 'INVESTIGACION_PDF'
]);

export const REVIEW_RECOMMENDATIONS = Object.freeze([
  'APROBADA', 'CON_CORRECCIONES', 'RECHAZADA'
]);

export function validateRubricCriteria(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) return 'Agrega al menos un criterio';
  for (const criterion of criteria) {
    const description = String(criterion.description ?? '').trim();
    const weight = Number(criterion.weight);
    const maximumScore = Number(criterion.maximumScore);
    if (!description) return 'Cada criterio requiere una descripción';
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) return 'Cada ponderación debe ser mayor que 0 y no exceder 100';
    if (!Number.isFinite(maximumScore) || maximumScore <= 0) return 'Cada puntaje máximo debe ser mayor que 0';
  }
  const total = criteria.reduce((sum, criterion) => sum + Number(criterion.weight), 0);
  return Math.abs(total - 100) <= 0.01 ? null : 'La ponderación total de la rúbrica debe ser 100 %';
}

export function calculateWeightedScore(criteria, scores) {
  const byCriterion = new Map((scores ?? []).map((item) => [Number(item.criterionId), Number(item.score)]));
  if (criteria.length !== byCriterion.size) throw Object.assign(new Error('Captura un puntaje para cada criterio'), { status: 400 });
  let total = 0;
  const normalized = criteria.map((criterion) => {
    const score = byCriterion.get(Number(criterion.id));
    const maximum = Number(criterion.maximumScore);
    if (!Number.isFinite(score) || score < 0 || score > maximum) {
      throw Object.assign(new Error(`El puntaje de "${criterion.description}" debe estar entre 0 y ${maximum}`), { status: 400 });
    }
    total += (score / maximum) * Number(criterion.weight);
    return { criterionId: Number(criterion.id), score };
  });
  return { total: Math.round(total * 100) / 100, scores: normalized };
}
