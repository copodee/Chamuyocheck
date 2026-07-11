/**
 * KnowledgeDomain: Topic domain independent of claim nature
 * Represents WHAT the claim is about (topic), not WHAT KIND of statement it is
 */
export type KnowledgeDomain =
  | 'mathematics'         // Arithmetic, algebra, geometry, logic
  | 'science'             // Physics, chemistry, astronomy, general science
  | 'biology-health'      // Medicine, disease, anatomy, health conditions
  | 'finance'             // Money, investment, banking, cryptocurrency
  | 'economics'           // Markets, inflation, employment, GDP
  | 'history-sports'      // Historical events, sports events and records
  | 'technology'          // Software, hardware, internet, AI, apps
  | 'legal'               // Law, contracts, rights, procedures
  | 'public-policy'       // Government decisions, regulations, public programs
  | 'public-claims'       // News events, government actions, public records
  | 'advertising-scams'   // Promotional schemes, pyramid schemes, false promises
  | 'politics'            // Political ideology, politicians, parties, campaigns
  | 'culture'             // Entertainment, arts, media, subjective preferences
  | 'general';            // No specific domain detected

/**
 * ContentDomain: Alias for backwards compatibility with V20
 */
export type ContentDomain =
  | 'academico'
  | 'financiero'
  | 'contrato'
  | 'salud'
  | 'noticia'
  | 'politica'
  | 'ciencia'
  | 'redes'
  | 'inversion'
  | 'publicidad'
  | 'general';

/**
 * V20-style domain detection (for backwards compatibility)
 */
export type DomainDetection = {
  domain: ContentDomain;
  label: string;
  confidence: number;
  reasons: string[];
  recommendedModules: string[];
};

/**
 * V21B: Nature-aware routing context
 */
export type NatureAwareRoutingContext = {
  claimText: string;
  claimNature: import('./claimNature').ClaimNatureResult;
  extractedEntities: {
    named: string[];              // Named entities (Bitcoin, Messi, etc.)
    temporal: string[];           // Time references (mañana, ayer, etc.)
    geographic: string[];         // Locations (Córdoba, Argentina, etc.)
    numeric: Array<{ value: number; unit?: string }>;  // Numbers with units
  };
  commercialSignals: string[];    // Product names, prices, calls to action
  legalSignals: string[];         // Legal terminology, contract references
  medicalSignals: string[];       // Medical terms, symptom references
  temporalSignals: string[];      // Tense markers, urgency language
  geographicSignals: string[];    // Location specificity
};

/**
 * V21B: Nature-aware domain detection result
 */
export type NatureAwareDomainDetection = {
  primaryDomain: KnowledgeDomain;
  secondaryDomains: KnowledgeDomain[];
  routingConfidence: number;      // 0.0-1.0: How confident in domain selection
  reason: string;
  visibleType: string;            // User-facing label (e.g., "Predicción financiera")
  recommendedSpecialists: string[];  // Specialists to run
};
