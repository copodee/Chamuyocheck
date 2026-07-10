import type { AnalyzedClaim } from './claimEvidenceGate';

export type ClaimScore = {
  claim: AnalyzedClaim;
  baseScore: number;
  adjustedScore: number;
  breakdown: string;
};

/**
 * Score a single claim based on its characteristics and evidence
 */
export function scoreIndividualClaim(claim: AnalyzedClaim): ClaimScore {
  let baseScore = 36; // Start conservative

  // If forceScore is set, use it (impossible claims = 100)
  if (claim.forceScore !== null) {
    return {
      claim,
      baseScore: claim.forceScore,
      adjustedScore: claim.forceScore,
      breakdown: `Forced score (${claim.reason})`
    };
  }

  // Apply minimumScore floor (extraordinary without evidence)
  let adjustedScore = baseScore;

  // Score adjustments based on claim type
  if (claim.classification === 'factual') {
    if (claim.severity === 'ordinary') {
      // Ordinary claims: base on evidence
      if (claim.evidenceStatus === 'supplied') {
        adjustedScore = 15; // Low score if evidence supplied
      } else if (claim.evidenceStatus === 'weak') {
        adjustedScore = 45; // Medium score for weak evidence
      } else if (claim.evidenceStatus === 'unverifiable') {
        adjustedScore = 65; // Higher for unverifiable
      } else {
        adjustedScore = 75; // No evidence for ordinary claim
      }

      // Boost if externally verifiable (easier to check)
      if (claim.externallyVerifiable) {
        adjustedScore = Math.max(adjustedScore - 15, 10);
      }
    } else if (claim.severity === 'extraordinary') {
      // Extraordinary claims: score higher unless evidence supplied
      if (claim.evidenceStatus === 'supplied') {
        adjustedScore = 70;
      } else if (claim.evidenceStatus === 'weak') {
        adjustedScore = 85;
      } else if (claim.evidenceStatus === 'unverifiable') {
        adjustedScore = 88;
      } else {
        adjustedScore = 92; // No evidence for extraordinary = very high
      }
    }
  } else if (claim.classification === 'opinion' || claim.classification === 'prediction') {
    // Opinions/predictions: score lower unless overstated as fact
    adjustedScore = 25; // Base for reasonable opinions

    // Check for absolute language (overstated certainty)
    if (/^(siempre|nunca|definitivamente|100%|cierto que|seguro que|obviamente)/i.test(claim.text)) {
      adjustedScore = 45;
    }
  } else if (claim.classification === 'question') {
    // Questions: very low score (not chamuyo-relevant)
    adjustedScore = 5;
  }

  // Apply minimumScore floor
  if (claim.minimumScore !== null) {
    adjustedScore = Math.max(adjustedScore, claim.minimumScore);
  }

  adjustedScore = Math.max(10, Math.min(100, Math.round(adjustedScore)));

  const breakdown = `
    Classification: ${claim.classification}
    Severity: ${claim.severity}
    Evidence status: ${claim.evidenceStatus}
    Externally verifiable: ${claim.externallyVerifiable}
    Base score: ${baseScore} → Adjusted: ${adjustedScore}
    ${claim.minimumScore ? `Minimum floor: ${claim.minimumScore}` : ''}
  `;

  return {
    claim,
    baseScore,
    adjustedScore,
    breakdown
  };
}
