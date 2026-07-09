import { detectInputKind, describeInput, getInputTypeLabel } from './inputClassifier';
import { detectTopic } from './topicClassifier';
import { extractEvidenceSignals } from './evidenceExtractor';
import { buildRiskItems } from './riskEngine';
import { buildRecommendations } from './recommendationEngine';
import { buildScoreExplanation } from './scoreExplanationEngine';
import { verifyFactualContent } from './externalVerificationEngine';
import { detectReproductiveBiologyQuestion } from './healthBiologyEngine';

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
  const verification = verifyFactualContent(text);
  const reproductiveBio = detectReproductiveBiologyQuestion(text);

  let strengths = buildStrengths(text, evidence);
  let weaknesses = buildWeaknesses(text, evidence);
  let risks = buildRiskItems(text, detectedInput);
  let baseScore = 58;
  let verifyQuestions = [
    '¿Cuál es la fuente original y la fecha de publicación?',
    '¿Qué evidencia verificable respalda la afirmación central?',
    '¿Se expone la metodología o el criterio de análisis?',
    '¿Qué contexto o límite de alcance se omite?'
  ];

  // Si es una pregunta de reproducción factual
  if (verification.domain === 'health-biology' && reproductiveBio.isReproductiveBiology) {
    baseScore = 85;
    
    strengths = [
      'Se trata de una pregunta factual con base en biología humana.',
      'La respuesta se apoya en conocimiento médico verificable.',
      'Hay claridad sobre los elementos básicos de la reproducción.'
    ];

    weaknesses = [
      `${reproductiveBio.ambiguity}`,
      'Falta contexto específico sobre la situación personal si aplica.'
    ];

    risks = [
      ...reproductiveBio.riskFactors,
      'Si es pregunta personal, requiere asesoramiento médico profesional.'
    ];

    verifyQuestions = [
      '¿Se refiere a un varón cisgénero, persona trans o intersex?',
      '¿Es una pregunta teórica o sobre una situación personal?',
      '¿Qué aspectos específicos de la reproducción busca entender?'
    ];
  }

  const recommendations = verification.domain === 'health-biology' 
    ? reproductiveBio.verifiedClaims.slice(0, 4) 
    : buildRecommendations(text, topic.key, detectedInput);
  
  const scoreExplanation = buildScoreExplanation(text, topic.key, detectedInput, baseScore, weaknesses, verification);

  const executiveSummary = verification.domain === 'health-biology' && reproductiveBio.isReproductiveBiology
    ? `${topic.summary} ${reproductiveBio.contextualAnswer}`
    : `${topic.summary} El análisis prioriza ${inputMeta.noun} y se centra en veracidad, contexto y trazabilidad.`;

  return {
    executiveSummary,
    strengths,
    weaknesses,
    risks,
    verifyQuestions,
    recommendations,
    scoreExplanation,
    specialistsUsed: ['Clasificador de input', 'Clasificador temático', 'Extractor de evidencias', 'Motor de riesgos', 'Motor de recomendaciones', ...(verification.isFactualQuestion ? ['Motor de preguntas factuales'] : [])],
    inputTypeLabel: verification.domain === 'health-biology' ? 'Pregunta factual' : inputLabel,
    topicLabel: topic.label
  };
}
