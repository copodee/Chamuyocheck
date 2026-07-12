import { registerExternalVerificationExecution } from './externalVerificationExecutionRegistry';
import type {
  DocumentExternalVerificationPlan,
  ExternalVerificationExecutionResult,
  ExternalVerificationSourceRecord,
  ExternalVerificationWorkItem,
} from '../types/externalVerification';

export type WebVerificationAssessment = 'corroborated' | 'contradicted' | 'inconclusive';

export type AutomaticWebVerificationResult = {
  attempted: boolean;
  assessment: WebVerificationAssessment;
  rationale: string;
  execution: ExternalVerificationExecutionResult;
};

type SearchClient = {
  chat: { completions: { create: (input: any) => Promise<any> } };
};

const TRUSTED_NEWS = new Set(['clarin.com', 'lanacion.com.ar', 'infobae.com', 'ambito.com']);
const TRUSTED_INSTITUTIONS = [
  'who.int', 'paho.org', 'anmat.gob.ar', 'fda.gov', 'ema.europa.eu', 'nih.gov',
  'ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'worldbank.org', 'imf.org',
  'bcra.gob.ar', 'argentina.gob.ar', 'boletinoficial.gob.ar', 'cnv.gov.ar',
  'byma.com.ar', 'reuters.com', 'apnews.com', 'bbc.com',
];

function host(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return null; }
}

function isTrusted(url: string): boolean {
  const value = host(url);
  if (!value) return false;
  return value.endsWith('.gov') || value.endsWith('.gov.ar') || value.endsWith('.gob.ar') || value.endsWith('.edu')
    || TRUSTED_NEWS.has(value) || TRUSTED_INSTITUTIONS.some((domain) => value === domain || value.endsWith(`.${domain}`));
}

function isOfficial(url: string): boolean {
  const value = host(url) || '';
  return value.endsWith('.gov') || value.endsWith('.gov.ar') || value.endsWith('.gob.ar')
    || ['who.int', 'paho.org', 'worldbank.org', 'imf.org', 'ema.europa.eu'].some((domain) => value === domain || value.endsWith(`.${domain}`));
}

function sourceTypeFor(url: string, item: ExternalVerificationWorkItem): string | null {
  const value = host(url) || '';
  const candidates = item.suggestedSourceTypes;
  const preferred = value.includes('pubmed') || value.includes('ncbi')
    ? ['peer-reviewed-medical-research', 'scientific-journals']
    : value.includes('anmat') ? ['drug-regulator-anmat', 'health-authorities']
    : value.includes('fda.gov') ? ['drug-regulator-fda', 'health-authorities']
    : value.includes('ema.europa.eu') ? ['drug-regulator-ema', 'health-authorities']
    : value.includes('bcra') ? ['central-bank-data', 'official-market-data', 'financial-regulators']
    : /boletinoficial|argentina\.gob\.ar\/normativa|infoleg/.test(url) ? ['official-gazette', 'government-law-repository', 'public-records']
    : /cnv\.gov\.ar/.test(value) ? ['securities-regulator-cnv', 'financial-regulators', 'regulatory-filings']
    : TRUSTED_NEWS.has(value) || /reuters|apnews|bbc/.test(value) ? ['independent-news', 'independent-reputable-sources']
    : isOfficial(url) ? ['official-statements', 'public-records', 'health-authorities', 'official-statistics', 'government-records', 'financial-regulators']
    : ['independent-reputable-sources', 'scientific-journals'];
  return preferred.find((type) => candidates.includes(type)) || null;
}

function citationUrls(message: any): Set<string> {
  const urls = new Set<string>();
  for (const annotation of Array.isArray(message?.annotations) ? message.annotations : []) {
    const citation = annotation?.url_citation || annotation;
    if (typeof citation?.url === 'string') urls.add(citation.url);
  }
  return urls;
}

function parseJson(text: string): any {
  try { return JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim()); }
  catch { return {}; }
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

export async function runAutomaticWebVerification(
  client: SearchClient,
  claimText: string,
  plan: DocumentExternalVerificationPlan,
  model = process.env.OPENAI_WEB_SEARCH_MODEL || 'gpt-4o-mini-search-preview',
  existingRecords: ExternalVerificationSourceRecord[] = []
): Promise<AutomaticWebVerificationResult> {
  const empty = registerExternalVerificationExecution(plan, existingRecords);
  if (!plan.externalVerificationRequired) return { attempted: false, assessment: 'inconclusive', rationale: 'No se requirió verificación externa.', execution: empty };

  try {
    const response = await client.chat.completions.create({
      model,
      web_search_options: { search_context_size: 'medium' },
      messages: [
        { role: 'system', content: 'Verificás afirmaciones con fuentes web reales. No completes datos por memoria. Priorizá fuentes primarias, oficiales, técnicas y periodísticas reconocidas. Respondé JSON.' },
        { role: 'user', content: `Contrastá esta afirmación: ${claimText.slice(0, 6000)}\nFuentes requeridas: ${plan.suggestedSourceTypes.join(', ')}. Devolvé {"assessment":"corroborated|contradicted|inconclusive","rationale":"...","sources":[{"url":"URL citada","title":"...","published_at":"fecha ISO si existe"}]}. Si no hay evidencia suficiente, assessment debe ser inconclusive.` },
      ],
    });
    const message = response?.choices?.[0]?.message;
    const parsed = parseJson(String(message?.content || ''));
    const cited = citationUrls(message);
    const sources = Array.isArray(parsed?.sources) ? parsed.sources : [];
    const retrievedAt = new Date().toISOString();
    const records: ExternalVerificationSourceRecord[] = [];

    for (const item of plan.workItems) {
      for (const source of sources) {
        if (typeof source?.url !== 'string' || !cited.has(source.url) || !isTrusted(source.url)) continue;
        const sourceType = sourceTypeFor(source.url, item);
        if (!sourceType) continue;
        records.push({
          sourceType, url: source.url,
          title: String(source.title || host(source.url) || 'Fuente web'), retrievedAt,
          ...(isoDate(source.published_at) ? { sourceDate: isoDate(source.published_at) } : {}),
          claimIndexes: item.claimIndexes, official: isOfficial(source.url),
        });
      }
    }
    const execution = registerExternalVerificationExecution(plan, [...existingRecords, ...records]);
    const requested = ['corroborated', 'contradicted', 'inconclusive'].includes(parsed?.assessment) ? parsed.assessment : 'inconclusive';
    const assessment: WebVerificationAssessment = execution.externalVerificationPerformed ? requested : 'inconclusive';
    return { attempted: true, assessment, rationale: String(parsed?.rationale || 'La búsqueda no produjo una conclusión auditable.'), execution };
  } catch {
    return { attempted: true, assessment: 'inconclusive', rationale: 'La búsqueda externa no pudo completarse.', execution: empty };
  }
}
