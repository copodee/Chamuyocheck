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
  assert.ok(result.missingFields.some((field) => /CFT.*datos suficientes/i.test(field)));
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
  assert.ok(Math.abs((result.impliedMonthlyRatePercent || 0) - 13.2806) < 0.001);
  assert.ok(Math.abs((result.impliedTnaPercent || 0) - 159.3672) < 0.001);
  assert.ok(Math.abs((result.impliedTeaPercent || 0) - 346.5463) < 0.001);
  assert.equal(result.missingFields.length, 0);
  assert.match(result.calculationBasis.join(' '), /TNA estimada: 159\.37%.*TEA estimada: 346\.55%/i);
  assert.match(result.warnings.join(' '), /no muestra un CFT oficial.*tasa implícita/i);
});

test('prioriza el plazo pedido por el usuario cuando el OCR separa plazos e importes', () => {
  const ocr = `Simulá la cuota de tu Préstamo
Elegí el monto de tu Préstamo
Ingresá el monto en miles. Caso contrario se redondeará automáticamente.
$ 1.007.000
¿En cuántas cuotas querés pagarlo?
12 cuotas de 24 cuotas de 36 cuotas de 48 cuotas de
$130.381* $100.553+* $106.213+* $107.037*`;
  const result = extractLoanNumbers(ocr, 'Necesito saber el CFT y la TNA para 36 meses.');
  assert.equal(result.principal, 1_007_000);
  assert.equal(result.months, 36);
  assert.equal(result.installment, 106_213);
  assert.equal(result.scenarios.length, 4);
  assert.equal(result.scenarios.find((scenario) => scenario.selected)?.months, 36);
  assert.equal(result.calculatedInstallmentsTotal, 3_823_668);
  assert.equal(result.financingCost, 2_816_668);
  assert.equal(result.missingFields.length, 0);
  assert.match(result.selectedScenarioReason || '', /priorizó la instrucción.*36 meses/i);
  assert.match(result.calculationBasis.join(' '), /CFT visible estimado/i);
});
