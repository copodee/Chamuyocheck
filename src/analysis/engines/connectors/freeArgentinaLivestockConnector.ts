import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const METADATA_URL = 'https://datos.magyp.gob.ar/api/3/action/package_show?id=senasa-existencias-bovinas';
const MAX_CSV_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const PROVINCES = [
  'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Cordoba', 'Corrientes', 'Entre Rios',
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquen', 'Rio Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucuman',
] as const;

const LIVESTOCK_TERMS = /\b(?:ganader(?:ia|o|a)|bovin(?:o|a|os|as)|vac(?:a|as)|vaquillon(?:a|as)|novill(?:o|os|ito|itos)|terner(?:o|a|os|as)|toro|toros|hacienda|cria|invernada|feedlot)\b/i;
const CATEGORIES = ['vacas', 'vaquillonas', 'novillos', 'novillitos', 'terneros', 'terneras', 'toros', 'toritos', 'bueyes'] as const;

type LivestockRow = {
  year: number;
  province: string;
  department: string;
  categories: Record<(typeof CATEGORIES)[number], number>;
};

type LivestockDataset = {
  expiresAt: number;
  resourceUrl: string;
  rows: LivestockRow[];
};

type CkanResource = { name?: string; url?: string; format?: string };
type CkanPayload = { success?: boolean; result?: { resources?: CkanResource[] } };

let datasetCache = new WeakMap<FetchLike, LivestockDataset>();

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function provinceForClaim(text: string): string | null {
  const normalized = ` ${normalize(text)} `;
  return PROVINCES.find((province) => normalized.includes(` ${normalize(province)} `)) || null;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else value += character;
  }
  fields.push(value);
  return fields;
}

function numeric(value: string | undefined): number {
  const parsed = Number(String(value || '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseRows(csv: string): LivestockRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalize);
  const position = (name: string) => headers.indexOf(normalize(name));
  const yearIndex = position('anio');
  const provinceIndex = position('provincia');
  const departmentIndex = position('departamento');
  const categoryIndexes = Object.fromEntries(CATEGORIES.map((category) => [category, position(category)])) as Record<(typeof CATEGORIES)[number], number>;
  if (yearIndex < 0 || provinceIndex < 0 || departmentIndex < 0 || Object.values(categoryIndexes).some((index) => index < 0)) return [];

  return lines.slice(1).flatMap((line) => {
    const fields = parseCsvLine(line);
    const year = Number(fields[yearIndex]);
    if (!Number.isInteger(year)) return [];
    return [{
      year,
      province: fields[provinceIndex] || '',
      department: fields[departmentIndex] || '',
      categories: Object.fromEntries(CATEGORIES.map((category) => [category, numeric(fields[categoryIndexes[category]])])) as LivestockRow['categories'],
    }];
  });
}

async function fetchWithTimeout(fetchImpl: FetchLike, url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { headers: { accept }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function safeOfficialUrl(value: string | undefined): string | null {
  try {
    const parsed = new URL(value || '');
    return parsed.protocol === 'https:' && parsed.hostname === 'datos.magyp.gob.ar' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function loadDataset(fetchImpl: FetchLike): Promise<LivestockDataset | null> {
  const cached = datasetCache.get(fetchImpl);
  if (cached && cached.expiresAt > Date.now()) return cached;
  try {
    const metadataResponse = await fetchWithTimeout(fetchImpl, METADATA_URL, 'application/json');
    if (!metadataResponse.ok) return null;
    const metadata = await metadataResponse.json() as CkanPayload;
    if (!metadata.success) return null;
    const resource = metadata.result?.resources?.find((item) =>
      String(item.format || '').toUpperCase() === 'CSV' &&
      /existencias bovinos/i.test(item.name || '') &&
      !/serie/i.test(item.name || '') &&
      Boolean(safeOfficialUrl(item.url))
    );
    const resourceUrl = safeOfficialUrl(resource?.url);
    if (!resourceUrl) return null;

    const csvResponse = await fetchWithTimeout(fetchImpl, resourceUrl, 'text/csv');
    const contentLength = Number(csvResponse.headers.get('content-length') || 0);
    if (!csvResponse.ok || (contentLength > 0 && contentLength > MAX_CSV_BYTES)) return null;
    const csv = await csvResponse.text();
    if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) return null;
    const rows = parseRows(csv);
    if (rows.length === 0) return null;
    const dataset = { expiresAt: Date.now() + CACHE_TTL_MS, resourceUrl, rows };
    datasetCache.set(fetchImpl, dataset);
    return dataset;
  } catch {
    return null;
  }
}

function total(row: LivestockRow): number {
  return CATEGORIES.reduce((sum, category) => sum + row.categories[category], 0);
}

function number(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits });
}

export function clearArgentinaLivestockCacheForTests(): void {
  datasetCache = new WeakMap<FetchLike, LivestockDataset>();
}

/** Returns a dated SENASA stock baseline. It never treats herd size as current price or profitability. */
export async function discoverArgentinaLivestockEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  if (!LIVESTOCK_TERMS.test(normalize(claimText)) || claimIndexes.length === 0) return [];
  const province = provinceForClaim(claimText);
  const dataset = await loadDataset(fetchImpl);
  if (!dataset) return [];
  const matching = dataset.rows.filter((row) => !province || normalize(row.province) === normalize(province));
  const latestYear = Math.max(...matching.map((row) => row.year));
  if (!Number.isFinite(latestYear)) return [];
  const latest = matching.filter((row) => row.year === latestYear);
  if (latest.length === 0) return [];

  const totals = Object.fromEntries(CATEGORIES.map((category) => [category, latest.reduce((sum, row) => sum + row.categories[category], 0)])) as LivestockRow['categories'];
  const heads = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const calfCowRatio = totals.vacas > 0 ? (totals.terneros + totals.terneras) / totals.vacas * 100 : 0;
  const departments = latest
    .filter((row) => row.department)
    .sort((a, b) => total(b) - total(a))
    .slice(0, 3)
    .map((row) => `${row.department} (${number(total(row))} cabezas)`);
  const geography = province || 'Argentina';
  const top = departments.length > 0 ? ` Mayor stock observado: ${departments.join(', ')}.` : '';

  return [{
    sourceType: 'official-livestock-data',
    url: dataset.resourceUrl,
    title: `SENASA — existencias bovinas históricas en ${geography}`,
    retrievedAt: new Date().toISOString(),
    sourceDate: `${latestYear}-12-31`,
    claimIndexes: [...new Set(claimIndexes)],
    official: true,
    excerpt: `Último año disponible en este CSV: ${latestYear}. Se registran ${number(heads)} bovinos en ${geography}: ${number(totals.vacas)} vacas, ${number(totals.vaquillonas)} vaquillonas, ${number(totals.novillos + totals.novillitos)} novillos/novillitos y ${number(totals.terneros + totals.terneras)} terneros/as. Relación terneros/as por 100 vacas: ${number(calfCowRatio, 1)}.${top} Es una referencia histórica, no un dato actual. No acredita precio, rentabilidad, receptividad del campo, sanidad, mortandad, alimentación, flete, clima ni capital de trabajo.`,
  }];
}
