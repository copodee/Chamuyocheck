import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ThreatMatch = { threatType?: string; platformType?: string; threat?: { url?: string }; cacheDuration?: string };

export function hasKnownUnsafeUrlMatch(records: ExternalVerificationSourceRecord[]): boolean {
  return records.some((record) =>
    record.sourceType === 'url-threat-intelligence'
    && /coincidencia\(s\).*navegaci[oó]n debe bloquearse/i.test(record.excerpt || '')
  );
}

/** Checks Google's known unsafe-URL lists. No match is not presented as proof of safety. */
export async function checkGoogleSafeBrowsing(
  url: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch,
  apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY || ''
): Promise<ExternalVerificationSourceRecord[]> {
  if (!claimIndexes.length) return [];
  const statusRecord = (excerpt: string): ExternalVerificationSourceRecord => ({
    sourceType: 'url-threat-intelligence-status',
    url: 'https://developers.google.com/safe-browsing/v4/lookup-api',
    title: 'Google Safe Browsing — estado de la comprobación',
    retrievedAt: new Date().toISOString(),
    claimIndexes,
    official: true,
    excerpt,
  });
  if (!apiKey) return [statusRecord('Google Safe Browsing no se ejecutó porque la clave del servicio no está configurada.')];
  let target: URL;
  try { target = new URL(url); } catch { return []; }
  if (!['http:', 'https:'].includes(target.protocol)) return [];
  try {
    const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`;
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'chamuyocheck', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'],
          threatEntries: [{ url: target.href }],
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [statusRecord(`Google Safe Browsing no pudo completar la comprobación (respuesta HTTP ${response.status}). No debe interpretarse como enlace seguro ni como enlace malicioso.`)];
    const payload = await response.json() as { matches?: ThreatMatch[] };
    const matches = payload.matches || [];
    const retrievedAt = new Date().toISOString();
    return [{
      sourceType: 'url-threat-intelligence',
      url: 'https://developers.google.com/safe-browsing/v4/lookup-api',
      title: 'Google Safe Browsing — consulta de URL',
      retrievedAt, sourceDate: retrievedAt, claimIndexes, official: true,
      excerpt: matches.length
        ? `Google Safe Browsing informó ${matches.length} coincidencia(s) para la URL consultada: ${[...new Set(matches.map((item) => item.threatType || 'amenaza no especificada'))].join(', ')}. La navegación debe bloquearse.`
        : 'La URL no produjo coincidencias en las listas consultadas de Google Safe Browsing. Esto sólo significa que no estaba listada en ese momento; no acredita identidad, autorización, solvencia ni legitimidad de la oferta.',
    }];
  } catch {
    return [statusRecord('Google Safe Browsing no respondió dentro del tiempo disponible. La seguridad técnica del enlace quedó sin comprobar.')];
  }
}
