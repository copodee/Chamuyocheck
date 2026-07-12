import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalAnalysis, normalizeAI } from '../../../../app/api/analyze/route';

test('PDF analysis exposes a local external verification plan without execution', () => {
  const text = 'Este contrato es ilegal en Argentina: https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949';
  const result = buildLocalAnalysis(text, 'PDF', 'contrato.pdf', {
    ok: true, text, pages: 1, chars: text.length, note: 'PDF leído correctamente.',
  });
  assert.equal(result.externalVerification.externalVerificationRequired, true);
  assert.equal(result.externalVerification.externalVerificationPerformed, false);
  assert.equal(result.externalVerification.execution, null);
  assert.equal(result.externalVerification.planning.requests[0].connector, 'infoleg');
  assert.ok(result.externalVerification.providers.some((provider) => provider.id === 'infoleg' && provider.status === 'implemented'));
  assert.equal(result.externalVerification.hasExecutableSourceType, true);
  assert.ok(result.externalVerification.sourceAvailability.some((item) => item.sourceType === 'government-law-repository' && item.status === 'implemented'));
});

test('PDF analysis reports planned medical regulators without pretending connectors exist', () => {
  const text = 'Trabajo académico: este medicamento produce efectos adversos graves.';
  const result = buildLocalAnalysis(text, 'PDF', 'farmacologia.pdf', {
    ok: true, text, pages: 1, chars: text.length, note: 'PDF leído correctamente.',
  });
  assert.equal(result.externalVerification.externalVerificationPerformed, false);
  assert.equal(result.externalVerification.planning.requests.length, 0);
  assert.ok(result.externalVerification.planning.pending.length > 0);
  assert.ok(result.externalVerification.providers.some((provider) => provider.id === 'anmat' && provider.status === 'planned'));
  assert.ok(result.externalVerification.providers.some((provider) => provider.id === 'fda' && provider.status === 'planned'));
  assert.ok(result.externalVerification.providers.some((provider) => provider.id === 'ema' && provider.status === 'planned'));
  assert.equal(result.externalVerification.hasPlannedSourceType, true);
  assert.ok(result.externalVerification.sourceAvailability.some((item) => item.sourceType === 'drug-regulator-anmat' && item.status === 'planned'));
});

test('AI normalization cannot claim that analyze performed external verification', () => {
  const text = 'Este contrato es ilegal en Argentina.';
  const fallback = buildLocalAnalysis(text, 'Texto', '', null);
  const normalized = normalizeAI({ externalVerification: { externalVerificationPerformed: true } }, fallback);
  assert.equal(normalized.externalVerification.externalVerificationPerformed, false);
  assert.equal(normalized.externalVerification.execution, null);
});

test('mixed PDF reports verification readiness separately for each claim', () => {
  const text = [
    'Este contrato es ilegal en Argentina: https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949.',
    'Este medicamento produce efectos adversos graves.',
  ].join('\n');
  const result = buildLocalAnalysis(text, 'PDF', 'informe-mixto.pdf', {
    ok: true, text, pages: 2, chars: text.length, note: 'PDF leído correctamente.',
  });
  const legalClaim = result.externalVerification.claims.find((claim) => claim.text.includes('contrato'));
  const medicalClaim = result.externalVerification.claims.find((claim) => claim.text.includes('medicamento'));
  assert.ok(legalClaim);
  assert.equal(legalClaim.explicitRequestCount, 1);
  assert.ok(legalClaim.executableConnectors.includes('infoleg'));
  assert.equal(legalClaim.externalVerificationPerformed, false);
  assert.ok(medicalClaim);
  assert.equal(medicalClaim.explicitRequestCount, 0);
  assert.ok(medicalClaim.plannedConnectors.includes('anmat'));
  assert.ok(medicalClaim.pendingReasons.length > 0);
  assert.equal(medicalClaim.externalVerificationPerformed, false);
});
