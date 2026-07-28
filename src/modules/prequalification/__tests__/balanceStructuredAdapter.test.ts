import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BalanceFieldName,
  StructuredBalanceExtraction,
  StructuredBalanceField,
} from '../../../lib/extractors/structuredBalanceExtractor';
import { integrateStructuredBalancePrequalification } from '../balancePrequalificationIntegration';
import {
  adaptStructuredBalanceToExtractedBalance,
  buildBalanceAccountingControl,
  isBalanceAccountingControl,
  sanitizeBalanceDerivedEconomicInputs,
  sanitizeExtractedBalanceWithControl,
} from '../balanceStructuredAdapter';

const names: BalanceFieldName[] = [
  'currentAssets', 'totalAssets', 'currentLiabilities', 'totalLiabilities',
  'equity', 'sales', 'operatingResult', 'netResult', 'cash',
  'tradeReceivables', 'inventories', 'financialDebt', 'closingDate',
  'fiscalYearDuration', 'currency', 'statementUnit',
];

const values: Partial<Record<BalanceFieldName, number>> = {
  currentAssets: 500, totalAssets: 1000, currentLiabilities: 300,
  totalLiabilities: 600, equity: 400, sales: 1200, operatingResult: 140,
  netResult: 90, cash: 100, tradeReceivables: 180, inventories: 160,
  financialDebt: 350,
};

function field(name: BalanceFieldName): StructuredBalanceField {
  const value = values[name] ?? null;
  const rawValue = name === 'closingDate' ? '31/12/2024'
    : name === 'currency' ? 'ARS'
      : name === 'statementUnit' ? 'thousands_ars' : value == null ? null : String(value);
  return {
    value, rawValue, status: rawValue == null ? 'missing' : 'validated',
    page: 1, rowIndex: 2,
    columnType: ['currency', 'statementUnit'].includes(name) ? null : 'current_period',
    period: ['currency', 'statementUnit'].includes(name) ? null : '31/12/2024',
    section: 'statement_of_financial_position', source: 'pdfjs', confidence: 0.95,
    labelText: name, unit: 'thousands_ars', extractionMethod: 'structured',
  };
}

function extraction(): StructuredBalanceExtraction {
  return {
    fields: Object.fromEntries(names.map(name => [name, field(name)])) as StructuredBalanceExtraction['fields'],
    pageQuality: [{ page: 1, orientationStatus: 'original', orientationConfidence: 0.95 }],
  };
}

test('adapta los nombres productivos y aplica la unidad declarada', () => {
  const data = extraction();
  const integration = integrateStructuredBalancePrequalification(data);
  const adapted = adaptStructuredBalanceToExtractedBalance(data, integration);
  assert.equal(adapted.operatingProfit, 140_000);
  assert.equal(adapted.netProfit, 90_000);
  assert.equal(adapted.inventory, 160_000);
  assert.equal(adapted.amountScale, 1000);
});

test('campos needs_review y missing se convierten en null, nunca en cero', () => {
  const data = extraction();
  data.fields.cash.status = 'needs_review';
  data.fields.inventories = { ...data.fields.inventories, status: 'missing', value: null };
  const integration = integrateStructuredBalancePrequalification(data);
  const adapted = adaptStructuredBalanceToExtractedBalance(data, integration);
  assert.equal(adapted.cash, null);
  assert.equal(adapted.inventory, null);
  assert.notEqual(adapted.cash, 0);
  assert.notEqual(adapted.inventory, 0);
});

test('manual_review_required elimina autoritativamente todo el balance', () => {
  const data = extraction();
  data.fields.totalLiabilities.value = 200;
  const integration = integrateStructuredBalancePrequalification(data);
  const control = buildBalanceAccountingControl(data, integration);
  const adapted = adaptStructuredBalanceToExtractedBalance(data, integration);
  assert.equal(control.automaticPrequalificationBlocked, true);
  assert.equal(sanitizeExtractedBalanceWithControl(adapted, control), undefined);
});

test('partial conserva únicamente la lista de campos autorizados', () => {
  const data = extraction();
  data.fields.sales.status = 'needs_review';
  const integration = integrateStructuredBalancePrequalification(data);
  const control = buildBalanceAccountingControl(data, integration);
  const adapted = adaptStructuredBalanceToExtractedBalance(data, integration);
  const attempted = { ...adapted, sales: 9_999_999 };
  const sanitized = sanitizeExtractedBalanceWithControl(attempted, control);
  assert.equal(control.extractionStatus, 'partial');
  assert.equal(sanitized?.sales, null);
  assert.equal(sanitized?.currentAssets, 500_000);
});

test('el servidor rechaza sobres declarados aprobados sin trazabilidad válida', () => {
  const data = extraction();
  const integration = integrateStructuredBalancePrequalification(data);
  const control = buildBalanceAccountingControl(data, integration);
  control.trace.currentAssets!.confidence = 0.1;
  assert.equal(isBalanceAccountingControl(control), false);
});

test('patrimonio y deuda bloqueados no sobreviven en los datos económicos', () => {
  const data = extraction();
  data.fields.equity.status = 'needs_review';
  data.fields.financialDebt.status = 'needs_review';
  const integration = integrateStructuredBalancePrequalification(data);
  const control = buildBalanceAccountingControl(data, integration);
  const adapted = adaptStructuredBalanceToExtractedBalance(data, integration);
  const inputs = sanitizeBalanceDerivedEconomicInputs({
    computableNetWorth: 99_000_000,
    existingComputableFinancing: 88_000_000,
  } as never, adapted, control, false);
  assert.equal(inputs.computableNetWorth, 0);
  assert.equal(inputs.existingComputableFinancing, 0);
});

test('una deuda documentada por separado no se elimina con el balance bloqueado', () => {
  const data = extraction();
  data.fields.financialDebt.status = 'needs_review';
  const integration = integrateStructuredBalancePrequalification(data);
  const control = buildBalanceAccountingControl(data, integration);
  const inputs = sanitizeBalanceDerivedEconomicInputs({
    computableNetWorth: 0,
    existingComputableFinancing: 12_500_000,
  } as never, undefined, control, true);
  assert.equal(inputs.existingComputableFinancing, 12_500_000);
});
