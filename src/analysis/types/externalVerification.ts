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

export type ExternalVerificationPriority = 'critical' | 'high' | 'standard';

export type ExternalVerificationWorkItem = {
  priority: ExternalVerificationPriority;
  primaryDomain: KnowledgeDomain;
  claimIndexes: number[];
  reasons: string[];
  suggestedSourceTypes: string[];
  minimumIndependentSources: number;
  recencyRequired: boolean;
  officialSourceRequired: boolean;
  jurisdictions: string[];
};

export type DocumentExternalVerificationPlan = {
  externalVerificationRequired: boolean;
  externalVerificationPerformed: false;
  verificationCutoffDate: string;
  totalClaims: number;
  claimsRequiringExternalVerification: number;
  suggestedSourceTypes: string[];
  minimumIndependentSources: number;
  recencyRequired: boolean;
  officialSourceRequired: boolean;
  jurisdictions: string[];
  workItems: ExternalVerificationWorkItem[];
};

export type ExternalVerificationSourceRecord = {
  sourceType: string;
  url: string;
  title: string;
  retrievedAt: string;
  sourceDate?: string;
  claimIndexes: number[];
  official: boolean;
  excerpt?: string;
};

export type ExternalVerificationExecutionStatus =
  | 'not-performed'
  | 'partial'
  | 'complete'
  | 'invalid';

export type ExternalVerificationExecutionResult = {
  externalVerificationPerformed: boolean;
  status: ExternalVerificationExecutionStatus;
  records: ExternalVerificationSourceRecord[];
  coveredClaimIndexes: number[];
  errors: string[];
};
