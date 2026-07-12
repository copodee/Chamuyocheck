import type { ExternalVerificationConnectorResult } from '../../types/externalVerification';
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function fetchWhoIndicator(indicator: string, country: string, claimIndexes: number[], fetchImpl: FetchLike = fetch): Promise<ExternalVerificationConnectorResult> {
  const code = indicator.trim().toUpperCase(); const iso = country.trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,60}$/.test(code) || !/^[A-Z]{3}$/.test(iso)) return { ok: false, provider: 'WHO GHO', records: [], error: 'Indicador o país inválido.' };
  if (!claimIndexes.length) return { ok: false, provider: 'WHO GHO', records: [], error: 'El indicador debe vincularse a un claim.' };
  const query = `$filter=SpatialDim eq '${iso}'&$orderby=TimeDim desc&$top=1`;
  const url = `https://ghoapi.azureedge.net/api/${code}?${query.replace(/ /g, '%20').replace(/'/g, '%27')}`;
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!response.ok || new URL(response.url || url).hostname !== 'ghoapi.azureedge.net') throw new Error();
    if (Number(response.headers.get('content-length') || 0) > 500_000) return { ok: false, provider: 'WHO GHO', records: [], error: 'Respuesta OMS demasiado grande.' };
    const json = await response.json() as any; const item = json?.value?.[0];
    if (!item || item.TimeDim == null || (item.NumericValue == null && item.Value == null)) return { ok: false, provider: 'WHO GHO', records: [], error: 'OMS no devolvió datos para ese indicador y país.' };
    const value = item.NumericValue ?? item.Value;
    return { ok: true, provider: 'WHO GHO', records: [{ sourceType: 'health-authorities', url, title: `OMS ${code} — ${iso}: ${value}`,
      retrievedAt: new Date().toISOString(), sourceDate: `${item.TimeDim}-01-01`, claimIndexes: [...new Set(claimIndexes)], official: true,
      excerpt: `Indicador ${code}, país ${iso}, período ${item.TimeDim}, valor ${value}.` }] };
  } catch { return { ok: false, provider: 'WHO GHO', records: [], error: 'No se pudo consultar la API de la OMS.' }; }
}
