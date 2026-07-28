import assert from 'node:assert/strict';
import test from 'node:test';
import { PROVINCIAL_LEASING_STAMP_MATRIX } from '../../../lib/leasing/argentinaLeasingTaxMatrix';
import { calculateFinancialLeasing } from '../../../lib/leasing/leasingFinanceMath';
import type {
  BalanceFieldName,
  StructuredBalanceExtraction,
  StructuredBalanceField,
} from '../../../lib/extractors/structuredBalanceExtractor';
import { integrateStructuredBalancePrequalification } from '../balancePrequalificationIntegration';

const NAMES: BalanceFieldName[] = [
  'currentAssets', 'totalAssets', 'currentLiabilities', 'totalLiabilities',
  'equity', 'sales', 'operatingResult', 'netResult', 'cash',
  'tradeReceivables', 'inventories', 'financialDebt', 'closingDate',
  'fiscalYearDuration', 'currency', 'statementUnit',
];

const VALUES: Partial<Record<BalanceFieldName, number>> = {
  currentAssets: 500, totalAssets: 1000,
  currentLiabilities: 300, totalLiabilities: 600,
  equity: 400, sales: 1200, operatingResult: 140, netResult: 90,
  cash: 100, tradeReceivables: 180, inventories: 160, financialDebt: 350,
  fiscalYearDuration: 12,
};

function makeField(name: BalanceFieldName): StructuredBalanceField {
  const value = VALUES[name] ?? null;
  const rawMetadata = name === 'closingDate' ? '31/12/2024'
    : name === 'currency' ? 'ARS'
      : name === 'statementUnit' ? 'thousands_ars' : null;
  return {
    value,
    rawValue: rawMetadata ?? (value == null ? null : String(value)),
    status: value == null && rawMetadata == null ? 'missing' : 'validated',
    page: 1,
    rowIndex: 1,
    columnType: ['closingDate', 'currency', 'statementUnit'].includes(name) ? null : 'current_period',
    period: ['currency', 'statementUnit'].includes(name) ? null : '31/12/2024',
    section: 'statement_of_financial_position',
    source: 'pdfjs',
    confidence: 0.95,
    labelText: name,
    unit: 'thousands_ars',
    extractionMethod: 'structured',
  };
}

function extraction(): StructuredBalanceExtraction {
  const fields = {} as Record<BalanceFieldName, StructuredBalanceField>;
  NAMES.forEach((name) => {
    fields[name] = makeField(name);
  });
  return {
    fields,
    pageQuality: [{ page: 1, orientationStatus: 'original', orientationConfidence: 0.95 }],
  };
}

test('approved autoriza y calcula todos los ratios', () => {
  const result = integrateStructuredBalancePrequalification(extraction());
  assert.equal(result.documentationQualityStatus, 'approved');
  assert.ok(result.ratios && Object.values(result.ratios).every((ratio) => ratio.canCalculate && ratio.value != null));
});

test('partial calcula solamente algunos ratios', () => {
  const data = extraction();
  data.fields.sales.status = 'needs_review';
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.documentationQualityStatus, 'partial');
  assert.equal(result.ratios?.currentLiquidity.canCalculate, true);
  assert.equal(result.ratios?.netMargin.canCalculate, false);
});

test('manual_review_required bloquea la precalificación automática', () => {
  const data = extraction();
  data.fields.equity.value = 100;
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.automaticPrequalificationBlocked, true);
  assert.equal(result.canContinueWithFinancialAnalysis, false);
  assert.equal(result.userMessage, 'Información insuficiente para precalificar automáticamente');
});

test('un ratio bloqueado devuelve null y No disponible', () => {
  const data = extraction();
  data.fields.sales.status = 'needs_review';
  const ratio = integrateStructuredBalancePrequalification(data).ratios?.netMargin;
  assert.equal(ratio?.value, null);
  assert.equal(ratio?.displayValue, 'No disponible');
});

test('expone una razón visible para cada bloqueo', () => {
  const data = extraction();
  data.fields.currentLiabilities.status = 'needs_review';
  const ratio = integrateStructuredBalancePrequalification(data).ratios?.currentLiquidity;
  assert.ok(ratio?.reason?.includes('currentLiabilities'));
});

test('un campo needs_review no se usa en ratios', () => {
  const data = extraction();
  data.fields.currentAssets.status = 'needs_review';
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.ratios?.currentLiquidity.canCalculate, false);
});

test('el fallback textual nunca alimenta el scoring ni los ratios', () => {
  const data = extraction();
  data.fields.totalAssets.status = 'needs_review';
  data.fields.totalAssets.extractionMethod = 'text_fallback';
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.automaticPrequalificationBlocked, true);
  assert.equal(result.ratios?.debtToAssets.value, null);
});

test('diferencia ausencia documental de desempeño financiero', () => {
  const data = extraction();
  data.fields.sales.status = 'needs_review';
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.documentationQualityStatus, 'partial');
  assert.equal(result.financialRiskStatus, 'not_evaluated');
  assert.ok(result.financialRiskReason.includes('no constituye'));
});

test('una ecuación contable inválida bloquea el análisis', () => {
  const data = extraction();
  data.fields.totalLiabilities.value = 200;
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.validation?.accountingEquationPassed, false);
  assert.equal(result.automaticPrequalificationBlocked, true);
});

test('un período incierto bloquea los ratios', () => {
  const data = extraction();
  data.fields.netResult.period = null;
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.validation?.periodConsistencyPassed, false);
  assert.equal(result.ratios?.roa.value, null);
});

test('una unidad desconocida bloquea los ratios', () => {
  const data = extraction();
  data.fields.totalAssets.unit = 'unknown';
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.validation?.unitConsistencyPassed, false);
  assert.equal(result.ratios?.debtToAssets.value, null);
});

test('una orientación incierta bloquea los campos de esa página', () => {
  const data = extraction();
  data.pageQuality![0].orientationStatus = 'uncertain';
  const result = integrateStructuredBalancePrequalification(data);
  assert.equal(result.validation?.orientationConsistencyPassed, false);
  assert.equal(result.automaticPrequalificationBlocked, true);
  assert.equal(
    result.qualityPresentation?.fields.find((field) => field.id === 'totalAssets')?.status,
    'needs_review',
  );
});

test('sin documento estructurado conserva el flujo anterior', () => {
  const result = integrateStructuredBalancePrequalification();
  assert.equal(result.mode, 'legacy');
  assert.equal(result.useLegacyFlow, true);
  assert.equal(result.automaticPrequalificationBlocked, false);
  assert.equal(result.qualityPresentation, null);
});

test('la integración no modifica el cotizador ni la comparación provincial', () => {
  const beforeJurisdictions = PROVINCIAL_LEASING_STAMP_MATRIX.map((item) => item.jurisdiction);
  integrateStructuredBalancePrequalification(extraction());
  const quote = calculateFinancialLeasing({
    assetValue: 100_000,
    financedPercent: 80,
    months: 24,
    annualNominalRatePercent: 36,
    optionPercent: 10,
    guaranteeCanons: 0,
    structuringFeePercent: 0,
  });
  assert.equal(quote.financedAmount, 80_000);
  assert.deepEqual(PROVINCIAL_LEASING_STAMP_MATRIX.map((item) => item.jurisdiction), beforeJurisdictions);
});
