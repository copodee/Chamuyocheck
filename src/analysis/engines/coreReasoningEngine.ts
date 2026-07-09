import { validateFinancialClaims, type FinancialValidation } from './financialReasoningEngine';
import { validateScientificPremise, type ScientificPremiseValidation } from './scientificPremiseValidator';

export type ReasoningResult = {
  inconsistencySeverity: 'extreme' | 'high' | 'medium' | 'none';
  forcedScore: number | null;    // if not null, override final score with this value
  scoreBoost: number;            // additional adjustment to apply if no forced score
  domain: 'finance' | 'science' | 'general';
  explanation: string;
  risks: string[];
  recommendations: string[];
  financial: FinancialValidation;
  scientific: ScientificPremiseValidation;
};

export function runCoreReasoning(text: string): ReasoningResult {
  // 1. Scientific premise check
  const scientific = validateScientificPremise(text);
  if (scientific.hasInvalidPremise && scientific.severity === 'extreme') {
    return {
      inconsistencySeverity: 'extreme',
      forcedScore: 100,
      scoreBoost: 0,
      domain: 'science',
      explanation: scientific.conclusion,
      risks: scientific.reasoning,
      recommendations: [
        'No compartir ni actuar sobre la afirmación sin verificar fuentes científicas.',
        'Contrastar con publicaciones revisadas por pares antes de tomar decisiones.'
      ],
      financial: _emptyFinancial(),
      scientific
    };
  }

  // 2. Financial reasoning check
  const financial = validateFinancialClaims(text);
  if (financial.hasMathInconsistency) {
    const isExtreme = financial.severity === 'extreme';
    return {
      inconsistencySeverity: financial.severity as 'extreme' | 'high',
      forcedScore: isExtreme ? 100 : null,
      scoreBoost: isExtreme ? 0 : 40,
      domain: 'finance',
      explanation: financial.explanation,
      risks: financial.risks,
      recommendations: financial.recommendations,
      financial,
      scientific: _emptyScientific()
    };
  }

  // No strong inconsistency detected
  return {
    inconsistencySeverity: 'none',
    forcedScore: null,
    scoreBoost: 0,
    domain: 'general',
    explanation: '',
    risks: [],
    recommendations: [],
    financial,
    scientific
  };
}

function _emptyFinancial(): FinancialValidation {
  return {
    hasFinancialClaim: false,
    hasMathInconsistency: false,
    severity: 'none',
    claim: { initialAmount: null, annualRatePercent: null, promisedAmount: null, timeframeDays: null, timeframeMonths: null, timeframeYears: null, isAdvanceFee: false, isMultiplication: false, isGuaranteed: false },
    expectedAmount: null,
    discrepancyFactor: null,
    explanation: '',
    risks: [],
    recommendations: []
  };
}

function _emptyScientific(): ScientificPremiseValidation {
  return {
    hasInvalidPremise: false,
    severity: 'none',
    category: 'none',
    conclusion: '',
    confidence: 0,
    reasoning: []
  };
}
