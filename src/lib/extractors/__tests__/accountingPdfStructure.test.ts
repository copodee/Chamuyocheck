import assert from 'node:assert/strict';
import test from 'node:test';
import {
  associateRowsWithAccountingColumns,
  detectAccountingColumns,
} from '../accountingPdfStructure';
import {
  groupPdfTokensIntoRows,
  type StructuredPdfDocument,
  type StructuredPdfToken,
} from '../browserPdfStructure';

type TokenInput = Pick<StructuredPdfToken, 'text' | 'x' | 'y' | 'width'>;

function documentFromTokens(inputs: TokenInput[]): StructuredPdfDocument {
  const tokens: StructuredPdfToken[] = inputs.map((token) => ({
    ...token,
    page: 1,
    height: 0.018,
    origin: 'pdfjs',
    confidence: 100,
  }));
  return {
    pages: [{
      page: 1,
      width: 1000,
      height: 1400,
      tokens,
      rows: groupPdfTokensIntoRows(tokens),
    }],
  };
}

function balanceRows(headers: TokenInput[], numericXs = [0.62, 0.82]): StructuredPdfDocument {
  const labels = ['Caja', 'CrÃ©ditos', 'Bienes de cambio', 'Total activo'];
  return documentFromTokens([
    { text: 'Estado de situaciÃ³n patrimonial', x: 0.08, y: 0.04, width: 0.35 },
    ...headers,
    ...labels.flatMap((label, index) => [
      { text: label, x: 0.08, y: 0.2 + index * 0.05, width: 0.28 },
      ...numericXs.map((x, column) => ({
        text: String((index + 1) * (column + 2) * 1000),
        x,
        y: 0.2 + index * 0.05,
        width: 0.1,
      })),
    ]),
  ]);
}

test('detecta el aÃ±o actual y el comparativo anterior', () => {
  const result = detectAccountingColumns(balanceRows([
    { text: '2024', x: 0.65, y: 0.12, width: 0.06 },
    { text: '2023', x: 0.85, y: 0.12, width: 0.06 },
  ]));
  const columns = result.pages[0].detectedColumns;

  assert.equal(result.pages[0].detectionStatus, 'detected');
  assert.equal(columns.find((column) => column.type === 'current_period')?.period, '2024');
  assert.equal(columns.find((column) => column.type === 'previous_period')?.period, '2023');
});

test('detecta fechas completas de cierre', () => {
  const result = detectAccountingColumns(balanceRows([
    { text: '31/12/2024', x: 0.61, y: 0.12, width: 0.11 },
    { text: '31/12/2023', x: 0.81, y: 0.12, width: 0.11 },
  ]));
  const columns = result.pages[0].detectedColumns;

  assert.equal(columns.find((column) => column.type === 'current_period')?.period, '31/12/2024');
  assert.equal(columns.find((column) => column.type === 'previous_period')?.period, '31/12/2023');
});

test('detecta alineaciones repetidas sin inventar encabezados ni perÃ­odos', () => {
  const result = detectAccountingColumns(balanceRows([]));
  const numeric = result.pages[0].detectedColumns.filter((column) => column.type !== 'label');

  assert.equal(result.pages[0].detectionStatus, 'partial');
  assert.equal(numeric.length, 2);
  assert.ok(numeric.every((column) => column.type === 'unknown'));
  assert.ok(numeric.every((column) => column.headerText === null && column.period === null));
});

test('una sola columna de importes queda parcial y no se presume actual', () => {
  const result = detectAccountingColumns(balanceRows([
    { text: '2024', x: 0.65, y: 0.12, width: 0.06 },
  ], [0.62]));
  const numeric = result.pages[0].detectedColumns.filter((column) => column.type !== 'label');

  assert.equal(result.pages[0].detectionStatus, 'partial');
  assert.equal(numeric.length, 1);
  assert.equal(numeric[0].type, 'unknown');
  assert.equal(numeric[0].period, '2024');
});

test('con tres columnas numÃ©ricas conserva como desconocida la columna extra', () => {
  const result = detectAccountingColumns(balanceRows([
    { text: '2024', x: 0.55, y: 0.12, width: 0.06 },
    { text: '2023', x: 0.72, y: 0.12, width: 0.06 },
    { text: 'Ajuste', x: 0.89, y: 0.12, width: 0.07 },
  ], [0.52, 0.69, 0.86]));
  const numeric = result.pages[0].detectedColumns.filter((column) => column.type !== 'label');

  assert.equal(numeric.length, 3);
  assert.equal(numeric.filter((column) => column.type === 'unknown').length, 1);
  assert.equal(numeric.filter((column) => column.type === 'current_period').length, 1);
  assert.equal(numeric.filter((column) => column.type === 'previous_period').length, 1);
});

test('una pÃ¡gina de notas no se interpreta como tabla principal', () => {
  const document = balanceRows([
    { text: '2024', x: 0.65, y: 0.12, width: 0.06 },
    { text: '2023', x: 0.85, y: 0.12, width: 0.06 },
  ]);
  document.pages[0].rows[0].text = 'Notas a los estados contables';
  document.pages[0].rows[0].tokens[0].text = 'Notas a los estados contables';

  const page = detectAccountingColumns(document).pages[0];
  assert.equal(page.detectionStatus, 'uncertain');
  assert.deepEqual(page.detectedColumns, []);
});

test('sin evidencia tabular devuelve incertidumbre sin perÃ­odos inventados', () => {
  const page = detectAccountingColumns(documentFromTokens([
    { text: 'Informe del auditor', x: 0.08, y: 0.05, width: 0.25 },
    { text: 'El ejercicio fue revisado durante 2024.', x: 0.08, y: 0.12, width: 0.55 },
    { text: 'Nota 1', x: 0.08, y: 0.2, width: 0.1 },
  ])).pages[0];

  assert.equal(page.detectionStatus, 'uncertain');
  assert.deepEqual(page.detectedColumns, []);
});

test('asocia las celdas de cada fila por la geometrÃ­a de las columnas', () => {
  const document = balanceRows([
    { text: '2024', x: 0.65, y: 0.12, width: 0.06 },
    { text: '2023', x: 0.85, y: 0.12, width: 0.06 },
  ]);
  const columns = detectAccountingColumns(document).pages[0].detectedColumns;
  const assignments = associateRowsWithAccountingColumns(document.pages[0], columns);
  const caja = assignments.find((assignment) => assignment.row.text.includes('Caja'));

  assert.deepEqual(
    caja?.cells.map((cell) => cell.columnType),
    ['label', 'current_period', 'previous_period'],
  );
});

