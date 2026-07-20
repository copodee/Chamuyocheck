import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProductScope } from '../productScopeClassifier';
import { extractLoanNumbers } from '../../../lib/finance/loanMath';
import { analyzeScamRisk } from '../../../lib/scams/scamRiskAnalysis';
import { analyzeArgentinaLegal } from '../../../lib/legal/argentinaLegalAnalysis';
import { buildCustomerDecisionAnswer, enrichDecisionAnswerWithEconomicEvidence } from '../customerDecisionAnswerEngine';
import { discoverArgentinaInflationEvidence } from '../connectors/freeArgentinaInflationConnector';

const text = '500000 pesos a 12 meses. Me dice que terminaré pagando 1000000 de pesos. Me dicen que la tasa es igual a la inflación proyectada para ese período. ¿Es así?';

test('keeps a capital-term-total inflation question inside financial scope', () => {
  const result = classifyProductScope(text);
  assert.equal(result.supported, true);
  assert.equal(result.primaryArea, 'finance-credit');
});

test('derives the visible cash flow and implicit rate without requiring loan labels', () => {
  const result = extractLoanNumbers(text);
  assert.equal(result.principal, 500_000);
  assert.equal(result.statedTotal, 1_000_000);
  assert.equal(result.months, 12);
  assert.ok(Math.abs((result.installment || 0) - 83_333.3333) < 0.01);
  assert.equal(result.installmentEstimationBasis, 'stated-total');
  assert.equal(result.calculatedInstallmentsTotal, 1_000_000);
  assert.equal(result.financingCost, 500_000);
  assert.equal(result.financingCostPercent, 100);
  assert.ok((result.impliedTeaPercent || 0) > 180);
  assert.equal(result.missingFields.length, 0);
  assert.match(result.warnings.join(' '), /total declarado.*sistema francés/i);
});

test('interprets colloquial financed purchases by economic roles instead of the kind of asset', () => {
  const cases = [
    'Me ofrecen comprar un auto que vale 15.000.000 de pesos y pagar 36 cuotas de 650.000 pesos por mes. ¿Cuál es la tasa?',
    'Un camión cuesta 15.000.000 pesos y me lo financian: pagaré 36 cuotas de 650.000 pesos.',
    'Me venden una máquina cuyo valor es 15.000.000 de pesos, a pagar en 36 cuotas de 650.000 pesos.',
  ];

  for (const query of cases) {
    const result = extractLoanNumbers(query);
    assert.equal(result.principal, 15_000_000, query);
    assert.equal(result.months, 36, query);
    assert.equal(result.installment, 650_000, query);
    assert.equal(result.calculatedInstallmentsTotal, 23_400_000, query);
    assert.ok((result.impliedTnaPercent || 0) > 30, query);
    assert.equal(result.missingFields.length, 0, query);
  }
});

test('the selected finance category forces a financial answer and recognizes a pledge', () => {
  const query = '¿Qué gastos tiene una prenda sobre un vehículo y qué debería comparar?';
  const scope = classifyProductScope(query, '', 'finance-credit');
  assert.equal(scope.primaryArea, 'finance-credit');
  assert.match(scope.matchedSignals.join(' '), /prenda/i);

  const answer = buildCustomerDecisionAnswer({
    documentText: query,
    selectedCategory: 'finance-credit',
    financialAnalysis: extractLoanNumbers(query),
    scamRiskAnalysis: analyzeScamRisk(''),
    argentinaLegalAnalysis: analyzeArgentinaLegal(''),
  });
  assert.equal(answer.kind, 'loan-cost');
  assert.match(answer.directAnswer, /faltan/i);
});

test('answers the calculation and explains the correct inflation comparison', () => {
  const financialAnalysis = extractLoanNumbers(text);
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    financialAnalysis,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.kind, 'loan-cost');
  assert.equal(answer.status, 'answerable');
  assert.match(answer.directAnswer, /12 cuotas sumarían.*1\.000\.000/i);
  assert.match(answer.directAnswer, /no puede afirmarse.*igual a la inflación/i);
  assert.match(answer.directAnswer, /costo nominal visible es 100,00%/i);
  assert.match(answer.findings.join(' '), /INDEC.*inflación observada/i);
  assert.match(answer.findings.join(' '), /REM del BCRA.*analistas privados/i);
});

test('consults free official inflation sources without calling REM a BCRA forecast', async () => {
  const fetchMock = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('api.bcra.gob.ar')) return Response.json({
      results: [{ fecha: '2026-06-30', valor: 22.3 }],
    });
    if (url.includes('bcra.gob.ar')) return new Response(`
      <h2>RESUMEN EJECUTIVO | JUNIO DE 2026</h2>
      <p>En el presente informe, publicado el día 6 de julio de 2026.</p>
      <p>Quienes participaron estimaron una inflación mensual de 2,0%.</p>
      <p>Los pronósticos vertidos en el REM no constituyen proyecciones propias del BCRA.</p>
    `, { status: 200 });
    return new Response('<h1>INDEC - Informes técnicos del IPC</h1>', { status: 200 });
  };
  const records = await discoverArgentinaInflationEvidence(text, [0], fetchMock);
  assert.equal(records.length, 3);
  assert.deepEqual(records.map((record) => record.sourceType).sort(), ['central-bank-data', 'central-bank-data', 'official-statistics']);
  assert.match(records[0].excerpt || '', /2,0%/);
  assert.match(records[0].excerpt || '', /no proyecciones propias/i);
  assert.match(records[1].excerpt || '', /22,3%/);
  assert.match(records[2].excerpt || '', /observada/i);

  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    financialAnalysis: extractLoanNumbers(text),
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  const enriched = enrichDecisionAnswerWithEconomicEvidence(answer, extractLoanNumbers(text), records);
  assert.match(enriched?.directAnswer || '', /mediana vigente.*22,30%/i);
  assert.match(enriched?.directAnswer || '', /afirmación no coincide.*100,00%.*319,61%/i);
});
