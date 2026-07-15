import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const METADATA_URL = 'https://datos.gob.ar/api/3/action/package_show?id=agroindustria-agricultura---estimaciones-agricolas';
const MAX_CSV_BYTES = 20_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type AgricultureRow = {
  crop: string;
  year: number;
  campaign: string;
  province: string;
  department: string;
  plantedHa: number;
  harvestedHa: number;
  productionTonnes: number;
};

type AgricultureDataset = {
  expiresAt: number;
  resourceUrl: string;
  sourceDate?: string;
  rows: AgricultureRow[];
};

type CkanResource = { url?: string; format?: string; last_modified?: string };
type CkanPayload = { success?: boolean; result?: { resources?: CkanResource[]; metadata_modified?: string } };

const CROPS = [
  { label: 'soja', aliases: ['soja'] },
  { label: 'maíz', aliases: ['maiz'] },
  { label: 'trigo', aliases: ['trigo'] },
  { label: 'girasol', aliases: ['girasol'] },
  { label: 'cebada', aliases: ['cebada'] },
  { label: 'sorgo', aliases: ['sorgo'] },
  { label: 'arroz', aliases: ['arroz'] },
  { label: 'algodón', aliases: ['algodon'] },
  { label: 'maní', aliases: ['mani'] },
  { label: 'avena', aliases: ['avena'] },
  { label: 'centeno', aliases: ['centeno'] },
] as const;

const PROVINCES = [
  'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
] as const;

let datasetCache = new WeakMap<FetchLike, AgricultureDataset>();

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cropForClaim(text: string): { label: string; aliases: readonly string[] } | null {
  const normalized = ` ${normalize(text)} `;
  return CROPS.find((crop) => crop.aliases.some((alias) => normalized.includes(` ${alias} `))) || null;
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
  const parsed = Number(String(value || '').trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseRelevantRows(csv: string): AgricultureRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalize);
  const position = (name: string) => headers.indexOf(normalize(name));
  const indexes = {
    crop: position('cultivo'), year: position('anio'), campaign: position('campania'),
    province: position('provincia'), department: position('departamento'),
    planted: position('superficie_sembrada_ha'), harvested: position('superficie_cosechada_ha'),
    production: position('produccion_tm'),
  };
  if (Object.values(indexes).some((index) => index < 0)) return [];

  const supportedAliases = CROPS.flatMap((crop) => [...crop.aliases]);
  const rows: AgricultureRow[] = [];
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const crop = normalize(fields[indexes.crop] || '');
    if (!supportedAliases.some((alias) => crop.includes(alias))) continue;
    const year = Number(fields[indexes.year]);
    if (!Number.isInteger(year)) continue;
    rows.push({
      crop,
      year,
      campaign: fields[indexes.campaign] || String(year),
      province: fields[indexes.province] || '',
      department: fields[indexes.department] || '',
      plantedHa: numeric(fields[indexes.planted]),
      harvestedHa: numeric(fields[indexes.harvested]),
      productionTonnes: numeric(fields[indexes.production]),
    });
  }
  return rows;
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

function safeOfficialUrl(value: string | undefined, expectedHost: string): string | null {
  try {
    const parsed = new URL(value || '');
    return parsed.protocol === 'https:' && parsed.hostname === expectedHost ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function loadDataset(fetchImpl: FetchLike): Promise<AgricultureDataset | null> {
  const cached = datasetCache.get(fetchImpl);
  if (cached && cached.expiresAt > Date.now()) return cached;
  try {
    const metadataResponse = await fetchWithTimeout(fetchImpl, METADATA_URL, 'application/json');
    if (!metadataResponse.ok) return null;
    const metadata = await metadataResponse.json() as CkanPayload;
    if (!metadata.success) return null;
    const resource = metadata.result?.resources?.find((item) =>
      String(item.format || '').toUpperCase() === 'CSV' && safeOfficialUrl(item.url, 'datos.magyp.gob.ar')
    );
    const resourceUrl = safeOfficialUrl(resource?.url, 'datos.magyp.gob.ar');
    if (!resourceUrl) return null;

    const csvResponse = await fetchWithTimeout(fetchImpl, resourceUrl, 'text/csv');
    const contentLength = Number(csvResponse.headers.get('content-length') || 0);
    if (!csvResponse.ok || (contentLength > 0 && contentLength > MAX_CSV_BYTES)) return null;
    const csv = await csvResponse.text();
    if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) return null;
    const rows = parseRelevantRows(csv);
    if (rows.length === 0) return null;

    const lastModified = resource?.last_modified || metadata.result?.metadata_modified;
    const dataset: AgricultureDataset = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      resourceUrl,
      sourceDate: lastModified && !Number.isNaN(Date.parse(lastModified))
        ? new Date(lastModified).toISOString().slice(0, 10)
        : undefined,
      rows,
    };
    datasetCache.set(fetchImpl, dataset);
    return dataset;
  } catch {
    return null;
  }
}

function number(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits });
}

export function clearArgentinaAgricultureCacheForTests(): void {
  datasetCache = new WeakMap<FetchLike, AgricultureDataset>();
}

/** Retrieves official observed production; it never converts one historical series into an investment recommendation. */
export async function discoverArgentinaAgricultureEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  const crop = cropForClaim(claimText);
  if (!crop || claimIndexes.length === 0) return [];
  const province = provinceForClaim(claimText);
  const dataset = await loadDataset(fetchImpl);
  if (!dataset) return [];

  const matching = dataset.rows.filter((row) =>
    crop.aliases.some((alias) => row.crop.includes(alias)) &&
    (!province || normalize(row.province) === normalize(province))
  );
  const latestYear = Math.max(...matching.map((row) => row.year));
  if (!Number.isFinite(latestYear)) return [];
  const latest = matching.filter((row) => row.year === latestYear);
  if (latest.length === 0) return [];

  const plantedHa = latest.reduce((sum, row) => sum + row.plantedHa, 0);
  const harvestedHa = latest.reduce((sum, row) => sum + row.harvestedHa, 0);
  const productionTonnes = latest.reduce((sum, row) => sum + row.productionTonnes, 0);
  const yieldKgHa = harvestedHa > 0 ? productionTonnes * 1000 / harvestedHa : 0;
  const departments = latest
    .filter((row) => row.department && row.productionTonnes > 0)
    .sort((a, b) => b.productionTonnes - a.productionTonnes)
    .slice(0, 3)
    .map((row) => `${row.department} (${number(row.productionTonnes)} t)`);
  const campaign = latest.map((row) => row.campaign).find(Boolean) || String(latestYear);
  const geography = province || 'Argentina';
  const top = departments.length > 0 ? ` Principales departamentos observados: ${departments.join(', ')}.` : '';

  return [{
    sourceType: 'official-agricultural-statistics',
    url: dataset.resourceUrl,
    title: `Secretaría de Agricultura — estimaciones de ${crop.label} en ${geography}`,
    retrievedAt: new Date().toISOString(),
    sourceDate: dataset.sourceDate,
    claimIndexes: [...new Set(claimIndexes)],
    official: true,
    excerpt: `Campaña ${campaign}: ${number(plantedHa)} ha sembradas, ${number(harvestedHa)} ha cosechadas, ${number(productionTonnes)} toneladas producidas y rendimiento agregado estimado de ${number(yieldKgHa, 1)} kg/ha en ${geography}.${top} Son datos productivos históricos: no acreditan por sí solos rentabilidad futura, precio de venta, costos, aptitud del campo, clima ni logística.`,
  }];
}
