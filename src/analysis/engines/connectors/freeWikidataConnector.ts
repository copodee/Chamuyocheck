import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type WikidataStructuredResult = { records: ExternalVerificationSourceRecord[]; assessment: 'contradicted' | 'corroborated' | 'inconclusive'; rationale: string };

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

function claimEntityIds(entity: any, property: string): string[] {
  return (entity?.claims?.[property] || []).flatMap((statement: any) => {
    const id = statement?.mainsnak?.datavalue?.value?.id;
    return typeof id === 'string' && /^Q\d+$/.test(id) ? [id] : [];
  });
}

/** Compares asserted nationality/occupation with Wikidata statement values. */
export async function verifyWikidataStructuredClaim(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<WikidataStructuredResult> {
  const query = entityQuery(claimText);
  const none: WikidataStructuredResult = { records: [], assessment: 'inconclusive', rationale: 'Wikidata no aportó propiedades suficientes para comparar la afirmación.' };
  if (!query || claimIndexes.length === 0) return none;
  try {
    const searchUrl = new URL('https://www.wikidata.org/w/api.php');
    searchUrl.search = new URLSearchParams({ action: 'wbsearchentities', search: query, language: 'es', uselang: 'es', format: 'json', limit: '3', origin: '*' }).toString();
    const searchResponse = await fetchImpl(searchUrl, { headers: { Accept: 'application/json', 'User-Agent': 'ChamuyoCheck/1.0' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!searchResponse.ok) return none;
    const search = await searchResponse.json() as { search?: Array<{ id?: string; label?: string; description?: string; concepturi?: string }> };
    let hit = search.search?.find((item) => /^Q\d+$/.test(item.id || '') && item.label && item.concepturi);
    if (!hit || /apellido|desambiguaci[oó]n/i.test(hit.description || '')) {
      const context = /\bpiloto\b/i.test(claimText) ? `${query} piloto` : query;
      const wikiUrl = new URL('https://es.wikipedia.org/w/api.php');
      wikiUrl.search = new URLSearchParams({ action: 'query', list: 'search', srsearch: context, format: 'json', srlimit: '3', origin: '*' }).toString();
      const wikiResponse = await fetchImpl(wikiUrl, { headers: { Accept: 'application/json', 'User-Agent': 'ChamuyoCheck/1.0' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
      const wiki = wikiResponse.ok ? await wikiResponse.json() as { query?: { search?: Array<{ title?: string; pageid?: number }> } } : {};
      const normalizedQuery = normalizedTerms(query).join(' ');
      const page = wiki.query?.search?.find((item) => item.pageid && item.title && normalizedTerms(item.title).join(' ').includes(normalizedQuery));
      if (page?.pageid) {
        const propsUrl = new URL('https://es.wikipedia.org/w/api.php');
        propsUrl.search = new URLSearchParams({ action: 'query', pageids: String(page.pageid), prop: 'pageprops', format: 'json', origin: '*' }).toString();
        const propsResponse = await fetchImpl(propsUrl, { headers: { Accept: 'application/json', 'User-Agent': 'ChamuyoCheck/1.0' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
        const props = propsResponse.ok ? await propsResponse.json() as { query?: { pages?: Record<string, { title?: string; pageprops?: { wikibase_item?: string } }> } } : {};
        const resolved = props.query?.pages?.[String(page.pageid)];
        if (resolved?.pageprops?.wikibase_item) hit = { id: resolved.pageprops.wikibase_item, label: resolved.title || page.title, concepturi: `https://www.wikidata.org/entity/${resolved.pageprops.wikibase_item}` };
      }
    }
    if (!hit?.id || !hit.label || !hit.concepturi) return none;
    const entityResponse = await fetchImpl(`https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`, { headers: { Accept: 'application/json', 'User-Agent': 'ChamuyoCheck/1.0' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!entityResponse.ok) return none;
    const entityPayload = await entityResponse.json() as { entities?: Record<string, any> };
    const entity = entityPayload.entities?.[hit.id];
    const ids = [...new Set([...claimEntityIds(entity, 'P27'), ...claimEntityIds(entity, 'P106'), ...claimEntityIds(entity, 'P22'), ...claimEntityIds(entity, 'P25'), ...claimEntityIds(entity, 'P3373'), ...claimEntityIds(entity, 'P26')])];
    if (!ids.length) return none;
    const labelsUrl = new URL('https://www.wikidata.org/w/api.php');
    labelsUrl.search = new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'es|en', format: 'json', origin: '*' }).toString();
    const labelsResponse = await fetchImpl(labelsUrl, { headers: { Accept: 'application/json', 'User-Agent': 'ChamuyoCheck/1.0' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!labelsResponse.ok) return none;
    const labelsPayload = await labelsResponse.json() as { entities?: Record<string, { labels?: Record<string, { value?: string }> }> };
    const label = (id: string) => labelsPayload.entities?.[id]?.labels?.es?.value || labelsPayload.entities?.[id]?.labels?.en?.value || '';
    const nationalities = claimEntityIds(entity, 'P27').map(label).filter(Boolean);
    const occupations = claimEntityIds(entity, 'P106').map(label).filter(Boolean);
    const parents = [...claimEntityIds(entity, 'P22'), ...claimEntityIds(entity, 'P25')].map(label).filter(Boolean);
    const siblings = claimEntityIds(entity, 'P3373').map(label).filter(Boolean);
    const partners = claimEntityIds(entity, 'P26').map(label).filter(Boolean);
    const normalized = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const assertedSpanish = /\b(?:español|española|de\s+españa)\b/i.test(claimText);
    const assertedArgentine = /\b(?:argentino|argentina)\b/i.test(claimText);
    const assertedMotorcycle = /\b(?:piloto\s+de\s+motos?|motociclismo|motociclista)\b/i.test(claimText);
    const relationship = claimText.match(/\b(hij[oa]|herman[oa]|pareja|espos[oa]|c[oó]nyuge)\s+de\s+(.+?)[.!?]*$/i);
    const nationalityMismatch = assertedSpanish && nationalities.length > 0 && !nationalities.some((value) => /españa|spanish|spain/.test(normalized(value)))
      || assertedArgentine && nationalities.length > 0 && !nationalities.some((value) => /argentina/.test(normalized(value)));
    const occupationMismatch = assertedMotorcycle && occupations.length > 0 && !occupations.some((value) => /moto|motorcycle/.test(normalized(value)));
    let relationshipMismatch = false;
    let relationshipMatch = false;
    if (relationship) {
      const kind = normalized(relationship[1]);
      const target = normalized(relationship[2]);
      const values = /^hij/.test(kind) ? parents : /^herman/.test(kind) ? siblings : partners;
      relationshipMatch = values.some((value) => normalized(value).includes(target) || target.includes(normalized(value)));
      const incompatible = /^hij/.test(kind) ? siblings : /^herman/.test(kind) ? parents : [];
      relationshipMismatch = !relationshipMatch && (values.length > 0 || incompatible.some((value) => normalized(value).includes(target) || target.includes(normalized(value))));
    }
    const excerpt = `Nacionalidad/ciudadanía: ${nationalities.join(', ') || 'sin dato'}. Ocupación: ${occupations.join(', ') || 'sin dato'}. Padres: ${parents.join(', ') || 'sin dato'}. Hermanos: ${siblings.join(', ') || 'sin dato'}. Pareja/cónyuge: ${partners.join(', ') || 'sin dato'}.`;
    const records: ExternalVerificationSourceRecord[] = [{ sourceType: 'public-records', url: hit.concepturi, title: `${hit.label} — Wikidata`, retrievedAt: new Date().toISOString(), claimIndexes: [...new Set(claimIndexes)], official: false, excerpt }];
    if (nationalityMismatch || occupationMismatch || relationshipMismatch) return { records, assessment: 'contradicted', rationale: `Los atributos estructurados consultados contradicen uno o más predicados. ${excerpt}` };
    const comparable = assertedSpanish || assertedArgentine || assertedMotorcycle || relationshipMatch;
    return { records, assessment: comparable ? 'corroborated' : 'inconclusive', rationale: comparable ? `Los atributos estructurados coinciden con la afirmación dentro de su alcance. ${excerpt}` : `La entidad fue identificada, pero no se comparó un atributo compatible. ${excerpt}` };
  } catch { return none; }
}
