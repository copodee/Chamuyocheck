import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runClaimFirstPipeline } from '../claimFirstPipeline';
import { planExternalVerificationRequests } from '../externalVerificationRequestPlanner';

test('planner extracts explicit InfoLEG and news URLs', () => {
  const result = runClaimFirstPipeline('Este contrato cita https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949. La noticia está en https://www.infobae.com/sociedad/2026/07/11/ejemplo/');
  const plan = planExternalVerificationRequests(result.claims);
  assert.equal(plan.requests.some((request) => request.connector === 'infoleg'), true);
  assert.equal(plan.requests.some((request) => request.connector === 'news'), true);
});

test('planner extracts explicit structured international identifiers', () => {
  const result = runClaimFirstPipeline('Datos: [BCRA:USD:2026-07-08] [WHO:WHOSIS_000001:BRA] [WB:BR:NY.GDP.MKTP.CD:2024] [PMID:42119588].');
  const plan = planExternalVerificationRequests(result.claims);
  assert.deepEqual(plan.requests.map((request) => request.connector), ['bcra-exchange-rate', 'who-indicator', 'world-bank-indicator', 'pubmed']);
});

test('planner never invents a law or indicator from ordinary prose', () => {
  const result = runClaimFirstPipeline('Este contrato es ilegal en Argentina.');
  const plan = planExternalVerificationRequests(result.claims);
  assert.deepEqual(plan.requests, []);
  assert.equal(plan.pending.length, 1);
});

test('planner ignores unsupported and malformed URLs', () => {
  const result = runClaimFirstPipeline('Fuentes https://example.com/noticia y https://www.argentina.gob.ar/otra-pagina.');
  const plan = planExternalVerificationRequests(result.claims);
  assert.deepEqual(plan.requests, []);
});

test('planner does not create pending work for locally verifiable claims', () => {
  const result = runClaimFirstPipeline('2 + 2 = 5.');
  const plan = planExternalVerificationRequests(result.claims);
  assert.deepEqual(plan.pending, []);
});
