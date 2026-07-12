import { test } from 'node:test';
import assert from 'node:assert/strict';
import { internationalProvidersFor } from '../internationalSourceRegistry';
import { fetchPubmedArticle } from '../connectors/pubmedConnector';
import { fetchWhoIndicator } from '../connectors/whoConnector';
import { fetchWorldBankIndicator } from '../connectors/worldBankConnector';

function jsonResponse(body: unknown, url: string) {
  const result = new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  Object.defineProperty(result, 'url', { value: url }); return result;
}

test('registry routes health to WHO and PubMed', () => {
  assert.deepEqual(internationalProvidersFor('biology-health').map((item) => item.id), ['who-gho', 'pubmed']);
});

test('PubMed connector returns scientific citation record', async () => {
  const url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
  const result = await fetchPubmedArticle('42119588', [0], async () => jsonResponse({ result: { '42119588': {
    title: 'A reviewed biomedical article', pubdate: '2026 Jul', sortpubdate: '2026/07/01 00:00', source: 'Lancet'
  } } }, url));
  assert.equal(result.ok, true); assert.equal(result.records[0].sourceType, 'scientific-journals');
  assert.equal(result.records[0].sourceDate, '2026-07-01');
});

test('WHO connector returns official country health indicator', async () => {
  const url = 'https://ghoapi.azureedge.net/api/WHOSIS_000001';
  const result = await fetchWhoIndicator('WHOSIS_000001', 'BRA', [0], async () => jsonResponse({ value: [{ TimeDim: 2024, NumericValue: 75.8 }] }, url));
  assert.equal(result.ok, true); assert.equal(result.records[0].official, true);
  assert.equal(result.records[0].sourceType, 'health-authorities');
});

test('World Bank connector returns official economic indicator', async () => {
  const url = 'https://api.worldbank.org/v2/country/br/indicator/NY.GDP.MKTP.CD';
  const result = await fetchWorldBankIndicator('BR', 'NY.GDP.MKTP.CD', 2024, [0], async () => jsonResponse([
    { page: 1 }, [{ indicator: { value: 'GDP (current US$)' }, country: { value: 'Brazil' }, value: 2_000_000, date: '2024' }]
  ], url));
  assert.equal(result.ok, true); assert.equal(result.records[0].official, true);
  assert.equal(result.records[0].sourceType, 'official-statistics');
});

test('international connectors reject malformed identifiers before network', async () => {
  let calls = 0; const transport = async () => { calls += 1; return jsonResponse({}, 'https://example.com'); };
  assert.equal((await fetchPubmedArticle('abc', [0], transport)).ok, false);
  assert.equal((await fetchWhoIndicator('bad code!', 'BR', [0], transport)).ok, false);
  assert.equal((await fetchWorldBankIndicator('BRAZIL', 'GDP!', 2024, [0], transport)).ok, false);
  assert.equal(calls, 0);
});

test('international connectors disable automatic redirects', async () => {
  const modes: Array<RequestRedirect | undefined> = [];
  await fetchPubmedArticle('42119588', [0], async (_input, init) => {
    modes.push(init?.redirect); throw new Error('stop');
  });
  await fetchWhoIndicator('WHOSIS_000001', 'BRA', [0], async (_input, init) => {
    modes.push(init?.redirect); throw new Error('stop');
  });
  await fetchWorldBankIndicator('BR', 'NY.GDP.MKTP.CD', 2024, [0], async (_input, init) => {
    modes.push(init?.redirect); throw new Error('stop');
  });
  assert.deepEqual(modes, ['error', 'error', 'error']);
});
