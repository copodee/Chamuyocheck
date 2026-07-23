import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructPdfText } from '../browserPdfOcr';

test('reconstructs PDF columns into visual rows before financial extraction', () => {
  const items = [
    { str: '$ 125.826.000', transform: [1, 0, 0, 1, 420, 700], height: 10 },
    { str: '36 meses', transform: [1, 0, 0, 1, 420, 680], height: 10 },
    { str: 'Valor del bien a dar en leasing (sin IVA):', transform: [1, 0, 0, 1, 70, 700], height: 10 },
    { str: 'Plazo del leasing:', transform: [1, 0, 0, 1, 70, 680], height: 10 },
  ];

  assert.equal(
    reconstructPdfText(items),
    'Valor del bien a dar en leasing (sin IVA): $ 125.826.000\nPlazo del leasing: 36 meses',
  );
});
