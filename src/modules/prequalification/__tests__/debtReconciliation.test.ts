import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileFinancialDebt } from '../scoring/debtReconciliation';

test('no suma la deuda del balance con el informe vigente', () => {
  const result = reconcileFinancialDebt(100_000_000, 110_000_000);
  assert.equal(result?.currentDebt, 110_000_000);
  assert.equal(result?.difference, 10_000_000);
  assert.notEqual(result?.currentDebt, 210_000_000);
});

test('marca una variación material posterior al cierre', () => {
  const result = reconcileFinancialDebt(100_000_000, 145_000_000);
  assert.equal(result?.status, 'material-change');
  assert.match(result?.label || '', /material/i);
});

test('no concilia cuando falta una de las dos fuentes', () => {
  assert.equal(reconcileFinancialDebt(null, 10_000_000), null);
});
