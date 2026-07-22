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

test('extracts the values from the ZRV quotation without replacing them with form defaults', () => {
  const quote = `
    Bien a dar en leasing: Honda ZRV TRG
    Valor del bien a dar en leasing (sin IVA): $ 49.578.512
    IVA del bien: $ 10.411.488
    Valor del bien a dar en leasing (IVA incluido): $ 59.990.000
    Plazo del leasing: 36 meses
    Cánones a pagar: 34 cánones fijos de $ 2.392.446 c/u
    Opción de compra del bien: $ 2.392.446 al finalizar el plazo
    Maxicanon/Adelanto: $ 0,00 más IVA
    Cánones en garantía (*): 2, equivalente a $ 4.784.892
    Comisión de estructuración: 4,5% más IVA
    Seguro del bien: A cargo del Tomador, contratado por Finanlease S.A.
  `;
  const result = extractLeasingQuoteData(quote);
  assert.equal(result?.assetValueNet, 49_578_512);
  assert.equal(result?.regularCanonCount, 34);
  assert.equal(result?.regularCanonAmount, 2_392_446);
  assert.equal(result?.optionAmount, 2_392_446);
  assert.equal(result?.guaranteeCanons, 2);
  assert.equal(result?.guaranteeAmount, 4_784_892);
  assert.equal(result?.structuringFeePercent, 4.5);
});

test('extracts the Audi Q5 quotation used as a production regression case', () => {
  const quote = `
    Tomador: El Caqui SAS CUIT 30-71671988-6
    Bien a dar en leasing: Audi Q5 Sportback Sline
    Valor del bien (sin IVA): $ 125.826.000
    IVA del bien: $ 26.423.460
    Valor del bien (IVA incluido): $ 152.249.460
    Plazo del leasing: 36 meses
    Cánones a pagar: 34 cánones fijos de $ 6.060.000 c/u
    Opción de compra del bien: $ 6.060.000
    Maxicanon / Adelanto: $ 0
    Cánones en garantía: 2 cánones por $ 12.120.000
    Comisión de estructuración: 3% + IVA
    Seguro del bien: A cargo del Tomador, contratado por Finanlease S.A.
  `;
  const result = extractLeasingQuoteData(quote);
  assert.equal(result?.assetDescription, 'Audi Q5 Sportback Sline');
  assert.equal(result?.assetValueNet, 125_826_000);
  assert.equal(result?.months, 36);
  assert.equal(result?.regularCanonCount, 34);
  assert.equal(result?.regularCanonAmount, 6_060_000);
  assert.equal(result?.optionAmount, 6_060_000);
  assert.equal(result?.guaranteeAmount, 12_120_000);
  assert.equal(result?.structuringFeePercent, 3);
});
