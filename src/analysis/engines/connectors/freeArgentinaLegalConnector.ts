import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type ArgentinaLegalResult = { records: ExternalVerificationSourceRecord[]; assessment: 'contradicted' | 'corroborated' | 'inconclusive'; rationale: string };

const PENAL_CODE = 'https://www.argentina.gob.ar/normativa/nacional/ley-11179-16546/actualizacion';

function text(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&ordm;/gi, 'º').replace(/\s+/g, ' ').trim();
}

/** Verifies common Argentine criminal-law penalty claims against the official consolidated Penal Code. */
export async function verifyArgentinaCriminalLaw(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ArgentinaLegalResult> {
  const none: ArgentinaLegalResult = { records: [], assessment: 'inconclusive', rationale: 'No se identificó una disposición penal argentina suficientemente específica.' };
  if (!/\b(?:argentina|argentinas?|c[oó]digo\s+penal)\b/i.test(claimText) || !/\b(?:roba|robar|hurto|sustrae)\b/i.test(claimText) || !claimIndexes.length) return none;
  try {
    const response = await fetchImpl(PENAL_CODE, { headers: { Accept: 'text/html', 'User-Agent': 'ChamuyoCheck/1.0' }, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    const final = new URL(response.url || PENAL_CODE);
    if (!response.ok || final.hostname !== 'www.argentina.gob.ar' || !/text\/html/i.test(response.headers.get('content-type') || '')) return none;
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > 5_000_000) return none;
    const body = text(html);
    const article = body.match(/ARTICULO\s+162[^.]*\.\s*-?\s*(El que se apoderare[\s\S]{0,500}?prisi[oó]n de un mes a dos años)/i)?.[0]
      || body.match(/ARTICULO\s+162[\s\S]{0,700}?prisi[oó]n de un mes a dos años/i)?.[0];
    if (!article) return none;
    const retrievedAt = new Date().toISOString();
    const record: ExternalVerificationSourceRecord = {
      sourceType: 'government-law-repository', url: PENAL_CODE, title: 'Código Penal de la Nación Argentina — Ley 11.179, artículo 162',
      retrievedAt, sourceDate: retrievedAt.slice(0, 10), claimIndexes: [...new Set(claimIndexes)], official: true, excerpt: article.slice(0, 700),
    };
    const allegesDeath = /\b(?:horca|pena\s+de\s+muerte|ejecutad[oa]|fusilad[oa])\b/i.test(claimText);
    const allegesStatutoryPrison = /\bprisi[oó]n\s+de\s+un\s+mes\s+a\s+dos\s+a[ñn]os\b/i.test(claimText);
    if (allegesDeath) return { records: [record], assessment: 'contradicted', rationale: 'La afirmación contradice el artículo 162 del Código Penal argentino, que para el hurto simple establece prisión de un mes a dos años; no pena de muerte. La calificación concreta depende de los hechos.' };
    if (allegesStatutoryPrison) return { records: [record], assessment: 'corroborated', rationale: 'La pena mencionada coincide con el artículo 162 para el hurto simple, sin perjuicio de la calificación concreta del caso.' };
    return { records: [record], assessment: 'inconclusive', rationale: 'Se localizó el artículo 162, pero la afirmación no expresa una pena directamente comparable.' };
  } catch { return none; }
}
