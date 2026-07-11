import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runClaimFirstPipeline } from '../claimFirstPipeline';
import { registerExternalVerificationExecution } from '../externalVerificationExecutionRegistry';
import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

function legalPlan() {
  return runClaimFirstPipeline('Este contrato es ilegal en Argentina.').documentExternalVerificationPlan;
}

function record(overrides: Partial<ExternalVerificationSourceRecord> = {}): ExternalVerificationSourceRecord {
  return {
    sourceType: 'government-law-repository',
    url: 'https://infoleg.gob.ar/norma/123',
    title: 'Norma aplicable',
    retrievedAt: '2026-07-11T12:00:00Z',
    sourceDate: '2026-07-10',
    claimIndexes: [0],
    official: true,
    ...overrides,
  };
}

test('empty evidence can never mark verification as performed', () => {
  const result = registerExternalVerificationExecution(legalPlan(), []);
  assert.equal(result.externalVerificationPerformed, false);
  assert.equal(result.status, 'not-performed');
});

test('invalid or unlinked evidence is rejected', () => {
  const result = registerExternalVerificationExecution(legalPlan(), [
    record({ url: 'not-a-url', claimIndexes: [] }),
  ]);
  assert.equal(result.externalVerificationPerformed, false);
  assert.equal(result.status, 'invalid');
  assert.ok(result.errors.length >= 2);
});

test('official requirement cannot be satisfied by a non-official source', () => {
  const result = registerExternalVerificationExecution(legalPlan(), [record({ official: false })]);
  assert.equal(result.externalVerificationPerformed, false);
  assert.equal(result.status, 'partial');
});

test('recency requirement needs a dated source record', () => {
  const result = registerExternalVerificationExecution(legalPlan(), [record({ sourceDate: undefined })]);
  assert.equal(result.externalVerificationPerformed, false);
  assert.equal(result.status, 'partial');
});

test('complete auditable evidence can mark verification as performed', () => {
  const result = registerExternalVerificationExecution(legalPlan(), [record()]);
  assert.equal(result.externalVerificationPerformed, true);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.coveredClaimIndexes, [0]);
});

test('one source cannot satisfy a two-source independent corroboration rule', () => {
  const plan = runClaimFirstPipeline('Se vio un OVNI ayer en Córdoba.').documentExternalVerificationPlan;
  const result = registerExternalVerificationExecution(plan, [
    record({
      sourceType: 'independent-news',
      url: 'https://news.example.com/report/1',
      official: false,
    }),
  ]);
  assert.equal(result.externalVerificationPerformed, false);
  assert.equal(result.status, 'partial');
});
