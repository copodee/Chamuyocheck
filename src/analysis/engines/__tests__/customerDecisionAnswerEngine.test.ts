import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLoanNumbers } from '../../../lib/finance/loanMath';
import { analyzeScamRisk } from '../../../lib/scams/scamRiskAnalysis';
import { analyzeArgentinaLegal } from '../../../lib/legal/argentinaLegalAnalysis';
import { analyzeInvestmentProject } from '../../../lib/investments/investmentProjectAnalysis';
import { buildCustomerDecisionAnswer } from '../customerDecisionAnswerEngine';

test('responde primero cuánto se paga y estima tasas para el plazo pedido', () => {
  const text = 'Monto del préstamo $1.007.000. 12 cuotas de $130.381. 24 cuotas de $100.553. 36 cuotas de $106.213. 48 cuotas de $107.037.';
  const instruction = 'Necesito saber el CFT y la TNA para 36 meses.';
  const financialAnalysis = extractLoanNumbers(text, instruction);
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: instruction, financialAnalysis,
    scamRiskAnalysis: analyzeScamRisk(text), argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.kind, 'loan-cost');
  assert.equal(answer.status, 'answerable');
  assert.match(answer.directAnswer, /36 cuotas sumarían/i);
  assert.match(answer.directAnswer, /sistema francés.*cuotas mensuales iguales y vencidas/i);
  assert.match(answer.directAnswer, /TNA implícita estimada/i);
  assert.match(answer.directAnswer, /CFT oficial no puede conocerse/i);
  assert.match(answer.findings.join(' '), /Modelo de cálculo: sistema francés.*periodicidad mensual.*pagos vencidos/i);
  assert.match(answer.findings.join(' '), /supuesto necesario.*confirmarse en el contrato/i);
  assert.match(answer.findings.join(' '), /priorizó la instrucción.*36 meses/i);
  assert.match(answer.nextActions.join(' '), /CFT contractual/i);
});

test('no acusa estafa cuando no hay señales y explica qué falta verificar', () => {
  const text = 'Préstamo personal de entidad desconocida. Consultar condiciones.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: '¿Es seguro pagar un anticipo?', financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text), argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.kind, 'scam-prevention');
  assert.doesNotMatch(answer.directAnswer, /es una estafa/i);
  assert.ok(answer.nextActions.length > 0);
});

test('responde una consulta de TNA ajustada por comisión inicial sin pedir una cuota inexistente', () => {
  const text = 'Me quieren prestar 1.000.000 de dólares a 36 meses. Me dicen que la TNA es 30% pero me piden el 3% de comisión al inicio.';
  const instruction = '¿Cuánto sería la TNA real que pago en 36 meses?';
  const financialAnalysis = extractLoanNumbers(text, instruction);
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: instruction, financialAnalysis,
    scamRiskAnalysis: analyzeScamRisk(text), argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.kind, 'loan-cost');
  assert.equal(answer.status, 'answerable');
  assert.match(answer.title, /comisión eleva el costo real/i);
  assert.match(answer.directAnswer, /TNA contractual sigue siendo 30,00%/i);
  assert.match(answer.directAnswer, /sistema francés.*cuotas mensuales iguales y vencidas/i);
  assert.match(answer.directAnswer, /desembolso neto de US\$\s*970\.000/i);
  assert.match(answer.directAnswer, /TNA implícita ajustada.*32,38%/i);
  assert.match(answer.directAnswer, /TEA implícita.*37,64%/i);
  assert.match(answer.directAnswer, /No son un CFT oficial/i);
});

test('explica el sistema alemán cuando el usuario lo solicita', () => {
  const text = 'Me prestan 1.000.000 de dólares a 36 meses con TNA 30% y 3% de comisión al inicio.';
  const instruction = 'Calcular con sistema alemán.';
  const financialAnalysis = extractLoanNumbers(text, instruction);
  const answer = buildCustomerDecisionAnswer({
    documentText: text, userInstruction: instruction, financialAnalysis,
    scamRiskAnalysis: analyzeScamRisk(text), argentinaLegalAnalysis: analyzeArgentinaLegal(text),
  });
  assert.equal(answer.status, 'answerable');
  assert.match(answer.directAnswer, /sistema alemán.*cuotas mensuales vencidas y decrecientes/i);
  assert.match(answer.findings.join(' '), /primera.*última/i);
});

test('responde la instrucción inmobiliaria con métricas preliminares y requisitos locales', () => {
  const text = 'Departamento en Córdoba, precio de compra USD 100.000, 50 m2, alquiler mensual USD 700, gastos mensuales USD 100 y vacancia 5%.';
  const instruction = 'Calcular precio por metro, rendimiento y decir si será fácil alquilarlo.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: instruction,
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
    investmentProjectAnalysis: analyzeInvestmentProject(text, instruction),
  });
  assert.equal(answer.kind, 'investment-project');
  assert.equal(answer.status, 'partial');
  assert.match(answer.findings.join(' '), /Precio calculado por m².*2\.000/i);
  assert.match(answer.findings.join(' '), /Rendimiento bruto anual preliminar.*8,40%/i);
  assert.match(answer.findings.join(' '), /Rendimiento neto anual preliminar.*6,78%/i);
  assert.match(answer.nextActions.join(' '), /localidad.*tipología.*vacancia/i);
  assert.doesNotMatch(answer.directAnswer, /es una buena inversión|inversión recomendable/i);
});

test('una oportunidad exportadora exige demanda, destinos, competidores y barreras', () => {
  const text = 'Proyecto para exportar vino argentino con demanda mundial creciente y retorno asegurado.';
  const instruction = 'Validar si es una buena inversión para vender al exterior.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: instruction,
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
    investmentProjectAnalysis: analyzeInvestmentProject(text, instruction),
  });
  assert.equal(answer.kind, 'investment-project');
  assert.equal(answer.status, 'needs-verification');
  assert.match(answer.nextActions.join(' '), /posición arancelaria.*destino.*barreras sanitarias/i);
  assert.match(answer.directAnswer, /no debe tratarse como una inversión recomendable/i);
});

test('expone producción, margen y retorno de un proyecto agrícola con sus límites', () => {
  const text = 'Proyecto de soja en 600 hectáreas. Inversión inicial USD 500.000, rinde 3,5 toneladas por hectárea, precio por tonelada USD 400 y costo por hectárea USD 900.';
  const instruction = 'Calcular producción, ingresos, costos, margen y retorno anual.';
  const answer = buildCustomerDecisionAnswer({
    documentText: text,
    userInstruction: instruction,
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(text),
    argentinaLegalAnalysis: analyzeArgentinaLegal(text),
    investmentProjectAnalysis: analyzeInvestmentProject(text, instruction),
  });
  assert.equal(answer.kind, 'investment-project');
  assert.match(answer.findings.join(' '), /Producto detectado: soja/i);
  assert.match(answer.findings.join(' '), /Producción proyectada.*2\.100 toneladas/i);
  assert.match(answer.findings.join(' '), /Margen operativo proyectado.*US\$\s*300\.000.*35,71%/i);
  assert.match(answer.findings.join(' '), /Retorno anual preliminar.*60,00%/i);
  assert.match(answer.nextActions.join(' '), /campaña y región.*clima.*rinde adverso/i);
});
