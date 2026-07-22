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
  assert.equal(result.finalUrl, 'https://banco.example/prestamo');
  assert.deepEqual(result.redirectChain, ['https://banco.example/prestamo']);
  assert.equal(result.serverAssessment, 'readable');
  assert.match(result.serverChecks.join(' '), /dominio final coincide/i);
});

test('no lee el cuerpo si el servidor aportado no usa HTTPS', async () => {
  let calls = 0;
  const fetchMock = async () => { calls += 1; return new Response('<html><body>oferta</body></html>'); };
  const result = await extractWebText('http://oferta.example', fetchMock as typeof fetch);
  assert.equal(result.ok, false);
  assert.equal(result.serverAssessment, 'blocked');
  assert.equal(calls, 0);
});

test('bloquea URLs locales antes de acceder a la red', async () => {
  let calls = 0;
  const fetchMock = async () => { calls += 1; return new Response(''); };
  const result = await extractWebText('http://127.0.0.1/admin', fetchMock as typeof fetch);
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test('sigue redirecciones públicas de forma manual y registra el destino real', async () => {
  const calls: string[] = [];
  const fetchMock = async (input: URL | RequestInfo) => {
    const url = String(input);
    calls.push(url);
    if (url === 'https://anuncio.example/inicio') {
      return new Response('', { status: 302, headers: { location: 'https://operador.example/oferta' } });
    }
    return new Response('<html><head><title>Oferta</title></head><body><main>Información pública suficiente sobre la propuesta, sus condiciones comerciales, la identidad del operador y los costos comunicados.</main></body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const result = await extractWebText('https://anuncio.example/inicio', fetchMock as typeof fetch);
  assert.equal(result.ok, true);
  assert.equal(result.finalUrl, 'https://operador.example/oferta');
  assert.deepEqual(result.redirectChain, ['https://anuncio.example/inicio', 'https://operador.example/oferta']);
  assert.deepEqual(calls, ['https://anuncio.example/inicio', 'https://operador.example/oferta']);
});

test('bloquea una redirección hacia una dirección local antes de solicitarla', async () => {
  const calls: string[] = [];
  const fetchMock = async (input: URL | RequestInfo) => {
    calls.push(String(input));
    return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/admin' } });
  };
  const result = await extractWebText('https://anuncio.example/inicio', fetchMock as typeof fetch);
  assert.equal(result.ok, false);
  assert.deepEqual(calls, ['https://anuncio.example/inicio']);
});
