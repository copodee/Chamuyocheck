import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLeasingTransparencyEvidence, calculateLeasingTransparencyScore } from '../leasingTransparencyScore';

test('LeasingScoring rewards financial transparency instead of measuring chamuyo', () => {
  const complete = calculateLeasingTransparencyScore('Dador Banco, tomador Empresa. Bien automotor marca y modelo. Valor neto sin IVA 100 e IVA 21. Financiado 100%. Plazo 36 meses. 34 cánones fijos de $10. TNA 40%, TEA 48%, CFTEA 55%. Opción de compra 5%. Comisión de estructuración 4,5%. Seguro y mantenimiento informados. Dos cánones en garantía que se aplican al final. Sellos e impuestos discriminados. Registración y jurisdicción informadas.');
  const incomplete = calculateLeasingTransparencyScore('Me ofrecen un leasing de un auto.');
  assert.ok(complete.score >= 85);
  assert.ok(incomplete.score < 30);
  assert.ok(incomplete.missing.includes('CFTEA o costo financiero total'));
});

test('LeasingScoring only counts evidence actually supplied by the user or document', () => {
  const evidence = buildLeasingTransparencyEvidence({
    userText: 'Quiero analizar un leasing para una máquina.',
    manualFields: { assetValue: '', financedPercent: '', months: '', option: '' },
  });
  const result = calculateLeasingTransparencyScore(evidence);
  assert.equal(result.present.includes('TNA informada'), false);
  assert.equal(result.present.includes('Plazo y periodicidad'), false);
  assert.equal(result.present.includes('Opción de compra cuantificada'), false);
});

test('document evidence and confirmed form fields are combined without invented defaults', () => {
  const evidence = buildLeasingTransparencyEvidence({
    documentText: 'Cotización: TNA 42%, TEA 51% y CFTEA 63%.',
    userText: 'El tomador es una empresa y el dador es un banco.',
    manualFields: { months: '36', option: '5%', jurisdiction: 'Buenos Aires' },
  });
  const result = calculateLeasingTransparencyScore(evidence);
  assert.ok(result.present.includes('TNA informada'));
  assert.ok(result.present.includes('TEA informada'));
  assert.ok(result.present.includes('CFTEA o costo financiero total'));
  assert.ok(result.present.includes('Plazo y periodicidad'));
  assert.ok(result.present.includes('Opción de compra cuantificada'));
  assert.ok(result.present.includes('Registro, jurisdicción y gastos de transferencia'));
});

test('a detailed commercial quote is not scored as insufficient merely because rates are absent', () => {
  const quote = `Tomador El Caqui SAS, CUIT 30-71671988-6. Finanlease S.A. Bien a dar en leasing: Audi Q5 Sportback Sline.
  Valor del bien sin IVA $125.826.000; IVA $26.423.460. Plazo 36 meses. 34 cánones fijos de $6.060.000.
  Opción de compra $6.060.000. Maxicanon $0. Dos cánones en garantía por $12.120.000.
  Comisión de estructuración 3% más IVA. Seguro del bien a cargo del Tomador, contratado por Finanlease S.A.
  Sellos, Ingresos Brutos, patente, registración y gastos de transferencia discriminados.`;
  const result = calculateLeasingTransparencyScore(quote);
  assert.ok(result.score >= 60, `score inesperadamente bajo: ${result.score}`);
  assert.ok(result.present.includes('Identificación del dador y del tomador'));
  assert.ok(result.present.includes('Seguro y mantenimiento'));
  assert.ok(result.missing.includes('CFTEA o costo financiero total'));
});
