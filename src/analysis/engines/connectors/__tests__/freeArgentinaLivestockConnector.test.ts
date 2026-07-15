import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearArgentinaLivestockCacheForTests,
  discoverArgentinaLivestockEvidence,
} from '../freeArgentinaLivestockConnector';

const csv = [
  'anio,provincia,provincia_id,departamento,departamento_id,vacas,vaquillonas,novillos,novillitos,terneros,terneras,toros,toritos,bueyes',
  '2018,Buenos Aires,06,Azul,06049,90,20,10,5,30,30,3,1,1',
  '2019,Buenos Aires,06,Azul,06049,100,25,12,8,40,35,4,1,0',
  '2019,Buenos Aires,06,Balcarce,06063,50,10,5,5,20,20,2,0,0',
  '2019,Santa Fe,82,Castellanos,82021,70,12,8,6,25,24,3,0,0',
].join('\n');

function officialFetch(): typeof fetch {
  return (async (input: string | URL | Request) => String(input).includes('/api/3/action/package_show')
    ? new Response(JSON.stringify({ success: true, result: { resources: [{ name: 'Existencias bovinos', format: 'CSV', url: 'https://datos.magyp.gob.ar/dataset/livestock.csv' }] } }), { status: 200 })
    : new Response(csv, { status: 200, headers: { 'content-type': 'text/csv' } })) as typeof fetch;
}

test('official livestock connector aggregates latest bovine stock by province and discloses its historical date', async () => {
  clearArgentinaLivestockCacheForTests();
  const records = await discoverArgentinaLivestockEvidence('Analizar una inversión ganadera bovina en Buenos Aires.', [0], officialFetch());
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceType, 'official-livestock-data');
  assert.equal(records[0].official, true);
  assert.equal(records[0].sourceDate, '2019-12-31');
  assert.match(records[0].excerpt || '', /Último año disponible.*2019/);
  assert.match(records[0].excerpt || '', /337 bovinos/);
  assert.match(records[0].excerpt || '', /referencia histórica, no un dato actual/);
  assert.match(records[0].excerpt || '', /Azul \(225 cabezas\)/);
});

test('official livestock connector does not fetch unrelated or non-bovine investment claims', async () => {
  let calls = 0;
  const records = await discoverArgentinaLivestockEvidence('Analizar exportaciones de vino argentino.', [0], (async () => {
    calls += 1;
    throw new Error('must not fetch');
  }) as typeof fetch);
  assert.deepEqual(records, []);
  assert.equal(calls, 0);
});

test('official livestock connector rejects redirected or untrusted resource hosts', async () => {
  clearArgentinaLivestockCacheForTests();
  const records = await discoverArgentinaLivestockEvidence('Analizar una inversión ganadera.', [0], (async () =>
    new Response(JSON.stringify({ success: true, result: { resources: [{ name: 'Existencias bovinos', format: 'CSV', url: 'https://example.com/fake.csv' }] } }), { status: 200 })
  ) as typeof fetch);
  assert.deepEqual(records, []);
});
