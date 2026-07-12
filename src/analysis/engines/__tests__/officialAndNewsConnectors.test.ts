import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchBcraExchangeRate } from '../connectors/bcraConnector';
import { fetchBoletinOficialNotice } from '../connectors/boletinOficialConnector';
import { fetchAllowedNewsArticle } from '../connectors/newsConnector';

function response(body: string, url: string, contentType = 'application/json') {
  const result = new Response(body, { status: 200, headers: { 'content-type': contentType } });
  Object.defineProperty(result, 'url', { value: url });
  return result;
}

test('BCRA connector creates official market record', async () => {
  const url = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones?fecha=2026-07-08';
  let redirectMode: RequestRedirect | undefined;
  const result = await fetchBcraExchangeRate('USD', '2026-07-08', [0], async (_input, init) => {
    redirectMode = init?.redirect;
    return response(JSON.stringify({
    status: 200, results: { fecha: '2026-07-08', detalle: [{ codigoMoneda: 'USD', descripcion: 'DOLAR E.E.U.U.', tipoCotizacion: 1488 }] }
    }), url);
  });
  assert.equal(result.ok, true);
  assert.equal(redirectMode, 'error');
  assert.equal(result.records[0].official, true);
  assert.equal(result.records[0].sourceType, 'official-market-data');
});

test('BCRA connector rejects oversized response before parsing', async () => {
  const url = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones?fecha=2026-07-08';
  const oversized = new Response('{}', { status: 200, headers: { 'content-length': '500001' } });
  Object.defineProperty(oversized, 'url', { value: url });
  const result = await fetchBcraExchangeRate('USD', '2026-07-08', [0], async () => oversized);
  assert.equal(result.ok, false);
  assert.match(result.error || '', /demasiado grande/);
});

test('BCRA connector rejects missing quotation', async () => {
  const url = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones?fecha=2026-07-08';
  const result = await fetchBcraExchangeRate('USD', '2026-07-08', [0], async () => response(JSON.stringify({
    status: 200, results: { fecha: null, detalle: [] }
  }), url));
  assert.equal(result.ok, false);
});

test('Boletin Oficial connector parses dated official notice', async () => {
  const url = 'https://www.boletinoficial.gob.ar/detalleAviso/primera/344149/20260708';
  const html = '<html><head><title>BOLETIN OFICIAL - Decreto 580/2026</title></head><body>Fecha de publicación 08/07/2026</body></html>';
  const result = await fetchBoletinOficialNotice(url, [0], async () => response(html, url, 'text/html'));
  assert.equal(result.ok, true);
  assert.equal(result.records[0].sourceType, 'official-gazette');
  assert.equal(result.records[0].sourceDate, '2026-07-08');
});

test('Boletin Oficial connector rejects non-detail URLs', async () => {
  const result = await fetchBoletinOficialNotice('https://www.boletinoficial.gob.ar/', [0]);
  assert.equal(result.ok, false);
});

test('news connector creates dated non-official record for allowed outlet', async () => {
  const url = 'https://www.infobae.com/sociedad/2026/07/11/ejemplo/';
  const html = '<meta property="og:title" content="Título verificable"><meta property="article:published_time" content="2026-07-11T10:00:00Z"><meta property="og:description" content="Resumen">';
  const result = await fetchAllowedNewsArticle(url, [0], async () => response(html, url, 'text/html'));
  assert.equal(result.ok, true);
  assert.equal(result.records[0].official, false);
  assert.equal(result.records[0].sourceType, 'independent-news');
});

test('news connector rejects outlets outside allowlist', async () => {
  const result = await fetchAllowedNewsArticle('https://example.com/noticia', [0]);
  assert.equal(result.ok, false);
});

test('news connector rejects undated articles', async () => {
  const url = 'https://www.clarin.com/sociedad/ejemplo.html';
  const result = await fetchAllowedNewsArticle(url, [0], async () => response('<meta property="og:title" content="Sin fecha">', url, 'text/html'));
  assert.equal(result.ok, false);
});
