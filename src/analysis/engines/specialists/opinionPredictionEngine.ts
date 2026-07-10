/**
 * Opinion/Prediction Knowledge Engine
 * Evaluates subjective claims, predictions, preferences
 * These should NOT be scored as false facts
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

export function evaluateOpinionPredictionClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'opinion-prediction';

  // Prediction markers
  const predictionPatterns = [
    /creo\s*que.*mañana|i\s*think.*tomorrow/i,
    /pienso\s*que.*próximo|i\s*believe.*next/i,
    /mañana\s+va\s+a|tomorrow.*will/i,
    /próximo\s+año|próxima\s+semana|next\s*(?:week|year|month)/i,
    /futuro|future|predicción|prediction|pronóstico|forecast/i
  ];

  let isPrediction = false;
  for (const pattern of predictionPatterns) {
    if (pattern.test(claimText)) {
      isPrediction = true;
      break;
    }
  }

  if (isPrediction) {
    // Check if overstated with absolute certainty language
    const absoluteLanguage = /siempre|nunca|definitivamente|100%|cierto\s*que|seguro\s*que|obviamente|always|never|definitely|certain/i;
    
    if (absoluteLanguage.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.85,
        verdict: 'prediction',
        recommendedScore: 30,
        reason: 'Prediction stated with overly absolute certainty language',
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }

    return {
      domain,
      applicable: true,
      confidence: 0.9,
      verdict: 'prediction',
      recommendedScore: 15,
      reason: 'Legitimate prediction or forecast (not a false factual claim)',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Opinion markers
  const opinionPatterns = [
    /creo\s*que|i\s*believe/i,
    /pienso\s*que|i\s*think/i,
    /me\s*parece|seems\s*to\s*me/i,
    /opinión|opinion/i,
    /a\s*mi\s*parecer|in\s*my\s*view/i,
    /definitivamente|absolutamente|seguramente|claramente|obviamente|sin duda/i  // Absolute language markers
  ];

  let isOpinion = false;
  for (const pattern of opinionPatterns) {
    if (pattern.test(claimText)) {
      isOpinion = true;
      break;
    }
  }

  if (isOpinion) {
    // Check if it's preference/taste or political/philosophical view
    const preferencePatterns = [
      /mejor|worse|good|bad|hermoso|ugly|bonito|horrible|terrible/i,
      /película|movie|música|music|comida|food|deportes|sport|artista|artist/i
    ];

    let isPreference = false;
    for (const pattern of preferencePatterns) {
      if (pattern.test(claimText)) {
        isPreference = true;
        break;
      }
    }

    if (isPreference) {
      return {
        domain,
        applicable: true,
        confidence: 0.9,
        verdict: 'opinion',
        recommendedScore: 5,
        reason: 'Personal preference or taste (not a false factual claim)',
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }

    // Political/philosophical opinion
    if (/gobierno|president|política|politics|religión|religion|ideología|ideology/i.test(claimText)) {
      // Check for overstated absolute language
      const hasAbsoluteLanguage = /definitivamente|absolutamente|seguramente|claramente|obviamente|sin duda|nunca|siempre/i.test(claimText);
      const score = hasAbsoluteLanguage ? 50 : 20;
      
      return {
        domain,
        applicable: true,
        confidence: 0.85,
        verdict: 'opinion',
        recommendedScore: score,
        reason: 'Political/philosophical opinion (not a false factual claim)',
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }

    return {
      domain,
      applicable: true,
      confidence: 0.8,
      verdict: 'opinion',
      recommendedScore: 15,
      reason: 'Opinion statement (not a false factual claim)',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Not clearly opinion or prediction
  return {
    domain,
    applicable: false,
    confidence: 0,
    verdict: 'unknown',
    reason: 'Not clearly an opinion or prediction',
    evidenceNeeded: [],
    externalVerificationRequired: false
  };
}
