import assert from 'node:assert/strict';
import test from 'node:test';
import {
  determineBalanceRatioAvailability,
  validateStructuredBalance,
} from '../balanceAccountingValidation';
import {
  type BalanceFieldName,
  type BalanceUnit,
  type StructuredBalanceExtraction,
  type StructuredBalanceField,
} from '../structuredBalanceExtractor';

const FIELD_NAMES: BalanceFieldName[] = [
  'currentAssets', 'totalAssets', 'currentLiabilities', 'totalLiabilities',
  'equity', 'sales', 'operatingResult', 'netResult', 'cash',
  'tradeReceivables', 'inventories', 'financialDebt', 'closingDate',
  'fiscalYearDuration', 'currency', 'statementUnit',
];

const VALUES: Partial<Record<BalanceFieldName, number>> = {
  currentAssets: 500,
  totalAssets: 1000,
  currentLiabilities: 300,
  totalLiabilities: 600,
  equity: 400,
  sales: 1200,
  operatingResult: 140,
  netResult: 90,
  cash: 100,
  tradeReceivables: 180,
  inventories: 160,
  financialDebt: 350,
  fiscalYearDuration: 12,
};

function field(
  name: BalanceFieldName,
  value: number | null = VALUES[name] ?? null,
  unit: BalanceUnit = 'thousands_ars',
): StructuredBalanceField {
  const metadata = ['closingDate', 'currency', 'statementUnit'].includes(name);
  return {
    value,
    rawValue: metadata
      ? name === 'closingDate' ? '31/12/2024' : name === 'currency' ? 'ARS' : unit
      : value == null ? null : String(value),
    status: value == null && !metadata ? 'missing' : 'validated',
    page: 1,
    rowIndex: 1,
    columnType: metadata ? null : 'current_period',
    period: metadata && name !== 'closingDate' ? null : '31/12/2024',
    section: 'statement_of_financial_position',
    source: 'pdfjs',
    confidence: 0.95,
    labelText: name,
    unit,
    extractionMethod: 'structured',
  };
}

function completeExtraction(): StructuredBalanceExtraction {
  const fields = {} as Record<BalanceFieldName, StructuredBalanceField>;
  FIELD_NAMES.forEach((name) => {
    fields[name] = field(name);
  });
  return {
    fields,
    pageQuality: [{ page: 1, orientationStatus: 'original', orientationConfidence: 0.95 }],
  };
}

function cloneExtraction(): StructuredBalanceExtraction {
  return structuredClone(completeExtraction());
}

test('aprueba una ecuaciÃ³n contable vÃ¡lida', () => {
  const result = validateStructuredBalance(cloneExtraction());
  assert.equal(result.accountingEquationPassed, true);
  assert.equal(result.accountingEquationDifference, 0);
});

test('acepta una diferencia menor de redondeo', () => {
  const extraction = cloneExtraction();
  extraction.fields.equity.value = 399;
  const result = validateStructuredBalance(extraction);
  assert.equal(result.accountingEquationPassed, true);
  assert.equal(result.accountingEquationDifference, 1);
});

test('rechaza una ecuaciÃ³n contable invÃ¡lida', () => {
  const extraction = cloneExtraction();
  extraction.fields.equity.value = 200;
  const result = validateStructuredBalance(extraction);
  assert.equal(result.accountingEquationPassed, false);
  assert.equal(result.extractionStatus, 'manual_review_required');
});

test('detecta activo corriente mayor que activo total', () => {
  const extraction = cloneExtraction();
  extraction.fields.currentAssets.value = 1100;
  const result = validateStructuredBalance(extraction);
  assert.equal(result.fieldValidations.currentAssets.usableForRatios, false);
  assert.ok(result.warnings.some((warning) => warning.includes('activo corriente')));
});

test('detecta pasivo corriente mayor que pasivo total', () => {
  const extraction = cloneExtraction();
  extraction.fields.currentLiabilities.value = 700;
  const result = validateStructuredBalance(extraction);
  assert.equal(result.fieldValidations.currentLiabilities.usableForRatios, false);
});

test('detecta disponibilidades mayores que activo corriente', () => {
  const extraction = cloneExtraction();
  extraction.fields.cash.value = 600;
  const result = validateStructuredBalance(extraction);
  assert.equal(result.fieldValidations.cash.usableForRatios, false);
});

test('bloquea una unidad desconocida', () => {
  const extraction = cloneExtraction();
  extraction.fields.totalAssets.unit = 'unknown';
  const result = validateStructuredBalance(extraction);
  assert.equal(result.unitConsistencyPassed, false);
  assert.equal(result.extractionStatus, 'manual_review_required');
});

test('detecta mezcla de pesos y miles de pesos', () => {
  const extraction = cloneExtraction();
  extraction.fields.totalLiabilities.unit = 'ars';
  const result = validateStructuredBalance(extraction);
  assert.equal(result.unitConsistencyPassed, false);
  assert.ok(result.blockingReasons.some((reason) => reason.includes('unidades')));
});

test('detecta perÃ­odos inconsistentes', () => {
  const extraction = cloneExtraction();
  extraction.fields.netResult.period = '31/12/2023';
  const result = validateStructuredBalance(extraction);
  assert.equal(result.periodConsistencyPassed, false);
  assert.equal(result.fieldValidations.netResult.usableForRatios, false);
});

test('bloquea orientaciÃ³n incierta en una pÃ¡gina relevante', () => {
  const extraction = cloneExtraction();
  extraction.pageQuality![0].orientationStatus = 'uncertain';
  const result = validateStructuredBalance(extraction);
  assert.equal(result.orientationConsistencyPassed, false);
  assert.equal(result.extractionStatus, 'manual_review_required');
});

test('detecta patrimonio anormalmente pequeÃ±o', () => {
  const extraction = cloneExtraction();
  extraction.fields.totalLiabilities.value = 999;
  extraction.fields.equity.value = 1;
  const result = validateStructuredBalance(extraction);
  assert.equal(result.accountingEquationPassed, true);
  assert.equal(result.fieldValidations.equity.usableForRatios, false);
});

test('detecta patrimonio negativo y bloquea ratios asociados', () => {
  const extraction = cloneExtraction();
  extraction.fields.totalLiabilities.value = 1100;
  extraction.fields.equity.value = -100;
  const validation = validateStructuredBalance(extraction);
  const ratios = determineBalanceRatioAvailability(extraction, validation);
  assert.equal(ratios.debtToEquity.canCalculate, false);
  assert.equal(ratios.roe.canCalculate, false);
});

test('exige revisiÃ³n si los campos principales provienen del fallback textual', () => {
  const extraction = cloneExtraction();
  extraction.fields.totalAssets.extractionMethod = 'text_fallback';
  extraction.fields.totalAssets.status = 'needs_review';
  const result = validateStructuredBalance(extraction);
  assert.equal(result.extractionStatus, 'manual_review_required');
});

test('devuelve extracciÃ³n parcial cuando falta un campo secundario', () => {
  const extraction = cloneExtraction();
  extraction.fields.inventories = field('inventories', null);
  const result = validateStructuredBalance(extraction);
  assert.equal(result.extractionStatus, 'partial');
});

test('bloquea liquidez cuando falta un componente', () => {
  const extraction = cloneExtraction();
  extraction.fields.currentLiabilities = field('currentLiabilities', null);
  const validation = validateStructuredBalance(extraction);
  assert.equal(determineBalanceRatioAvailability(extraction, validation).currentLiquidity.canCalculate, false);
});

test('bloquea endeudamiento cuando el activo total no es utilizable', () => {
  const extraction = cloneExtraction();
  extraction.fields.totalAssets.status = 'needs_review';
  const validation = validateStructuredBalance(extraction);
  assert.equal(determineBalanceRatioAvailability(extraction, validation).debtToAssets.canCalculate, false);
});

test('bloquea ROA cuando el resultado neto no estÃ¡ validado', () => {
  const extraction = cloneExtraction();
  extraction.fields.netResult.status = 'needs_review';
  const validation = validateStructuredBalance(extraction);
  assert.equal(determineBalanceRatioAvailability(extraction, validation).roa.canCalculate, false);
});

test('bloquea ROE cuando falta patrimonio utilizable', () => {
  const extraction = cloneExtraction();
  extraction.fields.equity = field('equity', null);
  const validation = validateStructuredBalance(extraction);
  assert.equal(determineBalanceRatioAvailability(extraction, validation).roe.canCalculate, false);
});

test('bloquea margen neto cuando faltan ventas validadas', () => {
  const extraction = cloneExtraction();
  extraction.fields.sales.status = 'needs_review';
  const validation = validateStructuredBalance(extraction);
  assert.equal(determineBalanceRatioAvailability(extraction, validation).netMargin.canCalculate, false);
});

test('aprueba una extracciÃ³n completa', () => {
  const extraction = cloneExtraction();
  const result = validateStructuredBalance(extraction);
  assert.equal(result.extractionStatus, 'approved');
  assert.deepEqual(result.blockingReasons, []);
});

test('permite un ratio mientras otro queda bloqueado', () => {
  const extraction = cloneExtraction();
  extraction.fields.sales.status = 'needs_review';
  const validation = validateStructuredBalance(extraction);
  const ratios = determineBalanceRatioAvailability(extraction, validation);
  assert.equal(ratios.currentLiquidity.canCalculate, true);
  assert.equal(ratios.netMargin.canCalculate, false);
});

test('bloquea un ratio con denominador cero', () => {
  const extraction = cloneExtraction();
  extraction.fields.currentLiabilities.value = 0;
  const validation = validateStructuredBalance(extraction);
  const ratio = determineBalanceRatioAvailability(extraction, validation).currentLiquidity;
  assert.equal(ratio.canCalculate, false);
  assert.ok(ratio.reason?.includes('cero'));
});

test('varias anomalÃ­as graves obligan a revisiÃ³n manual', () => {
  const extraction = cloneExtraction();
  extraction.fields.currentAssets.value = 1500;
  extraction.fields.currentLiabilities.value = 900;
  extraction.fields.cash.value = 1600;
  const result = validateStructuredBalance(extraction);
  assert.equal(result.extractionStatus, 'manual_review_required');
  assert.ok(result.blockingReasons.some((reason) => reason.includes('varias anomalÃ­as')));
});

