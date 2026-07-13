import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAutomaticWebVerification } from '../automaticWebVerification';
import { runClaimFirstPipeline } from '../claimFirstPipeline';
import { buildLocalAnalysis, normalizeAI, openAIAnalysisEnabled, POST } from '../../../../app/api/analyze/route';
import { TERMS_VERSION } from '../../../lib/legal/terms';

test('automatic web verification only registers real cited trusted URLs', async () => {
  const plan = runClaimFirstPipeline('Una noticia afirma que ocurrió un hecho público ayer en Argentina.').documentExternalVerificationPlan;
  const cited = [
    'https://www.lanacion.com.ar/sociedad/hecho-a',
    'https://www.infobae.com/sociedad/2026/07/12/hecho-b',
  ];
  const client = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: {
            content: JSON.stringify({ assessment: 'corroborated', rationale: 'Dos fuentes coinciden.', sources: cited.map((url, index) => ({ url, title: `Fuente ${index + 1}`, published_at: '2026-07-12' })) }),
            annotations: cited.map((url) => ({ type: 'url_citation', url_citation: { url, title: 'Fuente' } })),
          } }],
        }),
      },
    },
  };
  const result = await runAutomaticWebVerification(client, 'Hecho público', plan);
  assert.equal(result.attempted, true);
  assert.equal(result.execution.records.length, 2);
  assert.equal(result.execution.externalVerificationPerformed, true);
  assert.equal(result.assessment, 'corroborated');
});

test('uncited or untrusted model URLs can never count as performed verification', async () => {
  const plan = runClaimFirstPipeline('Una noticia afirma que ocurrió un hecho público ayer en Argentina.').documentExternalVerificationPlan;
  const client = {
    chat: { completions: { create: async () => ({
      choices: [{ message: {
        content: JSON.stringify({ assessment: 'corroborated', sources: [{ url: 'https://blog-desconocido.example/rumor', title: 'Rumor' }] }),
        annotations: [],
      } }],
    }) } },
  };
  const result = await runAutomaticWebVerification(client, 'Hecho público', plan);
  assert.equal(result.execution.records.length, 0);
  assert.equal(result.execution.externalVerificationPerformed, false);
  assert.equal(result.assessment, 'inconclusive');
});

test('a news citation cannot be relabeled as a personal self-disclosure', async () => {
  const plan = runClaimFirstPipeline('El ministro de Economía es homosexual.').documentExternalVerificationPlan;
  const url = 'https://www.infobae.com/politica/2026/07/12/rumor';
  const client = {
    chat: { completions: { create: async () => ({
      choices: [{ message: {
        content: JSON.stringify({ assessment: 'corroborated', sources: [{ url, title: 'Nota periodística', published_at: '2026-07-12' }] }),
        annotations: [{ url_citation: { url, title: 'Nota periodística' } }],
      } }],
    }) } },
  } as any;
  const result = await runAutomaticWebVerification(client, 'El ministro de Economía es homosexual.', plan);
  assert.equal(result.execution.records.length, 0);
  assert.equal(result.execution.externalVerificationPerformed, false);
  assert.equal(result.assessment, 'inconclusive');
});

test('AI normalization cannot lower an unverified factual score or reintroduce finance', () => {
  const fallback = buildLocalAnalysis('El ibuprofeno mató a dos chicos que lo mezclaron con agua de mar.', 'Texto', '', null);
  const normalized = normalizeAI({ score: 19, topic: 'general', categoryScores: [{ name: 'Riesgo financiero', score: 0 }] }, fallback);
  assert.ok(fallback.externalVerification.externalVerificationRequired);
  assert.ok(normalized.score >= 50);
  assert.equal(normalized.topic, fallback.topic);
  assert.ok(!normalized.categoryScores.some((category: any) => /financiero|ponzi/i.test(category.name)));
});

test('OpenAI analysis is disabled unless explicitly enabled', () => {
  assert.equal(openAIAnalysisEnabled(undefined), false);
  assert.equal(openAIAnalysisEnabled('false'), false);
  assert.equal(openAIAnalysisEnabled('true'), true);
});

test('ambiguous cultural entities are explained before any truth conclusion', () => {
  const result = buildLocalAnalysis('El pájaro carpintero era un dibujo animado.', 'Texto', '', null);
  assert.ok(result.externalVerification.externalVerificationRequired);
  assert.match(result.clarification || '', /ambigua.*ave.*El Pájaro Loco.*Woody Woodpecker/i);
  assert.ok(result.score >= 50);
});

test('free local endpoint returns the mandatory inconclusive wording', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousEnabled = process.env.OPENAI_ANALYSIS_ENABLED;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_ANALYSIS_ENABLED;
  try {
    const form = new FormData();
    form.set('text', 'Esta inversión en bitcoin garantiza una ganancia del 500% mensual.');
    form.set('termsAccepted', 'true');
    form.set('termsVersion', TERMS_VERSION);
    const response = await POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.match(body.prudentConclusion, /no puede ser validada.*no puede responderse con certeza/i);
    assert.ok(body.score >= 50);
    assert.equal(body.externalVerification.externalVerificationPerformed, false);
    const publicPayload = JSON.stringify(body);
    assert.doesNotMatch(publicPayload, /búsqueda paga|fuentes gratuitas|paidSearchUsed|"route"|"inconclusive"/i);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previousEnabled === undefined) delete process.env.OPENAI_ANALYSIS_ENABLED; else process.env.OPENAI_ANALYSIS_ENABLED = previousEnabled;
  }
});

test('out-of-scope endpoint does not score or pretend to verify', async () => {
  const form = new FormData();
  form.set('text', 'Colapinto es un piloto de motos de origen español.');
  form.set('termsAccepted', 'true');
  form.set('termsVersion', TERMS_VERSION);
  const response = await POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.scopeStatus, 'out-of-scope');
  assert.equal(body.score, 0);
  assert.equal(body.externalVerification.externalVerificationRequired, false);
  assert.equal(body.externalVerification.externalVerificationPerformed, false);
  assert.match(body.summary, /fuera del alcance/i);
  assert.match(body.summary, /no se asignó un puntaje/i);
  assert.match(body.summary, /no se realizó una verificación externa/i);
  assert.doesNotMatch(JSON.stringify(body), /contenido sólido y confiable/i);
});

test('a Banco Provincia loan URL pasted as text is read and routed to finance', async () => {
  const originalFetch = globalThis.fetch;
  const html = `<html><head><title>Préstamo personal Banco Provincia</title></head><body>
    Pedí tu préstamo personal. T.N.A.V. fija 97,40%. T.E.A.V. 155,10%. CFTEAV: 155,10%.
    Monto máximo $50.000.000. Plazo hasta 36 meses. Comisión de precancelación 4,00%.
  </body></html>`;
  globalThis.fetch = (async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })) as typeof fetch;
  try {
    const form = new FormData();
    form.set('text', 'https://www.bancoprovincia.com.ar/mvc/productos/creditos/BipPreca/condiciones_bip_preca');
    form.set('termsAccepted', 'true');
    form.set('termsVersion', TERMS_VERSION);
    const response = await POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.notEqual(body.scopeStatus, 'out-of-scope');
    assert.equal(body.detectedInput, 'Web');
    assert.equal(body.financialAnalysis?.tnaPercent, 97.4);
    assert.equal(body.financialAnalysis?.cftPercent, 155.1);
    assert.match(body.extractionStatus, /página pública leída/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('local analysis exposes reproducible loan calculations and normalization preserves them', () => {
  const fallback = buildLocalAnalysis('Monto del préstamo: $1.000.000. 12 cuotas de $120.000. TNA 75%. TEA 106,99%. CFT 140%.', 'Texto', '', null);
  assert.equal(fallback.financialAnalysis?.calculatedInstallmentsTotal, 1_440_000);
  assert.equal(fallback.financialAnalysis?.financingCost, 440_000);
  assert.match(fallback.summary, /12 × \$120\.000 = \$1\.440\.000/i);
  const normalized = normalizeAI({ financialAnalysis: null }, fallback);
  assert.equal(normalized.financialAnalysis?.financingCost, 440_000);
});
