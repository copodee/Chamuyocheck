import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const RESOURCE_URL = 'https://cdn.produccion.gob.ar/cdn-mineria/Datos-Abiertos-SIACAM/cartera_siacam.csv';
const MAX_CSV_BYTES = 15_000_000;
const FETCH_TIMEOUT_MS = 12_000;

const MINERALS = [
  'litio', 'cobre', 'oro', 'plata', 'uranio', 'potasio', 'hierro', 'plomo', 'zinc',
  'borato', 'boratos', 'carbon', 'cal', 'yeso', 'arena', 'arcilla',
];

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
    } else if ((character === ',' || character === ';') && !quoted) {
      fields.push(value); value = '';
    } else value += character;
  }
  fields.push(value);
  return fields;
}

function position(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.some((candidate) => header === candidate || header.includes(candidate)));
}

function relevantValue(text: string, values: string[]): string | null {
  const normalizedText = ` ${normalize(text)} `;
  return values.find((value) => normalizedText.includes(` ${normalize(value)} `)) || null;
}

async function fetchCsv(fetchImpl: FetchLike): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(RESOURCE_URL, { headers: { accept: 'text/csv' }, signal: controller.signal });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (!response.ok || (contentLength > 0 && contentLength > MAX_CSV_BYTES)) return null;
    const csv = await response.text();
    return new TextEncoder().encode(csv).byteLength <= MAX_CSV_BYTES ? csv : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Finds projects in the official SIACAM portfolio. It does not certify reserves or economic viability. */
export async function discoverArgentinaMiningEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  if (claimIndexes.length === 0 || !/miner[ií]a|minero|litio|cobre|oro|plata|uranio|potasio|cantera/i.test(claimText)) return [];
  const csv = await fetchCsv(fetchImpl);
  if (!csv) return [];
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalize);
  const indexes = {
    project: position(headers, ['proyecto', 'nombre proyecto', 'nombre']),
    province: position(headers, ['provincia']),
    mineral: position(headers, ['mineral principal', 'mineral', 'producto']),
    status: position(headers, ['estado', 'etapa', 'fase']),
  };
  if (indexes.project < 0 || indexes.province < 0 || indexes.mineral < 0) return [];

  const mineral = relevantValue(claimText, MINERALS);
  const normalizedClaim = normalize(claimText);
  const rows = lines.slice(1).map(parseCsvLine).map((fields) => ({
    project: fields[indexes.project] || '',
    province: fields[indexes.province] || '',
    mineral: fields[indexes.mineral] || '',
    status: indexes.status >= 0 ? fields[indexes.status] || '' : '',
  })).filter((row) => {
    const namedProject = normalize(row.project).length > 3 && normalizedClaim.includes(normalize(row.project));
    const matchingMineral = mineral && normalize(row.mineral).includes(normalize(mineral));
    return namedProject || matchingMineral;
  }).slice(0, 5);
  if (rows.length === 0) return [];

  const summary = rows.map((row) => `${row.project} (${row.province}; ${row.mineral}${row.status ? `; ${row.status}` : ''})`).join('; ');
  return [{
    sourceType: 'official-mining-data',
    url: RESOURCE_URL,
    title: 'Secretaría de Minería — Cartera de Proyectos Mineros del SIACAM',
    retrievedAt: new Date().toISOString(),
    sourceDate: '2022-12-07',
    claimIndexes: [...new Set(claimIndexes)],
    official: true,
    excerpt: `Coincidencias en la cartera oficial: ${summary}. La cartera informa proyecto, ubicación, mineral y etapa; su actualización publicada es antigua. No acredita por sí sola reservas, ley mineral, derechos vigentes, permisos, CAPEX, OPEX, precio futuro, rentabilidad ni financiamiento.`,
  }];
}
