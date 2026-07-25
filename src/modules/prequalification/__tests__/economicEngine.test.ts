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

test('combina monotributo con ingreso en relación de dependencia sin quitas documentales', () => {
  const result = evaluateEconomicCapacity({
    profile: 'monotributista', activity: 'Servicios', activitySeniorityMonths: 30,
    declaredMonthlyDebtService: 100_000, proposedMonthlyCanon: 300_000,
    declaredMonthlyNetIncome: 1_500_000,
    hasEmploymentIncome: true, additionalEmploymentNetIncome: 900_000,
  }, 8);
  assert.equal(result.normalizedMonthlyIncome, 2_400_000);
  assert.ok((result.installmentToIncomeRatio || 0) < 0.3);
  assert.equal(result.status, 'compatible');
});

test('computa íntegramente el ingreso neto declarado del monotributista', () => {
  const result = evaluateEconomicCapacity({
    profile: 'monotributista', activity: 'Venta minorista', activityCategory: 'commerce',
    activitySeniorityMonths: 24, declaredMonthlyDebtService: 0, proposedMonthlyCanon: 300_000,
    declaredMonthlyNetIncome: 4_000_000,
  }, 7);
  assert.equal(result.normalizedMonthlyIncome, 4_000_000);
  assert.equal(result.installmentToIncomeRatio, 0.075);
  assert.match(result.reasons.join(' '), /íntegramente/i);
});

test('clasifica una persona jurídica dentro del margen básico', () => {
  const result = evaluateEconomicCapacity({
    profile: 'legal-entity', activity: 'Industria', activitySeniorityMonths: 60,
    declaredMonthlyDebtService: 0, proposedMonthlyCanon: 1_000_000,
    monthlySales: Array(6).fill(20_000_000), declaredOperatingMargin: 20,
    requestedFinancing: 30_000_000, existingComputableFinancing: 20_000_000,
    computableNetWorth: 60_000_000, qualifyingGuarantee: 'none',
  }, 0);
  assert.equal(result.regulatoryExposure.status, 'basic-margin');
  assert.equal(result.status, 'compatible');
});

test('el margen complementario requiere aprobación y no califica automáticamente', () => {
  const result = evaluateEconomicCapacity({
    profile: 'legal-entity', activity: 'Servicios', activitySeniorityMonths: 60,
    declaredMonthlyDebtService: 0, proposedMonthlyCanon: 500_000,
    monthlySales: Array(6).fill(20_000_000), declaredOperatingMargin: 20,
    requestedFinancing: 70_000_000, existingComputableFinancing: 40_000_000,
    computableNetWorth: 100_000_000, qualifyingGuarantee: 'none',
  }, 0);
  assert.equal(result.regulatoryExposure.status, 'complementary-margin');
  assert.equal(result.status, 'conditional');
  assert.equal(result.regulatoryExposure.basicMarginAvailable, 60_000_000);
});

test('marca el ingreso como declarativo cuando no hay comprobantes', () => {
  const result = evaluateEconomicCapacity({
    profile: 'employee', activity: 'Administración', activitySeniorityMonths: 24,
    declaredMonthlyDebtService: 0, proposedMonthlyCanon: 300_000, employeeNetIncome: 1_500_000,
  }, 0);
  assert.equal(result.confidence, 'declarativa');
  assert.match(result.conditions.join(' '), /solicitar respaldo/i);
});
