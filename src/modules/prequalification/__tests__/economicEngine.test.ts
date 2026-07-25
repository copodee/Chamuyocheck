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

test('lee formato argentino con notas, fecha verbal e importes negativos entre paréntesis', () => {
  const result = extractBalanceData(`
    Estados contables por el ejercicio finalizado el 30 de junio de 2025
    Total de activo corriente 687.625.831
    Total de activo no corriente 106.431.993
    Total del pasivo corriente 587.913.585
    Patrimonio neto (según estado respectivo) 206.144.239
    Total del activo 794.057.824
    Total del pasivo 587.913.585
    Disponibilidades (Nota 3.a.) 15.682.978
    Créditos comerciales (Nota 3.b.) 95.225.171
    Bienes de cambio (Nota 3.c.) 574.583.215
    Ventas netas 671.495.592
    Costo de la mercadería vendida (508.490.270)
    Utilidad bruta 163.005.322
    Resultado operativo 92.997.060
    Resultado neto del ejercicio 61.568.980
  `);
  assert.equal(result.closingDate, '30/06/2025');
  assert.equal(result.currentAssets, 687_625_831);
  assert.equal(result.equity, 206_144_239);
  assert.equal(result.inventory, 574_583_215);
  assert.equal(result.costOfSales, -508_490_270);
  assert.equal(result.netProfit, 61_568_980);
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

test('una persona empleada puede sumar ingreso monotributista declarado', () => {
  const result = evaluateEconomicCapacity({
    profile: 'employee', activity: 'Administración', activitySeniorityMonths: 36,
    declaredMonthlyDebtService: 100_000, proposedMonthlyCanon: 500_000,
    employeeNetIncome: 1_400_000, hasMonotributoIncome: true,
    additionalMonotributoNetIncome: 800_000,
  }, 0);
  assert.equal(result.normalizedMonthlyIncome, 2_200_000);
  assert.match(result.reasons.join(' '), /actividad monotributista/i);
});

test('clasifica una persona jurídica dentro del margen básico', () => {
  const result = evaluateEconomicCapacity({
    profile: 'legal-entity', activity: 'Industria', activitySeniorityMonths: 60,
    declaredMonthlyDebtService: 0, proposedMonthlyCanon: 1_000_000,
    monthlySales: Array(6).fill(20_000_000), declaredOperatingMargin: 20,
    requestedFinancing: 30_000_000, existingComputableFinancing: 20_000_000,
    computableNetWorth: 60_000_000, qualifyingGuarantee: 'none',
  }, 0, {
    closingDate: '31/12/2025', currentAssets: 30_000_000, nonCurrentAssets: 50_000_000,
    currentLiabilities: 10_000_000, nonCurrentLiabilities: 10_000_000, equity: 60_000_000,
    sales: 240_000_000, grossProfit: 60_000_000, operatingProfit: 48_000_000,
    netProfit: 35_000_000, financialDebt: 20_000_000, cash: 8_000_000,
    extractionConfidence: 100, missingFields: [],
  });
  assert.equal(result.regulatoryExposure.status, 'basic-margin');
  assert.equal(result.status, 'compatible');
  assert.equal(result.normalizedMonthlyIncome, 4_000_000);
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
