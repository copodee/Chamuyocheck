/**
 * ClaimNature Type Definitions
 * 
 * Represents the semantic nature of a claim (what kind of statement it is),
 * independent from the knowledge domain (what topic it's about).
 * 
 * This is separate from KnowledgeDomain and allows for combinations like:
 * - "Bitcoin will rise" = Prediction + Finance
 * - "I think public spending is wasteful" = Opinion + Public Policy
 * - "Aliens landed in Córdoba" = Extraordinary Claim + Public Claims
 */

/**
 * ClaimNature: Semantic classification of what kind of statement is made
 */
export type ClaimNature =
  | 'fact'                  // Verifiable statement about reality (past/present)
  | 'opinion'               // Subjective evaluation or belief
  | 'prediction'            // Statement about future events
  | 'recommendation'        // Advice or suggestion for action
  | 'question'              // Information-seeking query
  | 'extraordinary-claim'   // Claims of impossible or extremely unlikely events
  | 'advertisement'         // Marketing or promotional content
  | 'promise'               // Explicit guarantee or commitment about outcome
  | 'rumor'                 // Unverified claim attributed to others
  | 'testimony'             // First-hand account of witnessed/experienced event
  | 'statistic'             // Quantified factual claim
  | 'legal-assertion'       // Claims about law, contracts, or rights
  | 'financial-offer'       // Explicit investment or money opportunity proposal
  | 'mixed'                 // Multiple independent natures in single claim
  | 'unknown';              // Unable to determine

/**
 * FactualVerifiability: How and when a claim can be verified
 */
export type FactualVerifiability =
  | 'currently-verifiable'      // Can be checked now against available information
  | 'future-verifiable'         // Can only be verified after future event occurs
  | 'subjective'                // Inherently subjective; cannot be verified as true/false
  | 'requires-external-source'  // Needs external data/expertise to verify
  | 'not-applicable';           // Not a statement about reality (e.g., question, pure recommendation)

/**
 * ClaimNatureResult: Output of nature detection for a single claim
 */
export type ClaimNatureResult = {
  /** Primary claim nature - the dominant semantic function */
  primaryNature: ClaimNature;

  /** Secondary natures present in the claim (in order of prominence) */
  secondaryNatures: ClaimNature[];

  /** Confidence in nature detection (0.0-1.0) */
  confidence: number;

  /** How the claim can be verified/falsified */
  factualVerifiability: FactualVerifiability;

  /** Linguistic signals that contributed to detection */
  linguisticSignals: string[];

  /** Explanation of nature detection reasoning */
  reason: string;
};
