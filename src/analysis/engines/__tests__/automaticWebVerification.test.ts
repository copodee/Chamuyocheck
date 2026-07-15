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
    form.set('text', 'Indicame la TNA, la TEA, el CFT y las condiciones. https://www.bancoprovincia.com.ar/mvc/productos/creditos/BipPreca/condiciones_bip_preca');
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
    assert.equal(body.externalVerification.externalVerificationPerformed, true);
    assert.equal(body.externalVerification.execution.status, 'partial');
    assert.equal(body.externalVerification.execution.records.length, 1);
    assert.equal(body.externalVerification.execution.records[0].url, 'https://www.bancoprovincia.com.ar/mvc/productos/creditos/BipPreca/condiciones_bip_preca');
    assert.match(body.summary, /se leyó la página de Banco Provincia/i);
    assert.match(body.externalVerification.conclusion, /fuente primaria.*verificación independiente/i);
    assert.doesNotMatch(body.summary, /no puede ser validada con las fuentes disponibles/i);
    assert.equal(body.scamRiskAnalysis.signals.some((signal: any) => signal.id === 'credential-request'), false);
    assert.equal(body.categoryScores.some((category: any) => /ponzi|piramidal/i.test(category.name)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('web analysis audits the real redirect destination without exposing tracking parameters', async () => {
  const originalFetch = globalThis.fetch;
  const landingHtml = `<html><head><title>Plataforma de inversión automatizada</title></head><body>
    Activá nuestro autotrading con inteligencia artificial. Registrate para conocer rendimientos,
    condiciones, identidad del operador y metodología de inversión.
  </body></html>`;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const requested = String(input);
    if (requested.startsWith('https://anuncio.example/click')) {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://operador.example/inversion' },
      });
    }
    if (requested === 'https://operador.example/inversion') {
      return new Response(landingHtml, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('', { status: 503 });
  }) as typeof fetch;
  try {
    const form = new FormData();
    form.set('text', 'Quiero saber si esta propuesta de autotrading es real o scam. https://anuncio.example/click?campaign_id=48799180&site_domain=taboolanews.com&utm_source=publicidad');
    form.set('termsAccepted', 'true');
    form.set('termsVersion', TERMS_VERSION);
    const response = await POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
    const body = await response.json();
    const publicPayload = JSON.stringify({
      extractedPreview: body.extractedPreview,
      summary: body.summary,
      issues: body.issues,
      evidenceFound: body.evidenceFound,
      decisionAnswer: body.decisionAnswer,
      scamSignals: body.scamRiskAnalysis.signals.map((signal: any) => ({
        id: signal.id,
        label: signal.label,
        evidence: signal.evidence,
      })),
    });
    assert.equal(response.status, 200);
    assert.notEqual(body.scopeStatus, 'out-of-scope');
    assert.equal(body.detectedInput, 'Web');
    assert.equal(body.externalVerification.externalVerificationPerformed, true);
    assert.equal(body.externalVerification.execution.records.length, 1);
    assert.equal(body.externalVerification.execution.records[0].url, 'https://operador.example/inversion');
    assert.equal(body.scamRiskAnalysis.signals.some((signal: any) => signal.id === 'cross-domain-redirect'), true);
    assert.match(publicPayload, /operador\.example/);
    assert.match(publicPayload, /taboolanews\.com.*No se consideran el operador financiero ni el destino final/i);
    assert.doesNotMatch(publicPayload, /campaign_id=48799180|utm_source=publicidad/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('client-side OCR text is analyzed without uploading the image to server OCR', async () => {
  const form = new FormData();
  form.set('text', 'Indicame las condiciones y cuánto interés pagaría.');
  form.set('ocrText', 'Préstamos online. Importe a solicitar $ 1.000.000. 18 cuotas de $ 148.548, 30 por mes.');
  form.set('ocrConfidence', '73');
  form.set('clientFileName', 'captura-prestamo.png');
  form.set('clientFileType', 'image/png');
  form.set('termsAccepted', 'true');
  form.set('termsVersion', TERMS_VERSION);
  const response = await POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.detectedInput, 'Imagen');
  assert.equal(body.financialAnalysis?.principal, 1_000_000);
  assert.equal(body.financialAnalysis?.installment, 148_548.30);
  assert.equal(body.financialAnalysis?.months, 18);
  assert.equal(body.financialAnalysis?.calculatedInstallmentsTotal, 2_673_869.4);
  assert.equal(body.financialAnalysis?.financingCost, 1_673_869.4);
  assert.ok(Math.abs(body.financialAnalysis?.impliedTnaPercent - 159.3672) < 0.001);
  assert.ok(Math.abs(body.financialAnalysis?.impliedTeaPercent - 346.5463) < 0.001);
  assert.equal(body.financialAnalysis?.missingFields.length, 0);
  assert.match(body.summary, /TNA estimada: 159\.37%.*TEA estimada: 346\.55%/i);
  assert.match(body.extractionStatus, /OCR local completado en el dispositivo/i);
});

test('OCR with several loan alternatives follows the user instruction', async () => {
  const form = new FormData();
  form.set('text', 'Necesito saber el CFT y la TNA para 36 meses.');
  form.set('ocrText', 'Simulá la cuota de tu Préstamo. Elegí el monto de tu Préstamo. Ingresá el monto en miles. $ 1.007.000. 12 cuotas de 24 cuotas de 36 cuotas de 48 cuotas de. $130.381* $100.553+* $106.213+* $107.037*');
  form.set('ocrConfidence', '79');
  form.set('clientFileName', 'simulador-macro.png');
  form.set('clientFileType', 'image/png');
  form.set('termsAccepted', 'true');
  form.set('termsVersion', TERMS_VERSION);
  const response = await POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.financialAnalysis?.principal, 1_007_000);
  assert.equal(body.financialAnalysis?.months, 36);
  assert.equal(body.financialAnalysis?.installment, 106_213);
  assert.equal(body.financialAnalysis?.calculatedInstallmentsTotal, 3_823_668);
  assert.equal(body.financialAnalysis?.financingCost, 2_816_668);
  assert.equal(body.financialAnalysis?.scenarios.length, 4);
  assert.ok(body.financialAnalysis?.impliedTnaPercent > 0);
  assert.ok(body.financialAnalysis?.impliedVisibleCftPercent > 0);
  assert.ok(body.score < 60, 'a calculable bank simulator must be presented as a calculation, not as extreme chamuyo');
  assert.equal(body.decisionAnswer?.kind, 'loan-cost');
  assert.equal(body.decisionAnswer?.status, 'answerable');
  assert.match(body.decisionAnswer?.directAnswer || '', /36 cuotas sumarían.*TNA implícita.*CFT oficial no puede conocerse/is);
  assert.match(body.summary, /36.*106\.213.*TNA estimada.*CFT visible estimado/is);
});

test('external content requires an explicit user instruction', async () => {
  const form = new FormData();
  form.set('text', '');
  form.set('ocrText', 'Préstamo de $1.000.000 en 12 cuotas de $120.000.');
  form.set('clientFileName', 'prestamo.png');
  form.set('clientFileType', 'image/png');
  form.set('termsAccepted', 'true');
  form.set('termsVersion', TERMS_VERSION);
  const response = await POST(new Request('http://localhost/api/analyze', { method: 'POST', body: form }));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.error, /Escribí qué necesitás saber/i);
});

test('local analysis exposes reproducible loan calculations and normalization preserves them', () => {
  const fallback = buildLocalAnalysis('Monto del préstamo: $1.000.000. 12 cuotas de $120.000. TNA 75%. TEA 106,99%. CFT 140%.', 'Texto', '', null);
  assert.equal(fallback.financialAnalysis?.calculatedInstallmentsTotal, 1_440_000);
  assert.equal(fallback.financialAnalysis?.financingCost, 440_000);
  assert.match(fallback.summary, /12 × \$120\.000 = \$1\.440\.000/i);
  const normalized = normalizeAI({ financialAnalysis: null }, fallback);
  assert.equal(normalized.financialAnalysis?.financingCost, 440_000);
});

test('local analysis solves a stated TNA plus upfront commission scenario', () => {
  const text = 'Me quieren prestar 1.000.000 de dólares a 36 meses. Me dicen que la TNA es 30% pero me piden el 3% de comisión al inicio.';
  const fallback = buildLocalAnalysis(text, 'Texto', '', null, '¿Cuánto sería la TNA real que pago en 36 meses?');
  assert.equal(fallback.financialAnalysis?.installmentEstimated, true);
  assert.equal(fallback.financialAnalysis?.missingFields.length, 0);
  assert.equal(fallback.decisionAnswer?.status, 'answerable');
  assert.match(fallback.decisionAnswer?.directAnswer || '', /TNA contractual sigue siendo 30,00%/i);
  assert.match(fallback.decisionAnswer?.directAnswer || '', /TNA implícita ajustada.*32,38%/i);
  assert.match(fallback.decisionAnswer?.directAnswer || '', /TEA implícita.*37,64%/i);
});
