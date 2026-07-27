import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEconomicCapacity, hasAffordableMonthlyPayment } from '../scoring/economicEngine';
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

test('permite enviar si la empresa cubre sus compromisos aunque el encuadre general tenga condiciones', () => {
  const result = evaluateEconomicCapacity({
    profile: 'legal-entity', activity: 'Servicios', activitySeniorityMonths: 36,
    declaredMonthlyDebtService: 0, proposedMonthlyCanon: 4_000_000,
    monthlySales: [100_000_000, 100_000_000, 100_000_000, 100_000_000, 100_000_000, 100_000_000],
    requestedFinancing: 160_000_000, computableNetWorth: 103_697_553,
    existingComputableFinancing: 0, qualifyingGuarantee: 'none',
  }, 2, {
    sales: 120_000_000, operatingProfit: 16_466_729,
    equity: 103_697_553, extractionConfidence: 100, missingFields: [],
  });
  assert.equal(result.status, 'conditional');
  assert.ok((result.installmentToIncomeRatio || 0) < 0.3);
  assert.equal(hasAffordableMonthlyPayment(result, 4_000_000, 'legal-entity'), true);
});

test('persona jurídica usa cobertura 1,25 veces y no el límite personal del 30%', () => {
  const result = evaluateEconomicCapacity({
    profile: 'legal-entity', activity: 'Servicios', activitySeniorityMonths: 36,
    declaredMonthlyDebtService: 1_000_000, proposedMonthlyCanon: 7_000_000,
    monthlySales: Array(6).fill(100_000_000),
    requestedFinancing: 80_000_000, computableNetWorth: 200_000_000,
  }, 2, {
    sales: 1_200_000_000, operatingProfit: 120_000_000,
    equity: 200_000_000, extractionConfidence: 100, missingFields: [],
  });
  assert.equal(result.installmentToIncomeRatio, 0.8);
  assert.equal(result.totalCommitmentCoverage, 1.25);
  assert.equal(result.status, 'compatible');
  assert.equal(hasAffordableMonthlyPayment(result, 7_000_000, 'legal-entity'), true);
});

test('responsable inscripto usa cobertura del negocio y no relación personal del 30%', () => {
  const result = evaluateEconomicCapacity({
    profile: 'responsable-inscripto', activity: 'Comercio', activitySeniorityMonths: 36,
    declaredMonthlyDebtService: 500_000, proposedMonthlyCanon: 1_500_000,
    monthlySales: Array(6).fill(10_000_000), declaredOperatingMargin: 25,
  }, 2);
  assert.equal(result.installmentToIncomeRatio, 0.8);
  assert.equal(result.totalCommitmentCoverage, 1.25);
  assert.equal(result.status, 'compatible');
  assert.equal(hasAffordableMonthlyPayment(result, 1_500_000, 'responsable-inscripto'), true);
});

test('extrae rubros centrales de un balance para revisión crediticia', () => {
  const result = extractBalanceData('Activo corriente $ 12.000.000 Pasivo corriente $ 4.000.000 Patrimonio neto $ 8.000.000 Ventas $ 30.000.000 Resultado neto $ 3.000.000');
  assert.equal(result.currentAssets, 12_000_000);
  assert.equal(result.currentLiabilities, 4_000_000);
  assert.equal(result.equity, 8_000_000);
  assert.ok(result.extractionConfidence > 0);
});

test('tolera etiquetas dañadas por OCR en un balance PyME escaneado', () => {
  const result = extractBalanceData(`
    ESTADO DE SITUACION PATRIMONIAL
    Total activ0 corríente 12.000.000
    Total pasiv0 corrIente 4.000.000
    Patrimonlo net0 8.000.000
    Vent4s netas 30.000.000
    Resultad0 neto 3.000.000
  `);
  assert.equal(result.currentAssets, 12_000_000);
  assert.equal(result.currentLiabilities, 4_000_000);
  assert.equal(result.equity, 8_000_000);
  assert.equal(result.sales, 30_000_000);
  assert.equal(result.netProfit, 3_000_000);
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

test('extrae un EECC ganadero comparativo sin confundir subtotales ni omitir las dos deudas financieras', () => {
  const result = extractBalanceData(`
    ESTADOS CONTABLES AL 31/12/2025
    Total del activo corriente 1.521.218.093,79 956.365.640,38
    Total del activo no corriente 328.396.343,80 206.917.300,59
    Total del activo 1.849.614.437,60 1.163.282.940,98
    Total del pasivo corriente 378.827.460,19 219.681.069,70
    Préstamos y otros pasivos financieros (Nota N°5) 33.385.529,81 27.116.971,79
    Total del pasivo no corriente 96.054.224,70 161.773.765,32
    Préstamos y otros pasivos financieros (Nota N°5) 80.255.908,80 134.985.843,76
    Total del pasivo 474.881.684,89 381.454.835,02
    PATRIMONIO NETO 1.374.732.752,71 781.828.105,96
    Ventas Netas de Bienes y Servicios 2.157.792.986,08
    Ganancia (pérdida) del ejercicio 592.904.646,75
  `);
  assert.equal(result.totalAssets, 1_849_614_437.60);
  assert.equal(result.totalLiabilities, 474_881_684.89);
  assert.equal(result.financialDebt, 113_641_438.61);
  assert.equal(result.netProfit, 592_904_646.75);
});

test('extrae un EECC de transporte con pérdida y notas intercaladas', () => {
  const result = extractBalanceData(`
    Actividad Principal: Servicios de Transporte de carga y Logística
    N°de inscripción en la Inspección General de Justicia: 172.590
    ESTADOS CONTABLES AL 31 DE DICIEMBRE DE 2025
    Total del Activo Corriente 22.582.184.600,93
    Total del Activo No Corriente 27.492.843.660,41
    Total del Pasivo Corriente 26.157.962.744,84
    Total del Pasivo No Corriente 2.004.511.469,10
    PATRIMONIO NETO Según estado respectivo y nota 2.10. 21.912.554.047,40
    TOTAL DEL ACTIVO 50.075.028.261,34
    TOTAL DEL PASIVO 28.162.474.213,94
    Ventas netas de bienes y servicios (Nota 8.12.) 84.824.549.224,84
    Costo de los bienes vendidos y servicios prestados (Anexo III) (80.469.576.525,32)
    Ganancia Bruta 4.354.972.699,52
    PÉRDIDA FINAL DEL EJERCICIO (5.380.692.244,58)
  `);
  assert.equal(result.activity, 'Servicios de Transporte de carga y Logística');
  assert.equal(result.currentLiabilities, 26_157_962_744.84);
  assert.equal(result.nonCurrentLiabilities, 2_004_511_469.10);
  assert.equal(result.equity, 21_912_554_047.40);
  assert.equal(result.sales, 84_824_549_224.84);
  assert.equal(result.costOfSales, -80_469_576_525.32);
  assert.equal(result.netProfit, -5_380_692_244.58);
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

test('informa la diferencia entre ingreso declarado y promedio documentado', () => {
  const result = evaluateEconomicCapacity({
    profile: 'monotributista', activity: 'Servicios', activitySeniorityMonths: 24,
    declaredMonthlyDebtService: 0, proposedMonthlyCanon: 500_000,
    declaredMonthlyNetIncome: 3_000_000, documentedMonthlyIncome: 2_500_000,
  }, 7);
  assert.equal(result.declaredMonthlyIncome, 3_000_000);
  assert.equal(result.documentedMonthlyIncome, 2_500_000);
  assert.equal(result.declaredDocumentedDifference, 500_000);
  assert.equal(result.declaredDocumentedDifferenceRatio, 0.2);
  assert.match(result.conditions.join(' '), /diferencia|supera/i);
});

test('usa el promedio documentado cuando no hay monto declarado', () => {
  const result = evaluateEconomicCapacity({
    profile: 'monotributista', activity: 'Servicios', activitySeniorityMonths: 24,
    declaredMonthlyDebtService: 0, proposedMonthlyCanon: 500_000,
    documentedMonthlyIncome: 2_616_667,
  }, 7);
  assert.equal(result.normalizedMonthlyIncome, 2_616_667);
  assert.equal(result.declaredMonthlyIncome, null);
  assert.equal(result.documentedMonthlyIncome, 2_616_667);
  assert.match(result.reasons.join(' '), /facturas/i);
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

test('identifica un estado intermedio trimestral sin tratarlo como balance anual', () => {
  const result = extractBalanceData(`
    ESTADOS CONTABLES Correspondientes al período intermedio de tres meses
    iniciado el 1° de octubre de 2025 y finalizado el 31 de diciembre de 2025
    Actividad principal: Producción de alimento balanceado para mascotas
    (Importes expresados en moneda homogénea)
    TOTAL DEL ACTIVO CORRIENTE 57.259.985.278,54
    TOTAL DEL ACTIVO NO CORRIENTE 105.113.275.307,64
    TOTAL DEL PASIVO CORRIENTE 59.223.887.474,94
    DEUDAS FINANCIERAS 33.230.073.039,35 37.174.337.871,13
    TOTAL DEL PASIVO NO CORRIENTE 13.111.588.113,36
    DEUDAS FINANCIERAS 13.108.759.973,82 9.352.246.728,08
    PATRIMONIO NETO 90.037.784.997,88
    INGRESOS POR PRODUCTOS 19.383.612.571,76
    RESULTADO BRUTO 8.214.470.889,22
    RESULTADO OPERATIVO 2.528.078.444,78
    RESULTADO DEL PERIODO 810.369.272,49
    INFORME DE REVISIÓN DEL AUDITOR INDEPENDIENTE SOBRE ESTADOS CONTABLES DE PERÍODOS INTERMEDIOS
  `);
  assert.equal(result.statementKind, 'interim');
  assert.equal(result.periodMonths, 3);
  assert.equal(result.periodStartDate, '01/10/2025');
  assert.equal(result.closingDate, '31/12/2025');
  assert.equal(result.currencyBasis, 'homogeneous');
  assert.equal(result.assuranceLevel, 'limited-review');
  assert.equal(result.financialDebt, 46_338_833_013.17);
});

test('escala estados publicados en miles y reconoce su alcance consolidado', () => {
  const result = extractBalanceData(`
    Estados financieros consolidados. Cifras expresadas en miles de pesos.
    Total del activo corriente 120.000
    Total del activo no corriente 80.000
    Total del pasivo corriente 50.000
    Total del pasivo no corriente 30.000
    Patrimonio neto 120.000
    Ventas netas 300.000
    Resultado neto del ejercicio 24.000
  `);
  assert.equal(result.amountScale, 1000);
  assert.equal(result.statementScope, 'consolidated');
  assert.equal(result.currentAssets, 120_000_000);
  assert.equal(result.sales, 300_000_000);
});
