import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeArgentinaLegal } from '../../../lib/legal/argentinaLegalAnalysis';
import { analyzeScamRisk } from '../../../lib/scams/scamRiskAnalysis';
import { buildCustomerDecisionAnswer } from '../customerDecisionAnswerEngine';

test('leasing calcula el formulario manual cuando el porcentaje llega dentro del saldo financiado', () => {
  const prompt = `Cliente: Nicolas Scioli.
Tipo de bien: Automotor / rodado.
Valor del bien sin IVA: 50000000.
Anticipo: 10% ($ 5000000).
Saldo financiado: 45000000 (90%).
Plazo: 36 meses.
TNA: 38%.
Modalidad de opción: porcentaje del valor del bien.
Opción de compra porcentual: 5%.
Opción de compra importe fijo: no aplica.
Cánones de garantía recibidos al inicio y aplicados a las ultimas cuotas: 2.
Gasto de estructuración: 3% del valor financiado.`;

  const answer = buildCustomerDecisionAnswer({
    documentText: prompt,
    userInstruction: prompt,
    selectedCategory: 'leasing-specialist',
    financialAnalysis: null,
    scamRiskAnalysis: analyzeScamRisk(''),
    argentinaLegalAnalysis: analyzeArgentinaLegal(''),
  });
  const rendered = [
    answer.directAnswer,
    ...answer.findings,
    ...(answer.sections?.flatMap((section) => section.items) || []),
  ].join(' ');

  assert.doesNotMatch(
    rendered,
    /Para cerrar el calculo faltan|Para cerrar el cálculo faltan/i,
  );
  assert.match(rendered, /TIR estimada del dador|TIR mensual|costo total visible/i);
});
