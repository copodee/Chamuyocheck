/**
 * V20 Knowledge Router
 * Routes each claim to appropriate specialist engines
 * Avoids running all specialists on all claims - only routes to relevant ones
 */

import { evaluateMathematicsClaim } from './specialists/mathKnowledgeEngine';
import { evaluateScienceClaim } from './specialists/scienceKnowledgeEngine';
import { evaluateBiologyHealthClaim } from './specialists/biologyHealthKnowledgeEngine';
import { evaluateFinanceClaim } from './specialists/financeKnowledgeEngine';
import { evaluateHistorySportsClaim } from './specialists/historySportsKnowledgeEngine';
import { evaluateTechnologyClaim } from './specialists/technologyKnowledgeEngine';
import { evaluateLegalClaim } from './specialists/legalKnowledgeEngine';
import { evaluatePublicClaimsClaim } from './specialists/publicClaimsKnowledgeEngine';
import { evaluateOpinionPredictionClaim } from './specialists/opinionPredictionEngine';

import type { RoutedClaimResult, KnowledgeDomain, SpecialistResult } from '../types/knowledgeRouter';

/**
 * Detect the most likely primary and secondary domains for a claim
 * This prevents running all specialists on every claim
 */
function detectPrimaryDomains(claimText: string): { primary: KnowledgeDomain; secondary: KnowledgeDomain[] } {
  const scoresByDomain: Record<KnowledgeDomain, number> = {
    mathematics: 0,
    science: 0,
    'biology-health': 0,
    finance: 0,
    'history-sports': 0,
    technology: 0,
    legal: 0,
    'public-claims': 0,
    'opinion-prediction': 0,
    general: 0,
    unknown: 0
  };

  // Mathematics indicators
  if (/\d+\s*[+\-×*=]|\d+%|suma|total|porcentaje|multiply|divide/i.test(claimText)) {
    scoresByDomain.mathematics += 10;
  }

  // Science indicators
  if (/física|agua|tierra|aire|gravedad|temperatura|luz|energía|atmósfera|vuelo|volar|physics|earth|air|gravity|temperature|light|flying|fly|milagro|miracle|sobrenatural|supernatural|moléculas|molecules|extraterrestre|alien|ovni|ufo/i.test(claimText)) {
    scoresByDomain.science += 10;
  }

  // Biology/Health indicators
  if (/biología|salud|médico|embaraz|vacuna|enfermedad|virus|bacteria|antibiótico|cuerpo|body|energía|energy|cura|cure|recuperación|recovery|\bpeso\b|\bweight\b|pierde|lose|kg|kilogram|health|medical|pregnancy|vaccine|disease/i.test(claimText)) {
    scoresByDomain['biology-health'] += 10;
  }

  // Finance indicators
  if (/pesos?|dólares?|interés|ganancia|inversión|capital|%\s*anual|pirámid|pyramid|reclut|recruit|garantiz|garantía|sin trabajar|sin riesgo|gana|finance|investment|interest|money|earn|guarantee/i.test(claimText)) {
    scoresByDomain.finance += 10;
  }

  // Boost finance for strong scam/promise language
  if (/garantizo|prometo|garantía|ganar.*fácil|dinero.*fácil|sin riesgo|sin trabajar|multiplica.*dinero/i.test(claimText)) {
    scoresByDomain.finance += 15;
  }

  // History/Sports indicators
  if (/mundial|world\s*cup|messi|argentina|fútbol|soccer|campeón|ganó|won|historia|history|guerra|war|año|year|colón|columbus|independencia|independence|siglo|century|fecha|date|conquista|conquest|capital|país|país|ciudad|city|europa|africa|asia|américa|america|país/i.test(claimText)) {
    scoresByDomain['history-sports'] += 10;
  }

  // Technology indicators
  if (/celular|smartphone|computadora|computer|aplicación|app|software|hardware|internet|wifi|carga|charge|telepatía|telepathy|python|java|javascript|programación|programming|lenguaje|language|chip|silicio|silicon|código|code|algoritmo|algorithm/i.test(claimText)) {
    scoresByDomain.technology += 10;
  }

  // Legal indicators
  if (/legal|ley|law|contrato|contract|derecho|right|cláusula|clause|CFT|TEA|ilegal|illegal/i.test(claimText)) {
    scoresByDomain.legal += 10;
  }

  // Public claims indicators (conspiracy theories, government claims, etc.)
  if (/ayer|yesterday|hoy|today|hace\s*\d+|ago|noticia|news|gobierno|government|reciente|recent|chemtrails|conspiración|conspiracy|montaje|setup|controlando|controlling|pruebas|evidence|secreto|secret/i.test(claimText)) {
    scoresByDomain['public-claims'] += 10;
  }

  // Opinion/Prediction indicators - including absolute/overstated language
  let opinionScore = 0;
  if (/creo\s*que|pienso\s*que|me\s*parece|opinión|i\s*think|i\s*believe/i.test(claimText)) {
    opinionScore += 10;
  }
  if (/mañana|próximo|futuro|tomorrow|next|future/i.test(claimText)) {
    opinionScore += 10;
  }
  // Boost score significantly for absolute/overstated claims (often opinions stated as facts)
  if (/definitivamente|absolutamente|seguramente|claramente|obviamente|sin duda|never|always|everybody|nobody|todos|nadie/i.test(claimText)) {
    opinionScore += 15; // Increased from 10 to 15 to beat tied public-claims
  }
  scoresByDomain['opinion-prediction'] += opinionScore;

  // Find primary (highest score)
  const sorted = Object.entries(scoresByDomain)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  const primary = (sorted[0]?.[0] as KnowledgeDomain) || 'general';
  const secondary = sorted.slice(1, 3).map(([domain]) => domain as KnowledgeDomain);

  return { primary, secondary };
}

/**
 * Route a single claim to specialist engines
 * Only runs primary specialist and secondary if needed
 */
export function routeClaim(claimText: string): RoutedClaimResult {
  // Detect primary domains
  const { primary, secondary } = detectPrimaryDomains(claimText);

  const specialistResults: SpecialistResult[] = [];

  // Run only primary specialist
  let primaryResult: SpecialistResult | null = null;

  if (primary === 'mathematics') {
    primaryResult = evaluateMathematicsClaim(claimText);
  } else if (primary === 'science') {
    primaryResult = evaluateScienceClaim(claimText);
  } else if (primary === 'biology-health') {
    primaryResult = evaluateBiologyHealthClaim(claimText);
  } else if (primary === 'finance') {
    primaryResult = evaluateFinanceClaim(claimText);
  } else if (primary === 'history-sports') {
    primaryResult = evaluateHistorySportsClaim(claimText);
  } else if (primary === 'technology') {
    primaryResult = evaluateTechnologyClaim(claimText);
  } else if (primary === 'legal') {
    primaryResult = evaluateLegalClaim(claimText);
  } else if (primary === 'public-claims') {
    primaryResult = evaluatePublicClaimsClaim(claimText);
  } else if (primary === 'opinion-prediction') {
    primaryResult = evaluateOpinionPredictionClaim(claimText);
  }

  // Try secondary specialist only if primary returned "not applicable" or low confidence and unknown
  let secondaryResult: SpecialistResult | null = null;

  if (primaryResult && (!primaryResult.applicable || (primaryResult.verdict === 'unknown' && primaryResult.confidence < 0.6)) && secondary.length > 0) {
    const secondDomain = secondary[0];

    if (secondDomain === 'opinion-prediction' && !primaryResult) {
      secondaryResult = evaluateOpinionPredictionClaim(claimText);
    } else if (secondDomain === 'public-claims' && !primaryResult) {
      secondaryResult = evaluatePublicClaimsClaim(claimText);
    } else if (secondDomain === 'science' && primaryResult?.domain !== 'science') {
      secondaryResult = evaluateScienceClaim(claimText);
    } else if (secondDomain === 'finance' && primaryResult?.domain !== 'finance') {
      secondaryResult = evaluateFinanceClaim(claimText);
    }
  }

  // Add results
  if (primaryResult) {
    specialistResults.push(primaryResult);
  }
  if (secondaryResult && secondaryResult.applicable) {
    specialistResults.push(secondaryResult);
  }

  // Select best result (prefer higher confidence and applicable results)
  let selectedResult = primaryResult || secondaryResult;

  if (!selectedResult) {
    // Fallback: return generic unknown result
    selectedResult = {
      domain: 'unknown',
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Claim could not be routed to any specialist',
      evidenceNeeded: [],
      externalVerificationRequired: true
    };
  }

  // If primary is not applicable but secondary is, use secondary
  if (primaryResult && !primaryResult.applicable && secondaryResult && secondaryResult.applicable) {
    selectedResult = secondaryResult;
  }

  const routingConfidence = selectedResult.confidence || 0;

  return {
    claimText,
    primaryDomain: primary,
    secondaryDomains: secondary,
    routingConfidence,
    specialistResults,
    selectedResult
  };
}
