import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLoanNumbers } from '../../../lib/finance/loanMath';
import { analyzeScamRisk } from '../../../lib/scams/scamRiskAnalysis';
import { analyzeArgentinaLegal } from '../../../lib/legal/argentinaLegalAnalysis';
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
  assert.match(answer.directAnswer, /TNA implícita estimada/i);
  assert.match(answer.directAnswer, /CFT oficial no puede conocerse/i);
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
