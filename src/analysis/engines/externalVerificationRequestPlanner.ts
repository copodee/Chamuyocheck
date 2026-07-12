import type { AnalyzedClaim } from './claimEvidenceGate';
import type {
  ExternalVerificationPlanningResult,
  ExternalVerificationRequest,
} from '../types/externalVerification';

const URL_PATTERN = /https:\/\/[^\s<>"')\]]+/gi;
const NEWS_HOSTS = new Set([
  'clarin.com', 'www.clarin.com', 'lanacion.com.ar', 'www.lanacion.com.ar',
  'infobae.com', 'www.infobae.com', 'ambito.com', 'www.ambito.com',
]);

function requestKey(request: ExternalVerificationRequest): string {
  return JSON.stringify(request);
}

function fromUrl(rawUrl: string, claimIndex: number): ExternalVerificationRequest | null {
  const url = rawUrl.replace(/[.,;:!?]+$/, '');
  try {
    const parsed = new URL(url);
    const infoleg = parsed.hostname === 'www.argentina.gob.ar' && parsed.pathname.match(/^\/normativa\/nacional\/ley-(\d+)-\d+\/?$/);
    if (infoleg) return { connector: 'infoleg', officialUrl: url, lawNumber: infoleg[1], claimIndexes: [claimIndex] };
    if (parsed.hostname === 'www.boletinoficial.gob.ar' && /^\/detalleAviso\/primera\/\d+\/\d+$/.test(parsed.pathname)) {
      return { connector: 'boletin-oficial', officialUrl: url, claimIndexes: [claimIndex] };
    }
    if (NEWS_HOSTS.has(parsed.hostname)) return { connector: 'news', articleUrl: url, claimIndexes: [claimIndex] };
    const pubmed = parsed.hostname === 'pubmed.ncbi.nlm.nih.gov' && parsed.pathname.match(/^\/(\d+)\/?$/);
    if (pubmed) return { connector: 'pubmed', pmid: pubmed[1], claimIndexes: [claimIndex] };
  } catch {
    return null;
  }
  return null;
}

function structuredRequests(text: string, claimIndex: number): ExternalVerificationRequest[] {
  const requests: ExternalVerificationRequest[] = [];
  for (const match of text.matchAll(/\[BCRA:([A-Z]{3}):(\d{4}-\d{2}-\d{2})\]/gi)) {
    requests.push({ connector: 'bcra-exchange-rate', currencyCode: match[1].toUpperCase(), date: match[2], claimIndexes: [claimIndex] });
  }
  for (const match of text.matchAll(/\[WHO:([A-Z0-9_]{2,60}):([A-Z]{3})\]/gi)) {
    requests.push({ connector: 'who-indicator', indicator: match[1].toUpperCase(), country: match[2].toUpperCase(), claimIndexes: [claimIndex] });
  }
  for (const match of text.matchAll(/\[WB:([A-Z]{2,3}):([A-Z0-9.]{3,50}):(\d{4})\]/gi)) {
    requests.push({ connector: 'world-bank-indicator', country: match[1].toUpperCase(), indicator: match[2].toUpperCase(), year: Number(match[3]), claimIndexes: [claimIndex] });
  }
  for (const match of text.matchAll(/\[PMID:(\d{1,10})\]/gi)) {
    requests.push({ connector: 'pubmed', pmid: match[1], claimIndexes: [claimIndex] });
  }
  return requests;
}

/** Plans requests from explicit evidence references only; never searches or guesses. */
export function planExternalVerificationRequests(claims: AnalyzedClaim[]): ExternalVerificationPlanningResult {
  const requests = new Map<string, ExternalVerificationRequest>();
  const pending: ExternalVerificationPlanningResult['pending'] = [];

  claims.forEach((claim, claimIndex) => {
    const planned: ExternalVerificationRequest[] = [];
    for (const url of claim.text.match(URL_PATTERN) || []) {
      const request = fromUrl(url, claimIndex);
      if (request) planned.push(request);
    }
    planned.push(...structuredRequests(claim.text, claimIndex));
    planned.forEach((request) => requests.set(requestKey(request), request));

    if (claim.externalVerificationRequired && planned.length === 0) {
      pending.push({ claimIndex, reason: 'La verificación requiere una URL oficial, PMID o identificador estructurado explícito.' });
    }
  });

  return { requests: [...requests.values()], pending };
}
