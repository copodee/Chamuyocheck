import { createHash } from 'node:crypto';
import { executeExternalVerificationPlan } from './externalVerificationOrchestrator';
import { registerExternalVerificationExecution } from './externalVerificationExecutionRegistry';
import { runAutomaticWebVerification, type AutomaticWebVerificationResult } from './automaticWebVerification';
import type {
  DocumentExternalVerificationPlan,
  ExternalVerificationRequest,
} from '../types/externalVerification';
import { discoverFreeNewsRss } from './connectors/freeNewsRssConnector';
import { discoverFreeDrugLabel } from './connectors/freeDrugLabelConnector';
import { verifyWikidataStructuredClaim } from './connectors/freeWikidataConnector';
import { discoverEuropePmcEvidence } from './connectors/freeEuropePmcConnector';
import { verifyArgentinaCriminalLaw } from './connectors/freeArgentinaLegalConnector';
import { discoverArgentinaInflationEvidence } from './connectors/freeArgentinaInflationConnector';
import { discoverArgentinaExportEvidence, discoverArgentinaProductiveInputEvidence } from './connectors/freeUnComtradeConnector';
import { discoverArgentinaAgricultureEvidence } from './connectors/freeArgentinaAgricultureConnector';
import { discoverArgentinaLivestockEvidence } from './connectors/freeArgentinaLivestockConnector';
import { discoverArgentinaMiningEvidence } from './connectors/freeArgentinaMiningConnector';
import { discoverArgentinaHydrocarbonEvidence } from './connectors/freeArgentinaHydrocarbonConnector';
import { discoverNeuquenHousingEvidence } from './connectors/freeNeuquenHousingConnector';
import { discoverInvestmentScamEvidence } from './connectors/freeInvestmentScamConnector';

type SearchClient = Parameters<typeof runAutomaticWebVerification>[0];
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type HybridVerificationResult = AutomaticWebVerificationResult & {
  route: 'not-required' | 'cache' | 'free-connectors' | 'paid-web-search' | 'inconclusive';
  paidSearchUsed: boolean;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cache = new Map<string, { expiresAt: number; value: HybridVerificationResult }>();

function cacheKey(text: string, plan: DocumentExternalVerificationPlan): string {
  return createHash('sha256').update(JSON.stringify({ text: text.trim().toLowerCase(), work: plan.workItems })).digest('hex');
}

function getCached(key: string): HybridVerificationResult | null {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) { cache.delete(key); return null; }
  return { ...item.value, route: 'cache', paidSearchUsed: false };
}

function setCached(key: string, value: HybridVerificationResult): void {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export function paidWebVerificationEnabled(value = process.env.PAID_WEB_VERIFICATION_ENABLED): boolean {
  return value === 'true';
}

/** Free/cached evidence always runs before the optional paid web-search fallback. */
export async function runHybridExternalVerification(
  client: SearchClient,
  claimText: string,
  plan: DocumentExternalVerificationPlan,
  requests: ExternalVerificationRequest[],
  fetchImpl: FetchLike = fetch,
  allowPaidSearch = paidWebVerificationEnabled()
): Promise<HybridVerificationResult> {
  const none = registerExternalVerificationExecution(plan, []);
  if (!plan.externalVerificationRequired) return { attempted: false, assessment: 'inconclusive', rationale: 'No se requirió verificación externa.', execution: none, route: 'not-required', paidSearchUsed: false };

  const key = cacheKey(claimText, plan);
  const cached = getCached(key);
  if (cached) return cached;

  const free = requests.length ? await executeExternalVerificationPlan(plan, requests, fetchImpl) : null;
  const publicClaimIndexes = plan.workItems.filter((item) => ['public-claims', 'politics', 'public-policy'].includes(item.primaryDomain)).flatMap((item) => item.claimIndexes);
  const rssRecords = publicClaimIndexes.length ? await discoverFreeNewsRss(claimText, [...new Set(publicClaimIndexes)], fetchImpl) : [];
  const medicalClaimIndexes = plan.workItems.filter((item) => item.suggestedSourceTypes.includes('drug-regulator-fda')).flatMap((item) => item.claimIndexes);
  const labelRecords = medicalClaimIndexes.length ? await discoverFreeDrugLabel(claimText, [...new Set(medicalClaimIndexes)], fetchImpl) : [];
  const wikidataItems = plan.workItems.filter((item) => item.suggestedSourceTypes.includes('public-records'));
  const wikidataResults = await Promise.all(wikidataItems.map((item) => verifyWikidataStructuredClaim(claimText, item.claimIndexes, fetchImpl)));
  const wikidataRecords = wikidataResults.flatMap((result) => result.records);
  const researchItems = plan.workItems.filter((item) => item.suggestedSourceTypes.includes('peer-reviewed-medical-research') || item.suggestedSourceTypes.includes('scientific-journals'));
  const researchRecords = (await Promise.all(researchItems.map((item) => discoverEuropePmcEvidence(claimText, item.claimIndexes, item.suggestedSourceTypes.includes('peer-reviewed-medical-research') ? 'peer-reviewed-medical-research' : 'scientific-journals', fetchImpl)))).flat();
  const legalItems = plan.workItems.filter((item) => item.suggestedSourceTypes.includes('government-law-repository'));
  const legalResults = await Promise.all(legalItems.map((item) => verifyArgentinaCriminalLaw(claimText, item.claimIndexes, fetchImpl)));
  const legalRecords = legalResults.flatMap((result) => result.records);
  const inflationClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.includes('central-bank-data') && item.suggestedSourceTypes.includes('official-statistics'))
    .flatMap((item) => item.claimIndexes);
  const inflationRecords = inflationClaimIndexes.length
    ? await discoverArgentinaInflationEvidence(claimText, [...new Set(inflationClaimIndexes)], fetchImpl)
    : [];
  const tradeClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.includes('international-trade-data'))
    .flatMap((item) => item.claimIndexes);
  const tradeRecords = tradeClaimIndexes.length
    ? await discoverArgentinaExportEvidence(claimText, [...new Set(tradeClaimIndexes)], fetchImpl)
    : [];
  const productiveInputClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.includes('productive-input-price-benchmarks'))
    .flatMap((item) => item.claimIndexes);
  const productiveInputRecords = productiveInputClaimIndexes.length
    ? await discoverArgentinaProductiveInputEvidence(claimText, [...new Set(productiveInputClaimIndexes)], fetchImpl)
    : [];
  const agricultureClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.includes('official-agricultural-statistics'))
    .flatMap((item) => item.claimIndexes);
  const agricultureRecords = agricultureClaimIndexes.length
    ? await discoverArgentinaAgricultureEvidence(claimText, [...new Set(agricultureClaimIndexes)], fetchImpl)
    : [];
  const livestockClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.includes('official-livestock-data'))
    .flatMap((item) => item.claimIndexes);
  const livestockRecords = livestockClaimIndexes.length
    ? await discoverArgentinaLivestockEvidence(claimText, [...new Set(livestockClaimIndexes)], fetchImpl)
    : [];
  const miningClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.includes('official-mining-data'))
    .flatMap((item) => item.claimIndexes);
  const miningRecords = miningClaimIndexes.length
    ? await discoverArgentinaMiningEvidence(claimText, [...new Set(miningClaimIndexes)], fetchImpl)
    : [];
  const hydrocarbonClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.includes('official-hydrocarbon-data'))
    .flatMap((item) => item.claimIndexes);
  const hydrocarbonRecords = hydrocarbonClaimIndexes.length
    ? await discoverArgentinaHydrocarbonEvidence(claimText, [...new Set(hydrocarbonClaimIndexes)], fetchImpl)
    : [];
  const neuquenHousingClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.includes('official-real-estate-data'))
    .flatMap((item) => item.claimIndexes);
  const neuquenHousingRecords = neuquenHousingClaimIndexes.length
    ? await discoverNeuquenHousingEvidence(claimText, [...new Set(neuquenHousingClaimIndexes)], fetchImpl)
    : [];
  const investmentScamClaimIndexes = plan.workItems
    .filter((item) => item.suggestedSourceTypes.some((type) => ['securities-regulator-cnv', 'regulatory-records', 'company-registries', 'consumer-protection-agencies', 'domain-registration-data'].includes(type)))
    .flatMap((item) => item.claimIndexes);
  const investmentScamRecords = investmentScamClaimIndexes.length
    ? await discoverInvestmentScamEvidence(claimText, [...new Set(investmentScamClaimIndexes)], fetchImpl)
    : [];
  const freeRecords = [...(free?.execution.records || []), ...rssRecords, ...labelRecords, ...wikidataRecords, ...researchRecords, ...legalRecords, ...inflationRecords, ...tradeRecords, ...productiveInputRecords, ...agricultureRecords, ...livestockRecords, ...miningRecords, ...hydrocarbonRecords, ...neuquenHousingRecords, ...investmentScamRecords];
  const freeExecution = registerExternalVerificationExecution(plan, freeRecords);
  if (freeExecution.externalVerificationPerformed) {
    const labelCorroborates = labelRecords.length > 0 && /\b(?:dolor\s+de\s+cabeza|cefalea)\b/i.test(claimText);
    const wikidataContradiction = wikidataResults.find((item) => item.assessment === 'contradicted');
    const wikidataCorroboration = wikidataResults.find((item) => item.assessment === 'corroborated');
    const legalContradiction = legalResults.find((item) => item.assessment === 'contradicted');
    const legalCorroboration = legalResults.find((item) => item.assessment === 'corroborated');
    const result: HybridVerificationResult = legalContradiction
      ? { attempted: true, assessment: 'contradicted', rationale: legalContradiction.rationale, execution: freeExecution, route: 'free-connectors', paidSearchUsed: false }
      : legalCorroboration
        ? { attempted: true, assessment: 'corroborated', rationale: legalCorroboration.rationale, execution: freeExecution, route: 'free-connectors', paidSearchUsed: false }
      : wikidataContradiction
      ? { attempted: true, assessment: 'contradicted', rationale: wikidataContradiction.rationale, execution: freeExecution, route: 'free-connectors', paidSearchUsed: false }
      : wikidataCorroboration
        ? { attempted: true, assessment: 'corroborated', rationale: wikidataCorroboration.rationale, execution: freeExecution, route: 'free-connectors', paidSearchUsed: false }
      : labelCorroborates
      ? { attempted: true, assessment: 'corroborated', rationale: 'La indicación consultada coincide con un prospecto oficial vigente.', execution: freeExecution, route: 'free-connectors', paidSearchUsed: false }
      : investmentScamRecords.length > 0
      ? { attempted: true, assessment: 'inconclusive', rationale: 'Se consultaron datos registrales del dominio y fuentes oficiales de la CNV. No se identificó una razón social o matrícula que permita vincular inequívocamente la oferta con un operador autorizado. El enlace publicitario y el registro del dominio no prueban legitimidad ni fraude; no corresponde depositar ni entregar datos hasta verificar identidad legal, autorización, custodia, retiros, costos y contrato.', execution: freeExecution, route: 'free-connectors', paidSearchUsed: false }
      : { attempted: true, assessment: 'inconclusive', rationale: 'Se localizaron fuentes relacionadas para revisión, pero su existencia no prueba por sí sola la afirmación.', execution: freeExecution, route: 'free-connectors', paidSearchUsed: false };
    setCached(key, result);
    return result;
  }

  if (!allowPaidSearch) {
    const rationale = productiveInputRecords.length > 0
      ? 'Se obtuvo un valor unitario aduanero histórico del insumo, pero no equivale al precio final en Argentina. Para calcular el costo real faltan especificación, concentración o capacidad, cantidad, fecha, proveedor, moneda, impuestos, flete, seguro, instalación y condiciones de pago.'
      : hydrocarbonRecords.length > 0
      ? 'Se obtuvo producción oficial de petróleo o gas para el período y área coincidentes, pero faltan reservas, concesión, CAPEX, OPEX, regalías, infraestructura, permisos y flujo de fondos. La producción tampoco demuestra valores de tierras, viviendas o alquileres, que requieren comparables fechados separados.'
      : miningRecords.length > 0
      ? 'Se localizaron proyectos coincidentes en la cartera oficial minera, pero faltan título o concesión vigente, informe competente de recursos y reservas, permisos, CAPEX, OPEX, precios, logística y flujo de fondos para evaluar la inversión.'
      : livestockRecords.length > 0
      ? 'Se obtuvo una referencia histórica oficial de existencias bovinas, pero no es un valor actual y faltan precios, receptividad del campo, sanidad, alimentación, flete, clima, impuestos, capital de trabajo y flujo de fondos para evaluar la inversión.'
      : agricultureRecords.length > 0
      ? 'Se obtuvieron producción, superficie y rendimiento oficiales del cultivo y la región, pero aún faltan precios, costos, clima, aptitud del campo, logística y flujo de fondos para evaluar la inversión.'
      : tradeRecords.length > 0
      ? 'Se obtuvieron exportaciones argentinas observadas del producto, pero aún faltan precios, costos, destinos, competidores, barreras y demanda importadora para recomendar la inversión.'
      : 'No se obtuvieron fuentes suficientes que cumplan los requisitos de calidad, independencia y actualidad.';
    return { attempted: requests.length > 0 || rssRecords.length > 0 || labelRecords.length > 0 || wikidataRecords.length > 0 || researchRecords.length > 0 || legalRecords.length > 0 || inflationRecords.length > 0 || tradeRecords.length > 0 || productiveInputRecords.length > 0 || agricultureRecords.length > 0 || livestockRecords.length > 0 || miningRecords.length > 0 || hydrocarbonRecords.length > 0 || neuquenHousingRecords.length > 0 || investmentScamRecords.length > 0, assessment: 'inconclusive', rationale, execution: freeExecution, route: 'inconclusive', paidSearchUsed: false };
  }

  const paid = await runAutomaticWebVerification(client, claimText, plan, undefined, freeRecords);
  const result: HybridVerificationResult = { ...paid, route: 'paid-web-search', paidSearchUsed: true };
  if (result.execution.externalVerificationPerformed) setCached(key, result);
  return result;
}
