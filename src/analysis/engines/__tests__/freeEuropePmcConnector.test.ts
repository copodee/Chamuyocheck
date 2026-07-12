import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverEuropePmcEvidence } from '../connectors/freeEuropePmcConnector';

function response(results: unknown[]) {
  return new Response(JSON.stringify({ resultList: { result: results } }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('Europe PMC accepts only research whose title or abstract covers the claim terms', async () => {
  const records = await discoverEuropePmcEvidence('La metanfetamina produce efectos cardiovasculares y neurológicos.', [0], 'peer-reviewed-medical-research', async () => response([
    { pmid: '123', title: 'Methamphetamine cardiovascular and neurological effects', abstractText: 'Evidence of cardiovascular and neurological harm caused by methamphetamine.', pubYear: '2025' },
  ]));
  assert.equal(records.length, 1);
  assert.match(records[0].url, /europepmc\.org\/article\/MED\/123/);
});

test('Europe PMC rejects a merely topical but predicate-irrelevant paper', async () => {
  const records = await discoverEuropePmcEvidence('El paracetamol cura una infección bacteriana.', [0], 'peer-reviewed-medical-research', async () => response([
    { pmid: '456', title: 'Paracetamol dosing for headache', abstractText: 'Pain and fever treatment.', pubYear: '2024' },
  ]));
  assert.equal(records.length, 0);
});
