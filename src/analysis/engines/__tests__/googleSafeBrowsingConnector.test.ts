import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGoogleSafeBrowsing } from '../connectors/googleSafeBrowsingConnector';

test('registra una consulta oficial sin convertir ausencia de coincidencias en sitio seguro', async () => {
  const fetchMock = async (_input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method, 'POST');
    assert.match(String(init?.body), /SOCIAL_ENGINEERING/);
    return new Response('{}', { status: 200 });
  };
  const records = await checkGoogleSafeBrowsing('https://ejemplo.com/oferta', [0], fetchMock, 'test-key');
  assert.equal(records.length, 1);
  assert.match(records[0].excerpt || '', /no produjo coincidencias.*no acredita identidad/is);
});

test('informa una coincidencia de ingeniería social como bloqueo', async () => {
  const fetchMock = async () => new Response(JSON.stringify({ matches: [{ threatType: 'SOCIAL_ENGINEERING' }] }), { status: 200 });
  const records = await checkGoogleSafeBrowsing('https://fraude.example/oferta', [0], fetchMock, 'test-key');
  assert.match(records[0].excerpt || '', /SOCIAL_ENGINEERING.*bloquearse/is);
});

test('sin clave configurada no simula la comprobación', async () => {
  const records = await checkGoogleSafeBrowsing('https://ejemplo.com', [0], fetch, '');
  assert.deepEqual(records, []);
});
