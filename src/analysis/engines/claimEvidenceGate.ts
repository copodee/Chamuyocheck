import type { RoutedClaimResult } from '../types/knowledgeRouter';

export type ClaimClassification = 'factual' | 'opinion' | 'prediction' | 'question' | 'advertising' | 'instruction';
export type ClaimSeverity = 'impossible' | 'extraordinary' | 'disputed' | 'ordinary' | 'unknown';
export type EvidenceStatus = 'supplied' | 'weak' | 'unverifiable' | 'none';

export type AnalyzedClaim = {
  text: string;
  classification: ClaimClassification;
  severity: ClaimSeverity;
  domain: string;
  externallyVerifiable: boolean;
  evidenceInInput: string[];
  evidenceStatus: EvidenceStatus;
  forceScore: number | null;
  minimumScore: number | null;
  reason: string;
  routedResult?: RoutedClaimResult;
};

/**
 * Evidence gate: determine forceScore and minimumScore based on claim type and evidence
 */
export function applyEvidenceGate(claim: AnalyzedClaim): AnalyzedClaim {
  // A) Impossible or contradicted by established knowledge
  if (claim.severity === 'impossible') {
    return {
      ...claim,
      forceScore: 100,
      minimumScore: null,
      reason: 'Contradicts established scientific/factual knowledge. Impossible claim = maximum chamuyo score.'
    };
  }

  // B) Extraordinary claim with no evidence supplied
  if (claim.severity === 'extraordinary' && claim.evidenceStatus === 'none') {
    return {
      ...claim,
      forceScore: null,
      minimumScore: 90,
      reason: 'Extraordinary claim without supporting evidence. Minimum chamuyo = 90 (cannot be lowered by heuristics).'
    };
  }

  // C) Extraordinary with weak or unverifiable evidence
  if (claim.severity === 'extraordinary' && (claim.evidenceStatus === 'weak' || claim.evidenceStatus === 'unverifiable')) {
    return {
      ...claim,
      forceScore: null,
      minimumScore: 80,
      reason: 'Extraordinary claim with weak/unverifiable evidence. Minimum chamuyo = 80.'
    };
  }

  // D) Ordinary factual claim: score normally, no force or minimum
  if (claim.severity === 'ordinary' && claim.classification === 'factual') {
    return {
      ...claim,
      forceScore: null,
      minimumScore: null,
      reason: 'Ordinary factual claim. Score based on evidence quality and sources.'
    };
  }

  // E) Opinion or prediction: score manipulation/certainty, not as false fact
  if (claim.classification === 'opinion' || claim.classification === 'prediction') {
    return {
      ...claim,
      forceScore: null,
      minimumScore: null,
      reason: `${claim.classification} claim. Score framing, certainty, and manipulation signals only; not as factual claim.`
    };
  }

  // Unknown: apply minimal gate
  return {
    ...claim,
    forceScore: null,
    minimumScore: null,
    reason: 'Unknown severity/classification. Score based on available signals.'
  };
}
