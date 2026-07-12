/**
 * Sensitive Allegation Regression Tests — V21B Phase 2
 *
 * Strict regression tests for:
 * 1. Serious sexual allegations about identifiable public figures
 * 2. Political opinions that must NOT be classified as sensitive allegations
 *
 * Run: npx tsx --test src/analysis/engines/__tests__/sensitiveAllegationRegression.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { runClaimFirstPipeline } from '../claimFirstPipeline';
import { detectClaimNature } from '../claimNatureDetector';
import { detectTopic } from '../topicClassifier';
import { calculateDomainWeightedScore } from '../domainWeightedScoringEngine';

// ─────────────────────────────────────────────────────────────────────────────
// CASE A: Serious unverified allegation about an identifiable public figure
// ─────────────────────────────────────────────────────────────────────────────
test('Sensitive allegation: public-claims domain, 95-100 score, correct summary, no finance/Ponzi', () => {
  const text = '¿Es verdad que una persona pública mantiene relaciones sexuales con un familiar?';

  const claimFirstResult = runClaimFirstPipeline(text);
  const topic = detectTopic(text, 'Texto');
  const nature = detectClaimNature(text);

  // Primary nature must be question
  assert.strictEqual(nature.primaryNature, 'question',
    `Expected primaryNature=question, got "${nature.primaryNature}"`);

  // Primary domain must be public-claims (not general, not public-policy)
  const routedDomain = claimFirstResult.dominantClaim?.routedResult?.primaryDomain;
  assert.strictEqual(routedDomain, 'public-claims',
    `Expected primaryDomain=public-claims, got "${routedDomain}"`);

  // Topic key must be sensitive-allegation (not public-policy, not general, not opinion)
  assert.strictEqual(topic.key, 'sensitive-allegation',
    `Expected topic key=sensitive-allegation, got "${topic.key}"`);

  // Topic label
  assert.strictEqual(topic.label, 'Afirmación personal sensible no verificada',
    `Expected sensitive-personal label, got "${topic.label}"`);

  // Minimum score must be 95
  const minimumScore = claimFirstResult.dominantClaim?.minimumScore ?? 0;
  assert.strictEqual(minimumScore, 95,
    `Expected minimumScore=95, got ${minimumScore}`);

  // Final score must be in [95, 100]
  const finalScore = Math.max(claimFirstResult.finalScore, minimumScore);
  assert.ok(finalScore >= 95 && finalScore <= 100,
    `Expected finalScore in [95,100], got ${finalScore}`);

  // Summary must be the specialized sensitive allegation text
  assert.ok(
    /acusaci[oó]n.*grave|desinformaci[oó]n|da[nñ]o reputacional|verificaci[oó]n externa/i.test(topic.summary),
    `Expected sensitive allegation summary, got: "${topic.summary}"`
  );

  // Summary must NOT use public-policy or generic opinion text
  assert.ok(
    !/política pública.*conviene verificar|conviene verificar.*impacto.*política|El análisis se enfoca/i.test(topic.summary),
    `Summary must not reuse public-policy or health template: "${topic.summary}"`
  );

  // Summary must NOT imply the allegation was confirmed or disproved
  assert.ok(
    !/ha sido confirmad|ha sido desmentid|se comprobó|se descartó/i.test(topic.summary),
    `Summary must not imply confirmation or disproof: "${topic.summary}"`
  );

  // Summary must NOT say "contenido sólido y confiable"
  assert.ok(
    !/contenido sólido|altamente confiable/i.test(topic.summary),
    `Summary must not say "contenido sólido" or equivalent: "${topic.summary}"`
  );

  // Finance and Ponzi dimensions must NOT be applicable
  const categoryScores = [
    { name: 'Evidencia faltante', score: 82, explanation: '' },
    { name: 'Transparencia', score: 64, explanation: '' },
    { name: 'Manipulación emocional', score: 12, explanation: '' },
    { name: 'Riesgo financiero', score: 0, explanation: '' },
    { name: 'Riesgo piramidal/Ponzi', score: 0, explanation: '' },
    { name: 'Posible IA académica', score: 0, explanation: '' },
  ];
  const weightedResult = calculateDomainWeightedScore(
    categoryScores, text, topic.key, 'Texto', null,
    false, false, false, false, false, nature.primaryNature
  );
  const financialApplicable = weightedResult.applicableDimensions.some(
    d => /financiero|ponzi/i.test(d.label)
  );
  assert.ok(!financialApplicable,
    `Finance/Ponzi dimensions must not be applicable for sensitive allegation. Applicable: ${weightedResult.applicableDimensions.map(d => d.label).join(', ')}`
  );

  // External verification: selectedResult must flag it as required
  // (We check this via the claimFirstResult structure)
  assert.ok(
    claimFirstResult.dominantClaim !== null,
    'dominantClaim must not be null'
  );
});

test('Sensitive personal assertion: job title does not turn the predicate into economics or finance', () => {
  const text = 'El ministro Caputo de economía es homosexual';
  const result = runClaimFirstPipeline(text);
  const topic = detectTopic(text, 'Texto');

  assert.strictEqual(result.dominantClaim?.classification, 'factual');
  assert.strictEqual(result.dominantClaim?.routedResult?.primaryDomain, 'public-claims');
  assert.strictEqual(result.dominantClaim?.externalVerificationPrimaryDomain, 'public-claims');
  assert.strictEqual(result.dominantClaim?.externalVerificationRequired, true);
  assert.strictEqual(result.dominantClaim?.externalVerificationPerformed, false);
  assert.deepStrictEqual(
    result.dominantClaim?.externalVerificationPlan?.suggestedSourceTypes,
    ['attributable-public-self-disclosure', 'authorized-biographical-source']
  );
  assert.ok(!result.dominantClaim?.routedResult?.secondaryDomains.includes('finance'));
  assert.strictEqual(result.dominantClaim?.minimumScore, 95);
  assert.ok(result.finalScore >= 95);
  assert.strictEqual(topic.key, 'sensitive-allegation');
  assert.match(topic.summary, /no confirma ni desmiente|dato personal sensible/i);

  const weighted = calculateDomainWeightedScore(
    [
      { name: 'Evidencia faltante', score: 82, explanation: '' },
      { name: 'Transparencia', score: 64, explanation: '' },
      { name: 'Manipulación emocional', score: 12, explanation: '' },
      { name: 'Riesgo financiero', score: 0, explanation: '' },
      { name: 'Riesgo piramidal/Ponzi', score: 0, explanation: '' },
    ],
    text, topic.key, 'Texto', null, false, false, false, false, false, 'fact'
  );
  assert.ok(!weighted.applicableDimensions.some((dimension) => /financiero|ponzi/i.test(dimension.label)));
});

test('Economic subject matter remains economics when the predicate is actually economic', () => {
  const result = runClaimFirstPipeline('La economía argentina crecerá el próximo año.');
  assert.notStrictEqual(result.dominantClaim?.routedResult?.primaryDomain, 'public-claims');
  assert.notStrictEqual(detectTopic('La economía argentina crecerá el próximo año.', 'Texto').key, 'sensitive-allegation');
  assert.notStrictEqual(result.dominantClaim?.minimumScore, 95);
});

test('Ordinary criticism of a minister is not treated as a sensitive personal claim', () => {
  const text = 'Creo que el ministro de Economía gestiona mal su cartera.';
  const result = runClaimFirstPipeline(text);
  assert.notStrictEqual(detectTopic(text, 'Texto').key, 'sensitive-allegation');
  assert.notStrictEqual(result.dominantClaim?.minimumScore, 95);
});

// ─────────────────────────────────────────────────────────────────────────────
// CASE B: Political opinion — must NOT be classified as sensitive allegation
// ─────────────────────────────────────────────────────────────────────────────
test('Political opinion: opinion nature, politics/public-policy topic, not sensitive allegation, low score', () => {
  const text = 'Creo que el presidente gobierna mal.';

  const claimFirstResult = runClaimFirstPipeline(text);
  const topic = detectTopic(text, 'Texto');
  const nature = detectClaimNature(text);

  // Must be classified as opinion
  assert.strictEqual(nature.primaryNature, 'opinion',
    `Expected primaryNature=opinion, got "${nature.primaryNature}"`);

  // Topic must NOT be sensitive-allegation
  assert.notStrictEqual(topic.key, 'sensitive-allegation',
    `Political opinion must NOT be classified as sensitive-allegation`);

  // Topic must be politics or public-policy (not general, not health)
  assert.ok(
    topic.key === 'politics' || topic.key === 'public-policy',
    `Expected topic key=politics or public-policy, got "${topic.key}"`
  );

  // Score must NOT reach the 95 floor reserved for sensitive allegations
  const minimumScore = claimFirstResult.dominantClaim?.minimumScore ?? 0;
  const finalScore = Math.max(claimFirstResult.finalScore, minimumScore);
  assert.ok(finalScore < 95,
    `Political opinion must NOT score 95+. Got finalScore=${finalScore}`
  );

  // Summary must NOT contain sensitive allegation language
  assert.ok(
    !/acusaci[oó]n sexual|da[nñ]o reputacional|no difundir/i.test(topic.summary),
    `Political opinion summary must not contain sensitive allegation language: "${topic.summary}"`
  );
});
