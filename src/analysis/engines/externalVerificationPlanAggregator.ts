import type { AnalyzedClaim } from './claimEvidenceGate';
import type { KnowledgeDomain } from '../types/contentDomain';
import type {
  DocumentExternalVerificationPlan,
  ExternalVerificationPlan,
  ExternalVerificationPriority,
  ExternalVerificationWorkItem,
} from '../types/externalVerification';

const PRIORITY_ORDER: Record<ExternalVerificationPriority, number> = {
  critical: 3,
  high: 2,
  standard: 1,
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function resolvePriority(
  claim: AnalyzedClaim,
  domain: KnowledgeDomain,
  plan: ExternalVerificationPlan
): ExternalVerificationPriority {
  const nature = claim.claimNature?.primaryNature;
  const criticalSources = new Set([
    'clinical-guidelines',
    'health-authorities',
    'government-law-repository',
    'official-gazette',
    'official-market-data',
    'financial-regulators',
  ]);
  if (
    ['biology-health', 'legal', 'finance'].includes(domain) ||
    nature === 'legal-assertion' ||
    nature === 'financial-offer' ||
    plan.suggestedSourceTypes.some((source) => criticalSources.has(source))
  ) return 'critical';

  if (
    ['public-claims', 'public-policy', 'politics', 'advertising-scams', 'economics'].includes(domain) ||
    ['extraordinary-claim', 'rumor', 'statistic'].includes(nature || '')
  ) return 'high';

  return 'standard';
}

function groupKey(priority: ExternalVerificationPriority, domain: KnowledgeDomain, plan: ExternalVerificationPlan): string {
  return JSON.stringify({
    priority,
    domain,
    sources: [...plan.suggestedSourceTypes].sort(),
    recency: plan.recencyRequired,
    official: plan.officialSourceRequired,
    jurisdiction: plan.jurisdictionalRelevance || '',
  });
}

export function consolidateExternalVerificationPlans(
  claims: AnalyzedClaim[],
  verificationCutoffDate = new Date().toISOString().slice(0, 10)
): DocumentExternalVerificationPlan {
  const grouped = new Map<string, ExternalVerificationWorkItem>();
  let requiredClaimCount = 0;

  claims.forEach((claim, claimIndex) => {
    const plan = claim.externalVerificationPlan;
    if (!plan?.externalVerificationRequired) return;
    requiredClaimCount += 1;

    const primaryDomain = claim.externalVerificationPrimaryDomain || 'general';
    const priority = resolvePriority(claim, primaryDomain, plan);
    const key = groupKey(priority, primaryDomain, plan);
    const existing = grouped.get(key);

    if (existing) {
      existing.claimIndexes.push(claimIndex);
      existing.reasons = unique([...existing.reasons, plan.reason]);
      existing.minimumIndependentSources = Math.max(existing.minimumIndependentSources, plan.minimumIndependentSources);
      return;
    }

    grouped.set(key, {
      priority,
      primaryDomain,
      claimIndexes: [claimIndex],
      reasons: [plan.reason],
      suggestedSourceTypes: [...plan.suggestedSourceTypes],
      minimumIndependentSources: plan.minimumIndependentSources,
      recencyRequired: plan.recencyRequired,
      officialSourceRequired: plan.officialSourceRequired,
      jurisdictions: plan.jurisdictionalRelevance ? [plan.jurisdictionalRelevance] : [],
    });
  });

  const workItems = [...grouped.values()].sort((a, b) =>
    PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority] || a.claimIndexes[0] - b.claimIndexes[0]
  );

  return {
    externalVerificationRequired: requiredClaimCount > 0,
    externalVerificationPerformed: false,
    verificationCutoffDate,
    totalClaims: claims.length,
    claimsRequiringExternalVerification: requiredClaimCount,
    suggestedSourceTypes: unique(workItems.flatMap((item) => item.suggestedSourceTypes)),
    minimumIndependentSources: workItems.reduce((minimum, item) => Math.max(minimum, item.minimumIndependentSources), 0),
    recencyRequired: workItems.some((item) => item.recencyRequired),
    officialSourceRequired: workItems.some((item) => item.officialSourceRequired),
    jurisdictions: unique(workItems.flatMap((item) => item.jurisdictions)),
    workItems,
  };
}
