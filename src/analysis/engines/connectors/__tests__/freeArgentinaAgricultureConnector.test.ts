import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearArgentinaAgricultureCacheForTests,
  discoverArgentinaAgricultureEvidence,
} from '../freeArgentinaAgricultureConnector';

const csv = `"cultivo","anio","campania","provincia","provincia_id","departamento","departamento_id","superficie_sembrada_ha","superficie_cosechada_ha","produccion_tm","rendimiento_kgxha"
"Soja",2025,"2024/25","Córdoba",14,"Marcos Juárez",14070,100,90,270,3000
"Soja",2025,"2024/25","Córdoba",14,"Río Cuarto",14098,200,180,630,3500
"Soja",2025,"2024/25","Santa Fe",82,"Caseros",82021,50,45,135,3000
"Soja",2024,"2023/24","Córdoba",14,"Marcos Juárez",14070,80,70,190,2714
"Trigo",2025,"2024/25","Córdoba",14,"Río Cuarto",14098,20,19,60,3158`;

function officialFetch(counter: { calls: number }) {
  return async (input: string | URL | Request): Promise<Response> => {
    counter.calls += 1;
    if (String(input).includes('/api/3/action/package_show')) {
      return new Response(JSON.stringify({
        success: true,
        result: { resources: [{ format: 'CSV', url: 'https://datos.magyp.gob.ar/dataset/agriculture.csv', last_modified: '2026-03-05T13:10:49.520271' }] },
      }), { status: 200 });
    }
    return new Response(csv, { status: 200 });
  };
}

test('official agriculture connector aggregates the latest crop campaign and selected province', async () => {
  clearArgentinaAgricultureCacheForTests();
  const counter = { calls: 0 };
  const fetchImpl = officialFetch(counter);
  const records = await discoverArgentinaAgricultureEvidence('Evaluar una inversión en soja en Córdoba', [0], fetchImpl);
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceType, 'official-agricultural-statistics');
  assert.equal(records[0].official, true);
  assert.equal(records[0].sourceDate, '2026-03-05');
  assert.match(records[0].excerpt || '', /300 ha sembradas/);
  assert.match(records[0].excerpt || '', /900 toneladas/);
  assert.match(records[0].excerpt || '', /3\.333,3 kg\/ha/);
  assert.match(records[0].excerpt || '', /Río Cuarto/);
  await discoverArgentinaAgricultureEvidence('Otra inversión en soja en Córdoba', [0], fetchImpl);
  assert.equal(counter.calls, 2, 'the second analysis must reuse the official dataset cache');
});

test('official agriculture connector does not fetch when the crop is unsupported', async () => {
  clearArgentinaAgricultureCacheForTests();
  let called = false;
  const fetchImpl = async (): Promise<Response> => { called = true; throw new Error('must not fetch'); };
  const records = await discoverArgentinaAgricultureEvidence('Evaluar una inversión inmobiliaria', [0], fetchImpl);
  assert.deepEqual(records, []);
  assert.equal(called, false);
});
