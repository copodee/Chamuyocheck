import type { ExternalVerificationConnectorResult } from '../../types/externalVerification';
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function fetchPubmedArticle(pmid: string, claimIndexes: number[], fetchImpl: FetchLike = fetch): Promise<ExternalVerificationConnectorResult> {
  if (!/^\d{1,10}$/.test(pmid)) return { ok: false, provider: 'PubMed', records: [], error: 'PMID inválido.' };
  if (!claimIndexes.length) return { ok: false, provider: 'PubMed', records: [], error: 'El artículo debe vincularse a un claim.' };
  const apiUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json&tool=ChamuyoCheck`;
  try {
    const response = await fetchImpl(apiUrl, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!response.ok || new URL(response.url || apiUrl).hostname !== 'eutils.ncbi.nlm.nih.gov') throw new Error();
    if (Number(response.headers.get('content-length') || 0) > 500_000) return { ok: false, provider: 'PubMed', records: [], error: 'Respuesta PubMed demasiado grande.' };
    const json = await response.json() as any;
    const item = json?.result?.[pmid];
    if (!item?.title || !item?.pubdate) return { ok: false, provider: 'PubMed', records: [], error: 'PubMed no devolvió una cita auditable.' };
    const sourceDate = /^\d{4}\/\d{2}\/\d{2}/.test(item.sortpubdate || '')
      ? item.sortpubdate.slice(0, 10).replaceAll('/', '-')
      : undefined;
    return { ok: true, provider: 'PubMed', records: [{
      sourceType: 'scientific-journals', url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, title: item.title,
      retrievedAt: new Date().toISOString(), sourceDate, claimIndexes: [...new Set(claimIndexes)], official: false,
      excerpt: [item.source, item.volume, item.issue].filter(Boolean).join(' '),
    }] };
  } catch { return { ok: false, provider: 'PubMed', records: [], error: 'No se pudo consultar PubMed.' }; }
}
