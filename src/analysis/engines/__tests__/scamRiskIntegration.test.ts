import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalAnalysis, normalizeAI } from '../../../../app/api/analyze/route';

test('el análisis principal expone señales justificadas de posible estafa', () => {
  const result = buildLocalAnalysis(
    'Inversión con ganancia garantizada sin riesgo. Transferí USDT ahora mismo y sumá referidos.',
    'Texto',
    '',
    null,
  );
  assert.ok(result.scamRiskAnalysis.score >= 50);
  assert.ok(result.scamRiskAnalysis.signals.length >= 3);
  assert.ok(result.evidenceFound.some((item) => /Señal observable/.test(item)));
  assert.match(result.scamRiskAnalysis.conclusion, /No prueban por sí solas/);
});

test('la normalización no puede borrar señales locales de posible estafa', () => {
  const fallback = buildLocalAnalysis('Ganancia garantizada sin riesgo; pagá para liberar el premio.', 'Texto', '', null);
  const normalized = normalizeAI({ scamRiskAnalysis: null, score: 0 }, fallback);
  assert.deepEqual(normalized.scamRiskAnalysis, fallback.scamRiskAnalysis);
  assert.ok(normalized.score >= fallback.scamRiskAnalysis.score);
});
