import type { ClaimNatureResult } from './claimNature';
import type { KnowledgeDomain } from './contentDomain';

export type ExternalVerificationPlan = {
  externalVerificationRequired: boolean;
  externalVerificationPerformed: boolean;
  reason: string;
  suggestedSourceTypes: string[];
  minimumIndependentSources: number;
  recencyRequired: boolean;
  officialSourceRequired: boolean;
  jurisdictionalRelevance?: string;
};

export type ExternalVerificationDecisionInput = {
  claimText: string;
  claimNature: ClaimNatureResult;
  primaryDomain: KnowledgeDomain;
  secondaryDomains?: KnowledgeDomain[];
};
