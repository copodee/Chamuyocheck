import * as cheerio from 'cheerio';

const MAX_HTML_BYTES = 4_000_000;
const MAX_REDIRECTS = 5;

function publicHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '::1' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url;
  } catch { return null; }
}

async function fetchFollowingPublicRedirects(requested: URL, fetchImpl: typeof fetch) {
  const chain = [requested.href];
  let current = requested;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchImpl(current, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'ChamuyoCheckBot/1.0 (+https://chamuyocheck.com)' },
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(12_000),
    });
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: current, chain };
    const location = response.headers.get('location');
    if (!location) throw new Error('redirect-without-location');
    const next = publicHttpUrl(new URL(location, current).href);
    if (!next) throw new Error('unsafe-redirect');
    if (hop === MAX_REDIRECTS) throw new Error('too-many-redirects');
    current = next;
    chain.push(current.href);
  }
  throw new Error('too-many-redirects');
}

/** Extracts visible and structured text; it does not execute page JavaScript. */
export async function extractWebText(rawUrl: string, fetchImpl: typeof fetch = fetch) {
  const requested = publicHttpUrl(rawUrl);
  if (!requested) return { ok: false, text: '', title: '', note: 'URL inválida, local o no pública.', requestedUrl: '', finalUrl: '', redirectChain: [] as string[] };
  if (requested.protocol !== 'https:') return { ok: false, text: '', title: '', note: 'El servidor no ofrece HTTPS en el enlace aportado. Por seguridad no se leyó el contenido.', requestedUrl: requested.href, finalUrl: '', redirectChain: [requested.href], serverAssessment: 'blocked' as const, serverChecks: ['El enlace no usa HTTPS.'] };
  try {
    const fetched = await fetchFollowingPublicRedirects(requested, fetchImpl);
    const res = fetched.response;
    const finalUrl = publicHttpUrl(fetched.finalUrl.href);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !finalUrl || !/html|xhtml/i.test(contentType)) return { ok: false, text: '', title: '', note: 'La página no devolvió HTML público utilizable.', requestedUrl: requested.href, finalUrl: finalUrl?.href || '', redirectChain: fetched.chain, serverAssessment: 'blocked' as const, serverChecks: [`Respuesta HTTP ${res.status}.`, `Tipo de contenido: ${contentType || 'no informado'}.`] };
    if (finalUrl.protocol !== 'https:') return { ok: false, text: '', title: '', note: 'La navegación terminó en un servidor sin HTTPS. Por seguridad no se leyó el contenido.', requestedUrl: requested.href, finalUrl: finalUrl.href, redirectChain: fetched.chain, serverAssessment: 'blocked' as const, serverChecks: ['El destino final no usa HTTPS.'] };
    const declaredLength = Number(res.headers.get('content-length') || 0);
    if (declaredLength > MAX_HTML_BYTES) return { ok: false, text: '', title: '', note: 'La página supera el tamaño permitido.', requestedUrl: requested.href, finalUrl: finalUrl.href, redirectChain: fetched.chain };
    const html = await res.text();
    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) return { ok: false, text: '', title: '', note: 'La página supera el tamaño permitido.', requestedUrl: requested.href, finalUrl: finalUrl.href, redirectChain: fetched.chain };

    const $ = cheerio.load(html);
    const title = $('title').first().text().replace(/\s+/g, ' ').trim();
    const meta = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const structured = $('script[type="application/ld+json"]').map((_, node) => $(node).text()).get().join(' ');
    $('script,style,noscript,svg,nav,footer').remove();
    const visible = $('body').text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const formLabels = $('label,[aria-label]').map((_, node) => `${$(node).text()} ${$(node).attr('aria-label') || ''}`).get().join(' ');
    const combined = [meta, visible, structured, formLabels].filter(Boolean).join('\n').replace(/\\u00a0/g, ' ').slice(0, 24_000);
    const requestedHost = requested.hostname.toLowerCase().replace(/^www\./, '');
    const finalHost = finalUrl.hostname.toLowerCase().replace(/^www\./, '');
    const crossDomain = requestedHost !== finalHost;
    const securityHeaders = [
      res.headers.get('strict-transport-security') ? 'HSTS informado.' : 'HSTS no informado en la respuesta.',
      res.headers.get('content-security-policy') ? 'Política de seguridad de contenido informada.' : 'Política de seguridad de contenido no informada.',
      crossDomain ? `Redirección hacia ${finalHost}; debe verificarse que corresponda al operador esperado.` : 'El dominio final coincide con el enlace solicitado.',
    ];
    return {
      ok: combined.length > 80,
      text: combined,
      title,
      requestedUrl: requested.href,
      finalUrl: finalUrl.href,
      redirectChain: fetched.chain,
      serverAssessment: crossDomain ? 'caution' as const : 'readable' as const,
      serverChecks: securityHeaders,
      note: combined.length > 80
        ? 'Página pública leída. Se extrajeron texto visible y datos estructurados; no se ejecutaron simuladores JavaScript.'
        : 'No se pudo extraer suficiente texto. La página puede requerir JavaScript o autenticación.',
    };
  } catch {
    return { ok: false, text: '', title: '', note: 'No se pudo leer la página de forma segura. Puede bloquear accesos automatizados, requerir JavaScript o redirigir a un destino no permitido.', requestedUrl: requested.href, finalUrl: '', redirectChain: [requested.href], serverAssessment: 'blocked' as const, serverChecks: ['La verificación técnica previa no pudo completarse.'] };
  }
}
