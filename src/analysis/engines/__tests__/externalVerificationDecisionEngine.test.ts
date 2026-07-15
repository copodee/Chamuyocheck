import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectClaimNature } from '../claimNatureDetector';
import { routeByNature } from '../natureAwareRouter';
import { decideExternalVerification } from '../externalVerificationDecisionEngine';
import { runClaimFirstPipeline } from '../claimFirstPipeline';

function decide(claimText: string) {
  const claimNature = detectClaimNature(claimText);
  const route = routeByNature(claimText, claimNature);
  return decideExternalVerification({
    claimText,
    claimNature,
    primaryDomain: route.primaryDomain,
    secondaryDomains: route.secondaryDomains,
  });
}

test('V21C does not pretend that external verification was performed', () => {
  const samples = [
    'El dólar cotiza hoy a 2000 pesos.',
    'Este contrato es ilegal en Argentina.',
    'El agua hierve a 100 °C a nivel del mar.',
    'Bitcoin va a subir mañana.',
  ];

  for (const sample of samples) {
    assert.equal(decide(sample).externalVerificationPerformed, false);
  }
});

test('current public and financial facts require current external sources', () => {
  const result = decide('El dólar cotiza hoy a 2000 pesos en Argentina.');
  assert.equal(result.externalVerificationRequired, true);
  assert.equal(result.recencyRequired, true);
  assert.ok(result.suggestedSourceTypes.includes('official-market-data'));
});

test('legal assertions require official, current, jurisdiction-relevant sources', () => {
  const result = decide('Este contrato es ilegal en Argentina.');
  assert.equal(result.externalVerificationRequired, true);
  assert.equal(result.officialSourceRequired, true);
  assert.equal(result.recencyRequired, true);
  assert.equal(result.jurisdictionalRelevance, 'Argentina');
  assert.ok(result.suggestedSourceTypes.includes('government-law-repository'));
});

test('medical treatment claims require clinical and official sources', () => {
  const result = decide('Este suplemento cura el cáncer.');
  assert.equal(result.externalVerificationRequired, true);
  assert.equal(result.officialSourceRequired, true);
  assert.ok(result.suggestedSourceTypes.includes('clinical-guidelines'));
});

test('medication effects route to medical research and drug regulators', () => {
  const result = decide('Este medicamento produce efectos adversos graves.');
  assert.equal(result.externalVerificationRequired, true);
  assert.equal(result.officialSourceRequired, true);
  assert.ok(result.suggestedSourceTypes.includes('drug-regulator-anmat'));
  assert.ok(result.suggestedSourceTypes.includes('drug-regulator-fda'));
  assert.ok(result.suggestedSourceTypes.includes('drug-regulator-ema'));
  assert.ok(result.suggestedSourceTypes.includes('peer-reviewed-medical-research'));
});

test('Argentine capital-market claims route to CNV and BYMA source types', () => {
  const result = decide('Esta acción está autorizada por la CNV y cotiza hoy en BYMA.');
  assert.equal(result.externalVerificationRequired, true);
  assert.equal(result.jurisdictionalRelevance, 'Argentina');
  assert.equal(result.officialSourceRequired, true);
  assert.ok(result.suggestedSourceTypes.includes('securities-regulator-cnv'));
  assert.ok(result.suggestedSourceTypes.includes('market-operator-byma'));
});

test('real-estate investments require local comparables and official data', () => {
  const result = decide('Quiero invertir en un departamento en Córdoba para alquilar y conocer su rentabilidad.');
  assert.equal(result.externalVerificationRequired, true);
  assert.equal(result.externalVerificationPerformed, false);
  assert.equal(result.recencyRequired, true);
  assert.ok(result.suggestedSourceTypes.includes('official-real-estate-data'));
  assert.ok(result.suggestedSourceTypes.includes('property-market-comparables'));
});

test('agricultural and export investments route to sector-specific official sources', () => {
  const agriculture = decide('Analizar una inversión ganadera y agrícola de soja en Argentina.');
  assert.ok(agriculture.suggestedSourceTypes.includes('official-agricultural-statistics'));
  assert.ok(agriculture.suggestedSourceTypes.includes('official-livestock-data'));

  const exports = decide('Quiero invertir en exportar vino argentino según la demanda internacional.');
  assert.ok(exports.suggestedSourceTypes.includes('official-trade-statistics'));
  assert.ok(exports.suggestedSourceTypes.includes('international-trade-data'));
  assert.ok(exports.suggestedSourceTypes.includes('customs-data'));
});

test('crypto claims route to market, on-chain, protocol and audit sources', () => {
  const result = decide('Este token de Ethereum tiene reservas suficientes y su contrato inteligente es seguro.');
  assert.equal(result.externalVerificationRequired, true);
  assert.ok(result.suggestedSourceTypes.includes('crypto-market-data'));
  assert.ok(result.suggestedSourceTypes.includes('blockchain-explorer'));
  assert.ok(result.suggestedSourceTypes.includes('protocol-documentation'));
  assert.ok(result.suggestedSourceTypes.includes('independent-security-audits'));
});

test('future prediction is not falsely described as currently verifiable', () => {
  const result = decide('Bitcoin va a subir mañana.');
  assert.equal(result.externalVerificationRequired, false);
  assert.equal(result.externalVerificationPerformed, false);
  assert.equal(result.minimumIndependentSources, 0);
});

test('subjective opinion and local arithmetic do not require external verification', () => {
  assert.equal(decide('Creo que esta película es mala.').externalVerificationRequired, false);
  assert.equal(decide('2 + 2 = 5.').externalVerificationRequired, false);
});

test('named biographical relationships require external corroboration even when stable', () => {
  const result = decide('Nicolás Scioli es hijo de Daniel Scioli.');
  assert.equal(result.externalVerificationRequired, true);
  assert.equal(result.externalVerificationPerformed, false);
  assert.deepEqual(result.suggestedSourceTypes, ['public-records', 'independent-news']);
  assert.equal(result.minimumIndependentSources, 2);
});

test('ordinary factual claims always require external verification', () => {
  const result = decide('Colapinto es un piloto de motos de carrera de origen español.');
  assert.equal(result.externalVerificationRequired, true);
  assert.equal(result.externalVerificationPerformed, false);
});

test('compound factual text is atomized so each predicate gets its own verification plan', () => {
  const result = runClaimFirstPipeline('La droga crystal es buena para el dolor de cabeza, se usa para fiestas electrónicas, pero también tiene efectos positivos para los dolores.');
  assert.ok(result.claims.length >= 3);
  assert.ok(result.claims.every((claim) => claim.externalVerificationRequired));
});

test('pipeline records the decision without changing existing scoring inputs', () => {
  const result = runClaimFirstPipeline('Este contrato es ilegal en Argentina.');
  assert.equal(result.claims.length, 1);
  assert.equal(result.claims[0].externalVerificationRequired, true);
  assert.equal(result.claims[0].externalVerificationPerformed, false);
  assert.equal(result.claims[0].externalVerificationPlan?.officialSourceRequired, true);
});

test('numeric segments inside URLs are not treated as local arithmetic', () => {
  const result = runClaimFirstPipeline(
    'Este contrato es ilegal en Argentina: https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949'
  );
  assert.equal(result.claims[0].externalVerificationRequired, true);
  assert.match(result.claims[0].externalVerificationPlan?.reason || '', /jurídica/);
});

test('dates inside structured source identifiers are not treated as local arithmetic', () => {
  const result = runClaimFirstPipeline(
    'El dólar oficial cotiza hoy a 1200 pesos [BCRA:USD:2026-07-11].'
  );
  assert.equal(result.claims[0].externalVerificationRequired, true);
  assert.match(result.claims[0].externalVerificationPlan?.reason || '', /financiero|mercado|actual/i);
});
