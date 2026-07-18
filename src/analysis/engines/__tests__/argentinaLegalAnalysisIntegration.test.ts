import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalAnalysis, normalizeAI } from '../../../../app/api/analyze/route';

test('integra fragmentos y fuentes jurídicas en el análisis principal', () => {
  const result = buildLocalAnalysis('Contrato en Argentina. La empresa podrá modificar unilateralmente las condiciones sin aviso y aplicar una penalidad de $50.000.', 'Texto', '', null);
  assert.equal(result.argentinaLegalAnalysis.area, 'contracts');
  assert.ok(result.argentinaLegalAnalysis.issues.some((issue) => issue.id === 'unilateral-change'));
  assert.ok(result.evidenceFound.some((item) => /Fragmento jurídico/.test(item)));
  assert.ok(result.categoryScores.some((item) => item.name === 'Revisión jurídica necesaria'));
});

test('normalización no puede borrar el análisis jurídico local', () => {
  const fallback = buildLocalAnalysis('Según el Código Penal argentino, robar un caramelo se castiga con la horca.', 'Texto', '', null);
  const normalized = normalizeAI({ argentinaLegalAnalysis: null }, fallback);
  assert.deepEqual(normalized.argentinaLegalAnalysis, fallback.argentinaLegalAnalysis);
});

test('responde la consulta coloquial sobre pena por violación dentro del derecho argentino', () => {
  const result = buildLocalAnalysis('¿Cuántos años de cárcel le dan a un violador?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  assert.equal(result.argentinaLegalAnalysis.area, 'criminal');
  assert.equal(result.argentinaLegalAnalysis.jurisdiction, 'argentina');
  assert.match(result.decisionAnswer?.directAnswer || '', /6 meses a 4 años/);
  assert.match(result.decisionAnswer?.directAnswer || '', /6 a 15 años/);
  assert.match(result.decisionAnswer?.directAnswer || '', /no puede determinarse/i);
});

test('prioriza derecho de familia frente a la palabra cuota', () => {
  const result = buildLocalAnalysis('Me estoy divorciando y tengo un hijo de 8 años. ¿Hasta qué edad se le debe dar cuota de alimento?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  assert.equal(result.argentinaLegalAnalysis.area, 'family');
  assert.equal(result.decisionAnswer?.kind, 'legal-document');
  assert.match(result.decisionAnswer?.directAnswer || '', /hasta los 21 años/i);
  assert.match(result.decisionAnswer?.directAnswer || '', /hasta los 25 años/i);
  assert.doesNotMatch(result.decisionAnswer?.directAnswer || '', /CFT|costo solicitado/i);
});

test('la categoría legal prevalece ante costos, pagos y honorarios jurídicos', () => {
  const result = buildLocalAnalysis('¿Qué costos y honorarios tengo que pagar si no cumplo una sentencia?', 'Texto', '', null, '', '', 'argentina-legal-documents');
  assert.equal(result.decisionAnswer?.kind, 'legal-document');
  assert.equal(result.argentinaLegalAnalysis.jurisdiction, 'argentina');
  assert.doesNotMatch(result.decisionAnswer?.directAnswer || '', /CFT|cuotas financieras|monto financiado/i);
});
