import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runClaimFirstPipeline } from '../claimFirstPipeline';
import { consolidateExternalVerificationPlans } from '../externalVerificationPlanAggregator';

test('document plan consolidates duplicate legal checks', () => {
  const result = runClaimFirstPipeline(
    'Este contrato es ilegal en Argentina. La cláusula también es ilegal en Argentina.'
  );
  const plan = result.documentExternalVerificationPlan;

  assert.equal(plan.externalVerificationRequired, true);
  assert.equal(plan.externalVerificationPerformed, false);
  assert.equal(plan.claimsRequiringExternalVerification, 2);
  assert.equal(plan.workItems.length, 1);
  assert.deepEqual(plan.workItems[0].claimIndexes, [0, 1]);
  assert.equal(plan.workItems[0].priority, 'critical');
  assert.deepEqual(plan.jurisdictions, ['Argentina']);
});

test('document plan deduplicates sources and prioritizes critical checks', () => {
  const result = runClaimFirstPipeline(
    'Se vio un OVNI ayer en Córdoba. Este suplemento cura el cáncer. El dólar cotiza hoy a 2000 pesos.'
  );
  const plan = result.documentExternalVerificationPlan;

  assert.equal(plan.externalVerificationPerformed, false);
  assert.equal(plan.workItems[0].priority, 'critical');
  assert.equal(new Set(plan.suggestedSourceTypes).size, plan.suggestedSourceTypes.length);
  assert.ok(plan.suggestedSourceTypes.includes('clinical-guidelines'));
  assert.ok(plan.suggestedSourceTypes.includes('official-market-data'));
  assert.equal(plan.recencyRequired, true);
  assert.equal(plan.officialSourceRequired, true);
});

test('document plan records explicit cutoff date without performing searches', () => {
  const result = runClaimFirstPipeline('Este contrato es ilegal en Argentina.');
  const plan = consolidateExternalVerificationPlans(result.claims, '2026-07-11');

  assert.equal(plan.verificationCutoffDate, '2026-07-11');
  assert.equal(plan.externalVerificationPerformed, false);
});

test('document plan remains empty when claims are locally verifiable', () => {
  const result = runClaimFirstPipeline('2 + 2 = 5.');
  const plan = result.documentExternalVerificationPlan;

  assert.equal(plan.externalVerificationRequired, false);
  assert.equal(plan.claimsRequiringExternalVerification, 0);
  assert.deepEqual(plan.workItems, []);
  assert.deepEqual(plan.suggestedSourceTypes, []);
});

test('document aggregation does not alter claim or final scores', () => {
  const result = runClaimFirstPipeline('Este contrato es ilegal en Argentina.');
  const scoresBeforeAggregation = result.claimScores.map((score) => score.adjustedScore);
  const finalScoreBeforeAggregation = result.finalScore;

  consolidateExternalVerificationPlans(result.claims, '2026-07-11');

  assert.deepEqual(result.claimScores.map((score) => score.adjustedScore), scoresBeforeAggregation);
  assert.equal(result.finalScore, finalScoreBeforeAggregation);
});
