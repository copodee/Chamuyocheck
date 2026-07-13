type CategoryLike = { name?: string; score?: number; explanation?: string };

export type LegalResultPresentation = {
  summary: string;
  prudentConclusion: string;
  resultJustification: string[];
  legalSafeguard: string;
  legalNotice: {
    automatedAssessment: true;
    notProfessionalAdvice: true;
    notFactualDetermination: true;
    humanReviewRecommended: true;
    limitations: string[];
    prohibitedSoleUses: string[];
  };
};

const LEGAL_SAFEGUARD = 'ChamuyoCheck genera una evaluación automatizada, orientativa y no concluyente sobre señales presentes en el contenido. El resultado no determina verdad, falsedad, ilegalidad, fraude, autoría, plagio, uso de IA, diagnóstico ni responsabilidad de una persona. No reemplaza asesoramiento legal, médico, financiero, científico, docente ni profesional. Antes de adoptar una decisión relevante, revisá el documento completo, las fuentes, la evidencia disponible y consultá a una persona profesional competente.';

function compact(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function buildLegalResultPresentation(input: {
  score: number;
  risk: string;
  confidence: string;
  baseSummary: string;
  baseConclusion: string;
  categoryScores: CategoryLike[];
  externalVerificationRequired: boolean;
  externalVerificationPerformed: boolean;
  verificationSummary?: string;
}): LegalResultPresentation {
  const score = Math.max(0, Math.min(100, Math.round(Number(input.score) || 0)));
  const factors = input.categoryScores
    .filter((item) => item.name && item.name !== 'Nivel de chamuyo' && Number(item.score) > 0)
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 3);
  const factorText = factors.length > 0
    ? factors.map((item) => `${compact(item.name)} (${Math.round(Number(item.score))}/100)`).join(', ')
    : 'no se identificaron dimensiones adicionales con puntaje positivo';
  const verificationText = compact(input.verificationSummary) || (input.externalVerificationRequired
    ? input.externalVerificationPerformed
      ? 'La verificación externa requerida figura como realizada con registros auditables.'
      : 'La verificación externa requerida no fue realizada; el resultado permanece sujeto a comprobación.'
    : 'El motor no determinó que esta evaluación necesitara verificación externa obligatoria.');

  return {
    summary: `${compact(input.baseSummary)} Resultado automatizado orientativo: ${compact(input.risk)} (${score}/100). Principales factores considerados: ${factorText}. ${verificationText}`,
    prudentConclusion: `${compact(input.baseConclusion)} No uses este resultado como única base para acusar, sancionar, diagnosticar, contratar, invertir o iniciar una acción legal.`,
    resultJustification: [
      `Resultado informado: ${score}/100 (${compact(input.risk)}). El número mide señales de riesgo o falta de evidencia; no es un porcentaje de mentira ni una probabilidad de responsabilidad.`,
      `Factores con mayor incidencia: ${factorText}.`,
      `Confianza declarada por el análisis: ${compact(input.confidence) || 'no especificada'}.`,
      verificationText,
      'El resultado puede cambiar si se aporta el documento completo, contexto, fuentes primarias, datos actualizados o evidencia contradictoria.',
    ],
    legalSafeguard: LEGAL_SAFEGUARD,
    legalNotice: {
      automatedAssessment: true,
      notProfessionalAdvice: true,
      notFactualDetermination: true,
      humanReviewRecommended: true,
      limitations: [
        'Puede haber falsos positivos, falsos negativos, errores de extracción y contexto incompleto.',
        'Las fuentes planificadas o sugeridas no se consideran consultadas hasta que exista un registro auditable.',
        'Una coincidencia lingüística no prueba intención, engaño, autoría ni uso de IA.',
      ],
      prohibitedSoleUses: [
        'Sanciones académicas o laborales.',
        'Diagnósticos o tratamientos médicos.',
        'Decisiones legales, crediticias, financieras o de inversión.',
        'Acusaciones públicas de fraude, delito, plagio o deshonestidad.',
      ],
    },
  };
}
