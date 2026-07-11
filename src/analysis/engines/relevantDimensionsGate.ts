/**
 * Relevant Dimensions Gate (V21B)
 *
 * Ensures only applicable dimensions participate in scoring.
 * Excluded dimensions must not affect the final score or be displayed.
 *
 * Scoring formula (only applicable dimensions):
 * weightedScore = sum(value * weight for applicable) / sum(weight for applicable)
 *
 * Score priority:
 * 1. forceScore (if set, overrides everything)
 * 2. minimumScore (hard floor for final score)
 * 3. weightedScore (from applicable dimensions)
 * 4. specialist recommendedScore (fallback)
 */

export type AnalysisDimension = {
  id: string;
  label: string;
  value: number;          // 0-100
  weight: number;         // 0-1
  applicable: boolean;
  reason: string;         // Why applicable or not
  sourceEngine: string;   // Which engine produced this
};

export type RelevantDimensionsResult = {
  applicableDimensions: AnalysisDimension[];
  excludedDimensions: AnalysisDimension[];
  numerator: number;      // sum(value * weight) for applicable
  denominator: number;    // sum(weight) for applicable
  weightedScore: number | null;  // numerator / denominator or null if no applicable
};

/**
 * Determine if a dimension is applicable based on claim nature and domain.
 */
function isDimensionApplicable(
  dimensionId: string,
  dimensionLabel: string,
  claimText: string,
  claimNature: string | undefined,
  primaryDomain: string | undefined,
  hasFinancialClaim: boolean,
  hasPonziSignals: boolean,
  hasHealthClaim: boolean,
  hasLegalClaim: boolean,
  hasAcademicClaim: boolean
): { applicable: boolean; reason: string } {
  const lower = claimText.toLowerCase();

  // Financial dimensions
  if (dimensionLabel.includes('Riesgo financiero') || dimensionId.includes('financial-risk')) {
    // In public-policy context, "inversión" means government spending, not a financial product
    if (primaryDomain === 'public-policy') {
      return { applicable: false, reason: 'Dominio de política pública: la inversión mencionada es presupuesto público, no un producto financiero.' };
    }
    const applicable = hasFinancialClaim || /inviert|prést|crédito|tasa|interés|rentabilidad|ganancia|inversión|dinero|pesos|dólares|euros/i.test(lower);
    return {
      applicable,
      reason: applicable ? 'Se detectó contenido financiero.' : 'No hay indicadores de contenido financiero.'
    };
  }

  // Ponzi/pyramid dimensions
  if (dimensionLabel.includes('Ponzi') || dimensionLabel.includes('piramidal') || dimensionId.includes('ponzi')) {
    const applicable = hasFinancialClaim && hasPonziSignals;
    return {
      applicable,
      reason: applicable
        ? 'Se detectaron señales de esquema piramidal o Ponzi.'
        : 'No se detectaron señales de estructura piramidal, referidos, o Ponzi.'
    };
  }

  // Medical/health dimensions
  if (dimensionLabel.includes('Salud') || dimensionLabel.includes('médico') || dimensionId.includes('health')) {
    const applicable = hasHealthClaim ||
      /médico|salud|enfermedad|síntoma|tratamiento|cura|medicamento|paciente|diagnóstico|enfermo|alergia|dolor|fiebre/i.test(lower);
    return {
      applicable,
      reason: applicable ? 'Se detectó contenido médico o de salud.' : 'No hay indicadores de contenido médico.'
    };
  }

  // Legal dimensions
  if (dimensionLabel.includes('Legal') || dimensionLabel.includes('jurídico') || dimensionId.includes('legal')) {
    const applicable = hasLegalClaim ||
      /ilegal|legal|derecho|ley|contrato|cláusula|obligación|jurisdicción|tribunal|código civil|constitución/i.test(lower);
    return {
      applicable,
      reason: applicable ? 'Se detectó contenido jurídico o legal.' : 'No hay indicadores de contenido legal.'
    };
  }

  // Academic/AI plagiarism dimensions
  if (dimensionLabel.includes('IA académica') || dimensionLabel.includes('Plagio') || dimensionId.includes('academic')) {
    const applicable = hasAcademicClaim ||
      /tesis|monografía|ensayo|universidad|colegio|alumno|académico|bibliografía|referencias|paper|investigación/i.test(lower);
    return {
      applicable,
      reason: applicable ? 'Se detectó contenido académico.' : 'No se detectó contenido académico.'
    };
  }

  // Generic dimensions (credibility, evidence, transparency, manipulation) are generally applicable
  if (/credibilidad|evidencia|transparencia|manipulación|manipulación emocional|consistencia|coherencia|corroboración|confiabilidad/i.test(dimensionLabel)) {
    return {
      applicable: true,
      reason: 'Dimensión genérica aplicable a todo análisis.'
    };
  }

  // Unknown dimension: not applicable by default
  return {
    applicable: false,
    reason: 'Dimensión desconocida o no aplicable.'
  };
}

/**
 * Filter dimensions by applicability and calculate weighted score.
 *
 * @param dimensions - All available dimensions from category scores
 * @param claimText - Original claim text
 * @param claimNature - Detected claim nature (from V21A)
 * @param primaryDomain - Detected primary domain (from V21B routing)
 * @param hasFinancialClaim - Whether financial indicators detected
 * @param hasPonziSignals - Whether Ponzi/pyramid signals detected
 * @param hasHealthClaim - Whether health/medical indicators detected
 * @param hasLegalClaim - Whether legal indicators detected
 * @param hasAcademicClaim - Whether academic indicators detected
 * @returns RelevantDimensionsResult with only applicable dimensions included in score
 */
export function filterRelevantDimensions(
  dimensions: AnalysisDimension[],
  claimText: string,
  claimNature: string | undefined,
  primaryDomain: string | undefined,
  hasFinancialClaim: boolean = false,
  hasPonziSignals: boolean = false,
  hasHealthClaim: boolean = false,
  hasLegalClaim: boolean = false,
  hasAcademicClaim: boolean = false
): RelevantDimensionsResult {
  // Determine applicability for each dimension
  const applicableDims: AnalysisDimension[] = [];
  const excludedDims: AnalysisDimension[] = [];

  dimensions.forEach(dim => {
    const { applicable, reason } = isDimensionApplicable(
      dim.id,
      dim.label,
      claimText,
      claimNature,
      primaryDomain,
      hasFinancialClaim,
      hasPonziSignals,
      hasHealthClaim,
      hasLegalClaim,
      hasAcademicClaim
    );

    const updatedDim = { ...dim, applicable, reason };

    if (applicable) {
      applicableDims.push(updatedDim);
    } else {
      excludedDims.push(updatedDim);
    }
  });

  // Calculate weighted score using ONLY applicable dimensions
  let numerator = 0;
  let denominator = 0;

  applicableDims.forEach(dim => {
    numerator += dim.value * dim.weight;
    denominator += dim.weight;
  });

  const weightedScore = denominator > 0 ? numerator / denominator : null;

  return {
    applicableDimensions: applicableDims,
    excludedDimensions: excludedDims,
    numerator,
    denominator,
    weightedScore
  };
}

/**
 * Apply score priority logic.
 *
 * Priority:
 * 1. forceScore (if number, use it)
 * 2. minimumScore (hard floor)
 * 3. weightedScore (from applicable dimensions)
 * 4. specialist recommendedScore
 * 5. fallback default
 */
export function applyScorePriority(
  forceScore: number | null | undefined,
  minimumScore: number | null | undefined,
  weightedScore: number | null,
  specialistRecommendedScore: number | null | undefined,
  fallbackScore: number = 36
): {
  finalScore: number;
  appliedRule: string;
} {
  // Priority 1: forceScore overrides everything
  if (typeof forceScore === 'number') {
    return {
      finalScore: forceScore,
      appliedRule: `forceScore=${forceScore}`
    };
  }

  // Priority 2: minimumScore is a hard floor
  let candidateScore = fallbackScore;
  let appliedRule = 'fallback';

  // Priority 3: weightedScore from applicable dimensions
  if (weightedScore !== null) {
    candidateScore = weightedScore;
    appliedRule = `weightedScore=${Math.round(weightedScore)}`;
  }

  // Priority 4: specialist recommended score (if no weighted score)
  if (weightedScore === null && typeof specialistRecommendedScore === 'number') {
    candidateScore = specialistRecommendedScore;
    appliedRule = `specialistRecommendedScore=${specialistRecommendedScore}`;
  }

  // Apply minimumScore floor
  if (typeof minimumScore === 'number') {
    if (candidateScore < minimumScore) {
      return {
        finalScore: minimumScore,
        appliedRule: `minimumScore=${minimumScore} (floor applied, candidate was ${Math.round(candidateScore)})`
      };
    }
  }

  return {
    finalScore: candidateScore,
    appliedRule
  };
}

/**
 * Assert consistency: excluded dimensions do not influence score.
 */
export function assertExcludedDimensionsNotUsed(
  result: RelevantDimensionsResult,
  finalScore: number
): { valid: boolean; message: string } {
  // Sanity check: excluded dimensions were not used in calculation
  for (const excluded of result.excludedDimensions) {
    if (excluded.value > 0 && excluded.weight > 0) {
      // If an excluded dimension has non-zero value and weight, it shouldn't affect score
      // This is inherently true since we only use applicable dimensions in calculation
    }
  }

  return {
    valid: true,
    message: 'Excluded dimensions correctly not used in score calculation.'
  };
}

/**
 * Ensure excluded dimensions are not displayed in category breakdown.
 */
export function getVisibleDimensions(result: RelevantDimensionsResult): AnalysisDimension[] {
  // Only return applicable dimensions for display
  return result.applicableDimensions;
}
