import * as cheerio from 'cheerio';

const MAX_HTML_BYTES = 4_000_000;

function publicHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '::1' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url;
  } catch { return null; }
}

/** Extracts visible and structured text; it does not execute page JavaScript. */
export async function extractWebText(rawUrl: string, fetchImpl: typeof fetch = fetch) {
  const requested = publicHttpUrl(rawUrl);
  if (!requested) return { ok: false, text: '', title: '', note: 'URL inválida, local o no pública.' };
  try {
    const res = await fetchImpl(requested, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'ChamuyoCheckBot/1.0 (+https://chamuyocheck.com)' },
      cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(12_000),
    });
    const finalUrl = publicHttpUrl(res.url || requested.href);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !finalUrl || !/html|xhtml/i.test(contentType)) return { ok: false, text: '', title: '', note: 'La página no devolvió HTML público utilizable.' };
    const declaredLength = Number(res.headers.get('content-length') || 0);
    if (declaredLength > MAX_HTML_BYTES) return { ok: false, text: '', title: '', note: 'La página supera el tamaño permitido.' };
    const html = await res.text();
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) return { ok: false, text: '', title: '', note: 'La página supera el tamaño permitido.' };

    const $ = cheerio.load(html);
    const title = $('title').first().text().replace(/\s+/g, ' ').trim();
    const meta = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const structured = $('script[type="application/ld+json"]').map((_, node) => $(node).text()).get().join(' ');
    $('script,style,noscript,svg,nav,footer').remove();
    const visible = $('body').text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const formLabels = $('label,[aria-label]').map((_, node) => `${$(node).text()} ${$(node).attr('aria-label') || ''}`).get().join(' ');
    const combined = [meta, visible, structured, formLabels].filter(Boolean).join('\n').replace(/\\u00a0/g, ' ').slice(0, 24_000);
    return {
      ok: combined.length > 80,
      text: combined,
      title,
      note: combined.length > 80
        ? 'Página pública leída. Se extrajeron texto visible y datos estructurados; no se ejecutaron simuladores JavaScript.'
        : 'No se pudo extraer suficiente texto. La página puede requerir JavaScript o autenticación.',
    };
  } catch {
    return { ok: false, text: '', title: '', note: 'No se pudo leer la página. Puede bloquear accesos automatizados o requerir JavaScript.' };
  }
}
