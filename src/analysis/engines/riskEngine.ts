export function buildRiskItems(text: string, inputKind: string) {
  const lowerText = text.toLowerCase();
  const risks = new Set<string>();

  if (text.trim().length < 220) risks.add('Puede omitir contexto relevante y requerir más información antes de tomar una decisión.');
  if (/%|porcentaje|estad|cifra|cifras|promedio|monto|millones|miles|crec[ií]o|ca[ií]da/.test(lowerText)) {
    risks.add('La interpretación puede requerir contrastar con la fuente oficial o el informe completo.');
  }
  if (/https?:\/\/|fuente|fuentes|referencia|informe|estudio|metodolog/i.test(text)) {
    risks.add('La lectura puede quedar incompleta si no se muestra la fuente original o la metodología.');
  }
  if (inputKind === 'PDF' || /pdf/i.test(text)) {
    risks.add('El resumen puede omitir contexto o detalle del informe completo.');
  }
  if (/garantiz|sin riesgo|sin esfuerzo|100%|comprobado|millonario|definitivo|promesa|oferta/i.test(text)) {
    risks.add('El lenguaje promocional o las promesas fuertes pueden distorsionar la evaluación.');
  }

  return Array.from(risks).slice(0, 4);
}
