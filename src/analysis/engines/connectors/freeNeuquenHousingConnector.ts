import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const RESOURCE_URL = 'https://portaldatosabiertos.neuquen.gov.ar/dataset/19061962-88ab-407c-aa38-ffbb706a4754/resource/82caa39c-1af9-4790-adf1-3a33e9db5222/download/viviendas-censos-2001-2010-2022.csv';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_CSV_BYTES = 2_000_000;

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseCsvLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === separator && !quoted) { fields.push(value); value = ''; }
    else value += character;
  }
  fields.push(value);
  return fields;
}

function numeric(value: string | undefined): number | null {
  const parsed = Number(String(value || '').replace(/\./g, '').replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function format(value: number | null): string {
  return value === null ? 'sin dato' : value.toLocaleString('es-AR');
}

/** Supplies official housing-stock context. It never estimates sale prices, rents or investment returns. */
export async function discoverNeuquenHousingEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  if (claimIndexes.length === 0
    || !/(a[nñ]elo|vaca\s+muerta|neuqu[eé]n|rinc[oó]n\s+de\s+los\s+sauces|san\s+patricio\s+del\s+cha[nñ]ar)/i.test(claimText)
    || !/(vivienda|departamento|alquiler|terreno|tierra|inmueble|ocupaci[oó]n|vacancia)/i.test(claimText)) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(RESOURCE_URL, { headers: { accept: 'text/csv' }, signal: controller.signal });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (!response.ok || (contentLength > 0 && contentLength > MAX_CSV_BYTES)) return [];
    const csv = await response.text();
    if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) return [];
    const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const separator = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
    const headers = parseCsvLine(lines[0], separator).map(normalize);
    const position = (names: string[]) => headers.findIndex((header) => names.some((name) => header.includes(name)));
    const indexes = {
      year: position(['ano', 'year']), department: position(['departamento']), total: position(['total de viviendas']),
      occupied: position(['particulares ocupadas', 'viviendas ocupadas']), unoccupied: position(['particulares desocupadas', 'viviendas desocupadas']),
    };
    if (indexes.department < 0 || indexes.year < 0) return [];
    const wantsAnelo = /a[nñ]elo|vaca\s+muerta/i.test(claimText);
    const rows = lines.slice(1).map((line) => parseCsvLine(line, separator)).map((fields) => ({
      year: Number(fields[indexes.year]) || 0, department: fields[indexes.department] || '',
      total: indexes.total >= 0 ? numeric(fields[indexes.total]) : null,
      occupied: indexes.occupied >= 0 ? numeric(fields[indexes.occupied]) : null,
      unoccupied: indexes.unoccupied >= 0 ? numeric(fields[indexes.unoccupied]) : null,
    })).filter((row) => wantsAnelo ? normalize(row.department) === 'anelo' : normalize(claimText).includes(normalize(row.department)));
    if (rows.length === 0) return [];
    const row = rows.reduce((latest, candidate) => candidate.year > latest.year ? candidate : latest, rows[0]);
    return [{
      sourceType: 'official-real-estate-data', url: RESOURCE_URL,
      title: 'Dirección Provincial de Estadística y Censos de Neuquén — viviendas por departamento',
      retrievedAt: new Date().toISOString(), sourceDate: String(row.year), claimIndexes: [...new Set(claimIndexes)], official: true,
      excerpt: `Departamento ${row.department}, Censo ${row.year}: ${format(row.total)} viviendas totales, ${format(row.occupied)} particulares ocupadas y ${format(row.unoccupied)} particulares desocupadas. Es contexto censal departamental: no informa precios actuales de tierras o viviendas, alquileres, vacancia locativa, días de publicación ni rentabilidad.`,
    }];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
