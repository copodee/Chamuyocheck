import type { AnalyzedClaim } from './claimEvidenceGate';
import type { RoutedClaimResult } from '../types/knowledgeRouter';

export type ClaimScore = {
  claim: AnalyzedClaim;
  routedResult?: RoutedClaimResult;
  baseScore: number;
  adjustedScore: number;
  breakdown: string;
};

/**
 * Score a single claim based on its characteristics, evidence, and specialist routing
 */
export function scoreIndividualClaim(claim: AnalyzedClaim, routedResult?: RoutedClaimResult): ClaimScore {
  let baseScore = 36; // Start conservative
  let adjustedScore = baseScore;


  // If forceScore is set by evidence gate, use it (impossible claims = 100)
  if (claim.forceScore !== null) {
    return {
      claim,
      routedResult,
      baseScore: claim.forceScore,
      adjustedScore: claim.forceScore,
      breakdown: `Forced score by evidence gate (${claim.reason})`
    };
  }

  // V20: Use specialist routing if available
  if (routedResult && routedResult.selectedResult.applicable) {
    const specialist = routedResult.selectedResult;

    // Apply specialist's forceScore if set (must be a number, not undefined/null)
    if (typeof specialist.forceScore === 'number') {
      adjustedScore = specialist.forceScore;
      return {
        claim,
        routedResult,
        baseScore: specialist.forceScore,
        adjustedScore: specialist.forceScore,
        breakdown: `Specialist verdict (${specialist.domain}): ${specialist.verdict} → ${specialist.forceScore}`
      };
    }

    // Apply specialist's minimumScore floor
    if (typeof specialist.minimumScore === 'number') {
      adjustedScore = specialist.minimumScore;
    }

    // Apply specialist's recommended score
    if (typeof specialist.recommendedScore === 'number') {
      if (typeof specialist.minimumScore === 'number') {
        adjustedScore = Math.max(specialist.recommendedScore, specialist.minimumScore);
      } else {
        adjustedScore = specialist.recommendedScore;
      }
    }

    // For 'supported' verdicts with high confidence, use low score
    if (specialist.verdict === 'supported' && specialist.confidence > 0.85) {
      adjustedScore = specialist.recommendedScore || 5;
    }

    // For 'contradicted' verdicts, it should have forceScore set (handled above)
    // But if not, ensure high score (unless minimumScore is specified)
    if (specialist.verdict === 'contradicted' && typeof specialist.forceScore !== 'number') {
      if (typeof specialist.minimumScore === 'number') {
        // If minimumScore is specified, use it (don't force to 90)
        adjustedScore = specialist.minimumScore;
      } else {
        // Otherwise ensure high score
        adjustedScore = Math.max(adjustedScore, 90);
      }
    }

    // For 'extraordinary-unverified' verdicts, enforce minimumScore
    if (specialist.verdict === 'extraordinary-unverified' && typeof specialist.minimumScore === 'number') {
      adjustedScore = Math.max(adjustedScore, specialist.minimumScore);
    }

    // For 'opinion' and 'prediction' verdicts, use recommended scores
    if ((specialist.verdict === 'opinion' || specialist.verdict === 'prediction') && typeof specialist.recommendedScore === 'number') {
      adjustedScore = specialist.recommendedScore;
    }

    // For unknown verdicts: use classification-based defaults instead of generic fallback
    if (specialist.verdict === 'unknown') {
      if (claim.classification === 'factual') {
        if (claim.severity === 'ordinary') {
          // Ordinary facts: start low, let external verification handle it
          adjustedScore = 15; // Unless evidence suggests otherwise
        } else if (claim.severity === 'extraordinary') {
          // Extraordinary facts without verdict: moderate score
          adjustedScore = 50;
        }
      } else if (claim.classification === 'opinion' || claim.classification === 'prediction') {
        adjustedScore = 25; // Opinions/predictions stay low by default
      }
    }

    // Apply minimumScore floor from claim evidence gate
    if (typeof claim.minimumScore === 'number') {
      adjustedScore = Math.max(adjustedScore, claim.minimumScore);
    }

    adjustedScore = Math.max(10, Math.min(100, Math.round(adjustedScore)));

    const breakdown = `
      Domain: ${specialist.domain}
      Verdict: ${specialist.verdict}
      Confidence: ${(specialist.confidence * 100).toFixed(0)}%
      Reason: ${specialist.reason}
      Base: ${baseScore} → Adjusted: ${adjustedScore}
      External verification required: ${specialist.externalVerificationRequired}
    `;

    return {
      claim,
      routedResult,
      baseScore,
      adjustedScore,
      breakdown
    };
  }

  // Fallback: Original scoring logic if no routing result
  // Score adjustments based on claim type
  if (claim.classification === 'factual') {
    if (claim.severity === 'ordinary') {
      // Ordinary factual claims: start with low defaults
      if (claim.externallyVerifiable) {
        // Well-known, verifiable facts should score very low
        adjustedScore = 10; // Default for verifiable ordinary facts
        
        // Adjust based on evidence status
        if (claim.evidenceStatus === 'supplied') {
          adjustedScore = 5;
        } else if (claim.evidenceStatus === 'weak') {
          adjustedScore = 20;
        } else if (claim.evidenceStatus === 'unverifiable') {
          adjustedScore = 30;
        }
      } else {
        // Non-verifiable ordinary claims: higher default
        if (claim.evidenceStatus === 'supplied') {
          adjustedScore = 15;
        } else if (claim.evidenceStatus === 'weak') {
          adjustedScore = 45;
        } else if (claim.evidenceStatus === 'unverifiable') {
          adjustedScore = 65;
        } else {
          adjustedScore = 75;
        }
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
    adjustedScore = 15; // Lower default for reasonable opinions

    // Check for absolute language (overstated certainty)
    if (/siempre|nunca|definitivamente|100%|cierto\s*que|seguro\s*que|obviamente/i.test(claim.text)) {
      adjustedScore = 35;
    }
  } else if (claim.classification === 'question') {
    // Questions: very low score (not chamuyo-relevant)
    adjustedScore = 5;
  } else if (claim.classification === 'advertising') {
    // Advertising: default to moderate-high
    adjustedScore = 50;
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
    routedResult,
    baseScore,
    adjustedScore,
    breakdown
  };
}
