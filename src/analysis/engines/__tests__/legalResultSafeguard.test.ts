import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLegalResultPresentation } from '../legalResultSafeguard';
import { buildLocalAnalysis, normalizeAI } from '../../../../app/api/analyze/route';

test('legal presentation explains score basis and verification limits', () => {
  const result = buildLegalResultPresentation({
    score: 72, risk: 'Alto chamuyo', confidence: 'Media',
    baseSummary: 'Se detectaron señales relevantes.', baseConclusion: 'Solicitá más evidencia.',
    categoryScores: [{ name: 'Evidencia faltante', score: 82, explanation: 'Faltan fuentes.' }],
    externalVerificationRequired: true, externalVerificationPerformed: false,
  });
  assert.match(result.summary, /72\/100/);
  assert.match(result.summary, /Evidencia faltante/);
  assert.match(result.summary, /no fue realizada/);
  assert.match(result.legalSafeguard, /no determina verdad, falsedad/i);
  assert.ok(result.legalNotice.prohibitedSoleUses.some((item) => /Sanciones académicas/.test(item)));
});

test('analysis always exposes a justified summary and immutable legal safeguard', () => {
  const fallback = buildLocalAnalysis('Este contrato es ilegal en Argentina.', 'Texto', '', null);
  const normalized = normalizeAI({
    score: 77,
    risk: 'Alto chamuyo',
    summary: 'Resumen generado.',
    legalSafeguard: '',
    legalNotice: { limitations: [], prohibitedSoleUses: [] },
    resultJustification: [],
  }, fallback);
  assert.match(normalized.summary, /77\/100/);
  assert.match(normalized.summary, /verificación externa requerida no fue realizada/i);
  assert.ok(normalized.resultJustification.length >= 4);
  assert.match(normalized.legalSafeguard, /no reemplaza asesoramiento legal/i);
  assert.equal(normalized.legalNotice.notFactualDetermination, true);
});
