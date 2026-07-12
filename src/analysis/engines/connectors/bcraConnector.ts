import type { ExternalVerificationConnectorResult } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Quote = { codigoMoneda?: string; descripcion?: string; tipoCotizacion?: number };
type BcraResponse = { status?: number; results?: { fecha?: string | null; detalle?: Quote[] } };

const API_ROOT = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones';
const MAX_RESPONSE_BYTES = 500_000;

export async function fetchBcraExchangeRate(
  currencyCode: string,
  date: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationConnectorResult> {
  const code = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return { ok: false, provider: 'BCRA', records: [], error: 'Código de moneda inválido.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return { ok: false, provider: 'BCRA', records: [], error: 'Fecha inválida.' };
  }
  if (!claimIndexes.length) return { ok: false, provider: 'BCRA', records: [], error: 'La consulta debe vincularse a un claim.' };

  const url = `${API_ROOT}?fecha=${encodeURIComponent(date)}`;
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!response.ok || new URL(response.url || url).hostname !== 'api.bcra.gob.ar') {
      return { ok: false, provider: 'BCRA', records: [], error: `Respuesta BCRA inválida (${response.status}).` };
    }
    if (Number(response.headers.get('content-length') || 0) > MAX_RESPONSE_BYTES) return { ok: false, provider: 'BCRA', records: [], error: 'Respuesta BCRA demasiado grande.' };
    const data = await response.json() as BcraResponse;
    const quote = data.results?.detalle?.find((item) => item.codigoMoneda === code);
    const sourceDate = data.results?.fecha;
    if (!quote || !sourceDate || typeof quote.tipoCotizacion !== 'number') {
      return { ok: false, provider: 'BCRA', records: [], error: 'No hay cotización oficial para la moneda y fecha solicitadas.' };
    }
    return {
      ok: true,
      provider: 'BCRA',
      records: [{
        sourceType: 'official-market-data',
        url,
        title: `BCRA — ${quote.descripcion || code} (${code}): ${quote.tipoCotizacion}`,
        retrievedAt: new Date().toISOString(),
        sourceDate,
        claimIndexes: [...new Set(claimIndexes)],
        official: true,
        excerpt: `Cotización oficial ${code}: ${quote.tipoCotizacion} para ${sourceDate}.`,
      }],
    };
  } catch {
    return { ok: false, provider: 'BCRA', records: [], error: 'No se pudo consultar la API oficial del BCRA.' };
  }
}
