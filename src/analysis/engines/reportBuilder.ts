import { detectInputKind, describeInput, getInputTypeLabel } from './inputClassifier';
import { detectTopic } from './topicClassifier';
import { extractEvidenceSignals } from './evidenceExtractor';
import { buildRiskItems } from './riskEngine';
import { buildRecommendations } from './recommendationEngine';
import { buildScoreExplanation } from './scoreExplanationEngine';

export type ReportSection = {
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  verifyQuestions: string[];
  recommendations: string[];
  scoreExplanation: string[];
  specialistsUsed: string[];
  inputTypeLabel: string;
  topicLabel: string;
};

function buildStrengths(text: string, evidence: ReturnType<typeof extractEvidenceSignals>) {
  const strengths: string[] = [];

  if (evidence.urls > 0) strengths.push('Se incluyen enlaces o referencias visibles.');
  if (evidence.money > 0) strengths.push('Se detectan montos o cifras concretas.');
  if (evidence.percents > 0) strengths.push('Se incluyen porcentajes o indicadores cuantitativos.');
  if (evidence.dates > 0) strengths.push('Se identifican fechas o períodos temporales.');
  if (evidence.strongClaims > 0) strengths.push('Se observan afirmaciones concretas que pueden contrastarse.');

  if (!strengths.length) {
    strengths.push('El contenido presenta un marco general que conviene contrastar con fuentes externas.');
  }

  return strengths.slice(0, 4);
}

function buildWeaknesses(text: string, evidence: ReturnType<typeof extractEvidenceSignals>) {
  const weaknesses: string[] = [];

  if (evidence.urls === 0) weaknesses.push('No se observa un enlace claro a la fuente original.');
  if (evidence.dates === 0) weaknesses.push('No se identifica una fecha o periodo claro.');
  if (!/metodolog|m[eé]todo|muestra|encuesta|criterio|procedimiento/i.test(text)) {
    weaknesses.push('No se observa una metodología o criterio explícito.');
  }
  if (!/fuente|fuentes|seg[uú]n|informe|comunicado|nota|autor/i.test(text)) {
    weaknesses.push('No se identifica claramente la fuente o el autor del contenido.');
  }

  if (!weaknesses.length) {
    weaknesses.push('No se detectan fallas evidentes, pero la trazabilidad sigue siendo limitada.');
  }

  return weaknesses.slice(0, 4);
}

export function buildAnalysisReport(text: string, inputKind: string, fileName: string, extraction: { chars?: number } | null): ReportSection {
  const detectedInput = detectInputKind(fileName, '', inputKind);
  const topic = detectTopic(text, detectedInput);
  const evidence = extractEvidenceSignals(text);
  const inputLabel = getInputTypeLabel(detectedInput);
  const inputMeta = describeInput(detectedInput);

  const strengths = buildStrengths(text, evidence);
  const weaknesses = buildWeaknesses(text, evidence);
  const risks = buildRiskItems(text, detectedInput);
  const verifyQuestions = [
    '¿Cuál es la fuente original y la fecha de publicación?',
    '¿Qué evidencia verificable respalda la afirmación central?',
    '¿Se expone la metodología o el criterio de análisis?',
    '¿Qué contexto o límite de alcance se omite?'
  ];
  const recommendations = buildRecommendations(text, topic.key, detectedInput);
  const scoreExplanation = buildScoreExplanation(text, topic.key, detectedInput, 58, weaknesses);

  const executiveSummary = `${topic.summary} El análisis prioriza ${inputMeta.noun} y se centra en veracidad, contexto y trazabilidad.`;

  return {
    executiveSummary,
    strengths,
    weaknesses,
    risks,
    verifyQuestions,
    recommendations,
    scoreExplanation,
    specialistsUsed: ['Clasificador de input', 'Clasificador temático', 'Extractor de evidencias', 'Motor de riesgos', 'Motor de recomendaciones'],
    inputTypeLabel: inputLabel,
    topicLabel: topic.label
  };
}
