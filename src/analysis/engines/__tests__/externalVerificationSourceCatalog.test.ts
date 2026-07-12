import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTERNAL_VERIFICATION_SOURCE_CATALOG, providersForSourceTypes } from '../externalVerificationSourceCatalog';

test('catalog distinguishes implemented connectors from planned providers', () => {
  const byId = new Map(EXTERNAL_VERIFICATION_SOURCE_CATALOG.map((provider) => [provider.id, provider]));
  for (const id of ['infoleg', 'boletin-oficial', 'bcra', 'pubmed', 'who', 'world-bank', 'news']) assert.equal(byId.get(id)?.status, 'implemented');
  for (const id of ['anmat', 'fda', 'ema', 'cnv', 'byma', 'crypto-market', 'blockchain-explorer', 'protocol-source', 'security-audit']) assert.equal(byId.get(id)?.status, 'planned');
});

test('catalog resolves medication, capital-market and crypto targets', () => {
  assert.deepEqual(providersForSourceTypes(['drug-regulator-anmat']).map((provider) => provider.id), ['anmat']);
  assert.deepEqual(providersForSourceTypes(['securities-regulator-cnv']).map((provider) => provider.id), ['cnv']);
  assert.deepEqual(providersForSourceTypes(['market-operator-byma']).map((provider) => provider.id), ['byma']);
  assert.ok(providersForSourceTypes(['blockchain-explorer']).some((provider) => provider.id === 'blockchain-explorer'));
});
