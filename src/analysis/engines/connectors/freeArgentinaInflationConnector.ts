import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const BCRA_REM_URL = 'https://www.bcra.gob.ar/relevamiento-expectativas-mercado-rem/';
const INDEC_IPC_URL = 'https://www.indec.gob.ar/indec/web/Institucional-Indec-InformesTecnicos-47';

function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
    .replace(/&deg;/gi, '°').replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function isoSourceDate(text: string): string | undefined {
  const months: Record<string, string> = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
  };
  const match = text.match(/publicado\s+el\s+d[ií]a\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
  if (!match) return undefined;
  const key = match[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return months[key] ? `${match[3]}-${months[key]}-${match[1].padStart(2, '0')}` : undefined;
}

/** Consults free official sources and never invents a missing projection. */
export async function discoverArgentinaInflationEvidence(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  if (!/\b(?:inflaci[oó]n|ipc|indec|rem)\b/i.test(claimText) || claimIndexes.length === 0) return [];

  const retrievedAt = new Date().toISOString();
  const records: ExternalVerificationSourceRecord[] = [];
  const [bcra, indec] = await Promise.allSettled([
    fetchImpl(BCRA_REM_URL, { headers: { accept: 'text/html' } }),
    fetchImpl(INDEC_IPC_URL, { headers: { accept: 'text/html' } }),
  ]);

  if (bcra.status === 'fulfilled' && bcra.value.ok) {
    const sourceText = plainText(await bcra.value.text());
    const period = sourceText.match(/RESUMEN\s+EJECUTIVO\s*\|\s*([A-ZÁÉÍÓÚ]+\s+DE\s+\d{4})/i)?.[1];
    const monthly = sourceText.match(/estim(?:aron|ó)\s+una\s+inflaci[oó]n\s+mensual\s+de\s+([\d.,]+%)/i)?.[1];
    const disclaimer = /no\s+constituyen\s+proyecciones\s+propias\s+del\s+BCRA/i.test(sourceText);
    records.push({
      sourceType: 'central-bank-data',
      url: BCRA_REM_URL,
      title: `BCRA — Relevamiento de Expectativas de Mercado${period ? ` (${period.toLowerCase()})` : ''}`,
      retrievedAt,
      sourceDate: isoSourceDate(sourceText),
      claimIndexes,
      official: true,
      excerpt: [
        monthly ? `El resumen vigente informa una expectativa mensual de ${monthly}.` : 'El REM publica expectativas de inflación para distintos horizontes.',
        disclaimer ? 'El BCRA aclara que son pronósticos de participantes privados, no proyecciones propias del Banco Central.' : '',
      ].filter(Boolean).join(' '),
    });
  }

  if (indec.status === 'fulfilled' && indec.value.ok) {
    records.push({
      sourceType: 'official-statistics',
      url: INDEC_IPC_URL,
      title: 'INDEC — Índice de Precios al Consumidor e informes técnicos',
      retrievedAt,
      claimIndexes,
      official: true,
      excerpt: 'El IPC del INDEC mide inflación efectivamente observada. No constituye una proyección futura.',
    });
  }

  return records;
}
