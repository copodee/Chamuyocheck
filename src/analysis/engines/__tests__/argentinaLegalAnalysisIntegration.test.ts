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
