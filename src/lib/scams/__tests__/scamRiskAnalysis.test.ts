import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeScamRisk } from '../scamRiskAnalysis';

test('detecta anticipo, urgencia y canal difícil de revertir', () => {
  const result = analyzeScamRisk('Ganaste un préstamo. Transferí USDT ahora mismo para liberar los fondos y pagar el seguro previo.');
  assert.equal(result.applicable, true);
  assert.ok(result.score >= 60);
  assert.ok(result.signals.some((signal) => signal.id === 'advance-fee'));
  assert.ok(result.signals.some((signal) => signal.id === 'urgency'));
});

test('detecta rentabilidad garantizada y referidos sin declarar delito', () => {
  const result = analyzeScamRisk('Inversión con rentabilidad garantizada sin riesgo. Ganás más incorporando cinco referidos.');
  assert.ok(result.score >= 45);
  assert.match(result.conclusion, /No prueban por sí solas una estafa o un delito/);
});

test('una oferta bancaria ordinaria no recibe señales falsas', () => {
  const result = analyzeScamRisk('Banco X ofrece un préstamo de $1.000.000 en 12 cuotas con CFT informado en el contrato.');
  assert.equal(result.applicable, true);
  assert.equal(result.signals.length, 0);
  assert.equal(result.score, 0);
});

test('mencionar home banking y token como requisitos del banco no simula un pedido de claves', () => {
  const result = analyzeScamRisk('Pedilo por Home Banking BIP. Para operar necesitás tener activo el Token de Seguridad.');
  assert.equal(result.signals.some((signal) => signal.id === 'credential-request'), false);
});

test('un pedido concreto de compartir el token sí dispara la alerta', () => {
  const result = analyzeScamRisk('Pasame tu token de seguridad para habilitar el préstamo.');
  assert.equal(result.signals.some((signal) => signal.id === 'credential-request'), true);
});
