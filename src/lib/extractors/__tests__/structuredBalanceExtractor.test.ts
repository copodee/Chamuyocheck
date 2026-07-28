import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAccountingColumns } from '../accountingPdfStructure';
import {
  extractStructuredBalanceData,
  type StructuredBalanceExtraction,
} from '../structuredBalanceExtractor';
import {
  groupPdfTokensIntoRows,
  type StructuredPdfDocument,
  type StructuredPdfToken,
} from '../browserPdfStructure';
import {
  type OrientationNormalizedPdfDocument,
  type OrientationNormalizedPdfPage,
} from '../pdfOrientationNormalization';

type RowInput = {
  label: string;
  current?: string;
  previous?: string;
  heading?: boolean;
};

const STANDARD_ROWS: RowInput[] = [
  { label: 'Estado de situación patrimonial', heading: true },
  { label: 'Activo corriente', current: '10.000', previous: '8.000' },
  { label: 'Disponibilidades', current: '2.000', previous: '1.500' },
  { label: 'Créditos por ventas', current: '3.000', previous: '2.500' },
  { label: 'Inventarios', current: '5.000', previous: '4.000' },
  { label: 'Total activo', current: '25.000', previous: '20.000' },
  { label: 'Pasivo corriente', current: '4.000', previous: '3.500' },
  { label: 'Deudas financieras', current: '6.000', previous: '5.500' },
  { label: 'Total pasivo', current: '10.000', previous: '9.000' },
  { label: 'Patrimonio neto', current: '15.000', previous: '11.000' },
  { label: 'Estado de resultados', heading: true },
  { label: 'Ventas', current: '40.000', previous: '35.000' },
  { label: 'Resultado operativo', current: '7.000', previous: '6.000' },
  { label: 'Resultado neto', current: '5.000', previous: '4.500' },
];

function pageFromRows(
  rows: RowInput[] = STANDARD_ROWS,
  options: {
    page?: number;
    unit?: string;
    currentPeriod?: string | null;
    previousPeriod?: string | null;
    oneAmountColumn?: boolean;
    orientationStatus?: 'original' | 'corrected' | 'uncertain';
  } = {},
): OrientationNormalizedPdfPage {
  const pageNumber = options.page ?? 1;
  const tokens: StructuredPdfToken[] = [];
  const add = (text: string, x: number, y: number, width: number) =>
    tokens.push({ text, page: pageNumber, x, y, width, height: 0.018, origin: 'pdfjs', confidence: 96 });
  add(options.unit ?? 'Expresado en miles de pesos', 0.06, 0.025, 0.28);
  if (options.currentPeriod !== null) add(options.currentPeriod ?? '31/12/2024', 0.61, 0.06, 0.11);
  if (!options.oneAmountColumn && options.previousPeriod !== null) {
    add(options.previousPeriod ?? '31/12/2023', 0.81, 0.06, 0.11);
  }
  rows.forEach((row, index) => {
    const y = 0.1 + index * 0.045;
    add(row.label, 0.06, y, row.heading ? 0.38 : 0.3);
    if (row.current != null) add(row.current, 0.62, y, 0.1);
    if (!options.oneAmountColumn && row.previous != null) add(row.previous, 0.82, y, 0.1);
  });
  return {
    page: pageNumber,
    width: 1000,
    height: 1400,
    tokens,
    rows: groupPdfTokensIntoRows(tokens),
    detectedRotation: 0,
    orientationConfidence: options.orientationStatus === 'uncertain' ? 0.2 : 0.94,
    orientationStatus: options.orientationStatus ?? 'original',
    deskewAngle: 0,
    normalizedWidth: 1000,
    normalizedHeight: 1400,
  };
}

function extractPages(
  pages: OrientationNormalizedPdfPage[],
  fallbackText?: string,
): StructuredBalanceExtraction {
  const orientationDocument: OrientationNormalizedPdfDocument = { pages };
  const document: StructuredPdfDocument = { pages };
  return extractStructuredBalanceData(
    document,
    detectAccountingColumns(orientationDocument),
    orientationDocument,
    fallbackText,
  );
}

test('extrae el ejercicio actual y no la columna comparativa', () => {
  const fields = extractPages([pageFromRows()]).fields;
  assert.equal(fields.totalAssets.value, 25000);
  assert.equal(fields.totalAssets.period, '31/12/2024');
  assert.equal(fields.totalAssets.columnType, 'current_period');
  assert.equal(fields.totalAssets.status, 'validated');
});

test('patrimonio neto de una nota no reemplaza al estado principal', () => {
  const note = pageFromRows([
    { label: 'Notas a los estados contables', heading: true },
    { label: 'Patrimonio neto', current: '999.000', previous: '888.000' },
    { label: 'Detalle uno', current: '1.000', previous: '900' },
    { label: 'Detalle dos', current: '2.000', previous: '1.800' },
  ], { page: 2 });
  const field = extractPages([pageFromRows(), note]).fields.equity;
  assert.equal(field.value, 15000);
  assert.equal(field.page, 1);
});

test('reconstruye un rótulo partido en dos filas con geometría compatible', () => {
  const rows = STANDARD_ROWS.flatMap((row) =>
    row.label === 'Créditos por ventas'
      ? [{ label: 'Créditos por', heading: true }, { label: 'ventas', current: '3.000', previous: '2.500' }]
      : [row]);
  const field = extractPages([pageFromRows(rows)]).fields.tradeReceivables;
  assert.equal(field.value, 3000);
  assert.equal(field.labelText, 'Créditos por ventas');
});

test('interpreta un número negativo entre paréntesis', () => {
  const rows = STANDARD_ROWS.map((row) =>
    row.label === 'Resultado neto' ? { ...row, current: '(1.234,50)' } : row);
  assert.equal(extractPages([pageFromRows(rows)]).fields.netResult.value, -1234.5);
});

test('interpreta importes con puntos y comas', () => {
  const rows = STANDARD_ROWS.map((row) =>
    row.label === 'Total activo' ? { ...row, current: '1.234.567,89' } : row);
  assert.equal(extractPages([pageFromRows(rows)]).fields.totalAssets.value, 1234567.89);
});

test('registra unidad expresada en miles', () => {
  const field = extractPages([pageFromRows()]).fields.totalAssets;
  assert.equal(field.unit, 'thousands_ars');
  assert.equal(field.status, 'validated');
});

test('registra unidad expresada en millones', () => {
  const field = extractPages([pageFromRows(STANDARD_ROWS, { unit: 'Cifras en millones de pesos' })]).fields.totalAssets;
  assert.equal(field.unit, 'millions_ars');
  assert.equal(field.status, 'validated');
});

test('mantiene missing para un campo ausente', () => {
  const rows = STANDARD_ROWS.filter((row) => row.label !== 'Inventarios');
  const field = extractPages([pageFromRows(rows)]).fields.inventories;
  assert.equal(field.status, 'missing');
  assert.equal(field.value, null);
});

test('un período incierto nunca queda validado', () => {
  const page = pageFromRows(STANDARD_ROWS, {
    currentPeriod: null,
    previousPeriod: null,
    oneAmountColumn: true,
  });
  const field = extractPages([page]).fields.totalAssets;
  assert.equal(field.status, 'needs_review');
  assert.equal(field.columnType, 'unknown');
  assert.equal(field.period, null);
});

test('una orientación incierta nunca queda validada', () => {
  const field = extractPages([pageFromRows(STANDARD_ROWS, { orientationStatus: 'uncertain' })]).fields.totalAssets;
  assert.equal(field.status, 'needs_review');
});

test('extrae desde una página rotada después de normalizarla', () => {
  const page = pageFromRows(STANDARD_ROWS, { orientationStatus: 'corrected' });
  page.detectedRotation = 270;
  const field = extractPages([page]).fields.totalAssets;
  assert.equal(page.orientationStatus, 'corrected');
  assert.equal(field.value, 25000);
  assert.equal(field.status, 'validated');
});

test('marca explícitamente el fallback textual como needs_review', () => {
  const result = extractStructuredBalanceData(
    { pages: [] },
    { pages: [] },
    { pages: [] },
    'Total activo 1.234',
  );
  assert.equal(result.fields.totalAssets.value, 1234);
  assert.equal(result.fields.totalAssets.status, 'needs_review');
  assert.equal(result.fields.totalAssets.extractionMethod, 'text_fallback');
});

test('deuda financiera de una nota no reemplaza el estado principal', () => {
  const note = pageFromRows([
    { label: 'Notas a los estados contables', heading: true },
    { label: 'Deudas financieras', current: '999.000', previous: '888.000' },
    { label: 'Detalle uno', current: '1.000', previous: '900' },
    { label: 'Detalle dos', current: '2.000', previous: '1.800' },
  ], { page: 2 });
  const field = extractPages([pageFromRows(), note]).fields.financialDebt;
  assert.equal(field.value, 6000);
  assert.equal(field.page, 1);
});

test('ventas y resultado corresponden al mismo período actual', () => {
  const fields = extractPages([pageFromRows()]).fields;
  assert.equal(fields.sales.value, 40000);
  assert.equal(fields.netResult.value, 5000);
  assert.equal(fields.sales.period, '31/12/2024');
  assert.equal(fields.netResult.period, fields.sales.period);
});
