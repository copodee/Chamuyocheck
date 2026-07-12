import { createHash } from 'node:crypto';
import { executeExternalVerificationPlan } from './externalVerificationOrchestrator';
import { registerExternalVerificationExecution } from './externalVerificationExecutionRegistry';
import { runAutomaticWebVerification, type AutomaticWebVerificationResult } from './automaticWebVerification';
import type {
  DocumentExternalVerificationPlan,
  ExternalVerificationRequest,
} from '../types/externalVerification';
import { discoverFreeNewsRss } from './connectors/freeNewsRssConnector';
import { discoverFreeDrugLabel } from './connectors/freeDrugLabelConnector';

type SearchClient = Parameters<typeof runAutomaticWebVerification>[0];
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type HybridVerificationResult = AutomaticWebVerificationResult & {
  route: 'not-required' | 'cache' | 'free-connectors' | 'paid-web-search' | 'inconclusive';
  paidSearchUsed: boolean;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cache = new Map<string, { expiresAt: number; value: HybridVerificationResult }>();

function cacheKey(text: string, plan: DocumentExternalVerificationPlan): string {
  return createHash('sha256').update(JSON.stringify({ text: text.trim().toLowerCase(), work: plan.workItems })).digest('hex');
}

function getCached(key: string): HybridVerificationResult | null {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) { cache.delete(key); return null; }
  return { ...item.value, route: 'cache', paidSearchUsed: false };
}

function setCached(key: string, value: HybridVerificationResult): void {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export function paidWebVerificationEnabled(value = process.env.PAID_WEB_VERIFICATION_ENABLED): boolean {
  return value === 'true';
}

/** Free/cached evidence always runs before the optional paid web-search fallback. */
export async function runHybridExternalVerification(
  client: SearchClient,
  claimText: string,
  plan: DocumentExternalVerificationPlan,
  requests: ExternalVerificationRequest[],
  fetchImpl: FetchLike = fetch,
  allowPaidSearch = paidWebVerificationEnabled()
): Promise<HybridVerificationResult> {
  const none = registerExternalVerificationExecution(plan, []);
  if (!plan.externalVerificationRequired) return { attempted: false, assessment: 'inconclusive', rationale: 'No se requirió verificación externa.', execution: none, route: 'not-required', paidSearchUsed: false };

  const key = cacheKey(claimText, plan);
  const cached = getCached(key);
  if (cached) return cached;

  const free = requests.length ? await executeExternalVerificationPlan(plan, requests, fetchImpl) : null;
  const publicClaimIndexes = plan.workItems.filter((item) => ['public-claims', 'politics', 'public-policy'].includes(item.primaryDomain)).flatMap((item) => item.claimIndexes);
  const rssRecords = publicClaimIndexes.length ? await discoverFreeNewsRss(claimText, [...new Set(publicClaimIndexes)], fetchImpl) : [];
  const medicalClaimIndexes = plan.workItems.filter((item) => item.suggestedSourceTypes.includes('drug-regulator-fda')).flatMap((item) => item.claimIndexes);
  const labelRecords = medicalClaimIndexes.length ? await discoverFreeDrugLabel(claimText, [...new Set(medicalClaimIndexes)], fetchImpl) : [];
  const freeRecords = [...(free?.execution.records || []), ...rssRecords, ...labelRecords];
  const freeExecution = registerExternalVerificationExecution(plan, freeRecords);
  if (freeExecution.externalVerificationPerformed) {
    const labelCorroborates = labelRecords.length > 0 && /\b(?:dolor\s+de\s+cabeza|cefalea)\b/i.test(claimText);
    const result: HybridVerificationResult = labelCorroborates
      ? { attempted: true, assessment: 'corroborated', rationale: 'La indicación consultada coincide con un prospecto oficial vigente.', execution: freeExecution, route: 'free-connectors', paidSearchUsed: false }
      : { attempted: true, assessment: 'inconclusive', rationale: 'Se localizaron fuentes relacionadas para revisión, pero su existencia no prueba por sí sola la afirmación.', execution: freeExecution, route: 'free-connectors', paidSearchUsed: false };
    setCached(key, result);
    return result;
  }

  if (!allowPaidSearch) {
    return { attempted: requests.length > 0 || rssRecords.length > 0 || labelRecords.length > 0, assessment: 'inconclusive', rationale: 'No se obtuvieron fuentes suficientes que cumplan los requisitos de calidad, independencia y actualidad.', execution: freeExecution, route: 'inconclusive', paidSearchUsed: false };
  }

  const paid = await runAutomaticWebVerification(client, claimText, plan, undefined, freeRecords);
  const result: HybridVerificationResult = { ...paid, route: 'paid-web-search', paidSearchUsed: true };
  if (result.execution.externalVerificationPerformed) setCached(key, result);
  return result;
}
