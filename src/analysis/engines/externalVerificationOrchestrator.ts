import type {
  DocumentExternalVerificationPlan,
  ExternalVerificationConnectorResult,
  ExternalVerificationOrchestrationResult,
  ExternalVerificationRequest,
  ExternalVerificationSourceRecord,
} from '../types/externalVerification';
import { registerExternalVerificationExecution } from './externalVerificationExecutionRegistry';
import { fetchInfolegLawByOfficialUrl } from './connectors/infolegConnector';
import { fetchBcraExchangeRate } from './connectors/bcraConnector';
import { fetchBoletinOficialNotice } from './connectors/boletinOficialConnector';
import { fetchAllowedNewsArticle } from './connectors/newsConnector';
import { fetchPubmedArticle } from './connectors/pubmedConnector';
import { fetchWhoIndicator } from './connectors/whoConnector';
import { fetchWorldBankIndicator } from './connectors/worldBankConnector';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const MAX_REQUESTS_PER_EXECUTION = 12;

function deduplicateRequests(requests: ExternalVerificationRequest[]): ExternalVerificationRequest[] {
  const unique = new Map<string, ExternalVerificationRequest>();
  for (const request of requests) {
    const canonical = { ...request, claimIndexes: [...new Set(request.claimIndexes)].sort((a, b) => a - b) } as ExternalVerificationRequest;
    const key = JSON.stringify(canonical);
    if (!unique.has(key)) unique.set(key, canonical);
  }
  return [...unique.values()];
}

async function executeRequest(request: ExternalVerificationRequest, fetchImpl: FetchLike): Promise<ExternalVerificationConnectorResult> {
  switch (request.connector) {
    case 'infoleg':
      return fetchInfolegLawByOfficialUrl(request.officialUrl, request.lawNumber, request.claimIndexes, fetchImpl);
    case 'bcra-exchange-rate':
      return fetchBcraExchangeRate(request.currencyCode, request.date, request.claimIndexes, fetchImpl);
    case 'boletin-oficial':
      return fetchBoletinOficialNotice(request.officialUrl, request.claimIndexes, fetchImpl);
    case 'news':
      return fetchAllowedNewsArticle(request.articleUrl, request.claimIndexes, fetchImpl);
    case 'pubmed':
      return fetchPubmedArticle(request.pmid, request.claimIndexes, fetchImpl);
    case 'who-indicator':
      return fetchWhoIndicator(request.indicator, request.country, request.claimIndexes, fetchImpl);
    case 'world-bank-indicator':
      return fetchWorldBankIndicator(request.country, request.indicator, request.year, request.claimIndexes, fetchImpl);
  }
}

function deduplicateRecords(records: ExternalVerificationSourceRecord[]): ExternalVerificationSourceRecord[] {
  const unique = new Map<string, ExternalVerificationSourceRecord>();
  for (const record of records) {
    const key = `${record.url}|${[...record.claimIndexes].sort((a, b) => a - b).join(',')}`;
    if (!unique.has(key)) unique.set(key, record);
  }
  return [...unique.values()];
}

/** Executes only explicitly supplied verification requests. */
export async function executeExternalVerificationPlan(
  plan: DocumentExternalVerificationPlan,
  requests: ExternalVerificationRequest[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationOrchestrationResult> {
  const connectorResults: ExternalVerificationConnectorResult[] = [];
  const uniqueRequests = deduplicateRequests(requests);

  if (uniqueRequests.length > MAX_REQUESTS_PER_EXECUTION) {
    return {
      execution: registerExternalVerificationExecution(plan, []),
      connectorResults: [],
      connectorErrors: [`Límite excedido: máximo ${MAX_REQUESTS_PER_EXECUTION} solicitudes externas por ejecución.`],
      attempts: [],
    };
  }

  // Sequential execution respects public API traffic limits and keeps failures isolated.
  for (const request of uniqueRequests) {
    try {
      connectorResults.push(await executeRequest(request, fetchImpl));
    } catch {
      connectorResults.push({ ok: false, provider: request.connector, records: [], error: 'Fallo no controlado del conector.' });
    }
  }

  const records = deduplicateRecords(connectorResults.flatMap((result) => result.ok ? result.records : []));
  const connectorErrors = connectorResults.filter((result) => !result.ok).map((result) => `${result.provider}: ${result.error || 'error desconocido'}`);
  const attempts = uniqueRequests.map((request, index) => {
    const result = connectorResults[index];
    return {
      connector: request.connector,
      claimIndexes: [...request.claimIndexes],
      ok: result.ok,
      recordCount: result.records.length,
      ...(result.error ? { error: result.error } : {}),
    };
  });

  return {
    execution: registerExternalVerificationExecution(plan, records),
    connectorResults,
    connectorErrors,
    attempts,
  };
}
