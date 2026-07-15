import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverArgentinaExportEvidence } from '../connectors/freeUnComtradeConnector';

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

test('UN Comtrade connector retrieves three annual Argentine export observations for a supported product', async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    calls.push(url);
    const year = Number(new URL(url).searchParams.get('period'));
    return response({ data: [{ period: year, primaryValue: (year - 2020) * 1_000_000 }] });
  };
  const records = await discoverArgentinaExportEvidence(
    'Quiero invertir para exportar soja argentina y evaluar la demanda internacional.', [0], fetchImpl, 2024
  );
  assert.equal(calls.length, 3);
  assert.ok(calls.every((url) => new URL(url).hostname === 'comtradeapi.un.org'));
  assert.ok(calls.every((url) => new URL(url).searchParams.get('reporterCode') === '32'));
  assert.ok(calls.every((url) => new URL(url).searchParams.get('flowCode') === 'X'));
  assert.ok(calls.every((url) => new URL(url).searchParams.get('cmdCode') === '1201'));
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceType, 'international-trade-data');
  assert.equal(records[0].official, true);
  assert.match(records[0].excerpt || '', /no prueban demanda futura/i);
});

test('UN Comtrade connector does not search unsupported products or fabricate failed responses', async () => {
  let calls = 0;
  const fetchImpl = async (): Promise<Response> => { calls += 1; return response({}, 500); };
  assert.deepEqual(await discoverArgentinaExportEvidence('Quiero exportar software', [0], fetchImpl, 2024), []);
  assert.equal(calls, 0);
  assert.deepEqual(await discoverArgentinaExportEvidence('Quiero invertir para exportar trigo', [0], fetchImpl, 2024), []);
  assert.equal(calls, 3);
});
