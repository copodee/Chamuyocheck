import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLeasingTransparencyEvidence, calculateLeasingTransparencyScore } from '../leasingTransparencyScore';

test('LeasingScore rewards financial transparency instead of measuring chamuyo', () => {
  const complete = calculateLeasingTransparencyScore('Dador Banco, tomador Empresa. Bien automotor marca y modelo. Valor neto sin IVA 100 e IVA 21. Financiado 100%. Plazo 36 meses. 34 cánones fijos de $10. TNA 40%, TEA 48%, CFTEA 55%. Opción de compra 5%. Comisión de estructuración 4,5%. Seguro y mantenimiento informados. Dos cánones en garantía que se aplican al final. Sellos e impuestos discriminados. Registración y jurisdicción informadas.');
  const incomplete = calculateLeasingTransparencyScore('Me ofrecen un leasing de un auto.');
  assert.ok(complete.score >= 85);
  assert.ok(incomplete.score < 30);
  assert.ok(incomplete.missing.includes('CFTEA o costo financiero total'));
});

test('LeasingScore only counts evidence actually supplied by the user or document', () => {
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
