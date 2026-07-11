/**
 * V20 Knowledge Router Types
 * Defines the routing and specialist result interfaces for domain-specific claim evaluation
 */

export type KnowledgeDomain =
  | 'mathematics'
  | 'science'
  | 'biology-health'
  | 'finance'
  | 'history-sports'
  | 'technology'
  | 'legal'
  | 'public-claims'
  | 'public-policy'
  | 'politics'
  | 'opinion-prediction'
  | 'general'
  | 'unknown';

export type SpecialistVerdict =
  | 'supported'
  | 'contradicted'
  | 'extraordinary-unverified'
  | 'disputed'
  | 'opinion'
  | 'prediction'
  | 'unknown';

export interface SpecialistResult {
  domain: KnowledgeDomain;
  applicable: boolean;
  confidence: number; // 0-1
  verdict: SpecialistVerdict;
  recommendedScore?: number;
  minimumScore?: number;
  forceScore?: number;
  reason: string;
  evidenceNeeded: string[];
  externalVerificationRequired: boolean;
  suggestedSourceTypes?: string[];
}

export interface RoutedClaimResult {
  claimText: string;
  primaryDomain: KnowledgeDomain;
  secondaryDomains: KnowledgeDomain[];
  routingConfidence: number;
  specialistResults: SpecialistResult[];
  selectedResult: SpecialistResult;
}
