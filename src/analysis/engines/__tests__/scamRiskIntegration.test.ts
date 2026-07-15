import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalAnalysis, normalizeAI } from '../../../../app/api/analyze/route';

test('el análisis principal expone señales justificadas de posible estafa', () => {
  const result = buildLocalAnalysis(
    'Inversión con ganancia garantizada sin riesgo. Transferí USDT ahora mismo y sumá referidos.',
    'Texto',
    '',
    null,
  );
  assert.ok(result.scamRiskAnalysis.score >= 50);
  assert.ok(result.scamRiskAnalysis.signals.length >= 3);
  assert.ok(result.evidenceFound.some((item) => /Señal observable/.test(item)));
  assert.match(result.scamRiskAnalysis.conclusion, /No prueban por sí solas/);
});

test('la normalización no puede borrar señales locales de posible estafa', () => {
  const fallback = buildLocalAnalysis('Ganancia garantizada sin riesgo; pagá para liberar el premio.', 'Texto', '', null);
  const normalized = normalizeAI({ scamRiskAnalysis: null, score: 0 }, fallback);
  assert.deepEqual(normalized.scamRiskAnalysis, fallback.scamRiskAnalysis);
  assert.ok(normalized.score >= fallback.scamRiskAnalysis.score);
});

test('la instrucción del usuario activa el análisis de scam aunque la web no entregue texto', () => {
  const url = 'https://lpa.web-crewsstats.com/ifwv_v_3_es_lp_wcs/?title=La+IA+que+hace+dinero&campaign_id=48799180&site=taboolanews.com';
  const result = buildLocalAnalysis(
    url,
    'Web',
    '',
    null,
    'Quiero saber si esa página es real o scam y si el autotrader es confiable.',
    url,
  );
  assert.equal(result.scamRiskAnalysis.applicable, true);
  assert.ok(result.scamRiskAnalysis.signals.some((signal) => signal.id === 'automated-money-claim'));
  assert.ok(result.scamRiskAnalysis.signals.some((signal) => signal.id === 'advertising-landing-link'));
  assert.match(result.scamRiskAnalysis.conclusion, /No prueban por sí solas/);
});
