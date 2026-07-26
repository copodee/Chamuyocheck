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

test('extrae resumen por moneda de un informe de deuda corporativa', () => {
  const result = extractFinancialDebt(`
    Reporte con información al 31/03/2026
    TOTAL ARS 22.836 MM 100,00% 0.77 38.94%
    TOTAL USD 11,82 MM 100,00% 0.63 9.28%
    1 Wise ARS 5.536 MM 24,24% 0.50 40.00%
  `);
  assert.equal(result.asOfDate, '31/03/2026');
  assert.equal(result.currencySummaries.length, 2);
  assert.equal(result.currencySummaries[0].capital, 22_836_000_000);
  assert.equal(result.currencySummaries[1].capital, 11_820_000);
  assert.ok(Math.abs((result.currencySummaries[0].weightedAnnualRate || 0) - 0.3894) < 0.000001);
  assert.equal(result.totalOutstanding, null);
  assert.equal(result.monthlyDebtServiceBasis, 'portfolio-estimate');
  assert.match(result.warnings.join(' '), /tipo de cambio/i);
});

test('usa el total ARS cuando el informe no contiene moneda extranjera', () => {
  const result = extractFinancialDebt(`
    Operaciones vigentes al 31/03/2026
    TOTAL ARS 12.749 MM 100,00% 5.03 35.33%
  `);
  assert.equal(result.totalOutstanding, 12_749_000_000);
  assert.ok((result.currencySummaries[0].estimatedMonthlyService || 0) > 0);
});
