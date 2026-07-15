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

test('limpia enlaces publicitarios extensos de todos los hallazgos', () => {
  const url = 'https://lpa.web-crewsstats.com/ifwv_v_3_es_lp_wcs/?subc=abc123&site_domain=taboolanews.com&thumbnail=https%25253A%25252F%25252Fcdn.example.com%25252Fimage.png&title=La+IA+que+hace+dinero%25253A+ganancias+autom%C3%A1ticas&campaign_id=48799180&campaign_name=ARG_AI';
  const result = analyzeScamRisk(`${url}\nQuiero saber si esta propuesta de autotrading es real o scam.`);
  const evidence = result.signals.map((signal) => signal.evidence).join(' ');
  assert.ok(result.signals.some((signal) => signal.id === 'advertising-landing-link'));
  assert.ok(result.signals.some((signal) => signal.id === 'automated-money-claim'));
  assert.match(evidence, /web-crewsstats\.com|Promesa publicitaria/i);
  assert.doesNotMatch(evidence, /campaign_id=|thumbnail=|subc=|%2525|https?:\/\/[^\s]+\?/i);
  assert.ok(result.signals.every((signal) => signal.evidence.length <= 240));
});

test('revisa la estructura de una URL con criterios transparentes de seguridad', () => {
  const result = analyzeScamRisk('http://usuario@xn--bcher-kva.top:8080/login/verificar?campaign_id=1');
  const ids = result.signals.map((signal) => signal.id);
  assert.ok(ids.includes('url-insecure-http'));
  assert.ok(ids.includes('url-embedded-credentials'));
  assert.ok(ids.includes('url-punycode'));
  assert.ok(ids.includes('url-unusual-tld'));
  assert.ok(ids.includes('url-unusual-port'));
  assert.ok(ids.includes('url-sensitive-action'));
  assert.equal(result.level, 'muy-alto');
});
