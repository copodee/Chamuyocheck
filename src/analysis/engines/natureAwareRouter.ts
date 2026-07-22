/**
 * Nature-Aware Router (V21B)
 *
 * Uses ClaimNatureResult to improve domain routing and specialist selection.
 * Combines claim nature, entities, linguistic context, and domain signals.
 *
 * Key principle: Domain is independent of nature, but routing uses nature + context.
 */

import type { ClaimNatureResult } from '../types/claimNature';
import type {
  KnowledgeDomain,
  NatureAwareRoutingContext,
  NatureAwareDomainDetection,
} from '../types/contentDomain';
import { detectSensitivePersonalClaim } from './sensitivePersonalClaim';

/**
 * Extract linguistic and entity signals from claim text
 */
function extractSignals(text: string): Partial<NatureAwareRoutingContext> {
  const lower = text.toLowerCase();

  // Temporal signals
  const temporalSignals: string[] = [];
  if (/mañana|próximo|siguiente|futuro|luego|después/i.test(text)) temporalSignals.push('future-marker');
  if (/ayer|pasado|hace|antes|previo|anterior/i.test(text)) temporalSignals.push('past-marker');

  // Geographic signals
  const geographicSignals: string[] = [];
  if (/córdoba|buenos aires|rosario|argentina|españa|brasil|méxico|eeuu/i.test(text)) {
    geographicSignals.push('location-specified');
  }

  // Commercial signals
  const commercialSignals: string[] = [];
  if (/\$|compra|invierte|obtén|descuento|oferta|promo|gratis/i.test(text)) {
    commercialSignals.push('commercial-language');
  }
  if (/suplemento|producto|curso|app|servicio/i.test(text)) {
    commercialSignals.push('product-mention');
  }
  if (/\d+\s*(?:pesos|dólares|euros|\$)/i.test(text)) {
    commercialSignals.push('money-amount');
  }

  // Legal signals
  const legalSignals: string[] = [];
  if (/ilegal|legal|derecho|ley|contrato|cláusula|boletín oficial/i.test(text)) {
    legalSignals.push('legal-terminology');
  }

  // Medical signals - distinguish policy context from medical context
  const medicalSignals: string[] = [];
  const hasPolicyContext = /política|pública|ministerio de salud|presupuesto|inversión|decreto|regulación|gobierno/i.test(text);
  
  if (!hasPolicyContext) {
    if (/médico|enfermedad|síntoma|tratamiento|cura|vacuna|embarazo|embarazada|hormona|paciente|fiebre|dolor/i.test(text)) {
      medicalSignals.push('medical-terminology');
    }
    if (/adelgazar|engordar|curar|sanar|recuperar|bajar de peso/i.test(text)) {
      medicalSignals.push('health-outcome');
    }
  }

  // Named entities
  const named: string[] = [];
  if (/bitcoin|ethereum|cripto|criptomoneda/i.test(text)) named.push('cryptocurrency');
  if (/messi|maradona|ronaldo|pelé|jugador|deportista/i.test(text)) named.push('sports-figure');
  if (/milei|massa|cristina|macri|fernández|perón|presidente|político/i.test(text)) named.push('politician');
  if (/ovni|alienígena|extraterrestre|platillo volador|ufo/i.test(text)) named.push('extraordinary-entity');
  if (/mundial|olimpiada|copa|torneo|campeonato/i.test(text)) named.push('sports-event');
  if (/ministerio de salud|ministerio|gobierno|congreso|senado|bcra|banco central/i.test(text)) named.push('government-entity');
  if (/ministerio de salud/i.test(text)) named.push('health-ministry');

  // Numeric values
  const numeric: Array<{ value: number; unit?: string }> = [];
  const numberMatches = text.match(/(\d+(?:[.,]\d+)?)\s*(?:pesos|dólares|euros|%|por ciento)?/gi) || [];
  numberMatches.forEach((match: string) => {
    const numStr = match.replace(/[^0-9.,]/g, '').replace(',', '.');
    const num = parseFloat(numStr);
    if (!isNaN(num)) numeric.push({ value: num });
  });

  return {
    extractedEntities: { named, temporal: temporalSignals, geographic: geographicSignals, numeric },
    commercialSignals,
    legalSignals,
    medicalSignals,
    temporalSignals,
    geographicSignals,
  };
}

/**
 * Determine primary and secondary domains based on nature + signals
 */
function routeByNatureAndSignals(
  nature: ClaimNatureResult,
  text: string,
  signals: Partial<NatureAwareRoutingContext>
): { primary: KnowledgeDomain; secondary: KnowledgeDomain[] } {
  if (detectSensitivePersonalClaim(text).detected) {
    return { primary: 'public-claims', secondary: ['politics'] };
  }
  const { primaryNature } = nature;
  const named = signals.extractedEntities?.named || [];
  const medicalSignals = signals.medicalSignals || [];
  const legalSignals = signals.legalSignals || [];
  const commercialSignals = signals.commercialSignals || [];

  let primary: KnowledgeDomain = 'general';
  const secondary: KnowledgeDomain[] = [];

  // Detect key signals
  const hasCrypto = named.includes('cryptocurrency');
  const hasMoneyAmount = commercialSignals.includes('money-amount');
  const hasInvestmentLanguage = /inviert|gana|rentabilidad|retorno/i.test(text);
  const hasMedical = medicalSignals.length > 0;
  const hasLegal = legalSignals.length > 0;
  const isPolitician = named.includes('politician');
  const hasGovEntity = named.includes('government-entity');
  const isHealthMinistry = named.includes('health-ministry');
  const hasPolicyContext = /política|pública|ministerio|presupuesto|inversión|decreto|regulación|gobierno/i.test(text);

  // Route based on nature
  switch (primaryNature) {
    case 'financial-offer':
    case 'promise':
      if (hasMoneyAmount || hasInvestmentLanguage || hasCrypto) {
        primary = 'finance';
      } else if (hasMedical && hasMoneyAmount) {
        primary = 'biology-health';
        secondary.push('advertising-scams');
      } else if (hasMedical) {
        primary = 'biology-health';
      } else {
        primary = 'advertising-scams';
      }
      break;

    case 'advertisement':
      if (hasMedical) {
        primary = 'advertising-scams';
        secondary.push('biology-health');
      } else if (hasMoneyAmount || hasCrypto || hasInvestmentLanguage) {
        primary = 'advertising-scams';
        secondary.push('finance');
      } else {
        primary = 'advertising-scams';
      }
      break;

    case 'prediction':
      if (hasCrypto || hasMoneyAmount || hasInvestmentLanguage) {
        primary = 'finance';
      } else if (isPolitician || (hasGovEntity && /ganar|elección/i.test(text))) {
        primary = 'politics';
      } else if (/dólar|bolsa|mercado|precio|inflación/i.test(text)) {
        primary = 'economics';
      } else {
        primary = 'general';
      }
      break;

    case 'opinion':
      if (isHealthMinistry && hasPolicyContext) {
        primary = 'public-policy';
      } else if (isPolitician || (hasGovEntity && !isHealthMinistry && hasPolicyContext)) {
        primary = 'public-policy';
        if (isPolitician) secondary.push('politics');
      } else if (hasMedical && !hasPolicyContext) {
        primary = 'biology-health';
      } else if (hasLegal) {
        primary = 'legal';
      } else if (/filme|música|arte|deportista|película/i.test(text)) {
        primary = 'culture';
      } else {
        primary = 'general';
      }
      break;

    case 'fact':
      if (hasLegal) {
        primary = 'legal';
      } else if (isHealthMinistry && hasPolicyContext) {
        // "El Ministerio de Salud aumentó presupuesto" = public-policy
        primary = 'public-policy';
        secondary.push('public-claims');
      } else if (hasMedical && !hasPolicyContext) {
        primary = 'biology-health';
      } else if ((isPolitician || hasGovEntity) && hasPolicyContext) {
        primary = 'public-policy';
        secondary.push('public-claims');
      } else if (hasCrypto || /bitcoin/i.test(text)) {
        primary = 'finance';
      } else if (/matemática|matemático|\d+\s*\+|\d+\s*-|\d+\s*\*/i.test(text)) {
        primary = 'mathematics';
      } else if (/física|química|biología|átomo|molécula|hierve|temperatura|grado|agua|celsius/i.test(text)) {
        primary = 'science';
      } else {
        primary = 'general';
      }
      break;

    case 'question':
      if (hasMedical) {
        primary = 'biology-health';
      } else if (hasLegal) {
        primary = 'legal';
      } else if (hasCrypto) {
        primary = 'finance';
      } else {
        primary = 'general';
      }
      break;

    case 'rumor':
    case 'testimony':
      if (named.includes('extraordinary-entity')) {
        primary = 'public-claims';
        secondary.push('science');
      } else if (isPolitician || hasGovEntity) {
        primary = 'public-claims';
        if (isPolitician) secondary.push('politics');
      } else {
        primary = 'public-claims';
      }
      break;

    case 'extraordinary-claim':
      primary = 'public-claims';
      if (named.includes('extraordinary-entity')) secondary.push('science');
      break;

    case 'statistic':
      if (hasMedical && !hasPolicyContext) {
        primary = 'biology-health';
      } else if (/mercado|precio|bolsa|inflación|dólar/i.test(text)) {
        primary = 'economics';
      } else if (hasPolicyContext && /encuesta|porcentaje|%|respondió/i.test(text)) {
        primary = 'public-policy';
      } else {
        primary = 'general';
      }
      break;

    case 'legal-assertion':
      primary = 'legal';
      if (hasGovEntity) secondary.push('public-policy');
      break;

    case 'recommendation':
      if (/inviert|compra|vende|bitcoin|cripto/i.test(text)) {
        primary = 'finance';
        secondary.push('advertising-scams');
      } else if (hasMedical && !hasPolicyContext) {
        primary = 'biology-health';
      } else {
        primary = 'general';
      }
      break;

    default:
      primary = 'general';
  }

  return {
    primary,
    secondary: [...new Set(secondary)],
  };
}

/**
 * Get user-facing label combining nature + domain
 */
export function getNatureDomainLabel(
  primaryNature: string,
  primaryDomain: KnowledgeDomain,
  secondaryDomains: KnowledgeDomain[] = []
): string {
  const key = `${primaryNature}-${primaryDomain}`;

  // Explicit mappings from V21 architecture
  const labelMap: Record<string, string> = {
    // Finance
    'fact-finance': 'Hecho financiero',
    'prediction-finance': 'Predicción financiera',
    'opinion-finance': 'Opinión sobre el mercado financiero',
    'recommendation-finance': 'Recomendación de inversión',
    'promise-finance': 'Garantía financiera',
    'financial-offer-finance': 'Oferta de inversión',

    // Economics
    'prediction-economics': 'Predicción económica',
    'fact-economics': 'Hecho económico',
    'statistic-economics': 'Estadística económica',

    // Public Policy
    'opinion-public-policy': 'Opinión sobre política pública',
    'fact-public-policy': 'Afirmación sobre gestión pública',
    'recommendation-public-policy': 'Recomendación de política',
    'statistic-public-policy': 'Estadística de política pública',

    // Politics
    'opinion-politics': 'Opinión política',
    'prediction-politics': 'Predicción política',
    'fact-politics': 'Hecho político',
    'rumor-politics': 'Rumor político',

    // Extraordinary Claims
    'extraordinary-claim-public-claims': 'Afirmación extraordinaria / evento público',
    'testimony-public-claims': 'Testimonio sobre un hecho extraordinario',
    'rumor-public-claims': 'Rumor sobre un hecho extraordinario',
    'fact-public-claims': 'Afirmación personal sensible no verificada',

    // Health
    'fact-biology-health': 'Hecho médico / biológico',
    'question-biology-health': 'Pregunta de biología o salud',
    'advertisement-biology-health': 'Publicidad con afirmación de salud',
    'promise-biology-health': 'Garantía de salud',
    'recommendation-biology-health': 'Recomendación de salud',
    'statistic-biology-health': 'Estadística médica',

    // Legal
    'legal-assertion-legal': 'Afirmación jurídica',
    'fact-legal': 'Afirmación jurídica verificable',
    'opinion-legal': 'Opinión sobre una norma',

    // Advertising/Scams
    'advertisement-advertising-scams': 'Anuncio o publicidad',
    'promise-advertising-scams': 'Promesa o garantía',
    'financial-offer-advertising-scams': 'Propuesta de dinero',

    // Science
    'fact-science': 'Afirmación científica verificable',
    'prediction-science': 'Predicción científica',
    'extraordinary-claim-science': 'Afirmación científica extraordinaria',

    // Culture
    'opinion-culture': 'Opinión sobre entretenimiento',

    // General fallbacks
    'prediction-general': 'Predicción especulativa',
    'question-general': 'Pregunta informativa',
    'statistic-general': 'Dato o estadística',
    'testimony-general': 'Relato o testimonio',
  };

  return labelMap[key] || `${primaryNature} sobre ${primaryDomain}`;
}

/**
 * Main routing function: Use ClaimNatureResult + signals to determine domain and routing
 */
export function routeByNature(
  claimText: string,
  claimNature: ClaimNatureResult
): NatureAwareDomainDetection {
  const signals = extractSignals(claimText);

  const { primary, secondary } = routeByNatureAndSignals(claimNature, claimText, {
    ...signals,
    claimText,
  });

  const visibleType = getNatureDomainLabel(claimNature.primaryNature, primary, secondary);

  // Select specialists based on nature + domain
  const recommendedSpecialists: string[] = [];

  if (primary === 'finance' && claimNature.primaryNature === 'prediction') {
    recommendedSpecialists.push('FinancePredictionSpecialist');
  } else if (primary === 'public-policy' && claimNature.primaryNature === 'opinion') {
    recommendedSpecialists.push('PublicPolicyOpinionSpecialist');
  } else if (primary === 'public-claims' && claimNature.primaryNature === 'extraordinary-claim') {
    recommendedSpecialists.push('ExtraordinaryPublicClaimSpecialist');
  } else if (primary === 'biology-health' && claimNature.primaryNature === 'advertisement') {
    recommendedSpecialists.push('HealthAdvertisingSpecialist');
  } else if (primary === 'legal' && claimNature.primaryNature === 'legal-assertion') {
    recommendedSpecialists.push('LegalVerificationSpecialist');
  } else {
    // Default specialist based on primary domain
    recommendedSpecialists.push(`${primary}Specialist`);
  }

  return {
    primaryDomain: primary,
    secondaryDomains: secondary,
    routingConfidence: claimNature.confidence,
    reason: `Nature: ${claimNature.primaryNature} + Domain: ${primary}. ${claimNature.reason}`,
    visibleType,
    recommendedSpecialists,
  };
}
