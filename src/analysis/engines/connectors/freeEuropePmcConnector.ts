import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const STOP = new Set(['este', 'esta', 'estos', 'estas', 'para', 'como', 'pero', 'tambien', 'tiene', 'puede', 'produce', 'efecto', 'efectos', 'salud', 'droga', 'medicamento', 'afirmacion']);
const MEDICAL_TERMS: Record<string, string> = {
  metanfetamina: 'methamphetamine', paracetamol: 'acetaminophen', cardiovasculares: 'cardiovascular',
  cardiovascular: 'cardiovascular', neurologicos: 'neurological', neurologicas: 'neurological',
  infeccion: 'infection', bacteriana: 'bacterial', bacteriano: 'bacterial', cefalea: 'headache',
};

function terms(text: string): string[] {
  return [...new Set(text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{5,}/g) || [])]
    .filter((term) => !STOP.has(term)).map((term) => MEDICAL_TERMS[term] || term).slice(0, 12);
}

/** Searches Europe PMC's public API and returns only strongly relevant bibliographic evidence. */
export async function discoverEuropePmcEvidence(
  claimText: string,
  claimIndexes: number[],
  sourceType: 'peer-reviewed-medical-research' | 'scientific-journals',
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  const needles = terms(claimText);
  if (needles.length < 2 || claimIndexes.length === 0) return [];
  try {
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.search = new URLSearchParams({ query: needles.join(' '), format: 'json', pageSize: '5', resultType: 'core' }).toString();
    const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'ChamuyoCheck/1.0' }, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok || !/json/i.test(response.headers.get('content-type') || '')) return [];
    const payload = await response.json() as { resultList?: { result?: Array<{ id?: string; pmid?: string; title?: string; abstractText?: string; pubYear?: string; journalTitle?: string }> } };
    const retrievedAt = new Date().toISOString();
    return (payload.resultList?.result || []).flatMap((item) => {
      const id = item.pmid || item.id;
      const evidence = `${item.title || ''} ${item.abstractText || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!id || !item.title || needles.filter((term) => evidence.includes(term)).length < Math.min(3, needles.length)) return [];
      const year = Number(item.pubYear);
      return [{
        sourceType,
        url: `https://europepmc.org/article/MED/${encodeURIComponent(id)}`,
        title: item.title,
        retrievedAt,
        ...(Number.isInteger(year) && year > 1800 && year <= new Date().getUTCFullYear() ? { sourceDate: `${year}-01-01` } : {}),
        claimIndexes: [...new Set(claimIndexes)],
        official: false,
        excerpt: item.abstractText?.slice(0, 500),
      }];
    }).slice(0, 3);
  } catch { return []; }
}
