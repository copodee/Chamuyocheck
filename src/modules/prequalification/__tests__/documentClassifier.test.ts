import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPrequalificationDocument } from '../scoring/documentClassifier';
import { latestSixMonthlySales } from '../scoring/fiscalDocumentExtractor';

const base = { profile: 'legal-entity' as const, targetCuit: '30716790203', usedKinds: new Set<string>() };

test('clasifica el lote societario por finalidad y etapa', () => {
  assert.equal(classifyPrequalificationDocument({ ...base, fileName: 'EECC 30.06.2025 Legalizado.pdf', extractedText: '' }).kind, 'balance-1');
  assert.equal(classifyPrequalificationDocument({ ...base, fileName: 'Acta Asamblea Designación de Autoridades.pdf', extractedText: '' }).stage, 3);
  assert.equal(classifyPrequalificationDocument({ ...base, fileName: 'DJ F.2051 022026.pdf', extractedText: '' }).kind, 'post-balance-sales');
  assert.equal(classifyPrequalificationDocument({ ...base, fileName: 'F713ddjj2025.pdf', extractedText: '' }).kind, 'corporate-income-tax');
});

test('reconoce las notas como complemento del balance', () => {
  const result = classifyPrequalificationDocument({
    ...base,
    fileName: '2- NOTAS siete puntas 2025.pdf',
    extractedText: 'NOTAS A LOS ESTADOS CONTABLES. Criterios de valuación y composición de los rubros.',
  });
  assert.equal(result.kind, 'balance-notes');
  assert.equal(result.stage, 2);
});

test('prioriza un EECC completo aunque incluya sus propias notas', () => {
  const result = classifyPrequalificationDocument({
    ...base,
    fileName: 'EECC 30.06.2025 GRUPO LORASCHI BATALLA Legalizado.pdf',
    extractedText: 'MEMORIA Y ESTADOS CONTABLES. Estado de situación patrimonial. Estado de resultados. Notas a los estados contables.',
  });
  assert.equal(result.kind, 'balance-1');
  assert.equal(result.stage, 2);
});

test('reconoce el lote económico real de GLB sin pedir nuevamente sus cuatro grupos', () => {
  const usedKinds = new Set<string>();
  const classify = (fileName: string, extractedText = '') => {
    const result = classifyPrequalificationDocument({ ...base, fileName, extractedText, usedKinds });
    usedKinds.add(result.kind);
    return result.kind;
  };
  assert.equal(classify(
    'EECC 30.06.2025 GRUPO LORASCHI BATALLA Legalizado.pdf',
    'MEMORIA Y ESTADOS CONTABLES. Estado de situación patrimonial. Estado de resultados. Notas a los estados contables.',
  ), 'balance-1');
  assert.equal(classify('EECC_30716790203_2024.pdf'), 'balance-2');
  assert.equal(classify('Ventas -2024-2026 - GLB.pdf', 'DETALLE DE VENTAS. Periodo Ventas Netas IVA Ventas Totales'), 'post-balance-sales');
  assert.equal(classify('Detalle de deuda - Grupo Loraschi Batalla.pdf'), 'financial-debt');
});

test('separa una cotización de leasing de los estados contables', () => {
  const result = classifyPrequalificationDocument({
    ...base,
    fileName: 'EL CAQUI SAS.pdf',
    extractedText: 'MOTOR LEASING COTIZACIÓN. Canon inicial. 35 cánones fijos mensuales. Opción de compra.',
  });
  assert.equal(result.kind, 'leasing-quotation');
  assert.equal(result.stage, 2);
});

test('pone en revisión documentos pertenecientes a otro CUIT', () => {
  const result = classifyPrequalificationDocument({ ...base, fileName: 'afip_cuit_30717339963_f2051.pdf', extractedText: '' });
  assert.equal(result.action, 'review');
  assert.equal(result.kind, 'different-subject');
});

test('descarta listas de requisitos que no acreditan información del cliente', () => {
  const result = classifyPrequalificationDocument({ ...base, fileName: 'Requisitos - Personas Fisicas.pdf', extractedText: '' });
  assert.equal(result.action, 'discard');
});

test('extrae los seis meses más recientes de ventas netas', () => {
  const text = 'dic-25 71.846.457,29 15.087.756,03 86.934.213,32 ene-26 102.065.352,00 21.433.723,92 123.499.075,92 feb-26 84.007.775,19 17.641.632,79 101.649.407,98 mar-26 102.038.977,38 21.428.185,25 123.467.162,63 abr-26 27.887.516,81 5.856.378,53 33.743.895,34 may-26 206.653.141,52 43.397.159,72 250.050.301,24';
  assert.deepEqual(latestSixMonthlySales(text), [71846457.29, 102065352, 84007775.19, 102038977.38, 27887516.81, 206653141.52]);
});
