import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLeasingQuoteData } from '../leasingQuoteExtraction';

test('extrae una consulta libre con precio, maxi canon ambiguo, cuotas y opción porcentual', () => {
  const result = extractLeasingQuoteData('Voy a comprar un auto BYD Dolphin que vale 35000000 de pesos. Pongo 10$ de maxicanon y el resto en 36 cuotas de 1500000 de pesos. La 37 es la opción de compra de un 3%. ¿Cuál es la tasa que pago?');
  assert.ok(result);
  assert.equal(result.assetValueNet, 35_000_000);
  assert.equal(result.months, 36);
  assert.equal(result.regularCanonCount, 36);
  assert.equal(result.regularCanonAmount, 1_500_000);
  assert.equal(result.maxiCanonAmount, 3_500_000);
  assert.equal(result.optionAmount, 1_050_000);
  assert.equal(result.ambiguousMaxiCanonSymbol, true);
});

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
    quoteDateText: undefined,
    customerName: undefined,
    customerTaxId: undefined,
    assetDescription: 'Honda HRV EXL',
    assetValueNet: 42_347_107,
    vatAmount: 8_892_893,
    freightAmount: undefined,
    freightVatAmount: undefined,
    assetValueVatIncluded: 51_240_000,
    currency: undefined,
    exchangeRate: undefined,
    months: 36,
    regularCanonCount: 34,
    regularCanonAmount: 2_044_542,
    optionAmount: 2_044_542,
    maxiCanonAmount: 0,
    guaranteeCanons: 2,
    guaranteeAmount: 4_089_084,
    structuringFeePercent: 4.5,
    insuranceText: 'A cargo del Tomador, contratado por Finanlease S.A.',
    assetRegistrationCost: undefined,
    contractRegistrationCost: undefined,
    advanceDisbursementCost: undefined,
    cancellationAdministrativeFee: undefined,
    quotedIncomeTaxSavingsLeasing: undefined,
    quotedVatInitialLeasing: undefined,
    claimedStampPatentExempt: undefined,
    claimedStampContractExempt: undefined,
    quoteValidityDays: undefined,
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

test('extracts quantified registration, disbursement and contingent costs', () => {
  const result = extractLeasingQuoteData(`
    Valor del bien (sin IVA): $ 125.826.000
    Plazo del leasing: 36 meses
    Inscripcion registral del bien - Patentamiento: $1.658.495
    Inscripcion registral del contrato: $360.160
    Costo financiero diario por desembolso anticipado: $138.022
    cargo administrativo de $ 200.000 + IVA
  `);

  assert.equal(result?.assetRegistrationCost, 1_658_495);
  assert.equal(result?.contractRegistrationCost, 360_160);
  assert.equal(result?.advanceDisbursementCost, 138_022);
  assert.equal(result?.cancellationAdministrativeFee, 200_000);
});

test('extracts every quantified field from the visual rows of the real Audi Q5 PDF', () => {
  const result = extractLeasingQuoteData(`
    COTIZACIÓN DE OPERACIÓN DE LEASING FINANCIERO EN PESOS Beccar, martes, 21 de julio de 2026
    Tomador del leasing: El Caqui SAS
    CUIT: 30-71671988-6
    Bien a dar en leasing: Audi Q5 Sportback Sline
    Valor del bien a dar en leasing (sin IVA): $ 125.826.000
    IVA del bien: $ 26.423.460
    Fletes, formularios, etc.: $ 0
    IVA fletes, formularios, etc.: $ 0
    Valor del bien a dar en leasing (IVA incluido): $ 152.249.460
    Tipo de cambio: $1.500
    Moneda del leasing: Pesos
    Plazo del leasing: 36 meses
    Cánones a pagar: 34 cánones fijos de $ 6.060.000 c/u
    Opción de compra del bien: $ 6.060.000 al finalizar el plazo del Leasing
    Maxicanon/Adelanto: $ 0,00 más IVA
    Cánones en garantía (*): 2, equivalente a $ 12.120.000
    Comisión de estructuración: 3% más IVA
    Seguro del bien: A cargo del Tomador, contratado por Finanlease S.A.
    Ganancias: Ahorro de $8.807.820 por año Ahorro de $16.473.383 por año Ahorro de $25.452.000 por año
    IVA (inmovilización por crédito al inicio): $ 26.423.460 $ 26.423.460 $ 1.412.586
    Patentamiento: Costo inicial de: $1.522.495 Costo inicial de: $1.522.495 Exento
    Contrato: No aplica Costo inicial de: $2.181.600 Exento
    Inscripción registral del bien - Patentamiento (**): $1.658.495
    Inscripción registral del contrato (**): $360.160
    Costo financiero diario por desembolso anticipado: $138.022
    La presente cotización tiene una validez de 15 días corridos.
    cargo administrativo de $ 200.000 + IVA.
  `);

  assert.equal(result?.quoteDateText, 'martes, 21 de julio de 2026');
  assert.equal(result?.customerName, 'El Caqui SAS');
  assert.equal(result?.customerTaxId, '30-71671988-6');
  assert.equal(result?.assetDescription, 'Audi Q5 Sportback Sline');
  assert.equal(result?.assetValueNet, 125_826_000);
  assert.equal(result?.vatAmount, 26_423_460);
  assert.equal(result?.freightAmount, 0);
  assert.equal(result?.freightVatAmount, 0);
  assert.equal(result?.assetValueVatIncluded, 152_249_460);
  assert.equal(result?.currency, 'Pesos');
  assert.equal(result?.exchangeRate, 1_500);
  assert.equal(result?.months, 36);
  assert.equal(result?.regularCanonCount, 34);
  assert.equal(result?.regularCanonAmount, 6_060_000);
  assert.equal(result?.optionAmount, 6_060_000);
  assert.equal(result?.maxiCanonAmount, 0);
  assert.equal(result?.guaranteeCanons, 2);
  assert.equal(result?.guaranteeAmount, 12_120_000);
  assert.equal(result?.structuringFeePercent, 3);
  assert.equal(result?.assetRegistrationCost, 1_658_495);
  assert.equal(result?.contractRegistrationCost, 360_160);
  assert.equal(result?.advanceDisbursementCost, 138_022);
  assert.equal(result?.cancellationAdministrativeFee, 200_000);
  assert.equal(result?.quotedIncomeTaxSavingsLeasing, 25_452_000);
  assert.equal(result?.quotedVatInitialLeasing, 1_412_586);
  assert.equal(result?.claimedStampPatentExempt, true);
  assert.equal(result?.claimedStampContractExempt, true);
  assert.equal(result?.quoteValidityDays, 15);
});
