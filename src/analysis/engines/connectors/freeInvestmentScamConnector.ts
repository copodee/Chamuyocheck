import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const CNV_ALERTS_URL = 'https://www.argentina.gob.ar/cnv/alertas-al-inversor';
const CNV_REGISTRY_URL = 'https://www.argentina.gob.ar/cnv/registros-publicos';
const MALWAREBYTES_TABOOLA_URL = 'https://www.malwarebytes.com/blog/news/2017/09/tech-support-scammers-abuse-native-ad-content-provider-taboola-serve-malvertising';

type RdapEvent = { eventAction?: string; eventDate?: string };
type RdapEntity = { roles?: string[]; vcardArray?: [string, Array<[string, unknown, string, unknown]>] };
type RdapResponse = { ldhName?: string; status?: string[]; events?: RdapEvent[]; entities?: RdapEntity[] };

function decodedText(value: string): string {
  let decoded = value.replace(/\+/g, ' ');
  try { decoded = decodeURIComponent(decoded); } catch { /* Preserve malformed links as visible text. */ }
  return `${value}\n${decoded}`;
}

function firstExternalUrl(text: string): URL | null {
  for (const raw of decodedText(text).match(/https?:\/\/[^\s<>"']+/gi) || []) {
    try {
      const parsed = new URL(raw.replace(/[),.;]+$/, ''));
      if (!parsed.hostname.endsWith('argentina.gob.ar')) return parsed;
    } catch { /* Ignore malformed URLs. */ }
  }
  return null;
}

function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const countrySecondLevel = /^(?:com|net|org|gov|gob|edu|mil)\.[a-z]{2}$/i.test(labels.slice(-2).join('.'));
  return labels.slice(countrySecondLevel ? -3 : -2).join('.');
}

function eventDate(events: RdapEvent[] | undefined, action: RegExp): string | undefined {
  const value = events?.find((event) => action.test(event.eventAction || ''))?.eventDate;
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

function registrarName(entities: RdapEntity[] | undefined): string | undefined {
  const fields = entities?.find((item) => item.roles?.includes('registrar'))?.vcardArray?.[1] || [];
  const name = fields.find((field) => field[0] === 'fn')?.[3];
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

function isInvestmentScamCheck(text: string): boolean {
  const normalized = decodedText(text);
  return /https?:\/\//i.test(normalized) && /\b(?:scam|estafa|fraude|enga[ñn]o|real|leg[ií]tim[oa]|segur[oa]|confiable|autotrader|auto\s*trader|trading\s*bot|inversi[oó]n|rentabilidad|ganancias?|dinero)\b/i.test(normalized);
}

function htmlText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function reputationSummary(page: string, domain: string): string | null {
  const text = htmlText(page);
  if (text.length < 80 || !text.toLowerCase().includes(domain.toLowerCase())) return null;
  const signals = [
    /(?:trust score|puntaje de confianza).{0,90}/i.exec(text)?.[0],
    /(?:whois|identity of the owner|identidad del propietario).{0,110}/i.exec(text)?.[0],
    /(?:recently registered|very young|domain age|registrado recientemente|antigüedad del dominio).{0,100}/i.exec(text)?.[0],
    /(?:low traffic|few visitors|poco tráfico).{0,90}/i.exec(text)?.[0],
  ].filter((value): value is string => Boolean(value)).map((value) => value.replace(/\s+/g, ' ').trim());
  return signals.length
    ? `La ficha pública de reputación para el dominio exacto ${domain} informa: ${signals.slice(0, 3).join(' ')} La puntuación de un tercero es orientativa y no prueba por sí sola fraude ni legitimidad.`
    : `Se consultó la ficha pública de reputación correspondiente al dominio exacto ${domain}. La página no expuso señales textuales suficientes para reproducir un veredicto; no se lo presume seguro por ese motivo.`;
}

/** Uses free public sources without treating domain registration or silence as proof. */
export async function discoverInvestmentScamEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  if (!claimIndexes.length || !isInvestmentScamCheck(claimText)) return [];
  const target = firstExternalUrl(claimText);
  if (!target) return [];

  const retrievedAt = new Date().toISOString();
  const domain = registrableDomain(target.hostname);
  const rdapUrl = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  const scamAdviserUrl = `https://www.scamadviser.com/check-website/${encodeURIComponent(domain)}`;
  const hasTaboolaTracking = /\btaboola(?:news)?\b|site_domain=taboolanews\.com|utm_(?:source|medium)=taboola/i.test(decodedText(claimText));
  const requests: Promise<Response>[] = [
    fetchImpl(rdapUrl, { headers: { accept: 'application/rdap+json, application/json' } }),
    fetchImpl(CNV_ALERTS_URL, { headers: { accept: 'text/html', 'accept-language': 'es-AR' } }),
    fetchImpl(CNV_REGISTRY_URL, { headers: { accept: 'text/html', 'accept-language': 'es-AR' } }),
    fetchImpl(scamAdviserUrl, { headers: { accept: 'text/html', 'accept-language': 'es-AR,en;q=0.8' } }),
  ];
  if (hasTaboolaTracking) requests.push(fetchImpl(MALWAREBYTES_TABOOLA_URL, { headers: { accept: 'text/html', 'accept-language': 'es-AR,en;q=0.8' } }));
  const [rdap, alerts, registry, reputation, malwarebytes] = await Promise.allSettled(requests);

  const records: ExternalVerificationSourceRecord[] = [];
  if (rdap.status === 'fulfilled' && rdap.value.ok) {
    try {
      const payload = await rdap.value.json() as RdapResponse;
      const registered = eventDate(payload.events, /registration/i);
      const changed = eventDate(payload.events, /last changed|last update/i);
      const expires = eventDate(payload.events, /expiration/i);
      const registrar = registrarName(payload.entities);
      records.push({
        sourceType: 'domain-registration-data',
        url: rdapUrl,
        title: `RDAP — datos registrales de ${payload.ldhName || domain}`,
        retrievedAt,
        sourceDate: changed || registered,
        claimIndexes,
        official: false,
        excerpt: [
          registered ? `Registro informado: ${registered.slice(0, 10)}.` : 'La respuesta no informó una fecha de alta utilizable.',
          registrar ? `Registrador: ${registrar}.` : '',
          expires ? `Vencimiento informado: ${expires.slice(0, 10)}.` : '',
          payload.status?.length ? `Estados: ${payload.status.slice(0, 4).join(', ')}.` : '',
          'Estos datos describen el dominio; no identifican necesariamente al operador ni acreditan que la inversión sea legítima.',
        ].filter(Boolean).join(' '),
      });
    } catch { /* Omit malformed RDAP responses instead of presenting them as evidence. */ }
  }

  if (alerts.status === 'fulfilled' && alerts.value.ok) {
    records.push({
      sourceType: 'consumer-protection-agencies', url: CNV_ALERTS_URL,
      title: 'CNV — Alertas al público inversor', retrievedAt, sourceDate: retrievedAt,
      claimIndexes, official: true,
      excerpt: 'Se consultó el canal oficial de alertas de la CNV. Sin una razón social, CUIT o nombre legal del operador no puede establecerse una coincidencia concluyente ni interpretarse la falta de coincidencia como autorización.',
    });
  }
  if (registry.status === 'fulfilled' && registry.value.ok) {
    records.push({
      sourceType: 'securities-regulator-cnv', url: CNV_REGISTRY_URL,
      title: 'CNV — Registros públicos de agentes y proveedores', retrievedAt, sourceDate: retrievedAt,
      claimIndexes, official: true,
      excerpt: 'La CNV publica registros de agentes y proveedores autorizados. El dominio aportado, por sí solo, no permite vincular inequívocamente la oferta con una entidad registrada.',
    });
  }
  if (reputation.status === 'fulfilled' && reputation.value.ok) {
    try {
      const excerpt = reputationSummary(await reputation.value.text(), domain);
      if (excerpt) records.push({
        sourceType: 'domain-reputation', url: scamAdviserUrl,
        title: `ScamAdviser — reputación pública de ${domain}`, retrievedAt, sourceDate: retrievedAt,
        claimIndexes, official: false, excerpt,
      });
    } catch { /* A failed third-party parse is not presented as a completed check. */ }
  }
  if (hasTaboolaTracking && malwarebytes?.status === 'fulfilled' && malwarebytes.value.ok) {
    records.push({
      sourceType: 'security-research', url: MALWAREBYTES_TABOOLA_URL,
      title: 'Malwarebytes Labs — antecedente documentado de malvertising en publicidad nativa',
      retrievedAt, sourceDate: '2017-09-28T00:00:00.000Z', claimIndexes, official: false,
      excerpt: 'La investigación documenta un caso en el que un anuncio nativo distribuido por Taboola usó una página señuelo y redirecciones condicionales hacia una estafa de soporte técnico. Es un antecedente del mecanismo de malvertising, no una prueba de que todo anuncio de Taboola ni este dominio concreto sean fraudulentos.',
    });
  }
  return records;
}
