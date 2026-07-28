import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupPdfTokensIntoRows,
  normalizePdfToken,
  type StructuredPdfToken,
} from '../browserPdfStructure';
import type { BrowserPdfOcrResult } from '../browserPdfOcr';

test('mantiene compatibles los resultados anteriores sin estructura geomÃ©trica', () => {
  const legacyResult: BrowserPdfOcrResult = {
    ok: true,
    text: 'Texto plano compatible',
    confidence: 100,
    pages: 1,
    nativePages: 1,
    ocrPages: 0,
    unreadablePages: [],
    partial: false,
    note: 'Lectura completa',
  };

  assert.equal(legacyResult.text, 'Texto plano compatible');
  assert.equal(legacyResult.structuredDocument, undefined);
});

test('normaliza la geometrÃ­a y conserva los metadatos del token', () => {
  const token = normalizePdfToken({
    text: 'Activo', page: 2, x: 100, y: 200, width: 50, height: 20,
    origin: 'ocr', confidence: 87.5,
  }, 400, 800);

  assert.deepEqual(token, {
    text: 'Activo', page: 2, x: 0.25, y: 0.25, width: 0.125, height: 0.025,
    origin: 'ocr', confidence: 87.5,
  });
});

test('limita coordenadas normalizadas al intervalo de cero a uno', () => {
  const token = normalizePdfToken({
    text: 'Total', page: 1, x: -10, y: 120, width: 150, height: 30,
    origin: 'pdfjs', confidence: 100,
  }, 100, 100);

  assert.equal(token.x, 0);
  assert.equal(token.y, 1);
  assert.equal(token.width, 1);
  assert.equal(token.height, 0.3);
});

test('agrupa tokens cercanos en filas y los ordena de izquierda a derecha', () => {
  const tokens: StructuredPdfToken[] = [
    { text: '1.000', page: 1, x: 0.7, y: 0.101, width: 0.1, height: 0.02, origin: 'pdfjs', confidence: 100 },
    { text: 'Activo', page: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.02, origin: 'pdfjs', confidence: 100 },
    { text: 'Pasivo', page: 1, x: 0.1, y: 0.2, width: 0.2, height: 0.02, origin: 'ocr', confidence: 91 },
  ];

  const rows = groupPdfTokensIntoRows(tokens);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].text, 'Activo 1.000');
  assert.deepEqual(rows[0].tokens.map((token) => token.text), ['Activo', '1.000']);
  assert.equal(rows[1].text, 'Pasivo');
});

test('no mezcla tokens de pÃ¡ginas distintas aunque compartan coordenadas', () => {
  const base = { x: 0.1, y: 0.1, width: 0.2, height: 0.02, origin: 'pdfjs' as const, confidence: 100 };
  const rows = groupPdfTokensIntoRows([
    { ...base, text: 'PÃ¡gina uno', page: 1 },
    { ...base, text: 'PÃ¡gina dos', page: 2 },
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.page), [1, 2]);
});

