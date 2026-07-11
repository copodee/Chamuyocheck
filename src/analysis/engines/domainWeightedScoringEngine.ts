import { filterRelevantDimensions, type AnalysisDimension } from './relevantDimensionsGate';

export type ScoringDimension = {
  id: string;
  label: string;
  value: number;       // 0-100
  weight: number;      // 0-1
  applicable: boolean;
  reason: string;
};

export type DomainWeightedResult = {
  finalScore: number;
  dimensions: ScoringDimension[];
  applicableDimensions: ScoringDimension[];
  excludedDimensions: ScoringDimension[];
  domain: string;
  isExtraordinaryClaim: boolean;
  extraordinarySeverity: 'extreme' | 'high' | 'medium' | 'none';
  breakdown: string;
};

// Detect extraordinary claims (not logically impossible, but highly unusual/skeptical)
function detectExtraordinaryClaim(text: string): { isExtraordinary: boolean; severity: 'high' | 'medium' | 'none' } {
  const lower = text.toLowerCase();

  // Extraterrestrials seen in a city recently
  if (/(extra|alien|extraterrestre|ovni|ufo|extrahumano).*(?:visto|vist[oa]|vieron?|observ[oa]do|detect[oa]do|present[eo]|apareci[oó]|encontr[oa]do)\s+.*(?:argentina|buenos\s+aires|c[aó]rdoba|mendoza|rosario|ciudad|pueblo|calle|parque|plaza|lugar)/i.test(lower) &&
    /(hace\s+)?(\d+)\s*(?:d[ií]as?|horas?|semanas?|meses?|a[ñn]os?)?\b/i.test(lower)) {
    return { isExtraordinary: true, severity: 'high' };
  }

  // Recent sightings of unusual/impossible phenomena in specific locations
  if (/(vieron?|observ[oa]ron?|detect[oa]ron?|apareci[oó]|encontr[oa]ron?)\s+.*(?:hace\s+)?(\d+)\s*(?:d[ií]as?|horas?)\b/i.test(lower) &&
    /(extraterrestre|ovni|fantasma|monstruo|criatura|criatura\s+desconocida|aparici[oó]n|fenómeno|evento|suceso)/i.test(lower)) {
    return { isExtraordinary: true, severity: 'high' };
  }

  // Hidden technology or medical cure presented as fact
  if (/(existe\s+)?(?:tecnolog[ií]a|cura|tratamiento|m[eé]todo)\s+(?:oculto|prohibido|suprimido|escondido)\s+(?:que\s+)?(?:pueden?|puede|cura[rn]?|trata[rn]?)/i.test(lower)) {
    return { isExtraordinary: true, severity: 'high' };
  }

  return { isExtraordinary: false, severity: 'none' };
}

export function calculateDomainWeightedScore(
  allCategoryScores: Array<{ name: string; score: number; explanation: string }>,
  text: string,
  topic: string | undefined,
  inputKind: string,
  forceScore: number | null,
  hasFinancialClaim: boolean,
  hasPonziSignals: boolean,
  hasHealthClaim: boolean = false,
  hasLegalClaim: boolean = false,
  hasAcademicClaim: boolean = false,
  claimNature: string | undefined = undefined
): DomainWeightedResult {
  try {
    const lower = text.toLowerCase();
    const { isExtraordinary, severity: extraordinarySeverity } = detectExtraordinaryClaim(text);

    // Build dimension list
    const dimensions: ScoringDimension[] = allCategoryScores.map((cat) => {
      return {
        id: cat.name.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-'),
        label: cat.name,
        value: cat.score,
        weight: 0.15, // default, will be overridden below
        applicable: true, // Will be overridden by gate
        reason: 'Dimensión inicial'
      };
    });

    // GATE: Apply strict applicability rules based on claim nature and domain
    const gateResult = filterRelevantDimensions(
      dimensions as AnalysisDimension[],
      text,
      claimNature,
      topic,
      hasFinancialClaim,
      hasPonziSignals,
      hasHealthClaim,
      hasLegalClaim,
      hasAcademicClaim
    );

    // Update dimensions with gate's applicability decisions
    dimensions.forEach((dim) => {
      const gateDim = gateResult.applicableDimensions.find((d) => d.id === dim.id);
      const excludedDim = gateResult.excludedDimensions.find((d) => d.id === dim.id);
      
      if (gateDim) {
        dim.applicable = true;
        dim.reason = gateDim.reason;
      } else if (excludedDim) {
        dim.applicable = false;
        dim.reason = excludedDim.reason;
      }
    });

    // Apply domain-specific weights for extraordinary claims
    if (isExtraordinary) {
      // For extraordinary claims, prioritize evidence and corroboration
      const evidenceIdx = dimensions.findIndex((d) => d.label === 'Evidencia faltante');
      const transparencyIdx = dimensions.findIndex((d) => d.label === 'Transparencia');
      const manipulationIdx = dimensions.findIndex((d) => d.label === 'Manipulación emocional');

      if (evidenceIdx >= 0) {
        dimensions[evidenceIdx].weight = 0.30; // External evidence is critical
        dimensions[evidenceIdx].applicable = true;
      }
      if (transparencyIdx >= 0) {
        dimensions[transparencyIdx].weight = 0.25; // Source credibility matters
        dimensions[transparencyIdx].applicable = true;
      }
      if (manipulationIdx >= 0) {
        dimensions[manipulationIdx].weight = 0.15;
        dimensions[manipulationIdx].applicable = true;
      }

      // Mark financial/ponzi as not applicable for extraordinary claims
      dimensions.forEach((d) => {
        if (d.id === 'riesgo-financiero' || d.id === 'riesgo-piramidal-ponzi') {
          d.applicable = false;
          d.reason = 'No aplica a afirmación extraordinaria de evento público.';
        }
      });
    } else {
      // For ordinary claims, drastically reduce weight on evidence and transparency
      const evidenceIdx = dimensions.findIndex((d) => d.label === 'Evidencia faltante');
      const transparencyIdx = dimensions.findIndex((d) => d.label === 'Transparencia');
      const manipulationIdx = dimensions.findIndex((d) => d.label === 'Manipulación emocional');
      
      // Reduce both value and weight for evidence for ordinary claims
      if (evidenceIdx >= 0 && dimensions[evidenceIdx].value > 50) {
        dimensions[evidenceIdx].value = Math.min(dimensions[evidenceIdx].value, 12);
        dimensions[evidenceIdx].weight = 0.02; // Minimal weight
      }
      if (transparencyIdx >= 0) {
        dimensions[transparencyIdx].weight = 0.05; // Minimal weight
      }
      if (manipulationIdx >= 0) {
        dimensions[manipulationIdx].weight = 0.30; // Focus on manipulation signals
      }
      
      // Set explicit weights for all financial/Ponzi to be applicable but low
      dimensions.forEach((d) => {
        if (d.id === 'riesgo-financiero' || d.id === 'riesgo-piramidal-ponzi') {
          d.weight = 0.01; // Nearly zero weight
        }
        if (d.label === 'Posible IA académica') {
          d.weight = 0.02; // Nearly zero weight
        }
      });
    }

    // Calculate weighted score using only applicable dimensions
    const applicableDimensions = dimensions.filter((d) => d.applicable);
    const excludedDimensions = dimensions.filter((d) => !d.applicable);

    let finalScore = forceScore ?? 36; // default if no force

    if (applicableDimensions.length > 0 && forceScore === null) {
      const totalWeight = applicableDimensions.reduce((sum, d) => sum + d.weight, 0);

      if (totalWeight > 0) {
        const weightedSum = applicableDimensions.reduce((sum, d) => sum + d.value * d.weight, 0);
        finalScore = Math.round(weightedSum / totalWeight);
      }
    }

    // If extraordinary but not forced to 100, boost to 90+
    if (isExtraordinary && forceScore === null && finalScore < 90) {
      if (extraordinarySeverity === 'high') {
        finalScore = Math.max(finalScore, 90);
      }
    }

    const breakdown = `Dimensiones aplicables: ${applicableDimensions.length}. ` +
      `${applicableDimensions.map((d) => `${d.label} (${d.value}, peso ${(d.weight * 100).toFixed(0)}%)`).join('; ')}.`;

    return {
      finalScore,
      dimensions,
      applicableDimensions,
      excludedDimensions,
      domain: topic || 'general',
      isExtraordinaryClaim: isExtraordinary,
      extraordinarySeverity,
      breakdown
    };
  } catch (error) {
    console.error('Error in calculateDomainWeightedScore:', error);
    // Return safe default
    return {
      finalScore: 36,
      dimensions: [],
      applicableDimensions: [],
      excludedDimensions: [],
      domain: topic || 'general',
      isExtraordinaryClaim: false,
      extraordinarySeverity: 'none',
      breakdown: 'Error en cálculo ponderado.'
    };
  }
}
