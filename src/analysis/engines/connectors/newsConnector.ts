import type { ExternalVerificationConnectorResult } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const ALLOWED = new Map([
  ['www.clarin.com', 'Clarín'], ['clarin.com', 'Clarín'],
  ['www.lanacion.com.ar', 'La Nación'], ['lanacion.com.ar', 'La Nación'],
  ['www.infobae.com', 'Infobae'], ['infobae.com', 'Infobae'],
  ['www.ambito.com', 'Ámbito'], ['ambito.com', 'Ámbito'],
]);

function publisher(url: string): string | null {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' ? ALLOWED.get(parsed.hostname) || null : null; }
  catch { return null; }
}

function meta(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1]
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'))?.[1];
}

export async function fetchAllowedNewsArticle(
  articleUrl: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationConnectorResult> {
  const outlet = publisher(articleUrl);
  if (!outlet) return { ok: false, provider: 'Noticias', records: [], error: 'Medio no permitido.' };
  if (!claimIndexes.length) return { ok: false, provider: outlet, records: [], error: 'La nota debe vincularse a un claim.' };
  try {
    const response = await fetchImpl(articleUrl, { headers: { Accept: 'text/html' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    const finalOutlet = publisher(response.url || articleUrl);
    if (!response.ok || !finalOutlet) return { ok: false, provider: outlet, records: [], error: 'Respuesta fuera de un medio permitido.' };
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > 2_000_000) return { ok: false, provider: outlet, records: [], error: 'Respuesta demasiado grande.' };
    const title = meta(html, 'og:title');
    const date = meta(html, 'article:published_time') || meta(html, 'datePublished');
    const description = meta(html, 'og:description') || meta(html, 'description');
    if (!title || !date || Number.isNaN(Date.parse(date))) return { ok: false, provider: outlet, records: [], error: 'La nota no expone título y fecha auditables.' };
    return { ok: true, provider: finalOutlet, records: [{
      sourceType: 'independent-news', url: response.url || articleUrl, title, retrievedAt: new Date().toISOString(),
      sourceDate: new Date(date).toISOString(), claimIndexes: [...new Set(claimIndexes)], official: false, excerpt: description,
    }] };
  } catch { return { ok: false, provider: outlet, records: [], error: 'No se pudo consultar el medio.' }; }
}
