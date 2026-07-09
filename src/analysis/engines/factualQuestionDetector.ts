export type FactualQuestionAnalysis = {
  isFactualQuestion: boolean;
  questionType: 'yes-no' | 'how' | 'why' | 'what' | 'is-it-possible' | 'other' | 'none';
  factualityScore: number; // 0-100, higher = clearer factual basis
  ambiguityLevel: 'low' | 'medium' | 'high'; // how ambiguous the question is
  conceptualVerifiable: boolean; // can be verified conceptually without external sources
};

const factualQuestionPatterns: Array<{ pattern: RegExp; type: 'yes-no' | 'how' | 'why' | 'what' | 'is-it-possible' }> = [
  { pattern: /\b(puede|puedo|pueden|podemos|podría|podrían)\b/i, type: 'is-it-possible' },
  { pattern: /\bes\s+(verdad|posible|cierto|posible|real|ciencia)\b/i, type: 'yes-no' },
  { pattern: /\bexiste\b/i, type: 'yes-no' },
  { pattern: /\b(qué|que)\s+(pasa|sucede|ocurre)\s+(si|cuando)\b/i, type: 'what' },
  { pattern: /\b(cómo|como)\s+(funciona|funcioni|se\s+produce|se\s+genera)/i, type: 'how' },
  { pattern: /\b(por\s+)?qué\b/i, type: 'why' },
  { pattern: /\b(puede|puedo)\s+(una|un)\s+(persona|hombre|mujer|individuo)\b/i, type: 'is-it-possible' },
  { pattern: /\bes\s+(posible|probable|factible)\b/i, type: 'is-it-possible' }
];

export function detectFactualQuestion(text: string): FactualQuestionAnalysis {
  const lower = text.toLowerCase();
  const isQuestion = text.trim().endsWith('?') || /\b(puede|es|existe|cómo|por\s+qué|qué)\b/i.test(text.slice(0, 50));

  if (!isQuestion) {
    return {
      isFactualQuestion: false,
      questionType: 'none',
      factualityScore: 0,
      ambiguityLevel: 'low',
      conceptualVerifiable: false
    };
  }

  let detectedType: 'yes-no' | 'how' | 'why' | 'what' | 'is-it-possible' | 'other' = 'other';
  
  for (const { pattern, type } of factualQuestionPatterns) {
    if (pattern.test(lower)) {
      detectedType = type;
      break;
    }
  }

  const ambiguousTerms = ['hombre', 'mujer', 'persona', 'gente', 'alguien', 'uno', 'una'];
  const ambiguityCount = ambiguousTerms.filter(term => lower.includes(term)).length;
  const ambiguityLevel: 'low' | 'medium' | 'high' = ambiguityCount > 2 ? 'high' : ambiguityCount > 0 ? 'medium' : 'low';

  return {
    isFactualQuestion: true,
    questionType: detectedType,
    factualityScore: 75,
    ambiguityLevel,
    conceptualVerifiable: ['is-it-possible', 'yes-no', 'how', 'why'].includes(detectedType)
  };
}
