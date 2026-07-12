import type {
  ExternalVerificationConnectorResult,
  ExternalVerificationSourceRecord,
} from '../../types/externalVerification';

const PROVIDER = 'InfoLEG / Argentina.gob.ar';
const OFFICIAL_HOST = 'www.argentina.gob.ar';
const MAX_RESPONSE_BYTES = 1_000_000;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type LegislationMetadata = {
  '@type'?: string;
  legislationIdentifier?: string;
  name?: string;
  alternateName?: string;
  abstract?: string;
  url?: string;
  datePublished?: string;
  legislationDate?: string;
};

function normalizedLawNumber(value: string): string | null {
  const digits = value.replace(/[.\s]/g, '');
  return /^\d{1,8}$/.test(digits) ? digits : null;
}

function isOfficialUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === OFFICIAL_HOST;
  } catch {
    return false;
  }
}

function isOfficialNormativeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return isOfficialUrl(value) && /^\/normativa\/nacional\/(?:norma-\d+|ley-\d+-\d+)\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function decodeJsonScript(script: string): string {
  return script.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
}

export function parseInfolegLegislationMetadata(html: string): LegislationMetadata | null {
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of scripts) {
    try {
      const parsed = JSON.parse(decodeJsonScript(match[1]).trim()) as LegislationMetadata;
      if (parsed['@type'] === 'Legislation') return parsed;
    } catch {
      // Ignore unrelated or malformed structured-data blocks.
    }
  }
  return null;
}

function failure(error: string): ExternalVerificationConnectorResult {
  return { ok: false, provider: PROVIDER, records: [], error };
}

/**
 * Fetches one Argentine national law from an explicit official InfoLEG URL.
 * It does not infer whether the law proves or disproves a claim; it only returns
 * an auditable official source record for the execution registry.
 */
export async function fetchInfolegLawByOfficialUrl(
  officialUrl: string,
  lawNumber: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationConnectorResult> {
  const normalized = normalizedLawNumber(lawNumber);
  if (!normalized) return failure('El número de ley debe contener únicamente dígitos.');
  if (!isOfficialNormativeUrl(officialUrl)) {
    return failure('La URL debe corresponder a una norma nacional del dominio oficial argentina.gob.ar.');
  }
  if (claimIndexes.length === 0 || claimIndexes.some((index) => !Number.isInteger(index) || index < 0)) {
    return failure('La consulta debe estar vinculada a al menos un claim válido.');
  }

  const requestedUrl = new URL(officialUrl).toString();
  let response: Response;
  try {
    response = await fetchImpl(requestedUrl, {
      method: 'GET',
      headers: { Accept: 'text/html,application/xhtml+xml' },
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return failure('No se pudo consultar el portal oficial de InfoLEG.');
  }

  if (!response.ok) return failure(`InfoLEG respondió con estado HTTP ${response.status}.`);
  if (!isOfficialUrl(response.url || requestedUrl)) return failure('InfoLEG redirigió fuera del dominio oficial permitido.');

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_RESPONSE_BYTES) return failure('La respuesta oficial excede el tamaño permitido.');

  const html = await response.text();
  if (new TextEncoder().encode(html).byteLength > MAX_RESPONSE_BYTES) {
    return failure('La respuesta oficial excede el tamaño permitido.');
  }

  const metadata = parseInfolegLegislationMetadata(html);
  if (!metadata) return failure('La página oficial no contiene metadata legislativa verificable.');

  const identifierDigits = metadata.legislationIdentifier?.match(/Ley\s+([\d.]+)/i)?.[1];
  if (normalizedLawNumber(identifierDigits || '') !== normalized) {
    return failure('La norma devuelta no coincide con el número de ley solicitado.');
  }

  const canonicalUrl = metadata.url && isOfficialUrl(metadata.url) ? metadata.url : response.url || requestedUrl;
  const title = [metadata.legislationIdentifier, metadata.name].filter(Boolean).join(' — ');
  const record: ExternalVerificationSourceRecord = {
    sourceType: 'government-law-repository',
    url: canonicalUrl,
    title,
    retrievedAt: new Date().toISOString(),
    sourceDate: metadata.datePublished || metadata.legislationDate,
    claimIndexes: [...new Set(claimIndexes)].sort((a, b) => a - b),
    official: true,
    excerpt: metadata.abstract || metadata.alternateName,
  };

  return { ok: true, provider: PROVIDER, records: [record] };
}
