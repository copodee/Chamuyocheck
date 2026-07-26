import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeInvoiceIncome, analyzeSalaryIncome, extractInvoiceData, extractInvoiceTotal, extractSalaryNetAmount, extractSalaryReceipt } from '../scoring/incomeDocumentExtractor';

test('extrae el neto a cobrar de un recibo de sueldo', () => {
  assert.equal(extractSalaryNetAmount('Haberes 1.800.000,00\nDescuentos 300.000,00\nNeto a cobrar $ 1.500.000,00'), 1_500_000);
});

const salarySlip = (period: string, receipt: string, concepts: string, net: string) => `
Recibo de Sueldo Número: ${receipt}
Período de pago: ${period} Días Trabajo: 30 Fecha: 31/03/2026
Haberes Retenciones
${concepts}
Neto a Cobrar: ${net}`;

test('identifica período, neto y naturaleza de recibos mensuales, retroactivos y SAC', () => {
  assert.equal(extractSalaryReceipt(salarySlip('Marzo de 2026', '791873', '311-SUELDO MENSUAL 1.166.877,57', '1.152.354,12')).kind, 'regular');
  const retro = extractSalaryReceipt(salarySlip('Enero y febrero 2026', '795125', '349-RETRO ENERO/FEB 125.182,00', '101.397,42'));
  assert.equal(retro.kind, 'retroactive');
  assert.deepEqual(retro.periodKeys, ['2026-01', '2026-02']);
  assert.equal(extractSalaryReceipt(salarySlip('SAC 1er semestre 2026', '800000', 'SUELDO ANUAL COMPLEMENTARIO', '575.000,00')).kind, 'sac');
});

test('promedia meses completos, distribuye retroactivos y prorratea el aguinaldo', () => {
  const analysis = analyzeSalaryIncome([
    salarySlip('Febrero de 2026', '787606', '311-SUELDO MENSUAL', '1.056.615,04'),
    salarySlip('Marzo de 2026', '791873', '311-SUELDO MENSUAL', '1.152.354,12'),
    salarySlip('Abril de 2026', '799227', '311-SUELDO MENSUAL', '1.167.511,40'),
    salarySlip('Mayo de 2026', '803514', '311-SUELDO MENSUAL', '1.047.156,76'),
    salarySlip('Enero y febrero 2026', '795125', '349-RETRO ENERO/FEB', '101.397,42'),
    salarySlip('SAC 1er semestre 2026', '810000', 'SUELDO ANUAL COMPLEMENTARIO', '575.000,00'),
  ]);
  assert.equal(analysis.observedRegularMonths, 4);
  assert.equal(Math.round(analysis.monthlyTotals[0].retroactiveNet), 50_699);
  assert.equal(Math.round(analysis.regularMonthlyAverage), 1_118_584);
  assert.equal(Math.round(analysis.sacMonthlyEquivalent), 95_833);
  assert.equal(Math.round(analysis.normalizedMonthlyIncome), 1_214_417);
});

test('extrae el importe total de una factura argentina', () => {
  assert.equal(extractInvoiceTotal('Subtotal $ 450.000,00\nImporte total: $ 544.500,00'), 544_500);
});

const invoice = (number: string, issueDate: string, from: string, total: string) => `
ORIGINAL C FACTURA
Punto de Venta: 00002 Comp. Nro: ${number}
Razón Social: EJEMPLO Fecha de Emisión: ${issueDate}
Domicilio Comercial: CABA - CUIT: 20239694323
Período Facturado Desde: ${from} Hasta:${from}
CUIT: 30700904063 Apellido y Nombre / Razón Social:CLIENTE
Importe Total: $ ${total}
CAE N°: 86084914665280
DUPLICADO C FACTURA
Importe Total: $ ${total}
TRIPLICADO C FACTURA
Importe Total: $ ${total}`;

test('extrae identidad, período e importe una sola vez aunque el PDF tenga triplicado', () => {
  const result = extractInvoiceData(invoice('00000043', '17/12/2025', '01/12/2025', '500000,00'));
  assert.equal(result.issuerCuit, '20239694323');
  assert.equal(result.receiverCuit, '30700904063');
  assert.equal(result.periodKey, '2025-12');
  assert.equal(result.total, 500_000);
  assert.equal(result.uniqueKey, '20239694323-00002-00000043');
});

test('agrupa varias facturas por mes y calcula el promedio documentado', () => {
  const result = analyzeInvoiceIncome([
    invoice('00000043', '17/12/2025', '01/12/2025', '500000,00'),
    invoice('00000044', '17/12/2025', '01/12/2025', '1850000,00'),
    invoice('00000045', '07/01/2026', '16/12/2025', '600000,00'),
    invoice('00000046', '19/01/2026', '02/01/2026', '500000,00'),
    invoice('00000047', '28/01/2026', '01/01/2026', '1950000,00'),
    invoice('00000048', '05/02/2026', '05/02/2026', '500000,00'),
    invoice('00000049', '23/02/2026', '02/02/2026', '1950000,00'),
  ]);
  assert.deepEqual(result.monthlyTotals.map(month => month.total), [2_950_000, 2_450_000, 2_450_000]);
  assert.equal(Math.round(result.averageMonthlyIncome), 2_616_667);
});

test('descarta un comprobante repetido por CUIT, punto de venta y número', () => {
  const same = invoice('00000043', '17/12/2025', '01/12/2025', '500000,00');
  const result = analyzeInvoiceIncome([same, same]);
  assert.equal(result.invoices.length, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.monthlyTotals[0].total, 500_000);
});
