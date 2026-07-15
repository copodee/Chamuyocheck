import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTERNAL_VERIFICATION_SOURCE_CATALOG, providersForSourceTypes, sourceAvailabilityForTypes } from '../externalVerificationSourceCatalog';

test('catalog distinguishes implemented connectors from planned providers', () => {
  const byId = new Map(EXTERNAL_VERIFICATION_SOURCE_CATALOG.map((provider) => [provider.id, provider]));
  for (const id of ['infoleg', 'boletin-oficial', 'bcra', 'pubmed', 'who', 'world-bank', 'news', 'fda']) assert.equal(byId.get(id)?.status, 'implemented');
  for (const id of ['anmat', 'ema', 'cnv', 'byma', 'crypto-market', 'blockchain-explorer', 'protocol-source', 'security-audit']) assert.equal(byId.get(id)?.status, 'planned');
});

test('source availability distinguishes executable, planned and unregistered types', () => {
  assert.deepEqual(sourceAvailabilityForTypes([
    'government-law-repository', 'drug-regulator-anmat', 'court-records',
  ]), [
    { sourceType: 'government-law-repository', status: 'implemented', providerIds: ['infoleg'] },
    { sourceType: 'drug-regulator-anmat', status: 'planned', providerIds: ['anmat'] },
    { sourceType: 'court-records', status: 'unregistered', providerIds: [] },
  ]);
});

test('catalog resolves medication, capital-market and crypto targets', () => {
  assert.deepEqual(providersForSourceTypes(['drug-regulator-anmat']).map((provider) => provider.id), ['anmat']);
  assert.deepEqual(providersForSourceTypes(['securities-regulator-cnv']).map((provider) => provider.id), ['cnv']);
  assert.deepEqual(providersForSourceTypes(['market-operator-byma']).map((provider) => provider.id), ['byma']);
  assert.ok(providersForSourceTypes(['blockchain-explorer']).some((provider) => provider.id === 'blockchain-explorer'));
});

test('catalog registers investment-sector sources as planned rather than pretending they ran', () => {
  const availability = sourceAvailabilityForTypes([
    'official-real-estate-data', 'official-agricultural-statistics', 'official-trade-statistics', 'international-trade-data',
  ]);
  assert.ok(availability.every((item) => item.status === 'planned'));
  assert.ok(providersForSourceTypes(['official-agricultural-statistics']).some((provider) => provider.id === 'inta'));
  assert.ok(providersForSourceTypes(['international-trade-data']).some((provider) => provider.id === 'international-trade'));
});
