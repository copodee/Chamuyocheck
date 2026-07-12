import type {
  ExternalVerificationDecisionInput,
  ExternalVerificationPlan,
} from '../types/externalVerification';
import type { KnowledgeDomain } from '../types/contentDomain';

type SourcePolicy = {
  sources: string[];
  minimum: number;
  official: boolean;
};

const DOMAIN_SOURCE_POLICY: Record<KnowledgeDomain, SourcePolicy> = {
  mathematics: { sources: ['calculation', 'mathematics-reference'], minimum: 0, official: false },
  science: { sources: ['scientific-journals', 'scientific-institutions'], minimum: 2, official: false },
  'biology-health': { sources: ['clinical-guidelines', 'peer-reviewed-medical-research', 'health-authorities'], minimum: 2, official: true },
  finance: { sources: ['official-market-data', 'regulatory-filings', 'financial-regulators'], minimum: 2, official: true },
  economics: { sources: ['official-statistics', 'central-bank-data', 'economic-research'], minimum: 2, official: true },
  'history-sports': { sources: ['official-records', 'reputable-archives', 'sports-governing-bodies'], minimum: 1, official: false },
  technology: { sources: ['vendor-documentation', 'release-notes', 'standards-bodies'], minimum: 1, official: true },
  legal: { sources: ['government-law-repository', 'official-gazette', 'court-records'], minimum: 1, official: true },
  'public-claims': { sources: ['official-statements', 'public-records', 'independent-news'], minimum: 2, official: false },
  'public-policy': { sources: ['government-records', 'official-statistics', 'policy-documents'], minimum: 2, official: true },
  politics: { sources: ['electoral-authorities', 'official-statements', 'independent-news'], minimum: 2, official: false },
  'advertising-scams': { sources: ['regulatory-records', 'company-disclosures', 'consumer-protection-agencies'], minimum: 2, official: true },
  culture: { sources: ['primary-sources', 'reputable-cultural-archives'], minimum: 1, official: false },
  general: { sources: ['primary-sources', 'independent-reputable-sources'], minimum: 2, official: false },
};

const RECENT_OR_CURRENT = /\b(hoy|ayer|anoche|esta semana|este mes|actual(?:es|mente)?|vigente|reciente|últim[oa]s?|ahora|en curso|cotiza|precio|tasa|dólar|elecci(?:ón|ones))\b/i;
const FOUNDATIONAL_SCIENCE = /\b(gravedad|agua hierve|velocidad de la luz|átomo|molécula|tierra gira|nivel del mar)\b/i;
const STABLE_HISTORY = /\b(antigüedad|edad media|siglo (?:x{1,3}|iv|v|vi|vii|viii|ix)|independencia|revolución francesa)\b/i;
const MEDICAL_ACTION = /\b(diagn[oó]stico|tratamiento|medicamento|dosis|cura|vacuna|síntoma|paciente|terapia|suplemento)\b/i;
const SPECIFIC_RECORD = /\b\d{1,4}(?:[.,]\d+)?\s*(?:%|goles?|partidos?|medallas?|casos?|personas?)\b|\b(?:ganó|campeón|récord|resultado)\b/i;
const ARGENTINA = /\b(argentina|argentino|argentina|córdoba|buenos aires|bcra|cnv|byma|boletín oficial)\b/i;
const ARITHMETIC_EXPRESSION = /\b\d+(?:[.,]\d+)?\s*[+\-×x*/=]\s*\d+(?:[.,]\d+)?/i;
const FINANCIAL_CURRENT_DATA = /\b(dólar|euro|bitcoin|cotiza|cotización|precio|tasa|tipo de cambio|mercado)\b|\b\d+(?:[.,]\d+)?\s*(?:pesos|dólares|euros)\b/i;
const MEDICATION_EFFECT = /\b(medicamento|fármaco|droga|principio activo|efecto(?:s)? adverso(?:s)?|contraindicación|prospecto|farmacovigilancia)\b/i;
const CAPITAL_MARKETS = /\b(cnv|byma|mercado de capitales|acci(?:ón|ones)|bonos?|obligaciones negociables|fondo común|agente de bolsa|hecho relevante|emisor(?:a|es)?)\b/i;
const CRYPTO_ASSET = /\b(criptomoneda|criptoactivo|bitcoin|ethereum|ether|token|blockchain|exchange cripto|wallet|contrato inteligente|stablecoin|solana)\b/i;
const CRYPTO_EVIDENCE_CLAIM = /\b(reservas?|transacci(?:ón|ones)|precio|cotiza|volumen|contrato inteligente|auditoría|suministro|capitalización)\b/i;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * V21C phase 1 is decision-only. It never accesses a network or a database, so
 * externalVerificationPerformed is deliberately and unconditionally false.
 */
export function decideExternalVerification(
  input: ExternalVerificationDecisionInput
): ExternalVerificationPlan {
  const { claimText, claimNature, primaryDomain } = input;
  const semanticText = claimText
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\[(?:BCRA|WHO|WB|PMID):[^\]]+\]/gi, ' ');
  const policy = DOMAIN_SOURCE_POLICY[primaryDomain];
  const natures = new Set([claimNature.primaryNature, ...claimNature.secondaryNatures]);
  const isRecent = RECENT_OR_CURRENT.test(claimText);
  const jurisdictionalRelevance = ARGENTINA.test(claimText) ? 'Argentina' : undefined;

  const finish = (
    required: boolean,
    reason: string,
    overrides: Partial<ExternalVerificationPlan> = {}
  ): ExternalVerificationPlan => ({
    externalVerificationRequired: required,
    externalVerificationPerformed: false,
    reason,
    suggestedSourceTypes: unique(overrides.suggestedSourceTypes ?? policy.sources),
    minimumIndependentSources: required ? (overrides.minimumIndependentSources ?? policy.minimum) : 0,
    recencyRequired: overrides.recencyRequired ?? (required && isRecent),
    officialSourceRequired: overrides.officialSourceRequired ?? (required && policy.official),
    ...(jurisdictionalRelevance ? { jurisdictionalRelevance } : {}),
  });

  if (
    claimNature.factualVerifiability === 'subjective' &&
    !natures.has('statistic') &&
    !(CRYPTO_ASSET.test(claimText) && CRYPTO_EVIDENCE_CLAIM.test(claimText))
  ) {
    return finish(false, 'La evaluación es subjetiva y no puede verificarse como verdadera o falsa.');
  }

  if (
    claimNature.factualVerifiability === 'future-verifiable' &&
    !(CRYPTO_ASSET.test(claimText) && CRYPTO_EVIDENCE_CLAIM.test(claimText))
  ) {
    return finish(false, 'El resultado futuro todavía no puede verificarse; las fuentes sólo servirán para revisar su base o comprobarlo después.');
  }

  if (primaryDomain === 'mathematics' || ARITHMETIC_EXPRESSION.test(semanticText)) {
    return finish(false, 'La afirmación matemática puede comprobarse mediante cálculo o demostración local.');
  }

  if (primaryDomain === 'science' && FOUNDATIONAL_SCIENCE.test(claimText) && !natures.has('statistic')) {
    return finish(false, 'La afirmación usa conocimiento científico fundacional comprobable localmente.');
  }

  if (primaryDomain === 'history-sports' && STABLE_HISTORY.test(claimText) && !SPECIFIC_RECORD.test(claimText)) {
    return finish(false, 'El dato histórico es estable y general; no exige consulta externa en esta fase.');
  }

  if (CRYPTO_ASSET.test(claimText) && CRYPTO_EVIDENCE_CLAIM.test(claimText)) {
    return finish(true, 'La afirmación sobre criptoactivos requiere distinguir datos de mercado, evidencia on-chain, documentación técnica y situación regulatoria.', {
      suggestedSourceTypes: ['crypto-market-data', 'blockchain-explorer', 'protocol-documentation', 'financial-regulators', 'independent-security-audits'],
      minimumIndependentSources: 2,
      recencyRequired: isRecent,
      officialSourceRequired: false,
    });
  }

  if (natures.has('legal-assertion') || primaryDomain === 'legal') {
    return finish(true, 'La afirmación jurídica requiere normativa y registros vigentes de la jurisdicción aplicable.', {
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (MEDICAL_ACTION.test(claimText) || MEDICATION_EFFECT.test(claimText)) {
    const medicationSources = MEDICATION_EFFECT.test(claimText)
      ? ['drug-regulator-anmat', 'drug-regulator-fda', 'drug-regulator-ema', 'peer-reviewed-medical-research', 'pharmacovigilance']
      : DOMAIN_SOURCE_POLICY['biology-health'].sources;
    return finish(true, 'La afirmación médica o terapéutica requiere evidencia clínica y autoridades sanitarias actualizadas.', {
      suggestedSourceTypes: medicationSources,
      minimumIndependentSources: DOMAIN_SOURCE_POLICY['biology-health'].minimum,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (natures.has('statistic')) {
    return finish(true, 'La cifra debe contrastarse con su fuente original, metodología y contexto.');
  }

  if (natures.has('extraordinary-claim') || natures.has('rumor') || natures.has('testimony')) {
    return finish(true, 'La afirmación extraordinaria, atribuida o testimonial necesita corroboración externa independiente.', {
      minimumIndependentSources: 2,
    });
  }

  if (CAPITAL_MARKETS.test(claimText)) {
    return finish(true, 'La afirmación sobre mercado de capitales requiere datos operativos, presentaciones y normativa del regulador aplicable.', {
      suggestedSourceTypes: ['securities-regulator-cnv', 'market-operator-byma', 'regulatory-filings', 'official-market-data'],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (CRYPTO_ASSET.test(claimText)) {
    return finish(true, 'La afirmación sobre criptoactivos requiere distinguir datos de mercado, evidencia on-chain, documentación técnica y situación regulatoria.', {
      suggestedSourceTypes: ['crypto-market-data', 'blockchain-explorer', 'protocol-documentation', 'financial-regulators', 'independent-security-audits'],
      minimumIndependentSources: 2,
      recencyRequired: isRecent,
      officialSourceRequired: false,
    });
  }

  if (FINANCIAL_CURRENT_DATA.test(claimText)) {
    return finish(true, 'La afirmación depende de precios, tasas o datos financieros que pueden cambiar.', {
      suggestedSourceTypes: DOMAIN_SOURCE_POLICY.finance.sources,
      minimumIndependentSources: DOMAIN_SOURCE_POLICY.finance.minimum,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (isRecent || ['finance', 'public-claims', 'public-policy', 'politics'].includes(primaryDomain)) {
    return finish(true, 'La afirmación depende de datos públicos, financieros o de actualidad que pueden cambiar.', {
      recencyRequired: true,
    });
  }

  if (primaryDomain === 'technology') {
    return finish(true, 'La afirmación tecnológica puede depender de versiones o documentación actualizada.', {
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (primaryDomain === 'history-sports' && SPECIFIC_RECORD.test(claimText)) {
    return finish(true, 'El resultado o registro específico debe comprobarse contra archivos confiables.');
  }

  if (claimNature.factualVerifiability === 'requires-external-source') {
    return finish(true, 'La naturaleza de la afirmación exige una fuente externa para poder contrastarla.');
  }

  return finish(false, 'No se detectó dependencia de información externa cambiante o especializada.');
}
