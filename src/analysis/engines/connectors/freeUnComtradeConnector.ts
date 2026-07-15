import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const API_ORIGIN = 'https://comtradeapi.un.org';
const API_PATH = '/public/v1/preview/C/A/HS';
const MAX_RESPONSE_BYTES = 500_000;

type TradeProduct = { label: string; hsCode: string; pattern: RegExp };
type ComtradeRow = { period?: string | number; primaryValue?: number; fobvalue?: number; netWgt?: number };
type ComtradePayload = { data?: ComtradeRow[] };

const PRODUCTS: TradeProduct[] = [
  { label: 'soja', hsCode: '1201', pattern: /\b(?:soja|porotos?\s+de\s+soja)\b/i },
  { label: 'maíz', hsCode: '1005', pattern: /\bma[ií]z\b/i },
  { label: 'trigo', hsCode: '1001', pattern: /\btrigo\b/i },
  { label: 'aceite de oliva', hsCode: '1509', pattern: /\baceite\s+de\s+oliva\b/i },
  { label: 'aceitunas preparadas', hsCode: '200570', pattern: /\baceitunas?\s+(?:preparadas?|conservadas?)\b/i },
  { label: 'aceitunas frescas', hsCode: '070992', pattern: /\baceitunas?\b/i },
  { label: 'uvas', hsCode: '0806', pattern: /\buvas?\b/i },
  { label: 'vino', hsCode: '2204', pattern: /\bvinos?\b/i },
  { label: 'yerba mate', hsCode: '0903', pattern: /\byerba(?:\s+mate)?\b/i },
  { label: 'carne bovina refrigerada', hsCode: '0201', pattern: /\bcarne\s+(?:bovina|vacuna)\s+(?:refrigerada|fresca)\b/i },
  { label: 'carne bovina congelada', hsCode: '0202', pattern: /\bcarne\s+(?:bovina|vacuna)(?:\s+congelada)?\b/i },
  { label: 'frutas', hsCode: '08', pattern: /\bfrutas?\b/i },
];

const PRODUCTIVE_INPUTS: TradeProduct[] = [
  { label: 'cianuro de sodio', hsCode: '283711', pattern: /\bcianuro\s+de\s+sodio\b/i },
  { label: 'ácido sulfúrico', hsCode: '2807', pattern: /\b[aá]cido\s+sulf[uú]rico\b/i },
  { label: 'urea fertilizante', hsCode: '310210', pattern: /\burea(?:\s+fertilizante)?\b/i },
  { label: 'fosfato diamónico', hsCode: '310530', pattern: /\b(?:fosfato\s+diam[oó]nico|dap)\b/i },
  { label: 'cloruro de potasio', hsCode: '310420', pattern: /\b(?:cloruro\s+de\s+potasio|muriato\s+de\s+potasio)\b/i },
  { label: 'máquinas para preparar alimento animal', hsCode: '843610', pattern: /\b(?:mezclador(?:a)?|mixer|maquinaria|equipamiento)\s+(?:de|para)\s+(?:alimento|raci[oó]n|ganado)\b/i },
  { label: 'máquinas de ordeñe', hsCode: '843410', pattern: /\b(?:m[aá]quina|equipo|sistema)\s+de\s+orde(?:ñ|n)e\b/i },
];

function productForClaim(text: string): TradeProduct | null {
  return PRODUCTS.find((product) => product.pattern.test(text)) || null;
}

function requestUrl(product: TradeProduct, year: number, flowCode = 'X'): string {
  const url = new URL(API_PATH, API_ORIGIN);
  url.search = new URLSearchParams({
    reporterCode: '32', period: String(year), cmdCode: product.hsCode, flowCode,
    partnerCode: '0', partner2Code: '0', customsCode: 'C00', motCode: '0', maxRecords: '5',
  }).toString();
  return url.toString();
}

async function importObservationForYear(product: TradeProduct, year: number, fetchImpl: FetchLike): Promise<{ year: number; value: number; weightKg: number; unitValue: number; url: string } | null> {
  const url = requestUrl(product, year, 'M');
  try {
    const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!response.ok || !safeContentLength(response)) return null;
    const payload = await response.json() as ComtradePayload;
    const row = payload.data?.find((item) => String(item.period) === String(year)) || payload.data?.[0];
    const value = Number(row?.primaryValue ?? row?.fobvalue);
    const weightKg = Number(row?.netWgt);
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) return null;
    return { year, value, weightKg, unitValue: value / weightKg, url };
  } catch {
    return null;
  }
}

function safeContentLength(response: Response): boolean {
  const header = response.headers.get('content-length');
  if (!header) return true;
  const bytes = Number(header);
  return Number.isFinite(bytes) && bytes >= 0 && bytes <= MAX_RESPONSE_BYTES;
}

async function observationForYear(product: TradeProduct, year: number, fetchImpl: FetchLike): Promise<{ year: number; value: number; url: string } | null> {
  const url = requestUrl(product, year);
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'comtradeapi.un.org') return null;
  try {
    const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!response.ok || !safeContentLength(response)) return null;
    const payload = await response.json() as ComtradePayload;
    const row = payload.data?.find((item) => String(item.period) === String(year)) || payload.data?.[0];
    const value = Number(row?.primaryValue ?? row?.fobvalue);
    return Number.isFinite(value) && value >= 0 ? { year, value, url } : null;
  } catch {
    return null;
  }
}

function usd(value: number): string {
  return `USD ${Math.round(value).toLocaleString('es-AR')}`;
}

/** Retrieves observed Argentine exports without treating one historical series as an investment recommendation. */
export async function discoverArgentinaExportEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch,
  referenceYear = new Date().getUTCFullYear() - 1
): Promise<ExternalVerificationSourceRecord[]> {
  const product = productForClaim(claimText);
  if (!product || claimIndexes.length === 0) return [];

  const years = [referenceYear - 2, referenceYear - 1, referenceYear];
  const observations = (await Promise.all(years.map((year) => observationForYear(product, year, fetchImpl))))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (observations.length === 0) return [];

  observations.sort((a, b) => a.year - b.year);
  const first = observations[0];
  const last = observations[observations.length - 1];
  const change = first.value > 0 && observations.length > 1 ? ((last.value / first.value) - 1) * 100 : null;
  const series = observations.map((item) => `${item.year}: ${usd(item.value)}`).join('; ');
  const trend = change === null ? '' : ` La variación nominal entre ${first.year} y ${last.year} fue ${change.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%.`;

  return [{
    sourceType: 'international-trade-data',
    url: last.url,
    title: `UN Comtrade — exportaciones argentinas de ${product.label} (HS ${product.hsCode})`,
    retrievedAt: new Date().toISOString(),
    sourceDate: `${last.year}-12-31`,
    claimIndexes: [...new Set(claimIndexes)],
    official: true,
    excerpt: `Exportaciones declaradas por Argentina al mundo: ${series}.${trend} Son valores históricos nominales: por sí solos no prueban demanda futura, rentabilidad, precio realizable ni acceso al mercado.`,
  }];
}

/** Uses observed Argentine imports as a customs benchmark, never as a local supplier quote. */
export async function discoverArgentinaProductiveInputEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch,
  referenceYear = new Date().getUTCFullYear() - 1
): Promise<ExternalVerificationSourceRecord[]> {
  const product = PRODUCTIVE_INPUTS.find((item) => item.pattern.test(claimText));
  if (!product || claimIndexes.length === 0) return [];

  const years = [referenceYear - 2, referenceYear - 1, referenceYear];
  const observations = (await Promise.all(years.map((year) => importObservationForYear(product, year, fetchImpl))))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.year - b.year);
  if (observations.length === 0) return [];

  const last = observations[observations.length - 1];
  const series = observations.map((item) => `${item.year}: USD ${item.unitValue.toLocaleString('es-AR', { maximumFractionDigits: 4 })}/kg`).join('; ');
  return [{
    sourceType: 'productive-input-price-benchmarks',
    url: last.url,
    title: `UN Comtrade — importaciones argentinas de ${product.label} (HS ${product.hsCode})`,
    retrievedAt: new Date().toISOString(),
    sourceDate: `${last.year}-12-31`,
    claimIndexes: [...new Set(claimIndexes)],
    official: true,
    excerpt: `Valor unitario aduanero histórico calculado como valor importado dividido por peso neto: ${series}. No es una cotización local ni un precio minorista: puede excluir o mezclar calidad, concentración, envase, flete interno, seguro, aranceles, impuestos, margen y condiciones del proveedor.`,
  }];
}
