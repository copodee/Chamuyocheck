import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProductScope } from '../productScopeClassifier';

test('acepta créditos y costos financieros', () => {
  const result = classifyProductScope('Me ofrecen un crédito de $500.000 en 12 cuotas con TNA del 90%.');
  assert.equal(result.supported, true);
  assert.equal(result.primaryArea, 'finance-credit');
});

test('acepta posibles estafas e inversiones engañosas', () => {
  const result = classifyProductScope('Me prometen rentabilidad garantizada si incorporo referidos. ¿Puede ser una estafa?');
  assert.equal(result.supported, true);
  assert.equal(result.primaryArea, 'scam-risk');
});

test('acepta derecho argentino, delitos y familia', () => {
  assert.equal(classifyProductScope('¿Qué pena establece el Código Penal argentino para el hurto?').primaryArea, 'argentina-legal-documents');
  assert.equal(classifyProductScope('Necesito revisar un convenio de divorcio y cuota alimentaria.').primaryArea, 'argentina-legal-documents');
});

test('no confunde cargos económicos con una consulta financiera', () => {
  const result = classifyProductScope('El ministro de economía es homosexual.');
  assert.equal(result.supported, false);
});

test('rechaza temas generales y detección concluyente de IA', () => {
  assert.equal(classifyProductScope('Colapinto es un piloto español.').supported, false);
  assert.equal(classifyProductScope('¿Este trabajo de un alumno fue escrito con IA?').supported, false);
});
