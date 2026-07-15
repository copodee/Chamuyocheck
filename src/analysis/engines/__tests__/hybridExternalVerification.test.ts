import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHybridExternalVerification, paidWebVerificationEnabled } from '../hybridExternalVerification';
import { runClaimFirstPipeline } from '../claimFirstPipeline';

const client = { chat: { completions: { create: async () => { throw new Error('paid search must not run'); } } } } as any;

test('paid web verification is opt-in and disabled by default', () => {
  assert.equal(paidWebVerificationEnabled(undefined), false);
  assert.equal(paidWebVerificationEnabled('false'), false);
  assert.equal(paidWebVerificationEnabled('true'), true);
});

test('hybrid flow remains inconclusive without free evidence and never calls paid search by default', async () => {
  const plan = runClaimFirstPipeline('Una noticia afirma que ocurrió un hecho público ayer en Argentina.').documentExternalVerificationPlan;
  const result = await runHybridExternalVerification(client, 'Hecho público reciente', plan, [], fetch, false);
  assert.equal(result.route, 'inconclusive');
  assert.equal(result.paidSearchUsed, false);
  assert.equal(result.execution.externalVerificationPerformed, false);
});

test('hybrid flow uses paid search only when explicitly enabled', async () => {
  let calls = 0;
  const paidClient = { chat: { completions: { create: async () => { calls += 1; return { choices: [{ message: { content: '{}', annotations: [] } }] }; } } } } as any;
  const plan = runClaimFirstPipeline('Una noticia afirma que ocurrió un hecho público ayer en Argentina.').documentExternalVerificationPlan;
  const result = await runHybridExternalVerification(paidClient, 'Otro hecho público reciente', plan, [], fetch, true);
  assert.equal(calls, 1);
  assert.equal(result.route, 'paid-web-search');
  assert.equal(result.paidSearchUsed, true);
  assert.equal(result.execution.externalVerificationPerformed, false);
});

test('hybrid flow automatically collects official export history but does not recommend an investment from one source', async () => {
  const text = 'Quiero invertir para exportar soja argentina y evaluar la demanda internacional.';
  const plan = runClaimFirstPipeline(text).documentExternalVerificationPlan;
  assert.ok(plan.suggestedSourceTypes.includes('international-trade-data'));
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const year = Number(new URL(String(input)).searchParams.get('period'));
    return new Response(JSON.stringify({ data: [{ period: year, primaryValue: 5_000_000 }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const result = await runHybridExternalVerification(client, text, plan, [], fetchImpl, false);
  assert.equal(result.attempted, true);
  assert.equal(result.route, 'inconclusive');
  assert.equal(result.execution.status, 'partial');
  assert.equal(result.execution.externalVerificationPerformed, false);
  assert.equal(result.execution.records[0]?.sourceType, 'international-trade-data');
  assert.match(result.rationale, /faltan precios, costos, destinos/i);
});

test('hybrid flow automatically collects official agricultural production without equating it to profitability', async () => {
  const text = 'Quiero evaluar una inversión productiva en soja en Córdoba.';
  const plan = runClaimFirstPipeline(text).documentExternalVerificationPlan;
  assert.ok(plan.suggestedSourceTypes.includes('official-agricultural-statistics'));
  const csv = `"cultivo","anio","campania","provincia","provincia_id","departamento","departamento_id","superficie_sembrada_ha","superficie_cosechada_ha","produccion_tm","rendimiento_kgxha"\n"Soja",2025,"2024/25","Córdoba",14,"Río Cuarto",14098,200,180,630,3500`;
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => String(input).includes('/api/3/action/package_show')
    ? new Response(JSON.stringify({ success: true, result: { resources: [{ format: 'CSV', url: 'https://datos.magyp.gob.ar/agriculture.csv', last_modified: '2026-03-05T13:10:49.520271' }] } }), { status: 200 })
    : new Response(csv, { status: 200 });
  const result = await runHybridExternalVerification(client, text, plan, [], fetchImpl, false);
  assert.equal(result.attempted, true);
  assert.equal(result.route, 'inconclusive');
  assert.equal(result.execution.status, 'partial');
  assert.equal(result.execution.externalVerificationPerformed, false);
  assert.ok(result.execution.records.some((record) => record.sourceType === 'official-agricultural-statistics'));
  assert.match(result.rationale, /faltan precios, costos, clima/i);
});

test('hybrid flow checks investment landing pages with free CNV and domain sources', async () => {
  const text = 'https://lpa.web-crewsstats.com/ifwv_v_3_es_lp_wcs/?campaign_id=48799180&title=La+IA+que+hace+dinero\nQuiero saber si esa página es real o scam.';
  const plan = runClaimFirstPipeline(text).documentExternalVerificationPlan;
  assert.ok(plan.suggestedSourceTypes.includes('securities-regulator-cnv'));
  assert.ok(plan.suggestedSourceTypes.includes('domain-registration-data'));
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url.startsWith('https://rdap.org/domain/')) return new Response(JSON.stringify({
      ldhName: 'WEB-CREWSSTATS.COM', status: ['active'],
      events: [{ eventAction: 'registration', eventDate: '2026-05-01T10:00:00Z' }],
    }), { status: 200 });
    if (url.includes('argentina.gob.ar/cnv/')) return new Response('<html>CNV</html>', { status: 200 });
    return new Response('', { status: 404 });
  };
  const result = await runHybridExternalVerification(client, text, plan, [], fetchImpl, false);
  assert.equal(result.attempted, true);
  assert.equal(result.route, 'free-connectors');
  assert.equal(result.assessment, 'inconclusive');
  assert.equal(result.paidSearchUsed, false);
  assert.ok(result.execution.records.some((record) => record.sourceType === 'domain-registration-data'));
  assert.ok(result.execution.records.some((record) => record.sourceType === 'securities-regulator-cnv'));
  assert.match(result.rationale, /no prueban legitimidad ni fraude/i);
});
