import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const RESOURCE_URL = 'https://datos.energia.gob.ar/dataset/c846e79c-026c-4040-897f-1ad3543b407c/resource/2f2834f4-1981-448f-9a3c-1e519d8c10cd/download/produccin-de-captulo-iv-agrupada-por-yacimiento-y-formacin-productiva.csv';
const MAX_CSV_BYTES = 30_000_000;
const FETCH_TIMEOUT_MS = 15_000;

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
    } else if (character === ',' && !quoted) { fields.push(value); value = ''; }
    else value += character;
  }
  fields.push(value);
  return fields;
}

function position(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.some((candidate) => header === candidate || header.includes(candidate)));
}

function numeric(value: string | undefined): number {
  const parsed = Number(String(value || '').trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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

function formatted(value: number): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

/** Retrieves observed official production. It never infers reserves, profitability, land values or rents. */
export async function discoverArgentinaHydrocarbonEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  if (claimIndexes.length === 0 || !/vaca\s+muerta|petr[oó]leo|gas\s+natural|hidrocarburo|yacimiento|pozo|no\s+convencional/i.test(claimText)) return [];
  const csv = await fetchCsv(fetchImpl);
  if (!csv) return [];
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalize);
  const indexes = {
    formation: position(headers, ['formacion', 'formacion productiva']),
    field: position(headers, ['yacimiento']),
    province: position(headers, ['provincia']),
    year: position(headers, ['anio', 'year']),
    month: position(headers, ['mes', 'month']),
    oil: position(headers, ['prod pet', 'petroleo', 'prod_pet']),
    gas: position(headers, ['prod gas', 'gas', 'prod_gas']),
  };
  if (indexes.formation < 0 && indexes.field < 0) return [];
  const wantsVacaMuerta = /vaca\s+muerta/i.test(claimText);
  const normalizedClaim = normalize(claimText);
  const rows = lines.slice(1).map(parseCsvLine).map((fields) => ({
    formation: indexes.formation >= 0 ? fields[indexes.formation] || '' : '',
    field: indexes.field >= 0 ? fields[indexes.field] || '' : '',
    province: indexes.province >= 0 ? fields[indexes.province] || '' : '',
    year: indexes.year >= 0 ? Number(fields[indexes.year]) : 0,
    month: indexes.month >= 0 ? Number(fields[indexes.month]) : 0,
    oil: indexes.oil >= 0 ? numeric(fields[indexes.oil]) : 0,
    gas: indexes.gas >= 0 ? numeric(fields[indexes.gas]) : 0,
  })).filter((row) => wantsVacaMuerta
    ? normalize(row.formation).includes('vaca muerta')
    : normalizedClaim.includes(normalize(row.field)) || /petr[oó]leo|gas|hidrocarburo/i.test(claimText));
  if (rows.length === 0) return [];
  const latest = rows.reduce((best, row) => row.year * 100 + row.month > best ? row.year * 100 + row.month : best, 0);
  const periodRows = latest > 0 ? rows.filter((row) => row.year * 100 + row.month === latest) : rows.slice(-1000);
  const oil = periodRows.reduce((sum, row) => sum + row.oil, 0);
  const gas = periodRows.reduce((sum, row) => sum + row.gas, 0);
  const fields = [...new Set(periodRows.map((row) => row.field).filter(Boolean))];
  const period = latest > 0 ? `${String(latest % 100).padStart(2, '0')}/${Math.floor(latest / 100)}` : 'último período disponible';

  return [{
    sourceType: 'official-hydrocarbon-data',
    url: RESOURCE_URL,
    title: 'Secretaría de Energía — Producción de petróleo y gas por yacimiento y formación',
    retrievedAt: new Date().toISOString(),
    claimIndexes: [...new Set(claimIndexes)],
    official: true,
    excerpt: `Período ${period}: ${formatted(oil)} m³ de petróleo y ${formatted(gas)} miles de m³ de gas en ${fields.length} yacimientos coincidentes${wantsVacaMuerta ? ' de la formación Vaca Muerta' : ''}. Es producción declarada y observada: no prueba reservas futuras, rentabilidad, capacidad de transporte, permisos, pasivos ambientales, valor de tierras, precio de viviendas, alquileres, vacancia ni demanda habitacional.`,
  }];
}
