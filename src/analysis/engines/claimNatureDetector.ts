/**
 * Claim Nature Detector
 * 
 * Detects the semantic nature of a claim (what kind of statement it is)
 * using multi-signal linguistic analysis, not single keywords.
 * 
 * Operates independently from domain routing.
 */

import { ClaimNature, FactualVerifiability, ClaimNatureResult } from '../types/claimNature';

interface SignalDetection {
  signal: string;
  confidence: number;
}

export function detectClaimNature(claimText: string): ClaimNatureResult {
  const signals: SignalDetection[] = [];
  const natures: Map<ClaimNature, number> = new Map();
  let hasPastTenseDetected = false; // Track if past tense was detected, don't store in natures map

  // Normalize text for analysis
  const normalized = claimText.toLowerCase().trim();

  // === PHASE 1: Detect Linguistic Signals ===

  // 1. Detect question (must be checked early)
  if (isQuestion(normalized)) {
    signals.push({ signal: 'interrogative-form', confidence: 0.95 });
    if (!natures.has('question')) natures.set('question', 0.95);
  }

  // 2. EARLY: Detect past tense BEFORE prediction (past tense excludes future classification)
  const pastSignals = detectPastTense(normalized);
  pastSignals.forEach(s => signals.push(s));
  hasPastTenseDetected = pastSignals.length > 0;

  // 3. Detect future tense markers (only if NOT past tense)
  const futureSignals = detectFutureTense(normalized);
  futureSignals.forEach(s => signals.push(s));
  if (futureSignals.length > 0 && !hasPastTenseDetected) {
    const futureConfidence = Math.min(0.95, futureSignals.reduce((a, b) => a + b.confidence, 0) / futureSignals.length);
    natures.set('prediction', (natures.get('prediction') ?? 0) + futureConfidence);
  }

  // 4. Detect belief/opinion markers
  const opinionSignals = detectBeliefMarkers(normalized);
  opinionSignals.forEach(s => signals.push(s));
  if (opinionSignals.length > 0) {
    const opinionConfidence = Math.min(0.95, opinionSignals.reduce((a, b) => a + b.confidence, 0) / opinionSignals.length);
    natures.set('opinion', (natures.get('opinion') ?? 0) + opinionConfidence);
  }

  // 5. Detect evaluative adjectives (strengthens opinion)
  const evaluativeSignals = detectEvaluativeAdjectives(normalized);
  evaluativeSignals.forEach(s => signals.push(s));
  if (evaluativeSignals.length > 0) {
    const evalConfidence = Math.min(0.85, evaluativeSignals.reduce((a, b) => a + b.confidence, 0) / evaluativeSignals.length);
    natures.set('opinion', (natures.get('opinion') ?? 0) + evalConfidence * 0.5);
  }

  // 6. Detect fact (present/past tense without subjective markers)
  const factSignals = detectFact(normalized, natures);
  factSignals.forEach(s => signals.push(s));
  if (factSignals.length > 0) {
    const factConfidence = Math.min(0.85, factSignals.reduce((a, b) => a + b.confidence, 0) / factSignals.length);
    natures.set('fact', (natures.get('fact') ?? 0) + factConfidence);
  }

  // 7. Detect imperative/hortative (recommendation/advertisement)
  const imperativeSignals = detectImperative(normalized);
  imperativeSignals.forEach(s => signals.push(s));
  if (imperativeSignals.length > 0) {
    const impConfidence = Math.min(0.9, imperativeSignals.reduce((a, b) => a + b.confidence, 0) / imperativeSignals.length);
    natures.set('recommendation', (natures.get('recommendation') ?? 0) + impConfidence * 0.4);
    // Multiple strong imperatives boost advertisement score
    const highImpConfidence = imperativeSignals.some(s => s.confidence >= 0.85);
    if (highImpConfidence) {
      natures.set('advertisement', (natures.get('advertisement') ?? 0) + impConfidence * 0.5);
    }
  }

  // 8. Detect commercial/advertising language (BEFORE promise to make it primary)
  const adSignals = detectAdvertisingLanguage(normalized);
  adSignals.forEach(s => signals.push(s));
  if (adSignals.length > 0) {
    const adConfidence = Math.min(0.85, adSignals.reduce((a, b) => a + b.confidence, 0) / adSignals.length);
    natures.set('advertisement', (natures.get('advertisement') ?? 0) + adConfidence);
  }

  // 9. Detect guarantee/promise language (STRICT - only explicit promises)
  const promiseSignals = detectPromiseLanguage(normalized);
  promiseSignals.forEach(s => signals.push(s));
  if (promiseSignals.length > 0) {
    const promiseConfidence = Math.min(0.9, promiseSignals.reduce((a, b) => a + b.confidence, 0) / promiseSignals.length);
    natures.set('promise', (natures.get('promise') ?? 0) + promiseConfidence);
  }

  // 10. Detect hearsay/rumor markers
  const rumorSignals = detectRumorMarkers(normalized);
  rumorSignals.forEach(s => signals.push(s));
  if (rumorSignals.length > 0) {
    const rumorConfidence = Math.min(0.9, rumorSignals.reduce((a, b) => a + b.confidence, 0) / rumorSignals.length);
    natures.set('rumor', (natures.get('rumor') ?? 0) + rumorConfidence);
  }

  // 11. Detect first-person/eyewitness markers (STRICT - first-person only, NOT passive observations)
  const testimonySignals = detectTestimony(normalized);
  testimonySignals.forEach(s => signals.push(s));
  if (testimonySignals.length > 0) {
    const testConfidence = Math.min(0.95, testimonySignals.reduce((a, b) => a + b.confidence, 0) / testimonySignals.length);
    natures.set('testimony', (natures.get('testimony') ?? 0) + testConfidence);
  }

  // 12. Detect extraordinary entities/claims
  const extraordinarySignals = detectExtraordinaryEntities(normalized);
  extraordinarySignals.forEach(s => signals.push(s));
  if (extraordinarySignals.length > 0) {
    const extraConfidence = Math.min(0.9, extraordinarySignals.reduce((a, b) => a + b.confidence, 0) / extraordinarySignals.length);
    natures.set('extraordinary-claim', (natures.get('extraordinary-claim') ?? 0) + extraConfidence);
  }

  // 13. Detect numeric/statistical patterns
  const statisticSignals = detectStatistic(normalized);
  statisticSignals.forEach(s => signals.push(s));
  if (statisticSignals.length > 0) {
    const statConfidence = Math.min(0.85, statisticSignals.reduce((a, b) => a + b.confidence, 0) / statisticSignals.length);
    natures.set('statistic', (natures.get('statistic') ?? 0) + statConfidence);
  }

  // 14. Detect legal assertion patterns
  const legalSignals = detectLegalAssertion(normalized);
  legalSignals.forEach(s => signals.push(s));
  if (legalSignals.length > 0) {
    const legalConfidence = Math.min(0.9, legalSignals.reduce((a, b) => a + b.confidence, 0) / legalSignals.length);
    natures.set('legal-assertion', (natures.get('legal-assertion') ?? 0) + legalConfidence);
  }

  // 15. Detect financial offer patterns
  const financialSignals = detectFinancialOffer(normalized);
  financialSignals.forEach(s => signals.push(s));
  if (financialSignals.length > 0) {
    const finConfidence = Math.min(0.85, financialSignals.reduce((a, b) => a + b.confidence, 0) / financialSignals.length);
    natures.set('financial-offer', (natures.get('financial-offer') ?? 0) + finConfidence);
  }

  // === PHASE 2: Determine Primary and Secondary Natures ===

  const primaryNature = determinePrimaryNature(natures, signals);
  const secondaryNatures = determineSecondaryNatures(natures, primaryNature);
  const confidence = calculateConfidence(natures, primaryNature, signals);
  const verifiability = determineVerifiability(primaryNature, secondaryNatures);
  const reason = generateReason(primaryNature, secondaryNatures, signals);

  return {
    primaryNature,
    secondaryNatures,
    confidence,
    factualVerifiability: verifiability,
    linguisticSignals: Array.from(new Set(signals.map(s => s.signal))),
    reason,
  };
}

// === SIGNAL DETECTION FUNCTIONS ===

function isQuestion(text: string): boolean {
  // Check for interrogative structure
  return /^¿|^\?|¿.*\?|.*\?$/.test(text);
}

function detectFutureTense(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Future tense constructions (ir a, serán, etc) - NO word boundaries for accents
  if (/va\s+a|voy\s+a|vas\s+a|vamos\s+a|van\s+a/.test(text)) {
    signals.push({ signal: 'future-ir-a', confidence: 0.9 });
  }
  if (/seré|serás|será|seremos|seréis|serán/.test(text)) {
    signals.push({ signal: 'future-indicative', confidence: 0.95 });
  }

  // Future haber conjugations (habré, habrás, habrá, habremos, habréis, habrán)
  if (/habré|habrás|habrá|habremos|habréis|habrán|ha de|han de/.test(text)) {
    signals.push({ signal: 'future-haber', confidence: 0.95 });
  }

  // Future temporal markers (ONLY future, NOT past)
  if (/(mañana|próximo|próxima|siguiente|luego|después|dentro de|el\s+año\s+que\s+viene|próximamente)/.test(text)) {
    signals.push({ signal: 'future-temporal-marker', confidence: 0.8 });
  }

  // Conditional constructions
  if (/si\b.*(?:va\s+a|será)/.test(text)) {
    signals.push({ signal: 'conditional-future', confidence: 0.8 });
  }

  return signals;
}

/**
 * Detect past temporal markers to exclude from future classification
 */
function detectPastTense(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Past tense verbs - Spanish conjugations
  if (/(fue|fueron|era|eran|estuvo|estuvieron|hubo|haya|hayamos|habían|había)/.test(text)) {
    signals.push({ signal: 'past-indicative', confidence: 0.9 });
  }

  // Past temporal markers - ONLY past, NOT future - NO \b for accented words
  if (/(ayer|anteayer|anoche|hace|pasado|la\s+semana\s+pasada|el\s+mes\s+pasado|el\s+año\s+pasado|hace\s+poco|hace\s+\d+\s+(?:día|días|semana|semanas|mes|meses|año|años))/.test(text)) {
    signals.push({ signal: 'past-temporal-marker', confidence: 0.95 });
  }

  // Simple past tense with common verbs - use word boundaries for 2-letter words
  if (/\b(vio|vieron)\b|\bví\b|\b(vi)\b(?!ene|vi|\w)|escuché|escuchó|escucharon|noté|notó|notaron|encontré|encontró|encontraron/.test(text)) {
    signals.push({ signal: 'simple-past', confidence: 0.85 });
  }

  return signals;
}

function detectBeliefMarkers(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Direct belief expressions
  if (/\bcreo\s+que\b|\bpienso\s+que\b|\bme\s+parece\b|\bopino\s+que\b|\bconsidero\s+que\b/.test(text)) {
    signals.push({ signal: 'belief-marker', confidence: 0.95 });
  }

  // Subjective framing
  if (/(en\s+mi\s+opinión|es\s+mi\s+parecer|en\s+mi\s+criterio)/.test(text)) {
    signals.push({ signal: 'subjective-framing', confidence: 0.9 });
  }

  return signals;
}

function detectEvaluativeAdjectives(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Positive evaluatives (no accents that break word boundaries)
  if (/\b(mejor|peor|bueno|malo|excelente|terrible|hermoso|horrible|maravilloso|fantástico|pésimo)\b/.test(text)) {
    signals.push({ signal: 'evaluative-adjective', confidence: 0.85 });
  }

  // Superlatives
  if (/\bmás\s+(\w+)\b|\bel\s+más\b/.test(text)) {
    signals.push({ signal: 'superlative-form', confidence: 0.8 });
  }

  return signals;
}

function detectImperative(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Spanish imperatives - count them to detect multiple - add word boundaries where safe
  // Note: use \b for non-accented, no \b for accented chars
  const imperativePatterns = /\b(compra|invierte|gana|hace|hazte|prueba|descarga|contacta|pide|llama|haz|come|corre|habla|escucha|consulta|considera|piensa)\b|compr[aá]|obtén/g;
  const matches = text.match(imperativePatterns);
  const imperativeCount = matches ? matches.length : 0;

  if (imperativeCount >= 1) {
    // More imperatives = stronger signal
    const confidence = Math.min(0.95, 0.7 + imperativeCount * 0.12);
    signals.push({ signal: 'imperative-verb', confidence });
  }

  // Hortative subjunctive - suggestions/recommendations
  if (/\b(deberías|podrías|conviene|importante|necesario|necesita)\b/.test(text)) {
    signals.push({ signal: 'hortative-subjunctive', confidence: 0.8 });
  }

  // Necessity claim (needs/should)
  if (/(necesita|necesario|debe|debería)\s+/.test(text)) {
    signals.push({ signal: 'necessity-claim', confidence: 0.75 });
  }

  return signals;
}

function detectPromiseLanguage(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // ONLY explicit guarantee language triggers promise
  // Guarantee language
  if (/\b(garantizo|te\s+garantizo|te\s+prometo|prometo|aseguro|seguro|100%|ciento por ciento)\b/.test(text)) {
    signals.push({ signal: 'guarantee-language', confidence: 0.95 });
  }

  // Absolute certainty markers ONLY count with future outcome - NO \b for accented
  if (/(seguramente|definitivamente|sin\s+duda|claramente|obviamente|absolutamente)/.test(text) && 
      /(vas\s+a|va\s+a|será)/.test(text) &&
      /(adelgazar|ganar|duplicar|triplicar|curarse|recuperarse|subir|bajar|crecer|mejorar)/.test(text)) {
    signals.push({ signal: 'false-certainty-future', confidence: 0.9 });
  }

  // Outcome promise: vas a + outcome verb (with or without guarantee language)
  // This handles "Comprá este suplemento y vas a adelgazar"
  if (/(vas\s+a|va\s+a)\s+(adelgazar|ganar|duplicar|triplicar|curarse|recuperarse|bajar de peso)/.test(text)) {
    signals.push({ signal: 'outcome-promise', confidence: 0.8 });
  }

  // Absolute outcome promise with explicit certainty words
  if (/(vas\s+a|va\s+a)\s+(adelgazar|ganar|duplicar|triplicar|curarse|recuperarse)/.test(text) && 
      /(seguro|garantizado|asegurado|100%|con\s+seguridad|sin\s+duda)/.test(text)) {
    signals.push({ signal: 'outcome-guarantee', confidence: 0.9 });
  }

  return signals;
}

function detectAdvertisingLanguage(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Commercial imperatives - NO \b for accented
  if (/(comprá|invierte|compra|descarga|contacta|pide|hoy|ahora|urgente|antes|oportunidad)/.test(text)) {
    signals.push({ signal: 'commercial-language', confidence: 0.8 });
  }

  // Product mention + benefit
  if (/\b(este|este|este)\s+(producto|suplemento|programa|servicio|curso|sistema)/.test(text)) {
    signals.push({ signal: 'product-mention', confidence: 0.85 });
  }

  // Urgency/scarcity
  if (/\b(limitado|limitada|urgente|no\s+esperes|antes\s+de|hoy|oferta|descuento)\b/.test(text)) {
    signals.push({ signal: 'urgency-language', confidence: 0.75 });
  }

  return signals;
}

function detectRumorMarkers(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Hearsay expressions - Spanish forms
  if (/(dicen\s+que|se\s+comenta|según|me\s+dijeron|he\s+escuchado|dicen|comentan|afirman|cuentan|se\s+dice)/.test(text)) {
    signals.push({ signal: 'hearsay-marker', confidence: 0.9 });
  }

  // Unattributed source
  if (/\b(algunos|muchos|la\s+gente|se\s+dice|se\s+comenta|parece\s+que)\s+/.test(text)) {
    signals.push({ signal: 'unattributed-source', confidence: 0.85 });
  }

  // Third-hand attribution
  if (/\b(supuestamente|aparentemente|al\s+parecer|según\s+dicen)\b/.test(text)) {
    signals.push({ signal: 'third-hand-attribution', confidence: 0.8 });
  }

  return signals;
}

function detectTestimony(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // STRICT: First-person (yo) + witness verb - EXPLICIT attribution only - NO \b for accented
  if (/(yo\s+vi|yo\s+ví|yo\s+presencié|yo\s+escuché|yo\s+oí|vi\s+con\s+mis\s+propios\s+ojos|presencié\s+personalmente)/.test(text)) {
    signals.push({ signal: 'first-person-experience', confidence: 0.95 });
  }

  // STRICT: Explicit attribution of testimony (un testigo dijo, María declaró, según un testigo, etc) - NO \b for accented
  if (/(un\s+testigo|una\s+testiga|testigos|declara|declaró|declaró\s+que|dice\s+que\s+vio|dijo\s+que\s+vio|según\s+(?:un|una|el|la)\s+testigo|un\s+testigo\s+afirmó)/.test(text)) {
    signals.push({ signal: 'attributed-testimony', confidence: 0.9 });
  }

  // DO NOT: Mark passive "se vieron" or "se vio" as testimony - this is just reporting an event
  // Passive voice without first-person or attribution is NOT testimony

  return signals;
}

function detectExtraordinaryEntities(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Extraordinary entities - Spanish forms
  if (/\b(extraterrestre|extraterrestres|alien|ovni|dinosaurio|criatura|monstruo|fantasma|demonio|ser\s+extraño)\b/.test(text)) {
    signals.push({ signal: 'extraordinary-entity', confidence: 0.95 });
  }

  // Impossible events - Spanish - NO \b for accented
  if (/(imposible|milagro|sobrenatural|magia|mágico|paranormal|fenómeno\s+extraño)/.test(text)) {
    signals.push({ signal: 'impossible-event', confidence: 0.85 });
  }

  // Recent + location framing (suggests public event) - Spanish - NO \b for accented
  // Only with past tense, not with passive voice alone
  if (/(ayer|anteayer|anoche|hace\s+\d+\s+(?:día|días|semana|semanas|mes|meses))/.test(text) &&
      /(Córdoba|Buenos Aires|Argentina|país|ciudad|lugar|zona|región)/.test(text) &&
      (/ vieron?$|vio\s| vio\s/.test(text) || /(extraterrestre|ovni|alien|dinosaurio|monstruo)/.test(text))) {
    signals.push({ signal: 'recent-location-event', confidence: 0.8 });
  }

  // DO NOT: Mark passive "se vio" alone as "witnessed-extraordinary"
  // Passive voice requires additional testimony/attribution markers

  return signals;
}

function detectStatistic(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Percentage pattern
  if (/\d+\s*%|por ciento|porcentaje/.test(text)) {
    signals.push({ signal: 'percentage-pattern', confidence: 0.9 });
  }

  // Numeric quantification  
  if (/\b(el|la)\s+\d+\s+(por ciento|%|de|de cada)/.test(text)) {
    signals.push({ signal: 'quantified-claim', confidence: 0.85 });
  }

  // Statistical language - NO \b for accented chars like "investigación"
  if (/(encuesta|estudio|investigación|datos|muestra|promedio|media)/.test(text)) {
    signals.push({ signal: 'statistical-language', confidence: 0.8 });
  }

  return signals;
}

function detectLegalAssertion(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Legal terminology
  if (/\b(ilegal|legal|ley|contrato|cláusula|derecho|obligación|prohibido|permitido|delito|crimen)\b/.test(text)) {
    signals.push({ signal: 'legal-terminology', confidence: 0.85 });
  }

  // Legal judgment
  if (/\b(es\s+(ilegal|legal)|viola|infringe|cumple|incumple)\b/.test(text)) {
    signals.push({ signal: 'legal-judgment', confidence: 0.9 });
  }

  return signals;
}

function detectFinancialOffer(text: string): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Investment/return language - require more context than just "invierte" alone
  // Case 1: invierte/invertí + amount: "Invierte $1000", "Invertí 100000 pesos"
  if (/inviert[ei]\s+[\$\d]|invertí\s+\d|ganá\s+\d|gané\s+\d|ganancia\s+de|rentabilidad|retorno\s+de|rendimiento\s+de|renta\s+\d/.test(text)) {
    signals.push({ signal: 'investment-language', confidence: 0.9 });
  }

  // Money amounts with investment context - include dollar sign + amount pattern
  if (/\$\d+.*(?:inviert|gana|rentabilidad|ganancia|retorno|obtén)/.test(text) ||
      /(\d+\s*(?:pesos|dólares|euros)).*(?:inviert|gana|rentabilidad|ganancia|retorno|anual)/.test(text) ||
      /inviert.*\$\d+/.test(text)) {
    signals.push({ signal: 'money-amount', confidence: 0.95 });
  }

  // Additional context: percentage return or annual yield
  if (/\d+\s*%.*(?:anual|mensual|semanal|diario|de\s+ganancia)/.test(text)) {
    signals.push({ signal: 'percentage-return', confidence: 0.9 });
  }

  // Return/multiplication language - Spanish
  if (/\b(duplica|duplicar|duplicará|triplicar|triplicará|multiplicar|multiplicará|x\s*\d+|veces\s+\d+)\b/.test(text)) {
    signals.push({ signal: 'return-multiplication', confidence: 0.85 });
  }

  return signals;
}

function detectFact(text: string, natures: Map<ClaimNature, number>): SignalDetection[] {
  const signals: SignalDetection[] = [];

  // Only classify as fact if no stronger signals for other natures
  const hasOpinion = natures.has('opinion') && (natures.get('opinion') ?? 0) > 0.3;
  const hasPrediction = natures.has('prediction') && (natures.get('prediction') ?? 0) > 0.3;
  const hasExtraordinary = natures.has('extraordinary-claim') && (natures.get('extraordinary-claim') ?? 0) > 0.3;
  const hasQuestion = /^¿|^\?|¿.*\?|.*\?$/.test(text);

  if (hasOpinion || hasPrediction || hasExtraordinary || hasQuestion) {
    return signals; // Don't classify as pure fact if other stronger natures present
  }

  // Past tense - Spanish simple past (preterito): aumentó, ganó, hizo, etc. - NO \b for accents
  if (/(aumentó|aumentaron|ganó|ganaron|hizo|hicieron|fue|fueron|estuvo|estuvieron|perdió|perdieron|publicó|publicaron|cambió|cambiaron|creció|crecieron|bajó|bajaron|subió|subieron|comenzó|comenzaron|terminó|terminaron|llegó|llegaron|invertí|invert)/.test(text)) {
    signals.push({ signal: 'simple-past-verb', confidence: 0.9 });
  }

  // Present tense assertion (es, son, está, están) - use \b for single-letter words
  if (/\b(es|son)\b|está|están|existe|existen/.test(text) && !/ va a | será | serán /.test(text)) {
    signals.push({ signal: 'present-tense', confidence: 0.85 });
  }

  // Named entity or institutional context (ministerio, gobierno, country, sport, etc)
  if (/(ministerio|gobierno|país|ciudad|mundial|diputado|senado|empresa|organización|país|copa|torneo)/.test(text)) {
    signals.push({ signal: 'named-entity', confidence: 0.8 });
  }

  return signals;
}

// === DECISION FUNCTIONS ===

function determinePrimaryNature(
  natures: Map<ClaimNature, number>,
  signals: SignalDetection[]
): ClaimNature {
  if (natures.size === 0) {
    return 'unknown';
  }

  // Special case: if question detected with high confidence, question is primary
  if (signals.some(s => s.signal === 'interrogative-form' && s.confidence > 0.9)) {
    return 'question';
  }

  // Special case: Rumor should be primary over prediction when hearsay marker present
  // This handles "Dicen que habrá una devaluación" - rumor (dicen que) > prediction (habrá)
  const rumorScore = natures.get('rumor') ?? 0;
  const predScore = natures.get('prediction') ?? 0;
  if (rumorScore > 0 && signals.some(s => s.signal === 'hearsay-marker')) {
    if (predScore > 0 && predScore > rumorScore) {
      // Prediction scores higher, but rumor has explicit hearsay marker - rumor wins
      return 'rumor';
    }
  }

  // Special case: Financial-offer should be primary over statistic when both present
  // This handles "Invertí 100000 pesos y ganá 10% anual" - financial-offer > statistic
  const finScore = natures.get('financial-offer') ?? 0;
  const statScore = natures.get('statistic') ?? 0;
  if (finScore > 0 && finScore >= statScore * 0.8) {
    if (signals.some(s => s.signal === 'investment-language' || s.signal === 'money-amount' || s.signal === 'money-investment-amount')) {
      return 'financial-offer';
    }
  }

  // Special case: Advertisement should be primary over prediction/promise when both present
  // This handles "Buy this supplement and lose weight" - advertisement > prediction
  const adScore = natures.get('advertisement') ?? 0;
  const promiseScore = natures.get('promise') ?? 0;

  if (adScore > 0 && adScore >= Math.max(predScore, promiseScore) * 0.7) {
    // Advertisement is strong enough (at least 70% of the highest competing score)
    if (signals.some(s => s.signal === 'product-mention' || s.signal === 'commercial-language')) {
      return 'advertisement';
    }
  }

  // Find highest-scoring nature
  let maxNature: ClaimNature = 'unknown';
  let maxScore = 0;

  for (const [nature, score] of natures) {
    if (score > maxScore) {
      maxScore = score;
      maxNature = nature;
    }
  }

  return maxNature;
}

function determineSecondaryNatures(
  natures: Map<ClaimNature, number>,
  primaryNature: ClaimNature
): ClaimNature[] {
  const sorted = Array.from(natures.entries())
    .filter(([nature]) => nature !== primaryNature && natures.get(nature)! > 0.25)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3) // Limit to 3 secondary natures
    .map(([nature]) => nature);

  return sorted;
}

function calculateConfidence(
  natures: Map<ClaimNature, number>,
  primaryNature: ClaimNature,
  signals: SignalDetection[]
): number {
  const primaryScore = natures.get(primaryNature) ?? 0;

  // Explicit natures with clear signals should have high confidence
  if (primaryNature === 'question' && signals.some(s => s.signal === 'interrogative-form')) {
    return 0.95;
  }

  if (primaryNature === 'prediction' && signals.some(s => s.signal.includes('future'))) {
    return Math.min(0.95, primaryScore);
  }

  if (primaryNature === 'opinion' && signals.some(s => s.signal === 'belief-marker')) {
    return Math.min(0.95, primaryScore);
  }

  if (primaryNature === 'testimony' && signals.some(s => s.signal === 'first-person-experience')) {
    return 0.95;
  }

  if (primaryNature === 'advertisement' && signals.some(s => s.signal === 'product-mention')) {
    return Math.min(0.90, Math.max(0.75, primaryScore));
  }

  if (primaryNature === 'extraordinary-claim' && signals.some(s => s.signal === 'extraordinary-entity')) {
    return Math.min(0.90, Math.max(0.75, primaryScore));
  }

  if (primaryNature === 'rumor' && signals.some(s => s.signal === 'hearsay-marker')) {
    return Math.min(0.95, primaryScore);
  }

  if (primaryNature === 'fact' && signals.some(s => s.signal.includes('past') || s.signal.includes('present'))) {
    return Math.min(0.95, primaryScore);
  }

  // Default: use score-based calculation
  const totalScore = Array.from(natures.values()).reduce((a, b) => a + b, 0);

  if (totalScore === 0) return 0.3;

  // Higher weight to primary score, minimum 0.4 for valid classifications
  const proportion = primaryScore / (totalScore + 1);
  return Math.min(0.95, Math.max(0.4, proportion));
}

function determineVerifiability(primaryNature: ClaimNature, secondaryNatures: ClaimNature[]): FactualVerifiability {
  // Question: not applicable (score the premise)
  if (primaryNature === 'question') {
    return 'not-applicable';
  }

  // Opinion: subjective
  if (primaryNature === 'opinion') {
    return 'subjective';
  }

  // Prediction/Promise: future-verifiable
  if (primaryNature === 'prediction' || primaryNature === 'promise') {
    return 'future-verifiable';
  }

  // Extraordinary claim: requires external source
  if (primaryNature === 'extraordinary-claim') {
    return 'requires-external-source';
  }

  // Rumor: requires external source
  if (primaryNature === 'rumor') {
    return 'requires-external-source';
  }

  // Testimony to extraordinary: requires external source
  if (primaryNature === 'testimony' && secondaryNatures.includes('extraordinary-claim')) {
    return 'requires-external-source';
  }

  // Recommendation: not applicable (depends on content)
  if (primaryNature === 'recommendation') {
    return 'not-applicable';
  }

  // Fact, statistic, legal-assertion, financial-offer: currently verifiable
  if (['fact', 'statistic', 'legal-assertion', 'financial-offer'].includes(primaryNature)) {
    return 'currently-verifiable';
  }

  // Advertisement: currently verifiable (claims within it are)
  if (primaryNature === 'advertisement') {
    return 'currently-verifiable';
  }

  // Default
  return 'requires-external-source';
}

function generateReason(
  primaryNature: ClaimNature,
  secondaryNatures: ClaimNature[],
  signals: SignalDetection[]
): string {
  const topSignals = signals
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(s => s.signal)
    .join(', ');

  const secondary = secondaryNatures.length > 0 ? ` with secondary natures: ${secondaryNatures.join(', ')}` : '';

  return `Detected primary nature: ${primaryNature}${secondary}. Key signals: ${topSignals}.`;
}
