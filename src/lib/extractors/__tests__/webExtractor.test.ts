import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractWebText } from '../webExtractor';

test('extrae condiciones visibles y JSON estructurado de una página bancaria', async () => {
  const html = '<html><head><title>Préstamo Banco Ejemplo</title><meta name="description" content="Crédito personal"></head><body><main>Monto del préstamo: $1.000.000. 12 cuotas de $120.000. TNA 75%. CFT 140%.</main><script type="application/ld+json">{"provider":"Banco Ejemplo"}</script></body></html>';
  const fetchMock = async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  const result = await extractWebText('https://banco.example/prestamo', fetchMock as typeof fetch);
  assert.equal(result.ok, true);
  assert.match(result.text, /1\.000\.000.*12 cuotas.*TNA 75%.*CFT 140%/i);
  assert.match(result.text, /Banco Ejemplo/);
});

test('bloquea URLs locales antes de acceder a la red', async () => {
  let calls = 0;
  const fetchMock = async () => { calls += 1; return new Response(''); };
  const result = await extractWebText('http://127.0.0.1/admin', fetchMock as typeof fetch);
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});
