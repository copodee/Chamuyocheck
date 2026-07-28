import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canUsePageForValidatedExtraction,
  normalizePdfDocumentOrientation,
  normalizePdfPageOrientation,
  rotateNormalizedToken,
  type PageRotation,
} from '../pdfOrientationNormalization';
import {
  groupPdfTokensIntoRows,
  type StructuredPdfDocument,
  type StructuredPdfPage,
  type StructuredPdfToken,
} from '../browserPdfStructure';

function canonicalPage(pageNumber = 1): StructuredPdfPage {
  const inputs = [
    ['Estado', 0.08, 0.05, 0.1], ['de', 0.19, 0.05, 0.03],
    ['situaciÃ³n', 0.23, 0.05, 0.11], ['patrimonial', 0.35, 0.05, 0.13],
    ['Activo', 0.08, 0.2, 0.1], ['corriente', 0.19, 0.2, 0.12],
    ['1.000', 0.7, 0.2, 0.1], ['900', 0.85, 0.2, 0.08],
    ['CrÃ©ditos', 0.08, 0.25, 0.11], ['2.000', 0.7, 0.25, 0.1], ['1.800', 0.83, 0.25, 0.1],
    ['Total', 0.08, 0.3, 0.07], ['activo', 0.16, 0.3, 0.09],
    ['3.000', 0.7, 0.3, 0.1], ['2.700', 0.83, 0.3, 0.1],
    ['Pasivo', 0.08, 0.4, 0.1], ['corriente', 0.19, 0.4, 0.12],
    ['1.200', 0.7, 0.4, 0.1], ['1.000', 0.83, 0.4, 0.1],
  ] as const;
  const tokens: StructuredPdfToken[] = inputs.map(([text, x, y, width]) => ({
    text, page: pageNumber, x, y, width, height: 0.02, origin: 'ocr', confidence: 94,
  }));
  return { page: pageNumber, width: 1000, height: 1400, tokens, rows: groupPdfTokensIntoRows(tokens) };
}

function physicallyRotatePage(page: StructuredPdfPage, rotation: PageRotation): StructuredPdfPage {
  const tokens = page.tokens.map((token) => rotateNormalizedToken(token, rotation));
  const swaps = rotation === 90 || rotation === 270;
  return {
    ...page,
    width: swaps ? page.height : page.width,
    height: swaps ? page.width : page.height,
    tokens,
    rows: groupPdfTokensIntoRows(tokens),
  };
}

test('corrige una pÃ¡gina rotada 90 grados', () => {
  const page = normalizePdfPageOrientation(physicallyRotatePage(canonicalPage(), 90));
  assert.equal(page.detectedRotation, 270);
  assert.equal(page.orientationStatus, 'corrected');
});

test('corrige una pÃ¡gina rotada 180 grados', () => {
  const page = normalizePdfPageOrientation(physicallyRotatePage(canonicalPage(), 180));
  assert.equal(page.detectedRotation, 180);
  assert.equal(page.orientationStatus, 'corrected');
});

test('corrige una pÃ¡gina rotada 270 grados', () => {
  const page = normalizePdfPageOrientation(physicallyRotatePage(canonicalPage(), 270));
  assert.equal(page.detectedRotation, 90);
  assert.equal(page.orientationStatus, 'corrected');
});

test('normaliza de manera independiente pÃ¡ginas con distintas orientaciones', () => {
  const document: StructuredPdfDocument = {
    pages: [
      canonicalPage(1),
      physicallyRotatePage(canonicalPage(2), 90),
      physicallyRotatePage(canonicalPage(3), 180),
    ],
  };
  const result = normalizePdfDocumentOrientation(document);
  assert.deepEqual(result.pages.map((page) => page.detectedRotation), [0, 270, 180]);
});

test('conserva una pÃ¡gina cuya orientaciÃ³n ya es correcta', () => {
  const page = normalizePdfPageOrientation(canonicalPage());
  assert.equal(page.detectedRotation, 0);
  assert.equal(page.orientationStatus, 'original');
  assert.equal(page.normalizedWidth, 1000);
  assert.equal(page.normalizedHeight, 1400);
});

test('marca como incierta una pÃ¡gina sin evidencia suficiente', () => {
  const token: StructuredPdfToken = {
    text: 'x', page: 1, x: 0.4, y: 0.4, width: 0.02, height: 0.02,
    origin: 'ocr', confidence: 20,
  };
  const page = normalizePdfPageOrientation({
    page: 1, width: 1000, height: 1400, tokens: [token], rows: groupPdfTokensIntoRows([token]),
  });
  assert.equal(page.orientationStatus, 'uncertain');
  assert.equal(canUsePageForValidatedExtraction(page), false);
});

test('conserva correctamente las coordenadas tras rotar y desrotar', () => {
  const token = canonicalPage().tokens[0];
  const rotated = rotateNormalizedToken(token, 90);
  const restored = rotateNormalizedToken(rotated, 270);

  assert.ok(Math.abs(restored.x - token.x) < 1e-12);
  assert.ok(Math.abs(restored.y - token.y) < 1e-12);
  assert.ok(Math.abs(restored.width - token.width) < 1e-12);
  assert.ok(Math.abs(restored.height - token.height) < 1e-12);
  assert.ok([restored.x, restored.y, restored.width, restored.height].every((value) => value >= 0 && value <= 1));
});

