import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const CNV_ALERTS_URL = 'https://www.argentina.gob.ar/cnv/alertas-al-inversor';
const CNV_REGISTRY_URL = 'https://www.argentina.gob.ar/cnv/registros-publicos';

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
  const [rdap, alerts, registry] = await Promise.allSettled([
    fetchImpl(rdapUrl, { headers: { accept: 'application/rdap+json, application/json' } }),
    fetchImpl(CNV_ALERTS_URL, { headers: { accept: 'text/html', 'accept-language': 'es-AR' } }),
    fetchImpl(CNV_REGISTRY_URL, { headers: { accept: 'text/html', 'accept-language': 'es-AR' } }),
  ]);

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
  return records;
}
