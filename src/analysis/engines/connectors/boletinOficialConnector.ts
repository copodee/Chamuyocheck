import type { ExternalVerificationConnectorResult } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function validUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.boletinoficial.gob.ar' &&
      /^\/detalleAviso\/primera\/\d+\/\d+$/.test(url.pathname);
  } catch { return false; }
}

function clean(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchBoletinOficialNotice(
  officialUrl: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationConnectorResult> {
  if (!validUrl(officialUrl)) return { ok: false, provider: 'Boletín Oficial', records: [], error: 'URL oficial de aviso inválida.' };
  if (!claimIndexes.length) return { ok: false, provider: 'Boletín Oficial', records: [], error: 'El aviso debe vincularse a un claim.' };
  try {
    const response = await fetchImpl(officialUrl, { headers: { Accept: 'text/html' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!response.ok || !validUrl(response.url || officialUrl)) {
      return { ok: false, provider: 'Boletín Oficial', records: [], error: 'Respuesta fuera del dominio o formato oficial.' };
    }
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > 1_500_000) return { ok: false, provider: 'Boletín Oficial', records: [], error: 'Respuesta demasiado grande.' };
    const title = clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
    const date = html.match(/Fecha de publicaci[oó]n\s*(?:<[^>]*>|\s)*([0-3]\d\/[01]\d\/\d{4})/i)?.[1];
    if (!title || !date) return { ok: false, provider: 'Boletín Oficial', records: [], error: 'El aviso no contiene título y fecha verificables.' };
    const [day, month, year] = date.split('/');
    return { ok: true, provider: 'Boletín Oficial', records: [{
      sourceType: 'official-gazette', url: officialUrl, title, retrievedAt: new Date().toISOString(),
      sourceDate: `${year}-${month}-${day}`, claimIndexes: [...new Set(claimIndexes)], official: true,
    }] };
  } catch {
    return { ok: false, provider: 'Boletín Oficial', records: [], error: 'No se pudo consultar el Boletín Oficial.' };
  }
}
