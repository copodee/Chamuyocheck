import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const DRUGS = [
  { input: /\b(?:paracetamol|acetaminof[eé]n)\b/i, query: 'acetaminophen', label: /^(?:EXTRA STRENGTH )?ACETAMINOPHEN (?:TABLET|CAPSULE)/i },
] as const;

function plain(xml: string): string {
  return xml.replace(/<styleCode>[^<]*<\/styleCode>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** Queries DailyMed, the free official US drug-label repository. */
export async function discoverFreeDrugLabel(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  const drug = DRUGS.find((candidate) => candidate.input.test(claimText));
  if (!drug || claimIndexes.length === 0) return [];
  try {
    const searchUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(drug.query)}&page=1&pagesize=20`;
    const search = await fetchImpl(searchUrl, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!search.ok || !/json/i.test(search.headers.get('content-type') || '')) return [];
    const payload = await search.json() as { data?: Array<{ setid?: string; title?: string; published_date?: string }> };
    const label = payload.data?.find((item) => typeof item.title === 'string' && drug.label.test(item.title));
    if (!label?.setid || !label.title || !label.published_date) return [];
    const xmlUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${encodeURIComponent(label.setid)}.xml`;
    const response = await fetchImpl(xmlUrl, { headers: { Accept: 'application/xml' }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!response.ok || !/xml/i.test(response.headers.get('content-type') || '')) return [];
    const xml = await response.text();
    if (new TextEncoder().encode(xml).byteLength > 4_000_000) return [];
    const content = plain(xml);
    const headache = content.match(/.{0,100}\bheadache\b.{0,180}/i)?.[0];
    if (!headache) return [];
    return [{
      sourceType: 'drug-regulator-fda',
      url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${label.setid}`,
      title: label.title,
      retrievedAt: new Date().toISOString(),
      sourceDate: new Date(label.published_date).toISOString(),
      claimIndexes: [...new Set(claimIndexes)],
      official: true,
      excerpt: headache,
    }];
  } catch { return []; }
}
