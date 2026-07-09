import { extractEvidenceHints } from './evidenceExtractor';
import type { VerificationResult } from './externalVerificationEngine';

export function buildScoreExplanation(text: string, topic: string | undefined, inputKind: string, score: number, issues: string[], verification?: VerificationResult) {
  const hints = extractEvidenceHints(text);
  const items = [
    `El score base se ajusta por evidencia visible, contexto y señales de manipulación.`,
    `El puntaje sube cuando aparecen datos verificables, fechas, links o metodología.`
  ];

  if (verification?.isFactualQuestion && verification?.domain === 'health-biology') {
    items.pop();
    items.pop();
    items.push('La respuesta se apoya en conocimiento biomédico básico.');
    items.push(`El puntaje de ${score}/100 refleja que la pregunta tiene respuesta clara y verificable.`);
    items.push('La ambigüedad principal es el término "hombre", que puede referirse a varón cis, hombre trans o persona intersex.');
    items.push('No se trata de una afirmación dudosa sino de una pregunta factual sobre biología.');
    return items.slice(0, 8);
  }

  if (score >= 70) {
    items.push('El puntaje refleja que hay más riesgo de interpretación o falta de trazabilidad.');
  } else {
    items.push('El puntaje refleja que la información es más prudente y requiere corroboración.');
  }

  if (hints.length) {
    items.push(`Se encontró ${hints.join(', ')}.`);
  }

  if (issues.length) {
    items.push(`Lo que bajó el puntaje: ${issues.slice(0, 3).join(' ')}`);
  }

  if (topic === 'health-biology-question') {
    items.push('Se trata de una pregunta factual sobre biología humana con respuesta verificable.');
  } else if (topic === 'finance') {
    items.push('El riesgo más pesado es la falta de costos completos, tasas o condiciones visibles.');
  } else if (topic === 'employment') {
    items.push('El riesgo más pesado es la ausencia de datos verificables sobre el puesto o la empresa.');
  } else if (topic === 'academic') {
    items.push('El riesgo más pesado es la falta de trazabilidad del método o de las fuentes.');
  } else {
    items.push('El riesgo más pesado suele ser la falta de fuente original, fecha o contexto.');
  }

  return items.slice(0, 6);
}
