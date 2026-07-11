import type {
  DocumentExternalVerificationPlan,
  ExternalVerificationExecutionResult,
  ExternalVerificationSourceRecord,
  ExternalVerificationWorkItem,
} from '../types/externalVerification';

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value) && !Number.isNaN(Date.parse(value));
}

function sourceHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function validateRecord(record: ExternalVerificationSourceRecord, totalClaims: number): string[] {
  const errors: string[] = [];
  if (!record.title.trim()) errors.push('Source title is required.');
  if (!record.sourceType.trim()) errors.push('Source type is required.');
  if (!sourceHost(record.url)) errors.push(`Invalid source URL: ${record.url || '(empty)'}.`);
  if (!isIsoDate(record.retrievedAt)) errors.push(`Invalid retrievedAt date for ${record.url || '(unknown source)'}.`);
  if (record.sourceDate && !isIsoDate(record.sourceDate)) errors.push(`Invalid sourceDate for ${record.url || '(unknown source)'}.`);
  if (record.claimIndexes.length === 0) errors.push(`Source ${record.url || '(unknown source)'} is not linked to a claim.`);
  if (record.claimIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= totalClaims)) {
    errors.push(`Source ${record.url || '(unknown source)'} references an invalid claim index.`);
  }
  return errors;
}

function recordsForClaim(
  records: ExternalVerificationSourceRecord[],
  item: ExternalVerificationWorkItem,
  claimIndex: number
): ExternalVerificationSourceRecord[] {
  return records.filter(
    (record) =>
      record.claimIndexes.includes(claimIndex) &&
      item.suggestedSourceTypes.includes(record.sourceType)
  );
}

function claimIsCovered(
  records: ExternalVerificationSourceRecord[],
  item: ExternalVerificationWorkItem,
  claimIndex: number
): boolean {
  const applicable = recordsForClaim(records, item, claimIndex);
  const independentHosts = unique(applicable.map((record) => sourceHost(record.url)).filter(Boolean));
  if (independentHosts.length < item.minimumIndependentSources) return false;
  if (item.officialSourceRequired && !applicable.some((record) => record.official)) return false;
  if (item.recencyRequired && !applicable.some((record) => Boolean(record.sourceDate))) return false;
  return true;
}

/**
 * Validates evidence supplied by a future connector. This function does not
 * fetch URLs and cannot manufacture verification records.
 */
export function registerExternalVerificationExecution(
  plan: DocumentExternalVerificationPlan,
  records: ExternalVerificationSourceRecord[]
): ExternalVerificationExecutionResult {
  if (records.length === 0) {
    return {
      externalVerificationPerformed: false,
      status: 'not-performed',
      records: [],
      coveredClaimIndexes: [],
      errors: [],
    };
  }

  const errors = records.flatMap((record) => validateRecord(record, plan.totalClaims));
  if (errors.length > 0) {
    return {
      externalVerificationPerformed: false,
      status: 'invalid',
      records,
      coveredClaimIndexes: [],
      errors: unique(errors),
    };
  }

  const coveredClaimIndexes = unique(
    plan.workItems.flatMap((item) =>
      item.claimIndexes.filter((claimIndex) => claimIsCovered(records, item, claimIndex))
    )
  ).sort((a, b) => a - b);
  const complete =
    plan.externalVerificationRequired &&
    coveredClaimIndexes.length === plan.claimsRequiringExternalVerification;

  return {
    externalVerificationPerformed: complete,
    status: complete ? 'complete' : 'partial',
    records,
    coveredClaimIndexes,
    errors: [],
  };
}
