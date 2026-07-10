import type { AnalyzedClaim, ClaimClassification, ClaimSeverity, EvidenceStatus } from './claimEvidenceGate';
import { applyEvidenceGate } from './claimEvidenceGate';
import { scoreIndividualClaim, type ClaimScore } from './claimScoringEngine';
import { routeClaim } from './knowledgeRouter';
import { detectClaimNature } from './claimNatureDetector';

export type ClaimFirstResult = {
  claims: AnalyzedClaim[];
  claimScores: ClaimScore[];
  finalScore: number;
  dominantClaim: AnalyzedClaim | null;
  breakdown: string;
};

/**
 * Extract sentences/clauses as claims from text
 */
function extractClaims(text: string): string[] {
  // Remove any internal metadata/headers
  let cleanText = text
    .replace(/PREGUNTA O CONTEXTO DEL USUARIO:/gi, '')
    .replace(/Contexto del usuario:/gi, '')
    .trim();

  // Split by sentence boundaries while preserving meaning
  const sentences = cleanText
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && !s.match(/^[\d\s,.-]+$/) && !s.match(/^Contenido recibido/i));

  return sentences;
}

/**
 * Classify a claim by type
 */
function classifyClaimType(text: string): ClaimClassification {
  const lower = text.toLowerCase();

  // Question
  if (/^\s*¿|^\s*que|^\s*cuál|^\s*cuándo|^\s*dónde|^\s*cómo|^\s*por qué|\?$/.test(lower)) {
    return 'question';
  }

  // Prediction (future)
  if (/mañana|próximo|dentro\s*de|va\s*a|será|habrá|sucederá|ocurrirá|futura|futuro/i.test(lower)) {
    return 'prediction';
  }

  // Opinion
  if (/creo\s*que|pienso\s*que|opino|considero|me\s*parece|en\s*mi\s*opinión|personalmente|a\s*mi\s*juicio|definitivamente|absolutamente|seguramente|claramente|obviamente|sin duda/i.test(lower)) {
    return 'opinion';
  }

  // Instruction/Command (only strict commands, not general statements)
  if (/^\s*(haz|haga|hagas|compra|compre|llama|llamá|no|nunca|evita|evite)\s+/.test(lower)) {
    return 'instruction';
  }

  // Advertising
  if (
    /\b(oferta|promoción|descuento|gratis|gana|ganará|ganarás|dinero fácil|rápido|instant|urgente|limitado|ahora mismo)\b/i.test(
      lower
    )
  ) {
    return 'advertising';
  }

  // Default: factual
  return 'factual';
}

/**
 * Classify claim severity (impossible, extraordinary, ordinary, etc.)
 */
function classifyClaimSeverity(text: string): ClaimSeverity {
  const lower = text.toLowerCase();

  // Detect impossible claims (scientific impossibilities)
  const impossiblePatterns = [
    /tierra plana|flat earth/i,
    /vacunas.*microchip|chips en vacunas/i,
    /nunca pisamos.*luna|moon hoax|no pisamos/i,
    /2\s*\+\s*2\s*=\s*5|matemática falsa/i,
    /humano.*perro.*híbrido|perro.*humano.*hijo|cría de perro|can.*human hybrid/i,
    /hombre.*embarazado|varón embarazado|hombre cis.*embarazo sin útero/i,
    /teletransportación real|cuerpo humano.*teletransporte/i,
    /dinosaurio vivo actualmente|dinosaurio caminando/i
  ];

  if (impossiblePatterns.some((p) => p.test(lower))) {
    return 'impossible';
  }

  // Detect extraordinary but not impossible claims
  const extraordinaryPatterns = [
    /extraterrestre|ovni|platillo volador|alienígena/i,
    /milagro|sobrenatural|fantasma|aparición/i,
    /tecnología secreta|prohibida|suprimida|ocultada/i,
    /gobierno.*oculta|conspiración|coverup/i,
    /hace\s+(\d+)\s*(día|semana|mes)\s+(vieron?|descubrieron?|encontraron?)/i
  ];

  if (extraordinaryPatterns.some((p) => p.test(lower))) {
    return 'extraordinary';
  }

  // Disputed claims (controversial but not clearly impossible)
  const disputedPatterns = [
    /mejor que|peor que|más importante/i,
    /siempre|nunca|todos|nadie/i
  ];

  if (disputedPatterns.some((p) => p.test(lower))) {
    return 'disputed';
  }

  return 'ordinary';
}

/**
 * Detect evidence supplied in the claim text
 */
function detectEvidenceInText(text: string): string[] {
  const evidence: string[] = [];
  const lower = text.toLowerCase();

  if (/estudi|investigación|investigadores|estudio|research/i.test(lower)) {
    evidence.push('Study/research mentioned');
  }
  if (/doctor|médico|especialista|experto|profesor|científico/i.test(lower)) {
    evidence.push('Expert mentioned');
  }
  if (/link|url|http|www|fuente|source|referencia/i.test(lower)) {
    evidence.push('Source/reference mentioned');
  }
  if (/video|foto|imagen|prueba|evidencia|registro|document/i.test(lower)) {
    evidence.push('Media/documentation mentioned');
  }
  if (/\d+%|\d+\s*(?:año|mes|día|persona|gente)/i.test(lower)) {
    evidence.push('Specific data/numbers');
  }

  return evidence;
}

/**
 * Determine evidence status (supplied, weak, unverifiable, none)
 */
function determineEvidenceStatus(claimText: string, evidenceInText: string[]): EvidenceStatus {
  if (evidenceInText.length >= 2) {
    return 'supplied';
  }
  if (evidenceInText.length === 1) {
    return 'weak';
  }
  if (/científicamente imposible|matemáticamente/i.test(claimText)) {
    return 'unverifiable';
  }
  return 'none';
}

/**
 * Main pipeline: extract, classify, and score claims
 */
export function runClaimFirstPipeline(text: string): ClaimFirstResult {
  // Step 1: Extract claims (sentences/clauses)
  const claimTexts = extractClaims(text);

  // If only one claim extracted, treat as single claim
  if (claimTexts.length === 0) {
    return {
      claims: [],
      claimScores: [],
      finalScore: 36,
      dominantClaim: null,
      breakdown: 'No claims extracted from text.'
    };
  }

  // Step 2: Analyze each claim and route through knowledge router
  const claims: AnalyzedClaim[] = claimTexts.map((claimText) => {
    const classification = classifyClaimType(claimText);
    const severity = classifyClaimSeverity(claimText);
    const evidenceInInput = detectEvidenceInText(claimText);
    const evidenceStatus = determineEvidenceStatus(claimText, evidenceInInput);

    // Determine if externally verifiable
    const externallyVerifiable =
      classification === 'factual' && severity === 'ordinary' && !/(opinión|creo|pienso|parece)/i.test(claimText);

    // Route through knowledge router to get specialist evaluation
    const routedResult = routeClaim(claimText);

    // V21 Phase 1: Shadow mode - detect claim nature without using it yet for routing/scoring
    const claimNature = detectClaimNature(claimText);

    return {
      text: claimText,
      classification,
      severity,
      domain: severity === 'extraordinary' ? 'scientific/public-event' : 'general',
      externallyVerifiable,
      evidenceInInput,
      evidenceStatus,
      forceScore: null,
      minimumScore: null,
      reason: '',
      routedResult,
      claimNature
    };
  });

  // Step 3: Apply evidence gates
  const gatedClaims = claims.map(applyEvidenceGate);

  // Step 4: Score each claim (pass routed result for specialist-based scoring)
  const claimScores = gatedClaims.map((claim) => scoreIndividualClaim(claim, claim.routedResult));

  // Step 5: Aggregate to final score
  // Rule: if any claim has forceScore=100, final=100
  const forcedScore = claimScores.find((cs) => cs.claim.forceScore === 100);
  if (forcedScore) {
    return {
      claims: gatedClaims,
      claimScores,
      finalScore: 100,
      dominantClaim: forcedScore.claim,
      breakdown: `Impossible claim detected: "${forcedScore.claim.text}". Final score = 100.`
    };
  }

  // Rule: if any claim has minimumScore >= 90, use its adjusted score and promote to at least 90
  const highMinimumClaim = claimScores.find((cs) => cs.claim.minimumScore && cs.claim.minimumScore >= 90);
  if (highMinimumClaim) {
    const maxScore = Math.max(
      ...claimScores.map((cs) => cs.adjustedScore),
      highMinimumClaim.claim.minimumScore
    );
    return {
      claims: gatedClaims,
      claimScores,
      finalScore: Math.max(maxScore, 90),
      dominantClaim: highMinimumClaim.claim,
      breakdown: `Extraordinary claim without evidence: "${highMinimumClaim.claim.text}". Final score >= 90.`
    };
  }

  // Rule: for multiple claims, use highest severity/score
  // Don't average: take the score of the most severe/critical claim
  const dominantScore = claimScores.reduce((max, current) => {
    // Prioritize by severity
    const severityOrder = { impossible: 4, extraordinary: 3, disputed: 2, ordinary: 1, unknown: 0 };
    const maxSeverity = severityOrder[max.claim.severity] || 0;
    const currentSeverity = severityOrder[current.claim.severity] || 0;

    if (currentSeverity > maxSeverity) return current;
    if (currentSeverity === maxSeverity && current.adjustedScore > max.adjustedScore) return current;
    return max;
  });

  return {
    claims: gatedClaims,
    claimScores,
    finalScore: dominantScore.adjustedScore,
    dominantClaim: dominantScore.claim,
    breakdown: `Multiple claims detected. Dominant: "${dominantScore.claim.text}" (${dominantScore.claim.severity}) → ${dominantScore.adjustedScore}`
  };
}
