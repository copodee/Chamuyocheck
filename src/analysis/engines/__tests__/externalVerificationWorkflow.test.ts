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
