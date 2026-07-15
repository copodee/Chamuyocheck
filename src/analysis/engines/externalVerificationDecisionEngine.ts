import type {
  ExternalVerificationDecisionInput,
  ExternalVerificationPlan,
} from '../types/externalVerification';
import type { KnowledgeDomain } from '../types/contentDomain';
import { detectSensitivePersonalClaim } from './sensitivePersonalClaim';

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
  'history-sports': { sources: ['public-records', 'official-records', 'reputable-archives', 'sports-governing-bodies'], minimum: 1, official: false },
  technology: { sources: ['vendor-documentation', 'release-notes', 'standards-bodies'], minimum: 1, official: true },
  legal: { sources: ['government-law-repository', 'official-gazette', 'court-records'], minimum: 1, official: true },
  'public-claims': { sources: ['official-statements', 'public-records', 'independent-news'], minimum: 2, official: false },
  'public-policy': { sources: ['government-records', 'official-statistics', 'policy-documents'], minimum: 2, official: true },
  politics: { sources: ['electoral-authorities', 'official-statements', 'independent-news'], minimum: 2, official: false },
  'advertising-scams': { sources: ['regulatory-records', 'company-disclosures', 'consumer-protection-agencies'], minimum: 2, official: true },
  culture: { sources: ['public-records', 'primary-sources', 'reputable-cultural-archives'], minimum: 1, official: false },
  general: { sources: ['public-records', 'primary-sources', 'independent-reputable-sources'], minimum: 2, official: false },
};

const RECENT_OR_CURRENT = /\b(hoy|ayer|anoche|esta semana|este mes|actual(?:es|mente)?|vigente|reciente|últim[oa]s?|ahora|en curso|cotiza|precio|tasa|dólar|elecci(?:ón|ones))\b/i;
const FOUNDATIONAL_SCIENCE = /\b(gravedad|agua hierve|velocidad de la luz|átomo|molécula|tierra gira|nivel del mar)\b/i;
const STABLE_HISTORY = /\b(antigüedad|edad media|siglo (?:x{1,3}|iv|v|vi|vii|viii|ix)|independencia|revolución francesa)\b/i;
const MEDICAL_ACTION = /\b(diagn[oó]stico|tratamiento|medicamento|dosis|cura|vacuna|síntoma|paciente|terapia|suplemento)\b/i;
const SPECIFIC_RECORD = /\b\d{1,4}(?:[.,]\d+)?\s*(?:%|goles?|partidos?|medallas?|casos?|personas?)\b|\b(?:ganó|campeón|récord|resultado)\b/i;
const ARGENTINA = /\b(argentina|argentino|argentina|córdoba|buenos aires|bcra|cnv|byma|boletín oficial)\b/i;
const ARITHMETIC_EXPRESSION = /\b\d+(?:[.,]\d+)?\s*[+\-×x*/=]\s*\d+(?:[.,]\d+)?/i;
const FINANCIAL_CURRENT_DATA = /\b(dólar|euro|bitcoin|cotiza|cotización|precio|tasa|tipo de cambio|mercado)\b|\b\d+(?:[.,]\d+)?\s*(?:pesos|dólares|euros)\b/i;
const MEDICATION_EFFECT = /\b(medicamento|fármaco|droga|principio activo|efecto(?:s)? adverso(?:s)?|contraindicación|prospecto|farmacovigilancia|ibuprofeno|paracetamol|acetaminof[eé]n|aspirina|amoxicilina|omeprazol|[a-záéíóúñ]+(?:profeno|cillina|micina|prazol|statina|zepam))\b/i;
const CAPITAL_MARKETS = /\b(cnv|byma|mercado de capitales|acci(?:ón|ones)|bonos?|obligaciones negociables|fondo común|agente de bolsa|hecho relevante|emisor(?:a|es)?)\b/i;
const CRYPTO_ASSET = /\b(criptomoneda|criptoactivo|bitcoin|ethereum|ether|token|blockchain|exchange cripto|wallet|contrato inteligente|stablecoin|solana)\b/i;
const CRYPTO_EVIDENCE_CLAIM = /\b(reservas?|transacci(?:ón|ones)|precio|cotiza|volumen|contrato inteligente|auditoría|suministro|capitalización)\b/i;
const BIOGRAPHICAL_RELATIONSHIP = /\b(?:es|era|fue|ser[ií]a)\s+(?:(?:el|la)\s+)?(?:hij[oa]|herman[oa]|padre|madre|pareja|espos[oa]|c[oó]nyuge|familiar|sobrin[oa]|t[ií][oa]|prim[oa])\s+de\b/i;
const BIOGRAPHICAL_FACT = /\b(?:nació|estudió|se\s+graduó|trabajó|ocupó\s+el\s+cargo|fue\s+(?:presidente|ministro|secretari[oa]|gobernador|diputado|senador))\b/i;
const SIMPLE_DRUG_INDICATION = /\b(?:paracetamol|acetaminof[eé]n|ibuprofeno|aspirina)\b.*\b(?:es|sirve|indicado|usa)\s+para\b/i;
const ILLICIT_DRUG = /\b(?:crystal(?:\s+meth)?|metanfetamina|coca[ií]na|crack|mdma|[eé]xtasis|hero[ií]na|fentanilo)\b/i;

const ARGENTINA_INFLATION_COMPARISON = /\b(?:inflaci[oó]n|ipc|indec|rem)\b/i;
const MINING_INVESTMENT = /\b(?:miner[ií]a|minero|litio|cobre|oro|plata|uranio|potasio|borato|cantera|proyecto\s+extractivo)\b/i;
const OIL_GAS_INVESTMENT = /\b(?:vaca\s+muerta|petr[oó]leo|gas\s+natural|hidrocarburos?|upstream|midstream|yacimiento|pozo|shale\s+(?:oil|gas)|no\s+convencional)\b/i;
const ENERGY_REGION_REAL_ESTATE = /\b(?:tierras?|terrenos?|viviendas?|departamentos?|alquiler(?:es)?|renta\s+locativa|precio\s+por\s+(?:m2|metro))\b/i;
const REAL_ESTATE_INVESTMENT = /\b(?:inversi[oó]n\s+inmobiliaria|inmueble|departamento|propiedad|alquiler|renta\s+locativa|precio\s+por\s+(?:m2|metro)|metros?\s+cuadrados?|lote|terreno)\b/i;
const AGRICULTURAL_INVESTMENT = /\b(?:campo|agropecuari[oa]|agricultur|ganader|hacienda|soja|ma[ií]z|trigo|aceituna|oliv|uva|vino|yerba|frut|cosecha|hect[aá]rea|rinde|cultivo)\b/i;
const INDUSTRIAL_PARK_REAL_ESTATE = /\b(?:parque|polo|predio)\s+industrial|\b(?:nave|galp[oó]n|lote)\s+industrial\b/i;
const PRODUCTIVE_INPUT_PRICES = /\b(?:cianuro\s+de\s+sodio|[aá]cido\s+sulf[uú]rico|fertilizantes?|urea|fosfato\s+diam[oó]nico|cloruro\s+de\s+potasio|muriato\s+de\s+potasio|equipamiento\s+(?:para|de)\s+ganado|m[aá]quina\s+de\s+orde(?:ñ|n)e|mixer\s+(?:de|para)\s+ganado)\b/i;
const EXPORT_INVESTMENT = /\b(?:exportaci[oó]n|exportar|comercio\s+exterior|demanda\s+(?:mundial|internacional)|mercado\s+internacional|venta\s+al\s+exterior|aduana)\b/i;
const SECTOR_INVESTMENT = /\b(?:proyecto\s+de\s+inversi[oó]n|invertir|inversi[oó]n|rentabilidad|retorno|viabilidad|flujo\s+de\s+fondos|\btir\b|\bvan\b)\b/i;
const AUTOMATED_INVESTMENT_OFFER = /\b(?:scam|estafa|autotrader|auto\s*trader|trading\s*bot|bot\s+de\s+(?:trading|inversi[oó]n)|robot\s+de\s+trading|plataforma\s+de\s+trading|inversi[oó]n\s+automatizada)\b|\b(?:ia|ai|inteligencia\s+artificial|algoritmo|robot)\b.{0,80}\b(?:hace|genera|gana|produce|multiplica)\b.{0,30}\b(?:dinero|ganancias?|rentabilidad|ingresos?)\b/i;

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
  const sensitivePersonalClaim = detectSensitivePersonalClaim(claimText);

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

  if (sensitivePersonalClaim.detected) {
    return finish(true, 'El dato personal sensible no debe inferirse ni darse por cierto. Sólo puede atribuirse a una autodeclaración pública verificable o a una fuente biográfica autorizada; de lo contrario debe permanecer no verificado.', {
      suggestedSourceTypes: ['attributable-public-self-disclosure', 'authorized-biographical-source'],
      minimumIndependentSources: 1,
      recencyRequired: false,
      officialSourceRequired: false,
    });
  }

  if (AUTOMATED_INVESTMENT_OFFER.test(claimText)) {
    return finish(true, 'Una oferta de inversión automatizada o una consulta sobre posible scam exige verificar la identidad del operador, su autorización, las alertas regulatorias, la custodia y retiro de fondos y la evidencia del rendimiento. La publicidad o el dominio no bastan para declararla legítima ni fraudulenta.', {
      suggestedSourceTypes: ['securities-regulator-cnv', 'regulatory-records', 'company-registries', 'consumer-protection-agencies', 'domain-registration-data'],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if ((primaryDomain === 'finance' || primaryDomain === 'economics') && ARGENTINA_INFLATION_COMPARISON.test(claimText)) {
    return finish(true, 'La comparación entre el costo financiero y la inflación requiere separar el IPC observado de las expectativas para un horizonte equivalente.', {
      suggestedSourceTypes: ['central-bank-data', 'official-statistics'],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (OIL_GAS_INVESTMENT.test(claimText) && (SECTOR_INVESTMENT.test(claimText) || ENERGY_REGION_REAL_ESTATE.test(claimText))) {
    const realEstateTypes = ENERGY_REGION_REAL_ESTATE.test(claimText)
      ? ['official-real-estate-data', 'property-market-comparables']
      : [];
    return finish(true, 'La inversión petrolera o gasífera requiere producción oficial por período, yacimiento y formación, además de concesiones, reservas, costos, infraestructura y permisos. Los valores de tierras o alquileres deben verificarse con comparables inmobiliarios separados.', {
      suggestedSourceTypes: ['official-hydrocarbon-data', 'official-energy-regulation', 'official-statistics', ...realEstateTypes],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (MINING_INVESTMENT.test(claimText) && (SECTOR_INVESTMENT.test(claimText) || ENERGY_REGION_REAL_ESTATE.test(claimText) || PRODUCTIVE_INPUT_PRICES.test(claimText))) {
    const realEstateTypes = ENERGY_REGION_REAL_ESTATE.test(claimText) ? ['official-real-estate-data', 'property-market-comparables'] : [];
    const inputTypes = PRODUCTIVE_INPUT_PRICES.test(claimText) ? ['productive-input-price-benchmarks', 'supplier-comparables'] : [];
    return finish(true, 'La inversión minera requiere cartera y registros oficiales, título o concesión, informe técnico de recursos y reservas, permisos, producción, costos y precios. Viviendas para trabajadores e insumos deben contrastarse con referencias fechadas y separadas.', {
      suggestedSourceTypes: ['official-mining-data', 'geological-survey-data', 'official-commodity-market-data', 'official-statistics', ...realEstateTypes, ...inputTypes],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (INDUSTRIAL_PARK_REAL_ESTATE.test(claimText)) {
    return finish(true, 'El valor de un inmueble industrial requiere comprobar el parque y contrastar lotes, naves o galpones comparables de la misma zona, superficie, servicios, habilitación y fecha.', {
      suggestedSourceTypes: ['official-industrial-park-registry', 'official-real-estate-data', 'industrial-property-comparables'],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (REAL_ESTATE_INVESTMENT.test(claimText) && SECTOR_INVESTMENT.test(claimText)) {
    return finish(true, 'La viabilidad inmobiliaria requiere comparar precio por metro cuadrado, alquileres, vacancia, liquidez y costos de la misma localidad, zona, tipología y fecha.', {
      suggestedSourceTypes: ['official-real-estate-data', 'property-market-comparables', 'official-statistics'],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (EXPORT_INVESTMENT.test(claimText) && SECTOR_INVESTMENT.test(claimText)) {
    return finish(true, 'La oportunidad exportadora requiere contrastar exportaciones argentinas, demanda internacional, precios, destinos, competidores y barreras de acceso.', {
      suggestedSourceTypes: ['official-trade-statistics', 'international-trade-data', 'customs-data'],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if ((AGRICULTURAL_INVESTMENT.test(claimText) && SECTOR_INVESTMENT.test(claimText)) || PRODUCTIVE_INPUT_PRICES.test(claimText)) {
    const inputTypes = PRODUCTIVE_INPUT_PRICES.test(claimText) ? ['productive-input-price-benchmarks', 'supplier-comparables'] : [];
    return finish(true, 'La inversión agropecuaria o regional requiere datos actuales de producción, rindes, sanidad, costos y precios del producto y de la región.', {
      suggestedSourceTypes: ['official-agricultural-statistics', 'commodity-market-data', 'official-livestock-data', 'official-regional-economy-data', ...inputTypes],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (SECTOR_INVESTMENT.test(claimText)) {
    return finish(true, 'La viabilidad de una inversión exige estadísticas sectoriales actuales, datos macroeconómicos y evidencia independiente de demanda, precios y costos.', {
      suggestedSourceTypes: ['official-sector-statistics', 'official-statistics', 'central-bank-data', 'economic-research'],
      minimumIndependentSources: 2,
      recencyRequired: true,
      officialSourceRequired: true,
    });
  }

  if (BIOGRAPHICAL_RELATIONSHIP.test(claimText) || BIOGRAPHICAL_FACT.test(claimText)) {
    return finish(true, 'La afirmación biográfica o de parentesco sobre personas identificables debe contrastarse con registros públicos y fuentes periodísticas independientes.', {
      suggestedSourceTypes: ['public-records', 'independent-news'],
      minimumIndependentSources: 2,
      recencyRequired: false,
      officialSourceRequired: false,
    });
  }

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
    if (ILLICIT_DRUG.test(claimText)) {
      return finish(true, 'La afirmación sobre una droga ilícita y sus efectos requiere autoridades de salud pública y evidencia toxicológica, no testimonios ni usos informales.', {
        suggestedSourceTypes: ['health-authorities', 'peer-reviewed-medical-research'],
        minimumIndependentSources: 2,
        recencyRequired: false,
        officialSourceRequired: true,
      });
    }
    const medicationSources = MEDICATION_EFFECT.test(claimText)
      ? ['drug-regulator-anmat', 'drug-regulator-fda', 'drug-regulator-ema', 'peer-reviewed-medical-research', 'pharmacovigilance']
      : DOMAIN_SOURCE_POLICY['biology-health'].sources;
    return finish(true, 'La afirmación médica o terapéutica requiere evidencia clínica y autoridades sanitarias actualizadas.', {
      suggestedSourceTypes: medicationSources,
      minimumIndependentSources: SIMPLE_DRUG_INDICATION.test(claimText) ? 1 : DOMAIN_SOURCE_POLICY['biology-health'].minimum,
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

  if (claimNature.factualVerifiability === 'currently-verifiable') {
    return finish(true, 'Toda afirmación presentada como un hecho debe contrastarse externamente antes de recibir una conclusión de confiabilidad.');
  }

  if (claimNature.factualVerifiability === 'requires-external-source') {
    return finish(true, 'La naturaleza de la afirmación exige una fuente externa para poder contrastarla.');
  }

  return finish(false, 'No se detectó dependencia de información externa cambiante o especializada.');
}
