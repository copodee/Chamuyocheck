import type { ExternalVerificationConnectorResult } from '../../types/externalVerification';
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function fetchWorldBankIndicator(country: string, indicator: string, year: number, claimIndexes: number[], fetchImpl: FetchLike = fetch): Promise<ExternalVerificationConnectorResult> {
  const iso = country.trim().toLowerCase(); const code = indicator.trim().toUpperCase();
  if (!/^[a-z]{2,3}$/.test(iso) || !/^[A-Z0-9.]{3,50}$/.test(code) || year < 1960 || year > new Date().getUTCFullYear()) return { ok: false, provider: 'World Bank', records: [], error: 'País, indicador o año inválido.' };
  if (!claimIndexes.length) return { ok: false, provider: 'World Bank', records: [], error: 'El indicador debe vincularse a un claim.' };
  const url = `https://api.worldbank.org/v2/country/${iso}/indicator/${code}?date=${year}&format=json`;
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!response.ok || new URL(response.url || url).hostname !== 'api.worldbank.org') throw new Error();
    if (Number(response.headers.get('content-length') || 0) > 500_000) return { ok: false, provider: 'World Bank', records: [], error: 'Respuesta Banco Mundial demasiado grande.' };
    const json = await response.json() as any; const item = json?.[1]?.[0];
    if (!item || item.value == null) return { ok: false, provider: 'World Bank', records: [], error: 'Banco Mundial no devolvió un valor para esa consulta.' };
    return { ok: true, provider: 'World Bank', records: [{ sourceType: 'official-statistics', url, title: `Banco Mundial — ${item.indicator?.value || code}: ${item.value}`,
      retrievedAt: new Date().toISOString(), sourceDate: `${year}-12-31`, claimIndexes: [...new Set(claimIndexes)], official: true,
      excerpt: `${item.country?.value || iso}, ${year}: ${item.value}.` }] };
  } catch { return { ok: false, provider: 'World Bank', records: [], error: 'No se pudo consultar la API del Banco Mundial.' }; }
}
