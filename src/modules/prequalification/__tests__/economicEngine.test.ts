import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEconomicCapacity } from '../scoring/economicEngine';
import { extractBalanceData } from '../scoring/balanceExtractor';

test('aplica la política del 30% a una persona en relación de dependencia', () => {
  const result = evaluateEconomicCapacity({
    profile: 'employee', activity: 'Empleado', activitySeniorityMonths: 36,
    declaredMonthlyDebtService: 100_000, proposedMonthlyCanon: 500_000,
    employeeNetIncome: 2_000_000,
  }, 6);
  assert.equal(result.installmentToIncomeRatio, 0.3);
  assert.equal(result.status, 'compatible');
  assert.equal(result.maximumPrudentCanon, 500_000);
});

test('extrae rubros centrales de un balance para revisión crediticia', () => {
  const result = extractBalanceData('Activo corriente $ 12.000.000 Pasivo corriente $ 4.000.000 Patrimonio neto $ 8.000.000 Ventas $ 30.000.000 Resultado neto $ 3.000.000');
  assert.equal(result.currentAssets, 12_000_000);
  assert.equal(result.currentLiabilities, 4_000_000);
  assert.equal(result.equity, 8_000_000);
  assert.ok(result.extractionConfidence > 0);
});

test('combina monotributo con ingreso en relación de dependencia', () => {
  const result = evaluateEconomicCapacity({
    profile: 'monotributista', activity: 'Servicios', activitySeniorityMonths: 30,
    declaredMonthlyDebtService: 100_000, proposedMonthlyCanon: 300_000,
    monthlySales: Array(6).fill(1_500_000), declaredOperatingMargin: 40,
    hasEmploymentIncome: true, additionalEmploymentNetIncome: 900_000,
  }, 8);
  assert.equal(result.normalizedMonthlyIncome, 1_350_000);
  assert.ok((result.installmentToIncomeRatio || 0) < 0.3);
  assert.equal(result.status, 'compatible');
});

test('estima ingreso monotributista por actividad sin pedir margen', () => {
  const result = evaluateEconomicCapacity({
    profile: 'monotributista', activity: 'Venta minorista', activityCategory: 'commerce',
    activitySeniorityMonths: 24, declaredMonthlyDebtService: 0, proposedMonthlyCanon: 300_000,
    monthlySales: Array(6).fill(4_000_000),
  }, 7);
  assert.equal(result.normalizedMonthlyIncome, 1_000_000);
  assert.equal(result.installmentToIncomeRatio, 0.3);
  assert.match(result.reasons.join(' '), /25%/);
});
