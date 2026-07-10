/**
 * Claim Nature Detector Tests
 * 
 * Tests for V21 Phase 1 implementation of semantic claim nature detection.
 * All mandatory test cases specified in requirements.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { detectClaimNature } from '../claimNatureDetector';

// === MANDATORY TEST CASES ===

test('Nature Detection: Fact - Bitcoin exists', () => {
  const result = detectClaimNature('Bitcoin existe.');
  assert.equal(result.primaryNature, 'fact', 'Should detect as fact');
  assert.ok(result.confidence >= 0.5, 'Should have reasonable confidence');
});

test('Nature Detection: Prediction - Bitcoin will rise', () => {
  const result = detectClaimNature('Bitcoin va a subir.');
  assert.equal(result.primaryNature, 'prediction', 'Should detect as prediction');
  assert.equal(result.factualVerifiability, 'future-verifiable', 'Predictions are future-verifiable');
});

test('Nature Detection: Opinion + Prediction - I think Bitcoin will rise', () => {
  const result = detectClaimNature('Creo que Bitcoin va a subir.');
  assert.equal(result.primaryNature, 'opinion', 'Should detect opinion as primary');
  assert.ok(result.secondaryNatures.includes('prediction'), 'Should include prediction as secondary');
});

test('Nature Detection: Prediction + Promise - Bitcoin will double tomorrow with certainty', () => {
  const result = detectClaimNature('Bitcoin va a duplicarse mañana con seguridad.');
  assert.equal(result.primaryNature, 'prediction', 'Should detect as prediction');
  assert.ok(result.secondaryNatures.includes('promise'), 'Should include promise as secondary');
});

test('Nature Detection: Advertisement - Buy Bitcoin now before it is too late', () => {
  const result = detectClaimNature('Comprá Bitcoin ahora antes de que sea tarde.');
  assert.equal(result.primaryNature, 'advertisement', 'Should detect as advertisement');
});

test('Nature Detection: Opinion + Recommendation - Public health needs more investment', () => {
  const result = detectClaimNature('La salud pública necesita más inversión.');
  assert.equal(result.primaryNature, 'opinion', 'Should detect as opinion');
  assert.ok(result.secondaryNatures.includes('recommendation'), 'Should include recommendation as secondary');
});

test('Nature Detection: Fact - Ministry increased health budget', () => {
  const result = detectClaimNature('El Ministerio de Salud aumentó el presupuesto.');
  assert.equal(result.primaryNature, 'fact', 'Should detect as fact');
});

test('Nature Detection: Question - Can a man become pregnant through hormones', () => {
  const result = detectClaimNature('¿Puede un hombre quedar embarazado mediante hormonas?');
  assert.equal(result.primaryNature, 'question', 'Should detect as question');
  assert.equal(result.factualVerifiability, 'not-applicable', 'Questions are not-applicable');
});

test('Nature Detection: Extraordinary Claim - Aliens seen yesterday in Córdoba', () => {
  const result = detectClaimNature('Se vieron extraterrestres ayer en Córdoba.');
  assert.equal(result.primaryNature, 'extraordinary-claim', 'Should detect as extraordinary-claim');
  assert.equal(result.factualVerifiability, 'requires-external-source', 'Extraordinary claims require external source');
});

test('Nature Detection: Testimony + Extraordinary - I saw a UFO last night', () => {
  const result = detectClaimNature('Yo vi un OVNI anoche.');
  assert.equal(result.primaryNature, 'testimony', 'Should detect as testimony');
  assert.ok(result.secondaryNatures.includes('extraordinary-claim'), 'Should include extraordinary-claim as secondary');
});

test('Nature Detection: Rumor + Prediction - They say there will be a devaluation', () => {
  const result = detectClaimNature('Dicen que habrá una devaluación.');
  assert.equal(result.primaryNature, 'rumor', 'Should detect as rumor');
  assert.ok(result.secondaryNatures.includes('prediction'), 'Should include prediction as secondary');
});

test('Nature Detection: Advertisement + Promise - Buy this supplement and lose weight', () => {
  const result = detectClaimNature('Comprá este suplemento y vas a adelgazar.');
  assert.equal(result.primaryNature, 'advertisement', 'Should detect as advertisement');
  assert.ok(result.secondaryNatures.includes('promise'), 'Should include promise as secondary');
});

test('Nature Detection: Promise/Fact policy - This supplement cures cancer', () => {
  const result = detectClaimNature('Este suplemento cura el cáncer.');
  // Could be promise or fact depending on policy; test just verifies it's NOT opinion
  assert.notEqual(result.primaryNature, 'opinion', 'Should NOT be opinion');
  assert.ok(['promise', 'fact', 'advertisement'].includes(result.primaryNature), 'Should be promise, fact, or advertisement');
});

test('Nature Detection: Recommendation - You should consult a doctor', () => {
  const result = detectClaimNature('Deberías consultar a un médico.');
  assert.equal(result.primaryNature, 'recommendation', 'Should detect as recommendation');
});

test('Nature Detection: Statistic - 70% of respondents said yes', () => {
  const result = detectClaimNature('El 70% de los encuestados respondió que sí.');
  assert.equal(result.primaryNature, 'statistic', 'Should detect as statistic');
});

test('Nature Detection: Legal Assertion - This contract is illegal', () => {
  const result = detectClaimNature('Este contrato es ilegal.');
  assert.equal(result.primaryNature, 'legal-assertion', 'Should detect as legal-assertion');
});

test('Nature Detection: Financial Offer - Invest 100000 pesos and earn 10% annual', () => {
  const result = detectClaimNature('Invertí 100000 pesos y ganá 10% anual.');
  assert.equal(result.primaryNature, 'financial-offer', 'Should detect as financial-offer');
});

test('Nature Detection: Fact - Messi won World Cup 2022', () => {
  const result = detectClaimNature('Messi ganó el Mundial 2022.');
  assert.equal(result.primaryNature, 'fact', 'Should detect as fact');
});

test('Nature Detection: Opinion - Messi was the best player at World Cup', () => {
  const result = detectClaimNature('Messi fue el mejor jugador del Mundial.');
  assert.equal(result.primaryNature, 'opinion', 'Should detect as opinion');
  assert.equal(result.factualVerifiability, 'subjective', 'Opinions are subjective');
});

test('Nature Detection: Mixed - Bitcoin exists but I think it will rise tomorrow', () => {
  const result = detectClaimNature('Bitcoin existe, pero creo que mañana va a subir.');
  // Could be mixed or opinion primary with fact and prediction secondary; test verifies reasonable parsing
  assert.ok(
    ['mixed', 'opinion', 'prediction'].includes(result.primaryNature),
    'Should be mixed, opinion, or prediction'
  );
});

// === ADDITIONAL EDGE CASES ===

test('Nature Detection: Edge case - Empty string', () => {
  const result = detectClaimNature('');
  assert.ok(result.primaryNature !== undefined, 'Should return valid result');
});

test('Nature Detection: Edge case - Single word fact', () => {
  const result = detectClaimNature('Lluvia.');
  assert.ok(result.primaryNature !== undefined, 'Should parse single word');
});

test('Nature Detection: Confidence is in valid range', () => {
  const result = detectClaimNature('Bitcoin va a subir.');
  assert.ok(result.confidence >= 0 && result.confidence <= 1, 'Confidence should be 0-1');
});

test('Nature Detection: Linguistic signals are populated', () => {
  const result = detectClaimNature('Bitcoin va a subir.');
  assert.ok(Array.isArray(result.linguisticSignals), 'Should have linguistic signals array');
  assert.ok(result.linguisticSignals.length > 0, 'Should have at least one signal');
});

test('Nature Detection: Reason is provided', () => {
  const result = detectClaimNature('Bitcoin va a subir.');
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0, 'Should provide reason');
});

test('Nature Detection: Secondary natures are subset of all natures except primary', () => {
  const result = detectClaimNature('Creo que Bitcoin va a subir.');
  for (const secondary of result.secondaryNatures) {
    assert.notEqual(secondary, result.primaryNature, 'Secondary should not equal primary');
  }
});

test('Nature Detection: Fact with present tense', () => {
  const result = detectClaimNature('El agua hierve a 100 grados Celsius.');
  assert.ok(['fact', 'unknown'].includes(result.primaryNature), 'Should detect as fact or unknown');
});

test('Nature Detection: Multiple imperatives suggests advertisement', () => {
  const result = detectClaimNature('Comprá ahora, invierte hoy, gana mañana!');
  assert.ok(
    ['advertisement', 'recommendation', 'prediction'].includes(result.primaryNature),
    'Multiple imperatives should suggest advertisement or recommendation'
  );
});

test('Nature Detection: False certainty language with future', () => {
  const result = detectClaimNature('Definitivamente va a ganar el 100%.');
  assert.ok(
    result.secondaryNatures.includes('promise') || result.primaryNature === 'promise',
    'Should detect promise (false certainty)'
  );
});

test('Nature Detection: Legal terminology', () => {
  const result = detectClaimNature('La ley prohíbe esta conducta.');
  assert.ok(
    result.primaryNature === 'legal-assertion' || result.linguisticSignals.includes('legal-terminology'),
    'Should detect legal terminology'
  );
});

test('Nature Detection: Percentage pattern triggers statistic', () => {
  const result = detectClaimNature('El 90% de pacientes se recuperaron.');
  assert.equal(result.primaryNature, 'statistic', 'Should detect as statistic');
});

test('Nature Detection: Money amounts trigger financial signals', () => {
  const result = detectClaimNature('Invierte $1000 y obtén $2000.');
  assert.ok(result.linguisticSignals.includes('money-amount') || result.primaryNature === 'financial-offer');
});

test('Nature Detection: Opinion negates pure fact classification', () => {
  const result = detectClaimNature('Creo que esto es incorrecto.');
  assert.notEqual(result.primaryNature, 'fact', 'Should not be fact when belief marker present');
});

test('Nature Detection: Extraordinary entity signals extraordinary claim', () => {
  const result = detectClaimNature('Se encontró un alienígena en el patio.');
  assert.ok(
    result.primaryNature === 'extraordinary-claim' || result.linguisticSignals.includes('extraordinary-entity')
  );
});

// === COMPREHENSIVE OUTPUT INSPECTION ===

test('Nature Detection: Inspect detailed output for prediction', () => {
  const result = detectClaimNature('Bitcoin va a subir el próximo mes.');
  console.log('\n=== Prediction Example ===');
  console.log('Input:', 'Bitcoin va a subir el próximo mes.');
  console.log('Primary Nature:', result.primaryNature);
  console.log('Secondary Natures:', result.secondaryNatures);
  console.log('Confidence:', result.confidence);
  console.log('Verifiability:', result.factualVerifiability);
  console.log('Signals:', result.linguisticSignals);
  console.log('Reason:', result.reason);
  assert.equal(result.primaryNature, 'prediction');
});

test('Nature Detection: Inspect detailed output for opinion', () => {
  const result = detectClaimNature('Creo que esta película es excelente.');
  console.log('\n=== Opinion Example ===');
  console.log('Input:', 'Creo que esta película es excelente.');
  console.log('Primary Nature:', result.primaryNature);
  console.log('Secondary Natures:', result.secondaryNatures);
  console.log('Confidence:', result.confidence);
  console.log('Verifiability:', result.factualVerifiability);
  console.log('Signals:', result.linguisticSignals);
  console.log('Reason:', result.reason);
  assert.equal(result.primaryNature, 'opinion');
});

test('Nature Detection: Inspect detailed output for extraordinary claim', () => {
  const result = detectClaimNature('Se vio un OVNI sobre Buenos Aires ayer.');
  console.log('\n=== Extraordinary Claim Example ===');
  console.log('Input:', 'Se vio un OVNI sobre Buenos Aires ayer.');
  console.log('Primary Nature:', result.primaryNature);
  console.log('Secondary Natures:', result.secondaryNatures);
  console.log('Confidence:', result.confidence);
  console.log('Verifiability:', result.factualVerifiability);
  console.log('Signals:', result.linguisticSignals);
  console.log('Reason:', result.reason);
  assert.equal(result.primaryNature, 'extraordinary-claim');
});

test('Nature Detection: Inspect detailed output for advertisement', () => {
  const result = detectClaimNature('Comprá este suplemento y adelgazá 10 kilos en 30 días!');
  console.log('\n=== Advertisement Example ===');
  console.log('Input:', 'Comprá este suplemento y adelgazá 10 kilos en 30 días!');
  console.log('Primary Nature:', result.primaryNature);
  console.log('Secondary Natures:', result.secondaryNatures);
  console.log('Confidence:', result.confidence);
  console.log('Verifiability:', result.factualVerifiability);
  console.log('Signals:', result.linguisticSignals);
  console.log('Reason:', result.reason);
  assert.equal(result.primaryNature, 'advertisement');
});

test('Nature Detection: Inspect detailed output for question', () => {
  const result = detectClaimNature('¿Es posible que un hombre quede embarazado?');
  console.log('\n=== Question Example ===');
  console.log('Input:', '¿Es posible que un hombre quede embarazado?');
  console.log('Primary Nature:', result.primaryNature);
  console.log('Secondary Natures:', result.secondaryNatures);
  console.log('Confidence:', result.confidence);
  console.log('Verifiability:', result.factualVerifiability);
  console.log('Signals:', result.linguisticSignals);
  console.log('Reason:', result.reason);
  assert.equal(result.primaryNature, 'question');
});
