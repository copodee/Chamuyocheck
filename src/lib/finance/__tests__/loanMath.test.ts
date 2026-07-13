import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLoanNumbers } from '../loanMath';

test('lee siglas bancarias argentinas con puntos y tasa vencida', () => {
  const result = extractLoanNumbers('CFTEAV: 155,10%. TASA NOMINAL ANUAL VENCIDA (T.N.A.V.) FIJA 97,40%, TASA EFECTIVA ANUAL VENCIDA (T.E.A.V.) 155,10%. Otro perfil: CFTEAV 159,14%. TASAS VIGENTES DEL 09/06/2026 AL 30/06/2026. SEGURO DE VIDA: SIN COSTO. LA PRIMERA CUOTA VENCERÁ EL MES SIGUIENTE.');
  assert.equal(result.tnaPercent, 97.4);
  assert.equal(result.teaPercent, 155.1);
  assert.equal(result.cftPercent, 155.1);
  assert.match(result.warnings.join(' '), /más de una tasa o CFT/i);
  assert.match(result.warnings.join(' '), /vigencia hasta el 30\/06\/2026/i);
  assert.doesNotMatch(result.warnings.join(' '), /seguro.*importe/i);
  assert.doesNotMatch(result.warnings.join(' '), /cuota publicada corresponde/i);
});

test('calcula el costo conocido de un préstamo bancario', () => {
  const result = extractLoanNumbers('Monto del préstamo: $1.000.000. Plazo: 12 cuotas. Valor de cuota: $120.000. TNA: 75%. TEA: 106,99%. CFT: 140%.');
  assert.equal(result.principal, 1_000_000);
  assert.equal(result.installment, 120_000);
  assert.equal(result.months, 12);
  assert.equal(result.calculatedInstallmentsTotal, 1_440_000);
  assert.equal(result.financingCost, 440_000);
  assert.equal(result.confidence, 'alta');
});

test('calcula financiación automotor con anticipo', () => {
  const result = extractLoanNumbers('Precio de contado: $20.000.000. Anticipo: $8.000.000. Monto financiado: $12.000.000. En 24 cuotas de $850.000. CFT 82,5%.');
  assert.equal(result.cashPrice, 20_000_000);
  assert.equal(result.downPayment, 8_000_000);
  assert.equal(result.principal, 12_000_000);
  assert.equal(result.calculatedKnownTotal, 28_400_000);
  assert.equal(result.financingCost, 8_400_000);
});

test('no inventa costos cuando faltan datos esenciales', () => {
  const result = extractLoanNumbers('Crédito para tu auto con tasa conveniente. Consultá condiciones.');
  assert.equal(result.calculatedKnownTotal, null);
  assert.equal(result.confidence, 'baja');
  assert.ok(result.missingFields.includes('CFT'));
});

test('extrae un ejemplo bancario aunque la primera cuota tenga una aclaración', () => {
  const result = extractLoanNumbers('CFTEA: 323%. Tasa Nominal Anual: 129%. TEA: 240,51%. EJEMPLO PARA UN PRÉSTAMO PERSONAL DE $100.000 EN 72 MESES. CUOTA TOTAL (CALCULADA PARA UN PRIMER PERIODO DE 31 DÍAS) $13.113,03.');
  assert.equal(result.principal, 100_000);
  assert.equal(result.installment, 13_113.03);
  assert.equal(result.months, 72);
  assert.equal(result.tnaPercent, 129);
  assert.equal(result.teaPercent, 240.51);
  assert.equal(result.cftPercent, 323);
});

test('calcula una simulación leída por OCR aunque separe los centavos', () => {
  const result = extractLoanNumbers('Importe a solicitar $ 1.000.000. 18 cuotas de $ 148.548, 30 por mes.');
  assert.equal(result.principal, 1_000_000);
  assert.equal(result.installment, 148_548.30);
  assert.equal(result.months, 18);
  assert.equal(result.calculatedInstallmentsTotal, 2_673_869.4);
  assert.equal(result.financingCost, 1_673_869.4);
});
