import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function entityQuery(text: string): string | null {
  const cleaned = text.trim().replace(/[.!?]+$/, '');
  const called = cleaned.match(/\bse\s+llama\s+(.+)$/i)?.[1];
  if (called) return called.trim();
  const subject = cleaned.match(/^(.+?)\s+(?:es|era|fue|nació|estudió|trabajó)\b/i)?.[1]
    ?.replace(/^(?:el|la|los|las|un|una)\s+/i, '')
    .replace(/^(?:presidente|ministro|secretari[oa]|piloto|actor|actriz)\s+(?:argentino|argentina|español|española)?\s*/i, '')
    .trim();
  return subject && subject.length >= 3 && subject.length <= 120 ? subject : null;
}

function normalizedTerms(text: string): string[] {
  const stop = new Set(['este', 'esta', 'estos', 'estas', 'como', 'para', 'origen', 'carrera', 'llama', 'unos', 'unas', 'del', 'las', 'los', 'una', 'que', 'con', 'por', 'era', 'fue', 'son']);
  return [...new Set(text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{4,}/g) || [])].filter((term) => !stop.has(term));
}

/** Resolves a factual subject against Wikidata's CC0 structured entity API. */
export async function discoverWikidataEntity(
  claimText: string,
  claimIndexes: number[],
  sourceType: string,
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  const query = entityQuery(claimText);
  if (!query || claimIndexes.length === 0) return [];
  try {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({ action: 'wbsearchentities', search: query, language: 'es', uselang: 'es', format: 'json', limit: '3', origin: '*' }).toString();
    const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'ChamuyoCheck/1.0' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) return [];
    const payload = await response.json() as { search?: Array<{ id?: string; label?: string; description?: string; concepturi?: string }> };
    const entity = payload.search?.find((item) => /^Q\d+$/.test(item.id || '') && item.label && item.concepturi);
    if (!entity?.id || !entity.label || !entity.concepturi) return [];
    const evidence = `${entity.label} ${entity.description || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const queryTerms = new Set(normalizedTerms(query));
    const predicateTerms = normalizedTerms(claimText).filter((term) => !queryTerms.has(term));
    const relationship = claimText.match(/\b(hij[oa]|herman[oa]|padre|madre|pareja|espos[oa]|c[oó]nyuge)\s+de\b/i)?.[1];
    const relationshipCovered = !relationship || evidence.includes(relationship.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    if (!relationshipCovered || predicateTerms.filter((term) => evidence.includes(term)).length < Math.min(2, predicateTerms.length || 2)) return [];
    return [{
      sourceType,
      url: entity.concepturi,
      title: `${entity.label} — Wikidata`,
      retrievedAt: new Date().toISOString(),
      claimIndexes: [...new Set(claimIndexes)],
      official: false,
      excerpt: entity.description?.slice(0, 300),
    }];
  } catch { return []; }
}
