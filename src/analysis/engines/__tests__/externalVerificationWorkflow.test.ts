import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runExternalVerificationWorkflow } from '../externalVerificationWorkflow';
import { externalVerificationExecutionEnabled, POST } from '../../../../app/api/verify/route';

test('workflow plans locally without touching network by default', async () => {
  let calls = 0;
  const result = await runExternalVerificationWorkflow(
    'El dato está en https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949 y este contrato es ilegal.',
    false,
    async () => { calls += 1; throw new Error('must not execute'); }
  );
  assert.equal(calls, 0);
  assert.equal(result.planning.requests.length, 1);
  assert.equal(result.execution, null);
  assert.equal(result.claims[0].externalVerificationRequired, true);
  assert.equal(result.claims[0].externalVerificationPerformed, false);
  assert.equal(result.claims[0].status, 'pending');
  assert.equal(result.claims[0].records.length, 0);
  assert.equal(result.claims[0].pendingReasons.length, 0);
  assert.deepEqual(result.claims[0].attempts, []);
});

test('workflow executes only explicit planned references when requested', async () => {
  const url = 'https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949';
  const html = '<script type="application/ld+json">{"@type":"Legislation","legislationIdentifier":"Ley 27275 / 2016","name":"ACCESO A LA INFORMACION","url":"https://www.argentina.gob.ar/normativa/nacional/norma-265949","datePublished":"2016-09-29"}</script>';
  let calls = 0;
  const result = await runExternalVerificationWorkflow(
    `Este contrato es ilegal en Argentina: ${url}`,
    true,
    async () => {
      calls += 1;
      const response = new Response(html, { status: 200 });
      Object.defineProperty(response, 'url', { value: url });
      return response;
    }
  );
  assert.equal(calls, 1);
  assert.equal(result.execution?.execution.externalVerificationPerformed, true);
  assert.equal(result.claims[0].externalVerificationPerformed, true);
  assert.equal(result.claims[0].status, 'complete');
  assert.equal(result.claims[0].records.length, 1);
  assert.equal(result.claims[0].records[0].official, true);
  assert.deepEqual(result.claims[0].pendingReasons, []);
  assert.equal(result.claims[0].attempts.length, 1);
  assert.equal(result.claims[0].attempts[0].ok, true);
});

test('workflow never marks a claim performed from insufficient evidence', async () => {
  const result = await runExternalVerificationWorkflow(
    'El dólar oficial cotiza hoy a 1200 pesos [BCRA:USD:2026-07-11].',
    true,
    async (input) => {
      const response = new Response(JSON.stringify({
        results: {
          fecha: '2026-07-11',
          detalle: [{ codigoMoneda: 'USD', descripcion: 'Dólar estadounidense', tipoCotizacion: 1200 }],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
      Object.defineProperty(response, 'url', { value: String(input) });
      return response;
    }
  );
  const requiredClaim = result.claims.find((claim) => claim.externalVerificationRequired);
  assert.equal(result.execution?.execution.status, 'partial');
  assert.ok(requiredClaim);
  assert.equal(requiredClaim.externalVerificationPerformed, false);
  assert.equal(requiredClaim.status, 'partial');
  assert.equal(requiredClaim.records.length, 1);
  assert.equal(requiredClaim.attempts[0].recordCount, 1);
});

test('workflow distinguishes claims that do not require external verification', async () => {
  const result = await runExternalVerificationWorkflow('Dos más dos es igual a cuatro.', false);
  assert.equal(result.claims[0].externalVerificationRequired, false);
  assert.equal(result.claims[0].externalVerificationPerformed, false);
  assert.equal(result.claims[0].status, 'not-required');
  assert.deepEqual(result.claims[0].records, []);
  assert.deepEqual(result.claims[0].attempts, []);
});

test('workflow exposes the pending reason on the claim that lacks an explicit source', async () => {
  const result = await runExternalVerificationWorkflow('Este contrato es ilegal en Argentina.', false);
  assert.equal(result.claims[0].status, 'pending');
  assert.equal(result.claims[0].records.length, 0);
  assert.equal(result.claims[0].pendingReasons.length, 1);
  assert.match(result.claims[0].pendingReasons[0], /URL oficial|identificador/);
});

test('feature flag enables execution only for literal true', () => {
  assert.equal(externalVerificationExecutionEnabled('true'), true);
  assert.equal(externalVerificationExecutionEnabled('TRUE'), false);
  assert.equal(externalVerificationExecutionEnabled('1'), false);
  assert.equal(externalVerificationExecutionEnabled(undefined), false);
});

test('verify endpoint returns a local plan without execution', async () => {
  const response = await POST(new Request('http://localhost/api/verify', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Este contrato es ilegal en Argentina.', execute: false }),
  }));
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.execution, null);
  assert.equal(json.plan.externalVerificationRequired, true);
  assert.equal(json.claims[0].externalVerificationRequired, true);
  assert.equal(json.claims[0].externalVerificationPerformed, false);
});

test('verify endpoint rejects execution while feature flag is disabled', async () => {
  const previous = process.env.EXTERNAL_VERIFICATION_EXECUTION_ENABLED;
  delete process.env.EXTERNAL_VERIFICATION_EXECUTION_ENABLED;
  try {
    const response = await POST(new Request('http://localhost/api/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Este contrato es ilegal en Argentina.', execute: true }),
    }));
    assert.equal(response.status, 403);
  } finally {
    if (previous === undefined) delete process.env.EXTERNAL_VERIFICATION_EXECUTION_ENABLED;
    else process.env.EXTERNAL_VERIFICATION_EXECUTION_ENABLED = previous;
  }
});

test('verify endpoint rejects malformed and oversized input', async () => {
  const malformed = await POST(new Request('http://localhost/api/verify', { method: 'POST', body: '{' }));
  assert.equal(malformed.status, 400);
  const oversized = await POST(new Request('http://localhost/api/verify', {
    method: 'POST', body: JSON.stringify({ text: 'x'.repeat(20_001) }),
  }));
  assert.equal(oversized.status, 413);
});
