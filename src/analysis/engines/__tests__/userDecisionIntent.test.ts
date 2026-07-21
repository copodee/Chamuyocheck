import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUserDecisionIntent } from '../userDecisionIntent';

for (const phrase of [
  '¿Son auténticas las compañías que aparecen en esta nota?',
  'Quiero saber si el operador está habilitado y quién está detrás.',
  '¿Esta plataforma existe o es un fraude?',
  'Comprobá si www.ejemplo.com está registrado y es confiable.',
  'Me nombraron tres proptech, ¿operan realmente?',
]) test(`detecta verificación de identidad: ${phrase}`, () => {
  assert.equal(classifyUserDecisionIntent(phrase).primary, 'identity-legitimacy');
});

for (const phrase of [
  '¿Se puede estructurar esta inversión?',
  '¿Sería legalmente posible tokenizar el inmueble?',
  'Quiero saber si el modelo de crowdfunding puede funcionar.',
  '¿Resulta viable usar un fideicomiso para estas participaciones?',
]) test(`detecta factibilidad: ${phrase}`, () => {
  assert.equal(classifyUserDecisionIntent(phrase, 'Tokenización inmobiliaria mediante fideicomiso.').primary, 'feasibility');
});

test('no confunde cálculo de retorno con identidad', () => {
  assert.equal(classifyUserDecisionIntent('Calculá la TIR y el rendimiento anual con estos importes.').primary, 'economics-calculation');
});

test('no confunde comparación de instrumentos con estafa', () => {
  assert.equal(classifyUserDecisionIntent('Compará esta inversión con un plazo fijo y decime cuál conviene.').primary, 'comparison');
});
