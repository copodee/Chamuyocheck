import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFinancialDebt } from '../scoring/financialDebtExtractor';

test('extrae saldo total, servicio mensual y entidad de un detalle de deuda', () => {
  const result = extractFinancialDebt(`
    Banco: Banco Ejemplo
    Préstamo capital adeudado $ 12.000.000
    Leasing saldo pendiente $ 8.000.000
    Total deuda bancaria y financiera: $ 20.000.000
    Servicio mensual de deuda: $ 1.250.000
  `);
  assert.equal(result.totalOutstanding, 20_000_000);
  assert.equal(result.monthlyDebtService, 1_250_000);
  assert.equal(result.creditorEntities[0], 'Banco Ejemplo');
  assert.ok(result.confidence >= 80);
});

test('suma saldos identificados si el documento no trae total', () => {
  const result = extractFinancialDebt('Préstamo saldo pendiente 3.000.000\nLeasing saldo adeudado 2.000.000');
  assert.equal(result.totalOutstanding, 5_000_000);
  assert.match(result.warnings.join(' '), /sumando saldos/i);
});
