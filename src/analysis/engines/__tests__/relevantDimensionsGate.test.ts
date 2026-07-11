/**
 * Relevant Dimensions Gate Tests (V21B)
 *
 * Tests proving that:
 * 1. Excluded dimensions do not affect score
 * 2. Scoring formula uses only applicable dimensions
 * 3. Score priority is respected
 * 4. Visible category breakdown excludes irrelevant dimensions
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  type AnalysisDimension,
  filterRelevantDimensions,
  applyScorePriority,
  getVisibleDimensions,
  assertExcludedDimensionsNotUsed
} from '../relevantDimensionsGate';

test('Relevant Dimensions Gate: Test A - Relevant dimensions not diluted by zeros', async (t) => {
  // Setup: 2 relevant dimensions (90, 80) + 3 irrelevant zero-valued dimensions
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 90, weight: 0.6, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'evidence', label: 'Evidencia', value: 80, weight: 0.4, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'financial-risk', label: 'Riesgo financiero', value: 0, weight: 0.2, applicable: false, reason: 'Not financial', sourceEngine: 'test' },
    { id: 'ponzi-risk', label: 'Riesgo Ponzi', value: 0, weight: 0.2, applicable: false, reason: 'Not Ponzi', sourceEngine: 'test' },
    { id: 'health-risk', label: 'Riesgo de salud', value: 0, weight: 0.2, applicable: false, reason: 'Not health', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(
    dimensions,
    'Bitcoin va a subir.',
    'prediction',
    'finance',
    false, // no financial claim
    false, // no Ponzi signals
    false, // no health
    false, // no legal
    false  // no academic
  );

  // Expected: 90 * 0.6 + 80 * 0.4 = 54 + 32 = 86
  // Denominator: 0.6 + 0.4 = 1.0
  // Score: 86 / 1.0 = 86

  assert.strictEqual(result.applicableDimensions.length, 2, 'Should have 2 applicable dimensions');
  assert.strictEqual(result.excludedDimensions.length, 3, 'Should have 3 excluded dimensions');
  assert.strictEqual(result.numerator, 86, 'Numerator should be 86 (90*0.6 + 80*0.4)');
  assert.strictEqual(result.denominator, 1.0, 'Denominator should be 1.0');
  assert.strictEqual(result.weightedScore, 86, 'Weighted score should be 86, NOT diluted by zeros');
});

test('Relevant Dimensions Gate: Test B - minimumScore floor respected', async (t) => {
  // Setup: weightedScore = 42, minimumScore = 95
  // Expected final score: 95 (floor applied)
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 40, weight: 0.5, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'evidence', label: 'Evidencia', value: 45, weight: 0.5, applicable: true, reason: '', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(
    dimensions,
    '¿Es verdad que una persona pública mantiene relaciones con un familiar?',
    'question',
    'general'
  );

  // Weighted: 40 * 0.5 + 45 * 0.5 = 20 + 22.5 = 42.5
  assert.strictEqual(Math.round(result.weightedScore!), 43, 'Weighted score should be ~43');

  // Apply priority with minimumScore = 95
  const priority = applyScorePriority(
    null, // no forceScore
    95,   // minimumScore = 95
    result.weightedScore,
    null  // no specialist recommended
  );

  assert.strictEqual(priority.finalScore, 95, 'Final score should be 95 (minimum floor applied)');
  assert(priority.appliedRule.includes('minimumScore=95'), 'Applied rule should mention minimumScore floor');
});

test('Relevant Dimensions Gate: Test C - Extraordinary claim has no finance/Ponzi dimensions', async (t) => {
  // Setup: Extraordinary claim with NO financial indicators
  // Expected: Finance and Ponzi dimensions excluded
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 70, weight: 0.25, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'corroboration', label: 'Corroboración', value: 30, weight: 0.25, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'financial-risk', label: 'Riesgo financiero', value: 50, weight: 0.25, applicable: false, reason: 'No financial indicators', sourceEngine: 'test' },
    { id: 'ponzi-risk', label: 'Riesgo Ponzi', value: 50, weight: 0.25, applicable: false, reason: 'No Ponzi signals', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(
    dimensions,
    'Se vio un OVNI ayer sobre Córdoba.',
    'extraordinary-claim',
    'public-claims',
    false, // no financial claim
    false  // no Ponzi signals
  );

  assert.strictEqual(result.applicableDimensions.length, 2, 'Only credibility and corroboration should be applicable');
  assert.strictEqual(result.excludedDimensions.length, 2, 'Finance and Ponzi dimensions should be excluded');
  
  // Verify excluded dimensions are truly finance and Ponzi
  const excludedLabels = result.excludedDimensions.map(d => d.label);
  assert(excludedLabels.includes('Riesgo financiero'), 'Riesgo financiero should be excluded');
  assert(excludedLabels.includes('Riesgo Ponzi'), 'Riesgo Ponzi should be excluded');

  // Verify they don't affect score
  // Weighted: 70 * 0.25 + 30 * 0.25 = 17.5 + 7.5 = 25
  // Denominator: 0.25 + 0.25 = 0.5
  // Score: 25 / 0.5 = 50
  assert.strictEqual(result.weightedScore, 50, 'Score should only use applicable dimensions');
});

test('Relevant Dimensions Gate: Test D - Financial inconsistency has finance/Ponzi dimensions', async (t) => {
  // Setup: Financial offer with Ponzi signals
  // Expected: Finance and Ponzi dimensions included, forceScore applied
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 20, weight: 0.2, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'financial-risk', label: 'Riesgo financiero', value: 100, weight: 0.4, applicable: true, reason: 'Financial offer detected', sourceEngine: 'test' },
    { id: 'ponzi-risk', label: 'Riesgo Ponzi', value: 100, weight: 0.4, applicable: true, reason: 'Ponzi signals detected', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(
    dimensions,
    'Me ofrecen invertir 100000 pesos al 10% anual y recibir 500000 en 15 días con recompensa si traes referidos.',
    'financial-offer',
    'advertising-scams',
    true,  // financial claim
    true   // Ponzi signals (referidos, extraordinary returns)
  );

  assert.strictEqual(result.applicableDimensions.length, 3, 'All dimensions should be applicable for financial Ponzi content');
  assert.strictEqual(result.excludedDimensions.length, 0, 'No dimensions should be excluded');

  // Score calculation: 20*0.2 + 100*0.4 + 100*0.4 = 4 + 40 + 40 = 84
  // Denominator: 0.2 + 0.4 + 0.4 = 1.0
  // Weighted: 84
  assert.strictEqual(result.weightedScore, 84, 'Weighted score should be 84');

  // Apply priority with forceScore (financial fraud = 100)
  const priority = applyScorePriority(
    100,  // forceScore for financial inconsistency
    null, // no minimumScore
    result.weightedScore,
    null
  );

  assert.strictEqual(priority.finalScore, 100, 'forceScore should override, final score = 100');
});

test('Relevant Dimensions Gate: Test E - Ordinary fact has no irrelevant dimensions', async (t) => {
  // Setup: Factual claim about sports (should not have finance, health, legal, academic dimensions)
  // Expected: Only credibility and evidence dimensions
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 15, weight: 0.5, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'evidence', label: 'Evidencia', value: 20, weight: 0.5, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'financial-risk', label: 'Riesgo financiero', value: 0, weight: 0.2, applicable: false, reason: '', sourceEngine: 'test' },
    { id: 'health-risk', label: 'Riesgo de salud', value: 0, weight: 0.2, applicable: false, reason: '', sourceEngine: 'test' },
    { id: 'legal-risk', label: 'Riesgo jurídico', value: 0, weight: 0.2, applicable: false, reason: '', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(
    dimensions,
    'Messi ganó el Mundial 2022 con Argentina.',
    'fact',
    'history-sports'
  );

  assert.strictEqual(result.applicableDimensions.length, 2, 'Only credibility and evidence applicable');
  assert.strictEqual(result.excludedDimensions.length, 3, 'Finance, health, legal should be excluded');

  // Weighted: 15*0.5 + 20*0.5 = 7.5 + 10 = 17.5
  // Denominator: 0.5 + 0.5 = 1.0
  // Score: 17.5
  assert.strictEqual(result.weightedScore, 17.5, 'Weighted score from applicable dims only');

  // Apply priority (no forceScore, no minimumScore, no specialist score)
  const priority = applyScorePriority(null, null, result.weightedScore, null);

  assert.strictEqual(priority.finalScore, 17.5, 'Final score uses weighted score');
  assert(!priority.appliedRule.includes('fallback'), 'Should not use fallback when weighted score available');
});

test('Relevant Dimensions Gate: Visible dimensions do not include excluded', async (t) => {
  // Setup: Mix of applicable and excluded
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 50, weight: 0.5, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'financial-risk', label: 'Riesgo financiero', value: 0, weight: 0.5, applicable: false, reason: 'Not applicable', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(
    dimensions,
    'Una afirmación general.',
    'fact',
    'general'
  );

  const visible = getVisibleDimensions(result);

  assert.strictEqual(visible.length, 1, 'Only 1 dimension should be visible');
  assert.strictEqual(visible[0].label, 'Credibilidad', 'Visible should only contain Credibilidad');
  assert.strictEqual(visible[0].applicable, true, 'Visible dimension must be applicable');

  // Verify financial risk is NOT in visible list
  const visibleLabels = visible.map(d => d.label);
  assert(!visibleLabels.includes('Riesgo financiero'), 'Riesgo financiero should not be visible');
});

test('Relevant Dimensions Gate: Consistency assertion passes', async (t) => {
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 70, weight: 0.6, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'evidence', label: 'Evidencia', value: 80, weight: 0.4, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'financial-risk', label: 'Riesgo financiero', value: 0, weight: 0.2, applicable: false, reason: '', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(dimensions, 'Test', 'fact', 'general');
  const assertion = assertExcludedDimensionsNotUsed(result, 75);

  assert.strictEqual(assertion.valid, true, 'Consistency assertion should pass');
  assert(assertion.message.includes('correctly'), 'Message should confirm exclusion');
});

test('Relevant Dimensions Gate: Health claim correctly applies health dimensions', async (t) => {
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 50, weight: 0.3, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'health-claim', label: 'Riesgo de salud', value: 85, weight: 0.7, applicable: true, reason: 'Medical content', sourceEngine: 'test' },
    { id: 'financial-risk', label: 'Riesgo financiero', value: 0, weight: 0.2, applicable: false, reason: '', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(
    dimensions,
    'Un paciente tiene fiebre alta y dolor de garganta.',
    'fact',
    'biology-health',
    false, // no financial
    false, // no Ponzi
    true   // health claim
  );

  assert.strictEqual(result.applicableDimensions.length, 2, 'Credibility and health should be applicable');
  assert(result.applicableDimensions.some(d => d.label.includes('salud')), 'Health dimension should be applicable');
});

test('Relevant Dimensions Gate: Score does not use zero-valued excluded dimensions', async (t) => {
  // Regression test: ensure zero-valued excluded dimensions have zero impact
  const dimensions: AnalysisDimension[] = [
    { id: 'credibility', label: 'Credibilidad', value: 100, weight: 0.5, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'evidence', label: 'Evidencia', value: 100, weight: 0.5, applicable: true, reason: '', sourceEngine: 'test' },
    { id: 'financial-risk', label: 'Riesgo financiero', value: 0, weight: 0.5, applicable: false, reason: '', sourceEngine: 'test' },
    { id: 'health-risk', label: 'Riesgo de salud', value: 0, weight: 0.5, applicable: false, reason: '', sourceEngine: 'test' },
    { id: 'ponzi-risk', label: 'Riesgo Ponzi', value: 0, weight: 0.5, applicable: false, reason: '', sourceEngine: 'test' },
  ];

  const result = filterRelevantDimensions(dimensions, 'Test claim', 'fact', 'general');

  // Expected: (100*0.5 + 100*0.5) / (0.5 + 0.5) = 100 / 1.0 = 100
  // Should NOT be: (100*0.5 + 100*0.5 + 0*0.5 + 0*0.5 + 0*0.5) / (0.5+0.5+0.5+0.5+0.5) = 100 / 2.5 = 40

  assert.strictEqual(result.weightedScore, 100, 'Score should be 100, not diluted by zero-valued irrelevant dimensions');
});
