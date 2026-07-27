import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractBalanceData } from '../src/modules/prequalification/scoring/balanceExtractor';

type CorpusEntry = {
  id: string;
  company: string;
  sector: string;
  profile: 'corporate' | 'financial-institution';
  periodEnd: string;
  periodType: 'annual' | 'interim';
  scope: 'consolidated' | 'separate' | 'individual';
  assurance: 'audit' | 'limited-review';
  currency: string;
  amountScale: 1 | 1000 | 1000000;
  sourceKind: 'cnv' | 'issuer-ir';
  sourcePage: string;
  documentUrl: string;
  accessedAt: string;
  tags: string[];
};

type Manifest = {
  schemaVersion: number;
  updatedAt: string;
  sources: CorpusEntry[];
};

type MetadataMismatch = {
  field: 'periodEnd' | 'periodType' | 'scope' | 'amountScale';
  expected: string | number;
  detected: string | number | null;
};

const root = process.cwd();
const corpusDirectory = path.join(root, 'corpus', 'public-eecc');
const manifestPath = path.join(corpusDirectory, 'manifest.json');
const downloadsDirectory = path.join(corpusDirectory, 'downloads');
const allowedHosts = new Set([
  'www.cnv.gov.ar',
  'cnv.gov.ar',
  'www.centralpuerto.com',
  'centralpuerto.com',
  'www.irsa.com.ar',
  'irsa.com.ar',
  'investors.ypf.com',
]);

async function loadManifest(): Promise<Manifest> {
  return JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
}

function validateEntry(entry: CorpusEntry, ids: Set<string>): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9-]+$/.test(entry.id)) errors.push(`${entry.id}: id inválido`);
  if (ids.has(entry.id)) errors.push(`${entry.id}: id duplicado`);
  ids.add(entry.id);
  if (!entry.company.trim()) errors.push(`${entry.id}: empresa vacía`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.periodEnd)) errors.push(`${entry.id}: fecha de cierre inválida`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.accessedAt)) errors.push(`${entry.id}: fecha de consulta inválida`);
  for (const [label, value] of [['sourcePage', entry.sourcePage], ['documentUrl', entry.documentUrl]]) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') errors.push(`${entry.id}: ${label} debe usar HTTPS`);
      if (!allowedHosts.has(url.hostname)) errors.push(`${entry.id}: host no permitido en ${label}`);
    } catch {
      errors.push(`${entry.id}: URL inválida en ${label}`);
    }
  }
  return errors;
}

async function validate(manifest: Manifest): Promise<void> {
  const ids = new Set<string>();
  const errors = manifest.sources.flatMap((entry) => validateEntry(entry, ids));
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion no soportada');
  if (!manifest.sources.length) errors.push('el corpus no contiene fuentes');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Manifiesto válido: ${manifest.sources.length} estados contables públicos.`);
}

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || null : null;
}

function normalizeDetectedDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function compareMetadata(
  entry: CorpusEntry,
  detected: {
    closingDate: string | null;
    statementKind: string;
    statementScope: string;
    amountScale: number;
  },
): MetadataMismatch[] {
  const mismatches: MetadataMismatch[] = [];
  const detectedPeriodEnd = normalizeDetectedDate(detected.closingDate);
  const detectedPeriodType = detected.statementKind === 'annual'
    ? 'annual'
    : detected.statementKind === 'interim'
      ? 'interim'
      : null;
  const detectedScope = detected.statementScope === 'individual'
    ? 'separate'
    : detected.statementScope;

  if (detectedPeriodEnd !== entry.periodEnd) {
    mismatches.push({ field: 'periodEnd', expected: entry.periodEnd, detected: detectedPeriodEnd });
  }
  if (detectedPeriodType !== entry.periodType) {
    mismatches.push({ field: 'periodType', expected: entry.periodType, detected: detectedPeriodType });
  }
  if (detectedScope !== entry.scope) {
    mismatches.push({ field: 'scope', expected: entry.scope, detected: detectedScope });
  }
  if (detected.amountScale !== entry.amountScale) {
    mismatches.push({ field: 'amountScale', expected: entry.amountScale, detected: detected.amountScale });
  }
  return mismatches;
}

async function download(manifest: Manifest): Promise<void> {
  const requestedId = argument('id');
  const requestedSector = argument('sector');
  const selected = manifest.sources.filter((entry) =>
    (!requestedId || entry.id === requestedId) &&
    (!requestedSector || entry.sector === requestedSector));
  if (!selected.length) throw new Error('No hay documentos que coincidan con el filtro.');
  await mkdir(downloadsDirectory, { recursive: true });
  const index: Array<Record<string, unknown>> = [];
  for (const entry of selected) {
    try {
      console.log(`Descargando ${entry.id}…`);
      const response = await fetch(entry.documentUrl, {
        redirect: 'follow',
        headers: { 'user-agent': 'LeasingScoring public-corpus-validator/1.0' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 40 * 1024 * 1024) throw new Error('supera 40 MB');
      if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new Error('la respuesta no es un PDF');
      }
      const filename = `${entry.id}.pdf`;
      await writeFile(path.join(downloadsDirectory, filename), bytes);
      index.push({
        id: entry.id,
        filename,
        status: 'downloaded',
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        downloadedAt: new Date().toISOString(),
        sourceUrl: entry.documentUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${entry.id}: ${message}`);
      index.push({ id: entry.id, status: 'failed', error: message, sourceUrl: entry.documentUrl });
    }
  }
  await writeFile(path.join(downloadsDirectory, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  const downloaded = index.filter((item) => item.status === 'downloaded').length;
  console.log(`Descarga completa: ${downloaded}/${selected.length} documento(s).`);
}

async function analyze(manifest: Manifest): Promise<void> {
  const requestedId = argument('id');
  const selected = manifest.sources.filter((entry) => !requestedId || entry.id === requestedId);
  const results: Array<Record<string, unknown>> = [];
  for (const entry of selected) {
    const filename = path.join(downloadsDirectory, `${entry.id}.pdf`);
    let buffer: Buffer;
    try {
      buffer = await readFile(filename);
    } catch {
      console.warn(`${entry.id}: no descargado; se omite.`);
      continue;
    }
    const pdfParseModule = (await import('pdf-parse')) as any;
    let parsed: { text: string; numpages?: number };
    if (typeof pdfParseModule.PDFParse === 'function') {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      try {
        const textResult = await parser.getText();
        parsed = { text: textResult.text, numpages: textResult.total };
      } finally {
        await parser.destroy();
      }
    } else {
      const legacyParser = pdfParseModule.default || pdfParseModule;
      parsed = await legacyParser(buffer);
    }
    const extracted = extractBalanceData(String(parsed.text || ''));
    const detected = {
      closingDate: extracted.closingDate,
      periodMonths: extracted.periodMonths,
      statementKind: extracted.statementKind,
      statementScope: extracted.statementScope,
      amountScale: extracted.amountScale,
      currencyBasis: extracted.currencyBasis,
    };
    const metadataMismatches = compareMetadata(entry, detected);
    results.push({
      id: entry.id,
      expected: {
        periodEnd: entry.periodEnd,
        periodType: entry.periodType,
        scope: entry.scope,
        amountScale: entry.amountScale,
      },
      pages: parsed.numpages ?? null,
      textCharacters: String(parsed.text || '').length,
      extractionConfidence: extracted.extractionConfidence,
      missingFields: extracted.missingFields,
      detected,
      metadataMismatches,
    });
    console.log(
      `${entry.id}: confianza ${extracted.extractionConfidence}%, `
      + `faltantes ${extracted.missingFields.join(', ') || 'ninguno'}, `
      + `metadatos divergentes ${metadataMismatches.map((item) => item.field).join(', ') || 'ninguno'}.`,
    );
  }
  if (!results.length) throw new Error('No hay PDF descargados para analizar.');
  await writeFile(path.join(downloadsDirectory, 'analysis.json'), `${JSON.stringify(results, null, 2)}\n`);
}

async function main(): Promise<void> {
  const manifest = await loadManifest();
  await validate(manifest);
  if (process.argv.includes('--download')) await download(manifest);
  if (process.argv.includes('--analyze')) await analyze(manifest);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
