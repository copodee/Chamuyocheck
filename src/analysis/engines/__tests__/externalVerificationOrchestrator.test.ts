import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runClaimFirstPipeline } from '../claimFirstPipeline';
import { executeExternalVerificationPlan } from '../externalVerificationOrchestrator';

function response(body: unknown, url: string) {
  const result = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
  Object.defineProperty(result, 'url', { value: url }); return result;
}

test('orchestrator does nothing without explicit requests', async () => {
  const plan = runClaimFirstPipeline('Este contrato es ilegal en Argentina.').documentExternalVerificationPlan;
  const result = await executeExternalVerificationPlan(plan, []);
  assert.equal(result.execution.status, 'not-performed');
  assert.equal(result.execution.externalVerificationPerformed, false);
});

test('orchestrator keeps one BCRA source partial when finance plan requires two', async () => {
  const plan = runClaimFirstPipeline('El dólar cotiza hoy a 1488 pesos.').documentExternalVerificationPlan;
  const apiUrl = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones?fecha=2026-07-08';
  const result = await executeExternalVerificationPlan(plan, [{ connector: 'bcra-exchange-rate', currencyCode: 'USD', date: '2026-07-08', claimIndexes: [0] }], async () => response({
    status: 200, results: { fecha: '2026-07-08', detalle: [{ codigoMoneda: 'USD', descripcion: 'DOLAR', tipoCotizacion: 1488 }] }
  }, apiUrl));
  assert.equal(result.connectorErrors.length, 0);
  assert.equal(result.execution.status, 'partial');
  assert.equal(result.execution.externalVerificationPerformed, false);
});

test('orchestrator completes a legal plan with matching official InfoLEG evidence', async () => {
  const plan = runClaimFirstPipeline('Este contrato es ilegal en Argentina.').documentExternalVerificationPlan;
  const url = 'https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949';
  const html = '<script type="application/ld+json">{"@type":"Legislation","legislationIdentifier":"Ley 27275 / 2016","name":"ACCESO A LA INFORMACION","url":"https://www.argentina.gob.ar/normativa/nacional/norma-265949","datePublished":"2016-09-29"}</script>';
  const result = await executeExternalVerificationPlan(plan, [{ connector: 'infoleg', officialUrl: url, lawNumber: '27275', claimIndexes: [0] }], async () => response(html, url));
  assert.equal(result.execution.status, 'complete');
  assert.equal(result.execution.externalVerificationPerformed, true);
});

test('orchestrator reports partial verification when one of two news sources fails', async () => {
  const plan = runClaimFirstPipeline('Se vio un OVNI ayer en Córdoba.').documentExternalVerificationPlan;
  const goodUrl = 'https://www.infobae.com/sociedad/2026/07/11/ovni/';
  const requests = [
    { connector: 'news' as const, articleUrl: goodUrl, claimIndexes: [0] },
    { connector: 'news' as const, articleUrl: 'https://example.com/copia', claimIndexes: [0] },
  ];
  const result = await executeExternalVerificationPlan(plan, requests, async () => response(
    '<meta property="og:title" content="Reporte"><meta property="article:published_time" content="2026-07-11T10:00:00Z">', goodUrl
  ));
  assert.equal(result.connectorErrors.length, 1);
  assert.equal(result.execution.status, 'partial');
  assert.equal(result.execution.externalVerificationPerformed, false);
});

test('orchestrator deduplicates identical source requests', async () => {
  const plan = runClaimFirstPipeline('El dólar cotiza hoy a 1488 pesos.').documentExternalVerificationPlan;
  const apiUrl = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones?fecha=2026-07-08';
  const request = { connector: 'bcra-exchange-rate' as const, currencyCode: 'USD', date: '2026-07-08', claimIndexes: [0] };
  let calls = 0;
  const result = await executeExternalVerificationPlan(plan, [request, request], async () => {
    calls += 1;
    return response({ results: { fecha: '2026-07-08', detalle: [{ codigoMoneda: 'USD', tipoCotizacion: 1488 }] } }, apiUrl);
  });
  assert.equal(calls, 1);
  assert.equal(result.execution.records.length, 1);
});

test('orchestrator rejects excessive unique requests without network calls', async () => {
  const plan = runClaimFirstPipeline('El dólar cotiza hoy a 1488 pesos.').documentExternalVerificationPlan;
  const requests = Array.from({ length: 13 }, (_, index) => ({
    connector: 'bcra-exchange-rate' as const,
    currencyCode: 'USD',
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    claimIndexes: [0],
  }));
  let calls = 0;
  const result = await executeExternalVerificationPlan(plan, requests, async () => {
    calls += 1;
    throw new Error('must not execute');
  });
  assert.equal(calls, 0);
  assert.equal(result.execution.status, 'not-performed');
  assert.match(result.connectorErrors[0], /Límite excedido/);
});
