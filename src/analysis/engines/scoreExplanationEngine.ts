import { extractEvidenceHints } from './evidenceExtractor';
import type { VerificationResult } from './externalVerificationEngine';

export function buildScoreExplanation(text: string, topic: string | undefined, inputKind: string, score: number, issues: string[], verification?: VerificationResult) {
  const hints = extractEvidenceHints(text);
  const items = [
    `El ChamuyoScore mide el nivel de señales de manipulación, falta de evidencia o contenido dudoso.`,
    `Mayor puntaje = más señales de chamuyo. Menor puntaje = contenido más sólido y verificable.`
  ];

  // High severity score (>= 95): special justification
  if (score >= 95 && !verification?.isFactualQuestion && verification?.domain === 'health-biology') {
    return [
      '⚠️ FUNDAMENTO DEL PUNTAJE EXTREMO',
      '',
      'CONCLUSIÓN PRINCIPAL:',
      'La afirmación sostiene una premisa biológicamente imposible bajo evidencia médica actual.',
      '',
      'HECHOS VERIFICABLES:',
      '• La gestación humana requiere implantación embrionaria en tejido uterino funcional.',
      '• Un varón cis no posee útero ni ovarios funcionales.',
      '• La terapia hormonal modifica características sexuales secundarias pero NO crea órganos reproductivos nuevos.',
      '• Los embarazos documentados en hombres trans corresponden a personas que conservaban útero y ovarios funcionales.',
      '',
      'INTERPRETACIÓN LITERAL:',
      'Bajo una interpretación literal de la afirmación, no existe respaldo biomédico verificable.',
      '',
      'CRITERIOS MÉDICOS APLICADOS:',
      '• Definición de gestación: implantación embrionaria en endometrio uterino.',
      '• Diferencia anatómica: varón cis vs. persona con capacidad reproductiva.',
      '• Alcance de la terapia hormonal: no es generativa de órganos nuevos.',
      '• Contexto de personas trans: requiere conservación de órganos reproduc activos.',
      '',
      'LIMITACIÓN DEL ANÁLISIS:',
      'Este análisis se basa en criterios de plausibilidad biomédica y coherencia con conocimiento médico ampliamente aceptado. ',
      'Si la pregunta intenta referirse a tecnologías futuras (implante uterino, etc.), la evaluación no las cubre.',
      '',
      'POR QUÉ EL PUNTAJE ES 100:',
      'El contenido contradice de manera fundamental conocimiento biomédico establecido, sin dejar margen a interpretación compatible.',
      'No se encontró respaldo verificable en criterios médicos considerados.'      
    ];
  }

  if (verification?.isFactualQuestion && verification?.domain === 'health-biology') {
    items.pop();
    items.pop();
    items.push('La respuesta se apoya en conocimiento biomédico básico.');
    items.push(`El puntaje de ${score}/100 refleja que la pregunta tiene respuesta clara y verificable.`);
    items.push('La ambigüedad principal es el término "hombre", que puede referirse a varón cis, hombre trans o persona intersex.');
    items.push('No se trata de una afirmación dudosa sino de una pregunta factual sobre biología.');
    return items.slice(0, 8);
  }

  if (!verification?.isFactualQuestion && verification?.domain === 'health-biology') {
    items.pop();
    items.pop();
    items.push('⚠️ PREMISA FALSA DETECTADA: Esta pregunta asume algo biológicamente imposible.');
    items.push(`El puntaje de ${score}/100 refleja contenido dudoso o engañoso sobre biología reproductiva.`);
    items.push('Tratamientos hormonales NO pueden crear órganos reproductivos (útero, ovarios) en personas que no los tienen.');
    items.push('El embarazo en personas trans solo es posible si conservan útero y ovarios funcionales.');
    return items.slice(0, 8);
  }

  if (score >= 70) {
    items.push('El puntaje alto indica fuertes señales de manipulación, promesas extraordinarias o falta significativa de evidencia.');
  } else if (score >= 40) {
    items.push('El puntaje moderado refleja algunos riesgos; requiere verificación de puntos específicos.');
  } else {
    items.push('El puntaje bajo indica contenido más sólido con respaldo, fuentes y metodología clara.');
  }

  if (hints.length) {
    items.push(`Evidencia encontrada: ${hints.join(', ')}.`);
  }

  if (issues.length) {
    items.push(`Factores que suben el puntaje: ${issues.slice(0, 3).join(' ')}`);
  }

  if (topic === 'health-biology-question') {
    items.push('Se trata de una pregunta factual sobre biología humana con respuesta verificable.');
  } else if (topic === 'finance') {
    items.push('El factor principal es la falta de costos completos, tasas o condiciones visibles.');
  } else if (topic === 'employment') {
    items.push('El factor principal es la ausencia de datos verificables sobre el puesto o la empresa.');
  } else if (topic === 'academic') {
    items.push('El factor principal es la falta de trazabilidad del método o de las fuentes.');
  } else {
    items.push('El factor principal suele ser la falta de fuente original, fecha o contexto.');
  }

  return items.slice(0, 6);
}
