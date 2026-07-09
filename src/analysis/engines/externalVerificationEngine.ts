import { detectFactualQuestion } from './factualQuestionDetector';
import { detectReproductiveBiologyQuestion } from './healthBiologyEngine';

export type VerificationResult = {
  verificationMode: 'conceptual-local' | 'requires-external' | 'standard';
  isFactualQuestion: boolean;
  domain: 'health-biology' | 'science' | 'factual' | 'general';
  scoreAdjustment: number; // -30 to +30, applied to base score
  contextualResponse?: string;
  externalSources: string[]; // empty for now, prepared for future API
  confidence: number; // 0-100
  recommendedLabel?: string;
};

export function verifyFactualContent(text: string): VerificationResult {
  const factualQ = detectFactualQuestion(text);

  if (!factualQ.isFactualQuestion) {
    return {
      verificationMode: 'standard',
      isFactualQuestion: false,
      domain: 'general',
      scoreAdjustment: 0,
      externalSources: [],
      confidence: 50
    };
  }

  const reproductiveBio = detectReproductiveBiologyQuestion(text);

  if (reproductiveBio.isReproductiveBiology) {
    return {
      verificationMode: 'conceptual-local',
      isFactualQuestion: true,
      domain: 'health-biology',
      scoreAdjustment: 25,
      contextualResponse: reproductiveBio.contextualAnswer,
      externalSources: [],
      confidence: 82,
      recommendedLabel: 'Salud / biología / reproducción'
    };
  }

  if (factualQ.conceptualVerifiable) {
    return {
      verificationMode: 'conceptual-local',
      isFactualQuestion: true,
      domain: 'factual',
      scoreAdjustment: 15,
      externalSources: [],
      confidence: factualQ.factualityScore,
      recommendedLabel: 'Pregunta factual'
    };
  }

  return {
    verificationMode: 'requires-external',
    isFactualQuestion: true,
    domain: 'factual',
    scoreAdjustment: 5,
    externalSources: [],
    confidence: 45,
    recommendedLabel: 'Pregunta factual'
  };
}
