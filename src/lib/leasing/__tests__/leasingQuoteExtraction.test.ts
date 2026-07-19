import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLeasingQuoteData } from '../leasingQuoteExtraction';

test('extracts the commercial fields from an Argentine leasing quote', () => {
  const quote = `
    Bien a dar en leasing: Honda HRV EXL
    Valor del bien (sin IVA): $ 42.347.107
    IVA del bien: $ 8.892.893
    Valor del bien (IVA incluido): $ 51.240.000
    Plazo del leasing: 36 meses
    Cánones a pagar: 34 cánones de $ 2.044.542
    Opción de compra al finalizar: $ 2.044.542
    Maxicanon / Adelanto: $ 0 + IVA
    Cánones en garantía: 2 cánones por $ 4.089.084
    Comisión de estructuración: 4,5% + IVA
    Seguro del bien: A cargo del Tomador, contratado por Finanlease S.A.
  `;
  assert.deepEqual(extractLeasingQuoteData(quote), {
    assetDescription: 'Honda HRV EXL',
    assetValueNet: 42_347_107,
    vatAmount: 8_892_893,
    assetValueVatIncluded: 51_240_000,
    months: 36,
    regularCanonCount: 34,
    regularCanonAmount: 2_044_542,
    optionAmount: 2_044_542,
    maxiCanonAmount: 0,
    guaranteeCanons: 2,
    guaranteeAmount: 4_089_084,
    structuringFeePercent: 4.5,
    insuranceText: 'A cargo del Tomador, contratado por Finanlease S.A.',
  });
});
