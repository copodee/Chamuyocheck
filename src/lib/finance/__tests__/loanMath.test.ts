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

test('estima el costo ajustado cuando informan capital, TNA, plazo y comisión inicial', () => {
  const result = extractLoanNumbers('Me quieren prestar 1.000.000 de dólares a 36 meses. Me dicen que la TNA es 30% pero me piden el 3% de comisión al inicio. ¿Cuánto sería la TNA real que pago en 36 meses?');
  assert.equal(result.currency, 'USD');
  assert.equal(result.principal, 1_000_000);
  assert.equal(result.months, 36);
  assert.equal(result.tnaPercent, 30);
  assert.equal(result.upfrontFeePercent, 3);
  assert.equal(result.upfrontFeeAmount, 30_000);
  assert.equal(result.netDisbursement, 970_000);
  assert.equal(result.installmentEstimated, true);
  assert.equal(result.amortizationSystem, 'french');
  assert.equal(result.paymentPeriod, 'monthly');
  assert.equal(result.paymentTiming, 'arrears');
  assert.ok(Math.abs((result.installment || 0) - 42_451.5767) < 0.01);
  assert.ok(Math.abs((result.impliedTnaPercent || 0) - 32.3780) < 0.001);
  assert.ok(Math.abs((result.impliedTeaPercent || 0) - 37.6425) < 0.001);
  assert.equal(result.missingFields.length, 0);
  assert.match(result.warnings.join(' '), /sistema francés/i);
  assert.match(result.calculationBasis.join(' '), /desembolso neto económico/i);
});

test('respeta el sistema alemán pedido y calcula cuotas mensuales vencidas decrecientes', () => {
  const result = extractLoanNumbers(
    'Me quieren prestar 1.000.000 de dólares a 36 meses. La TNA es 30% y cobran 3% de comisión al inicio.',
    'Calcular con sistema alemán.',
  );
  assert.equal(result.amortizationSystem, 'german');
  assert.equal(result.paymentPeriod, 'monthly');
  assert.equal(result.paymentTiming, 'arrears');
  assert.ok(Math.abs((result.firstInstallment || 0) - 52_777.7778) < 0.01);
  assert.ok(Math.abs((result.lastInstallment || 0) - 28_472.2222) < 0.01);
  assert.ok(Math.abs((result.calculatedInstallmentsTotal || 0) - 1_462_500) < 0.01);
  assert.ok((result.impliedTnaPercent || 0) > 32);
  assert.match(result.warnings.join(' '), /sistema alemán.*cuotas.*decrecientes/i);
});

test('calcula una cuota francesa cuando el capital se expresa como 1M', () => {
  const result = extractLoanNumbers('Cuanto pago de cuota si me prestan 1M de pesos en 12 meses al 30% TNA');
  assert.equal(result.principal, 1_000_000);
  assert.equal(result.months, 12);
  assert.equal(result.tnaPercent, 30);
  assert.equal(result.amortizationSystem, 'french');
  assert.equal(result.installmentEstimated, true);
  assert.ok(Math.abs((result.installment || 0) - 97_487.1270) < 0.01);
  assert.ok(Math.abs((result.calculatedInstallmentsTotal || 0) - 1_169_845.5239) < 0.02);
  assert.equal(result.missingFields.length, 0);
});

test('comprende magnitudes monetarias escritas en millones y miles', () => {
  const millions = extractLoanNumbers('Me prestan 1,5 millones de pesos a 24 meses con TNA 40%.');
  const thousands = extractLoanNumbers('Me prestan 500k pesos a 12 meses con TNA 25%.');
  assert.equal(millions.principal, 1_500_000);
  assert.equal(thousands.principal, 500_000);
  assert.ok((millions.installment || 0) > 0);
  assert.ok((thousands.installment || 0) > 0);
});

test('calcula un préstamo genérico informado con TEA sin depender de la consulta anterior', () => {
  const result = extractLoanNumbers('15000000 pesos en 24 cuotas con TEA 30%');

  assert.equal(result.principal, 15_000_000);
  assert.equal(result.months, 24);
  assert.equal(result.teaPercent, 30);
  assert.equal(result.tnaPercent, null);
  assert.ok(result.installment !== null);
  assert.ok(Math.abs(result.installment - 812_098.293548) < 0.01);
  assert.ok(result.calculatedInstallmentsTotal !== null);
  assert.ok(Math.abs(result.calculatedInstallmentsTotal - 19_490_359.045153) < 0.02);
  assert.deepEqual(result.missingFields, []);
});

test('separa capital, plazo y cuota en una oferta redactada libremente', () => {
  const result = extractLoanNumbers(
    'me ofrecen 10000000 de pesos a devolver en 12 cuotas mensuales de 1500000. que tasa de interes pago?',
  );

  assert.equal(result.principal, 10_000_000);
  assert.equal(result.months, 12);
  assert.equal(result.installment, 1_500_000);
  assert.equal(result.calculatedInstallmentsTotal, 18_000_000);
  assert.equal(result.financingCost, 8_000_000);
  assert.equal(result.financingCostPercent, 80);
  assert.ok(result.impliedTnaPercent !== null);
  assert.ok(result.impliedTeaPercent !== null);
  assert.deepEqual(result.missingFields, []);
});

test('asigna roles financieros por contexto y no por la posicion del numero', () => {
  const variants = [
    'Me dan $10.000.000 y pago 12 cuotas de $1.500.000',
    'Recibo 10 millones de pesos; son 12 pagos mensuales de 1,5 millones',
  ];

  for (const text of variants) {
    const result = extractLoanNumbers(text);
    assert.equal(result.principal, 10_000_000);
    assert.equal(result.months, 12);
    assert.equal(result.installment, 1_500_000);
    assert.deepEqual(result.missingFields, []);
  }
});

test('distingue TNA, TEA y CFT y acepta 1Mde sin espacio', () => {
  const tna = extractLoanNumbers('Cuanto pago si me prestan 1Mde pesos en 12 cuotas con TNA 30%');
  const tea = extractLoanNumbers('Cuanto pago si me prestan 1Mde pesos en 12 cuotas con TEA 30%');
  const cft = extractLoanNumbers('Cuanto pago si me prestan 1Mde pesos en 12 cuotas con CFT 30%');

  for (const result of [tna, tea, cft]) {
    assert.equal(result.principal, 1_000_000);
    assert.equal(result.months, 12);
    assert.equal(result.installmentEstimated, true);
    assert.deepEqual(result.missingFields, []);
  }

  assert.equal(tna.tnaPercent, 30);
  assert.equal(tna.teaPercent, null);
  assert.equal(tna.cftPercent, null);
  assert.equal(tea.tnaPercent, null);
  assert.equal(tea.teaPercent, 30);
  assert.equal(tea.cftPercent, null);
  assert.equal(cft.tnaPercent, null);
  assert.equal(cft.teaPercent, null);
  assert.equal(cft.cftPercent, 30);
});
