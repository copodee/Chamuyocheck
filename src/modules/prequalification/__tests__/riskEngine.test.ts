import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreditReport, PrequalificationRequest } from '../domain/types';
import { evaluatePrequalification } from '../scoring/riskEngine';

const request: PrequalificationRequest = {
  cuit: '30712345671',
  clientType: 'persona-juridica',
  assetValue: 35_000_000,
  advance: 7_000_000,
  termMonths: 36,
  assetType: 'automotor-0km',
};

function report(overrides: Partial<CreditReport> = {}): CreditReport {
  return {
    provider: 'test-provider',
    subjectId: request.cuit,
    denomination: 'Empresa de prueba',
    current: [{ entity: 'Banco A', period: '202606', situation: 1, debtAmount: 1_500_000, daysPastDue: 0, underReview: false, judicialProcess: false }],
    history: [{ entity: 'Banco A', period: '202605', situation: 1, debtAmount: 1_600_000, daysPastDue: 0, underReview: false, judicialProcess: false }],
    rejectedChecks: [],
    fetchedAt: new Date().toISOString(),
    warnings: [],
    ...overrides,
  };
}

test('precalifica un historial limpio sin afirmar capacidad de pago', () => {
  const result = evaluatePrequalification(request, report());
  assert.equal(result.status, 'prequalified');
  assert.equal(result.paymentCapacity.status, 'not-estimable');
  assert.equal(result.paymentCapacity.requestedExposure, 28_000_000);
  assert.equal(result.confidence, 'alta');
});

test('no condiciona el riesgo BCRA por no informar anticipo', () => {
  const result = evaluatePrequalification({ ...request, advance: 0 }, report());
  assert.equal(result.status, 'prequalified');
  assert.equal(result.score, 100);
  assert.equal(result.paymentCapacity.advanceRatio, 0);
  assert.ok(!result.conditions.some((condition) => condition.toLowerCase().includes('anticipo')));
});

test('envía a revisión manual una situación 3', () => {
  const current = [{ ...report().current[0], situation: 3 }];
  assert.equal(evaluatePrequalification(request, report({ current })).status, 'manual-review');
});

test('no precalifica procesos judiciales o situación 4', () => {
  const current = [{ ...report().current[0], situation: 4, judicialProcess: true }];
  const result = evaluatePrequalification(request, report({ current }));
  assert.equal(result.status, 'not-prequalified');
  assert.ok(result.score < 50);
});
