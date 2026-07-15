export type UrlIdentityAudit = {
  requestedDomain: string;
  finalDomain: string | null;
  crossDomainRedirect: boolean;
  redirectCount: number;
  trackingParameterCount: number;
  publisherDomains: string[];
  embeddedDestinationDomains: string[];
  analysisText: string;
};

const TRACKING_PARAMETER = /^(?:utm_.+|gclid|fbclid|subc|adid|site_id|site_domain|thumbnail|campaign_id|campaign_name|tblci)$/i;
const DESTINATION_PARAMETER = /^(?:url|uri|target|destination|dest|redirect|redirect_url|redirect_uri|continue|next|link|out)$/i;

export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const countrySecondLevel = /^(?:com|net|org|gov|gob|edu|mil)\.[a-z]{2}$/i.test(labels.slice(-2).join('.'));
  return labels.slice(countrySecondLevel ? -3 : -2).join('.');
}

function decodeRepeatedly(value: string): string {
  let decoded = value.replace(/\+/g, ' ');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { break; }
  }
  return decoded;
}

function domainFromValue(value: string): string | null {
  try { return registrableDomain(new URL(decodeRepeatedly(value)).hostname); } catch { return null; }
}

export function summarizePublicUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const path = url.pathname === '/' ? '' : url.pathname.slice(0, 80);
    return `${url.protocol}//${url.hostname}${path}${url.search ? ' (parámetros omitidos)' : ''}`;
  } catch { return 'enlace externo no normalizable'; }
}

export function auditUrlIdentity(rawUrl: string, finalUrl?: string, redirectChain: string[] = []): UrlIdentityAudit | null {
  let requested: URL;
  try { requested = new URL(rawUrl); } catch { return null; }
  const requestedDomain = registrableDomain(requested.hostname);
  const finalDomain = domainFromValue(finalUrl || '') || requestedDomain;
  const publisherDomains = new Set<string>();
  const embeddedDestinationDomains = new Set<string>();
  let trackingParameterCount = 0;
  for (const [key, value] of requested.searchParams) {
    if (TRACKING_PARAMETER.test(key)) trackingParameterCount += 1;
    if (/^(?:site_domain|publisher|source_domain)$/i.test(key)) {
      const domain = domainFromValue(`https://${decodeRepeatedly(value).replace(/^https?:\/\//i, '')}`);
      if (domain) publisherDomains.add(domain);
    }
    if (DESTINATION_PARAMETER.test(key)) {
      const domain = domainFromValue(value);
      if (domain && domain !== requestedDomain) embeddedDestinationDomains.add(domain);
    }
  }
  const chainDomains = redirectChain.map(domainFromValue).filter((value): value is string => Boolean(value));
  const crossDomainRedirect = finalDomain !== requestedDomain || chainDomains.some((domain) => domain !== requestedDomain);
  const facts = [
    `Dominio del enlace aportado: ${requestedDomain}.`,
    finalDomain !== requestedDomain ? `Destino final observado: ${finalDomain}; no coincide con el dominio inicial.` : `Destino final observado: ${finalDomain}.`,
    redirectChain.length > 1 ? `La lectura atravesó ${redirectChain.length - 1} redirección(es) validada(s).` : '',
    trackingParameterCount ? `El enlace contiene ${trackingParameterCount} parámetro(s) de seguimiento publicitario; se omiten del análisis sustantivo.` : '',
    publisherDomains.size ? `Dominio(s) declarado(s) como medio o procedencia publicitaria: ${[...publisherDomains].join(', ')}. No se consideran el operador financiero ni el destino final.` : '',
    embeddedDestinationDomains.size ? `Destino(s) incorporado(s) en parámetros de redirección: ${[...embeddedDestinationDomains].join(', ')}.` : '',
  ].filter(Boolean);
  return {
    requestedDomain, finalDomain, crossDomainRedirect,
    redirectCount: Math.max(0, redirectChain.length - 1), trackingParameterCount,
    publisherDomains: [...publisherDomains], embeddedDestinationDomains: [...embeddedDestinationDomains],
    analysisText: `Auditoría de identidad del enlace. ${facts.join(' ')}`,
  };
}
