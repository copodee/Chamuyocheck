export type CommercialCourseAnalysis = {
  applicable: boolean;
  offerType: string;
  observedPromises: string[];
  disclosedConditions: string[];
  evidenceClaims: string[];
  coherenceIssues: string[];
  missingInformation: string[];
  conclusion: string;
};

function excerpts(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)))
    .slice(0, 6).map((match) => text.slice(Math.max(0, (match.index || 0) - 25), Math.min(text.length, (match.index || 0) + match[0].length + 50)).replace(/\s+/g, ' ').trim());
}

export function analyzeCommercialCourse(text: string): CommercialCourseAnalysis {
  const applicable = /curso|mentor[ií]a|coaching|masterclass|capacitaci[oó]n|programa.{0,30}(?:negocio|emprend)|negocio exitoso|libertad financiera/i.test(text);
  const observedPromises = excerpts(text, /(?:vas a|pod[eé]s|te ense[ñn](?:o|a) a|logr[aá]|consegu[ií]).{0,55}(?:[eé]xito|factur|ganar|vender|cliente|libertad financiera)|(?:ingresos?|ventas?|facturaci[oó]n|facturar).{0,45}(?:garantiz|asegur|por mes|mensual|mill[oó]n)/gi);
  const disclosedConditions = excerpts(text, /(?:precio|cuesta|inversi[oó]n|cuotas?|duraci[oó]n|semanas?|meses?|reembolso|devoluci[oó]n|garant[ií]a).{0,70}/gi);
  const evidenceClaims = excerpts(text, /(?:casos? de [eé]xito|testimonios?|resultados? comprobables?|alumnos?.{0,25}(?:ganaron|facturaron|lograron)|estad[ií]stic|estudio).{0,70}/gi);
  const coherenceIssues = [
    /garantiz|resultado asegurado|sin riesgo|infalible/i.test(text) ? 'Presenta resultados como garantizados o prácticamente seguros, aunque el éxito comercial depende de variables que el curso no controla.' : '',
    /sin experiencia|sin capital|sin esfuerzo|trabajando.{0,15}(?:minutos|horas)/i.test(text) ? 'Reduce o elimina requisitos relevantes como experiencia, capital, tiempo o esfuerzo.' : '',
    /casos? de [eé]xito|testimonios?/i.test(text) && !/(cantidad total|todos los alumnos|tasa de [eé]xito|metodolog[ií]a|muestra)/i.test(text) ? 'Usa testimonios o casos seleccionados sin informar resultados del conjunto de participantes.' : '',
    /factur/i.test(text) && !/(costos?|gastos?|margen|ganancia neta|impuestos?)/i.test(text) ? 'Habla de facturación sin distinguir ingresos, costos, impuestos y ganancia neta.' : '',
  ].filter(Boolean);
  const missingInformation = [
    disclosedConditions.length === 0 ? 'precio, duración, alcance, cancelación y devolución' : '',
    evidenceClaims.length === 0 ? 'evidencia verificable de los resultados promocionados' : '',
    !/(nombre|empresa|cuit|raz[oó]n social|responsable)/i.test(text) ? 'identidad legal y responsable de la oferta' : '',
    !/(temario|m[oó]dulos?|contenido|clases?)/i.test(text) ? 'temario y entregables concretos' : '',
  ].filter(Boolean);
  return {
    applicable,
    offerType: applicable ? 'Curso, mentoría o programa de éxito comercial' : 'No identificado',
    observedPromises,
    disclosedConditions,
    evidenceClaims,
    coherenceIssues,
    missingInformation,
    conclusion: !applicable ? 'No se identificó una oferta de formación comercial.' : coherenceIssues.length ? 'La propuesta contiene puntos de coherencia y evidencia que deben aclararse antes de comprar.' : 'La transcripción no muestra contradicciones fuertes, pero el resultado comercial prometido requiere evidencia y condiciones completas.',
  };
}
