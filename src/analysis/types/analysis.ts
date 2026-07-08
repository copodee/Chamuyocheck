export type RiskLevel = 'Bajo' | 'Medio' | 'Alto';

export type ScoreCategory = {
  name: string;
  score: number;
  explanation: string;
};

export type AnalysisResult = {
  documentIcon: string;
  documentType: string;
  documentFocus: string;
  extractionStatus: string;
  extractedChars: number;
  extractedPreview?: string;
  score: number;
  risk: RiskLevel | string;
  confidence: string;
  detectedTheme: string;
  detectedInput: string;
  centralQuestion: string;
  summary: string;
  prudentConclusion: string;
  verdict: string;
  categoryScores: ScoreCategory[];
  modules: ScoreCategory[];
  flaggedPhrases: Array<{ phrase: string; problem: string; severity: string }>;
  issues: string[];
  questions: string[];
  missingInformation: string[];
  worstCase: string;
  improved: string;
  evidenceFound?: string[];
  scoreExplanation?: string[];
  refutationPoints?: string[];
  improvementPlan?: string[];
  legalSafeguard: string;
};
