import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeArgentinaLegal } from '../argentinaLegalAnalysis';

test('clasifica contrato argentino y justifica cláusulas concretas', () => {
  const result = analyzeArgentinaLegal('Contrato argentino. El proveedor podrá modificar unilateralmente el precio sin aviso. Renovación automática. Penalidad de $100.000.');
  assert.equal(result.area, 'contracts');
  assert.equal(result.jurisdiction, 'argentina');
  assert.ok(result.issues.some((issue) => issue.id === 'unilateral-change'));
  assert.ok(result.issues.every((issue) => issue.evidence.length > 0));
});

test('una consulta penal no determina delito sin hechos', () => {
  const result = analyzeArgentinaLegal('Según el Código Penal argentino, ¿qué pena tiene un robo?');
  assert.equal(result.area, 'criminal');
  assert.ok(result.factsNeeded.some((item) => /conducta/.test(item)));
  assert.match(result.sourceTargets[0], /Código Penal/);
});

test('divorcio identifica familia y datos relevantes', () => {
  const result = analyzeArgentinaLegal('Quiero iniciar un divorcio en Argentina y tenemos hijos y bienes.');
  assert.equal(result.area, 'family');
  assert.ok(result.sourceTargets.some((item) => /Código Civil y Comercial/));
});

test('no asume Argentina cuando falta jurisdicción', () => {
  const result = analyzeArgentinaLegal('Este contrato permite cancelar sin aviso.');
  assert.equal(result.jurisdiction, 'not-specified');
  assert.match(result.conclusion, /no corresponde aplicar automáticamente/);
});

test('reconoce una consulta coloquial por violación y pide los hechos relevantes', () => {
  const result = analyzeArgentinaLegal('¿Cuántos años de cárcel le dan a un violador?', true);
  assert.equal(result.applicable, true);
  assert.equal(result.jurisdiction, 'argentina');
  assert.equal(result.area, 'criminal');
  assert.ok(result.factsNeeded.some((item) => /edad de la víctima/i.test(item)));
});
