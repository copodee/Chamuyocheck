import type { ExternalVerificationSourceRecord } from '../../types/externalVerification';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const FEEDS = [
  { provider: 'LA NACION', url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml', host: 'lanacion.com.ar' },
] as const;

const STOP = new Set(['para', 'como', 'pero', 'este', 'esta', 'estos', 'estas', 'unos', 'unas', 'del', 'las', 'los', 'una', 'que', 'con', 'por', 'fue', 'son', 'sus', 'han', 'hay', 'argentina', 'argentino']);

function decode(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function field(item: string, name: string): string {
  return decode(item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '');
}

function terms(text: string): string[] {
  return [...new Set(text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{4,}/g) || [])]
    .filter((term) => !STOP.has(term)).slice(0, 20);
}

/** Uses only publisher-provided RSS feeds that are verified as publicly reachable. */
export async function discoverFreeNewsRss(
  claimText: string,
  claimIndexes: number[],
  fetchImpl: FetchLike = fetch
): Promise<ExternalVerificationSourceRecord[]> {
  const needles = terms(claimText);
  if (needles.length < 2 || claimIndexes.length === 0) return [];
  const records: ExternalVerificationSourceRecord[] = [];

  for (const feed of FEEDS) {
    try {
      const response = await fetchImpl(feed.url, { headers: { Accept: 'application/rss+xml, application/xml' }, redirect: 'error', signal: AbortSignal.timeout(6_000) });
      if (!response.ok || !/xml|rss/i.test(response.headers.get('content-type') || '')) continue;
      if (Number(response.headers.get('content-length') || 0) > 1_000_000) continue;
      const xml = await response.text();
      if (new TextEncoder().encode(xml).byteLength > 1_000_000) continue;
      for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
        const title = field(item, 'title');
        const description = field(item, 'description');
        const link = field(item, 'link');
        const date = field(item, 'pubDate');
        const searchable = `${title} ${description}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const relevance = needles.filter((term) => searchable.includes(term)).length;
        let parsed: URL;
        try { parsed = new URL(link); } catch { continue; }
        if (relevance < 2 || parsed.protocol !== 'https:' || !parsed.hostname.replace(/^www\./, '').endsWith(feed.host) || Number.isNaN(Date.parse(date))) continue;
        records.push({ sourceType: 'independent-news', url: link, title, retrievedAt: new Date().toISOString(), sourceDate: new Date(date).toISOString(), claimIndexes, official: false, excerpt: description.slice(0, 300) });
        if (records.length >= 3) break;
      }
    } catch { /* A blocked or unavailable publisher is simply not used. */ }
  }
  return records;
}
