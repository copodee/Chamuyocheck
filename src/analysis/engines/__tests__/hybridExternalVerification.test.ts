import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHybridExternalVerification, paidWebVerificationEnabled } from '../hybridExternalVerification';
import { runClaimFirstPipeline } from '../claimFirstPipeline';

const client = { chat: { completions: { create: async () => { throw new Error('paid search must not run'); } } } } as any;

test('paid web verification is opt-in and disabled by default', () => {
  assert.equal(paidWebVerificationEnabled(undefined), false);
  assert.equal(paidWebVerificationEnabled('false'), false);
  assert.equal(paidWebVerificationEnabled('true'), true);
});

test('hybrid flow remains inconclusive without free evidence and never calls paid search by default', async () => {
  const plan = runClaimFirstPipeline('Una noticia afirma que ocurrió un hecho público ayer en Argentina.').documentExternalVerificationPlan;
  const result = await runHybridExternalVerification(client, 'Hecho público reciente', plan, [], fetch, false);
  assert.equal(result.route, 'inconclusive');
  assert.equal(result.paidSearchUsed, false);
  assert.equal(result.execution.externalVerificationPerformed, false);
});

test('hybrid flow uses paid search only when explicitly enabled', async () => {
  let calls = 0;
  const paidClient = { chat: { completions: { create: async () => { calls += 1; return { choices: [{ message: { content: '{}', annotations: [] } }] }; } } } } as any;
  const plan = runClaimFirstPipeline('Una noticia afirma que ocurrió un hecho público ayer en Argentina.').documentExternalVerificationPlan;
  const result = await runHybridExternalVerification(paidClient, 'Otro hecho público reciente', plan, [], fetch, true);
  assert.equal(calls, 1);
  assert.equal(result.route, 'paid-web-search');
  assert.equal(result.paidSearchUsed, true);
  assert.equal(result.execution.externalVerificationPerformed, false);
});
