import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { detectInputKind, describeInput } from '../../../src/analysis/engines/inputClassifier';
import { detectTopic } from '../../../src/analysis/engines/topicClassifier';
import { extractEvidenceSignals } from '../../../src/analysis/engines/evidenceExtractor';
import { buildRiskItems } from '../../../src/analysis/engines/riskEngine';
import { buildRecommendations } from '../../../src/analysis/engines/recommendationEngine';
import { buildScoreExplanation } from '../../../src/analysis/engines/scoreExplanationEngine';
import { verifyFactualContent } from '../../../src/analysis/engines/externalVerificationEngine';
import { runCoreReasoning } from '../../../src/analysis/engines/coreReasoningEngine';
import { runUniversalClaimReasoning } from '../../../src/analysis/engines/universalClaimReasoningEngine';
import { calculateDomainWeightedScore } from '../../../src/analysis/engines/domainWeightedScoringEngine';

export const runtime = 'nodejs';

type CategoryScore = {
  name: string;
  score: number;
  explanation: string;
};

type Extraction = {
  ok: boolean;
  text: string;
  pages: number | null;
  chars: number;
  note: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function detectDomain(text: string, inputKind: string) {
  const all = text.toLowerCase();
  const topic = detectTopic(text, inputKind);

  if (/tesis|monograf|ensayo|universidad|facultad|colegio|alumno|bibliograf|referencias|docente|hecho con ia|hecha con ia|chatgpt/.test(all)) {
    return {
      icon: '🎓',
      label: 'Trabajo académico / posible IA',
      focus: 'Originalidad, fuentes, trazabilidad, estilo y verificación prudente.',
      modules: ['IA académica', 'Originalidad', 'Plagio estimativo', 'Bibliografía', 'Coherencia']
    };
  }

  if (/pr[eé]stamo|cr[eé]dito|cuota|cft|tea|tna|inter[eé]s|financiaci[oó]n|comisi[oó]n|seguro|\$\s?\d/.test(all)) {
    return {
      icon: '💰',
      label: 'Oferta financiera / préstamo',
      focus: 'Costo total, tasas, cargos ocultos y condiciones.',
      modules: ['Costo total', 'CFT', 'Tasas', 'Cargos ocultos', 'Condiciones']
    };
  }

  if (/contrato|cl[aá]usula|jurisdicci[oó]n|penalidad|rescisi[oó]n|incumplimiento|obligaci[oó]n|t[eé]rminos y condiciones/.test(all)) {
    return {
      icon: '📄',
      label: 'Contrato / documento legal',
      focus: 'Cláusulas, obligaciones, penalidades y vacíos.',
      modules: ['Cláusulas', 'Obligaciones', 'Penalidades', 'Jurisdicción', 'Vacíos']
    };
  }

  if (/salud|m[eé]dico|medicamento|tratamiento|cura|c[aá]ncer|dolor|s[ií]ntoma|suplemento|dosis|paciente|diagn[oó]stico/.test(all)) {
    return {
      icon: '🩺',
      label: 'Contenido de salud',
      focus: 'Evidencia médica, riesgos, fuentes y advertencias.',
      modules: ['Evidencia médica', 'Riesgo sanitario', 'Fuentes científicas', 'Advertencias']
    };
  }

  if (/(salario real|inflaci[oó]n|empleo registrado|sipa|convenios colectivos|remuneraciones|secretar[ií]a de trabajo|poder adquisitivo|nota period[ií]stica|informe econ[oó]mico|econom[ií]a|empleo formal|remuneraci[oó]n real)/.test(all)) {
    return {
      icon: '📈',
      label: 'Economía / información pública / nota periodística',
      focus: 'Fuente, contexto económico, fechas y trazabilidad.',
      modules: ['Fuente original', 'Contexto económico', 'Fecha', 'Trazabilidad']
    };
  }

  if (/noticia|diario|periodista|comunicado|prensa|redacci[oó]n|exclusivo|último momento|nota/.test(all)) {
    return {
      icon: '📰',
      label: 'Nota / contenido periodístico',
      focus: 'Fuente, autor, fecha, citas y trazabilidad.',
      modules: ['Fuente original', 'Autor', 'Fecha', 'Citas', 'Trazabilidad']
    };
  }

  return {
    icon: inputKind === 'PDF' ? '📄' : '🔎',
    label: topic.label,
    focus: topic.hint,
    modules: topic.modules
  };
}

async function extractPdfText(file: File): Promise<Extraction> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParseModule = (await import('pdf-parse')) as any;
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(buffer);
    const text = String(data?.text || '').replace(/\s+\n/g, '\n').trim();

    return {
      ok: text.length > 0,
      text,
      pages: Number(data?.numpages || 0) || null,
      chars: text.length,
      note: text.length > 0 ? 'PDF leído correctamente.' : 'PDF recibido, pero no se pudo extraer texto. Puede requerir OCR.'
    };
  } catch {
    return {
      ok: false,
      text: '',
      pages: null,
      chars: 0,
      note: 'PDF recibido, pero falló la extracción de texto. Puede requerir OCR.'
    };
  }
}

async function extractWebText(url: string) {
  try {
    if (!/^https?:\/\//i.test(url)) {
      return { text: '', note: 'URL inválida o incompleta.' };
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChamuyoCheckBot/1.0' },
      cache: 'no-store'
    });

    const html = await res.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      text: `${title ? `Título: ${title}\n` : ''}${cleaned}`.slice(0, 12000),
      note: cleaned.length > 80 ? 'Texto web extraído automáticamente.' : 'No se pudo extraer suficiente texto de la página.'
    };
  } catch {
    return { text: '', note: 'No se pudo leer la página web.' };
  }
}

function youtubeNote(url: string) {
  const id =
    url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)?.[1] ||
    url.match(/[?&]v=([a-zA-Z0-9_-]+)/)?.[1] ||
    url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/)?.[1] ||
    '';

  return id
    ? `Video de YouTube identificado. ID: ${id}. Falta conectar transcripción automática.`
    : 'URL de YouTube recibida, pero no se pudo identificar el video.';
}

function buildLocalAnalysis(text: string, inputKind: string, fileName: string, extraction: Extraction | null) {
  const domain = detectDomain(text, inputKind);
  const topic = detectTopic(text, inputKind);
  const evidence = extractEvidenceSignals(text);
  const all = `${text} ${fileName}`.toLowerCase();

  const missing = !/(fuente|estudio|metodolog|contrato|bases|condiciones|cft|tea|tna|bibliograf|reglamento)/i.test(all);
  const promise = /(garantiz|asegur|sin esfuerzo|millonari|duplic|triplic|100%|riesgo cero|aprobaci[oó]n inmediata)/i.test(all);
  const financial = /(pr[eé]stamo|cuota|cft|tea|tna|cr[eé]dito|financiaci[oó]n|inter[eé]s|\$)/i.test(all);
  const pyramid = /(referido|referidos|red|multinivel|ingresos pasivos|rentabilidad garantizada|ponzi|pir[aá]mid|invitar)/i.test(all);
  const academic = /(trabajo acad[eé]mico|facultad|colegio|alumno|ensayo|monograf|tesis|bibliograf|docente|hecha con ia|hecho con ia|chatgpt)/i.test(all);
  const health = /(medicamento|salud|m[eé]dico|tratamiento|suplemento|dieta|cura|dolor|c[aá]ncer)/i.test(all);

  const riskScore = clamp(
    18 +
      (missing ? 18 : 0) +
      (promise ? 22 : 0) +
      (financial ? 18 : 0) +
      (pyramid ? 25 : 0) +
      (academic ? 14 : 0) +
      (health ? 16 : 0)
  );

  // Universal claim reasoning: runs FIRST — catches scientific impossibilities,
  // extinct species alive, and extraordinary claim + money patterns
  const universalReasoning = runUniversalClaimReasoning(text);

  // Core reasoning: run before factual verification, can force score to 100
  const reasoning = runCoreReasoning(text);

  // Verificación factual: detectar preguntas y ajustar score
  const verification = verifyFactualContent(text);

  let finalScore: number;
  if (universalReasoning.forceScore !== null) {
    finalScore = universalReasoning.forceScore;
  } else if (reasoning.forcedScore !== null) {
    finalScore = reasoning.forcedScore;
  } else if (reasoning.scoreBoost > 0) {
    finalScore = clamp(riskScore + reasoning.scoreBoost);
  } else {
    finalScore = clamp(riskScore + verification.scoreAdjustment);
  }

  const categoryScoresWithoutLevel: CategoryScore[] = [
    {
      name: 'Evidencia faltante',
      score: missing ? 82 : 15,
      explanation: 'Sube cuando hay afirmaciones o cifras sin fuente verificable.'
    },
    {
      name: 'Transparencia',
      score: financial ? 75 : missing ? 64 : 18,
      explanation: 'Evalúa claridad de condiciones, costos, límites, responsables y metodología.'
    },
    {
      name: 'Manipulación emocional',
      score: promise ? 65 : 12,
      explanation: 'Detecta urgencia, promesas extraordinarias o lenguaje manipulador.'
    },
    {
      name: 'Riesgo financiero',
      score: financial ? 88 : 0,
      explanation: financial ? 'Faltan CFT, TEA, TNA, IVA, comisiones, seguros y costo total.' : 'No se detectó oferta financiera principal.'
    },
    {
      name: 'Riesgo piramidal/Ponzi',
      score: pyramid ? 86 : 0,
      explanation: pyramid ? 'Hay señales de referidos, ingresos pasivos o rentabilidad prometida.' : 'No se detectaron señales piramidales fuertes.'
    },
    {
      name: 'Posible IA académica',
      score: academic ? 72 : 0,
      explanation: academic ? 'Estimación no concluyente: revisar estilo, fuentes, borradores y defensa oral.' : 'No se activó como eje principal.'
    }
  ];

  // Domain-aware weighted scoring: only count applicable dimensions
  const forceScoreForWeighting = universalReasoning.forceScore ?? reasoning.forcedScore ?? null;
  const weightedResult = calculateDomainWeightedScore(
    categoryScoresWithoutLevel,
    text,
    topic.key,
    inputKind,
    forceScoreForWeighting,
    financial,
    pyramid
  );

  // Use weighted score if no forced score exists
  if (forceScoreForWeighting === null) {
    finalScore = weightedResult.finalScore;
  }

  const categoryScores: CategoryScore[] = [
    {
      name: 'Nivel de chamuyo',
      score: finalScore,
      explanation: 'Nivel de señales de manipulación, falta de evidencia o contenido dudoso.'
    },
    ...categoryScoresWithoutLevel
  ];

  const inputText = describeInput(inputKind);
  const shortText = inputKind === 'Texto' && text.trim().length < 220;

  return {
    documentIcon: domain.icon,
    documentType: domain.label,
    documentFocus: domain.focus,
    extractionStatus: inputKind === 'Texto' ? 'Se analizará el texto ingresado directamente.' : extraction?.note || 'Contenido recibido.',
    extractedChars: extraction?.chars || text.length,
    extractedPreview: text.slice(0, 1200),
    score: finalScore,
    risk: finalScore > 80 ? 'Chamuyo extremo' : finalScore > 60 ? 'Alto chamuyo' : finalScore > 40 ? 'Requiere verificación' : 'Bajo chamuyo',
    confidence: extraction?.chars ? 'Media/Alta' : 'Media',
    detectedTheme: domain.label,
    detectedInput: inputKind,
    centralQuestion: academic ? '¿Puedo decidir sin ver el costo total y el contrato?' : '¿Puedo confiar en esto sin pedir más evidencia?',
    summary: topic.summary,
    prudentConclusion: topic.prudentConclusion,
    verdict: topic.verdict,
    categoryScores,
    modules: categoryScores.filter((c) => c.score > 0).slice(0, 8),
    flaggedPhrases: promise ? [{ phrase: text.slice(0, 220), problem: 'Frase o estructura que requiere respaldo, fuente o contexto.', severity: 'Media' }] : [],
    issues: [
      inputKind === 'Texto' ? 'Se analizará el texto ingresado directamente; no requiere extracción de archivo.' : extraction?.chars ? `El análisis usa texto extraído del ${inputText.noun}.` : `No se pudo leer completo ${inputText.phrase}; análisis preliminar.`,
      academic ? 'Posible análisis académico: no prueba uso de IA; requiere verificación docente.' : '',
      promise ? 'Promesa o resultado atractivo sin margen claro de incertidumbre.' : '',
      missing ? (shortText ? 'La afirmación requiere verificación externa y contexto adicional.' : 'Faltan fuentes o metodología verificable.') : '',
      financial ? 'Faltan costos financieros completos.' : '',
      pyramid ? 'Posible estructura basada en referidos o rentabilidad prometida.' : '',
      ...reasoning.risks,
      ...universalReasoning.whyImpossible
    ].filter(Boolean),
    questions: [
      '¿Qué fuente independiente respalda la afirmación?',
      '¿Quién es el autor y cuál es la fecha?',
      '¿Qué evidencia verificable aparece dentro del contenido?',
      academic ? '¿El autor puede defender oralmente el trabajo y mostrar borradores?' : '',
      financial ? '¿Cuál es el CFT efectivo anual con IVA incluido?' : ''
    ].filter(Boolean),
    missingInformation: [
      shortText ? 'verificación externa y contexto adicional' : 'fuentes verificables',
      'autor, fecha y origen del contenido',
      'metodología o base del dato',
      academic ? 'borradores, historial de edición, fuentes y defensa oral' : '',
      financial ? 'CFT, TEA, TNA, IVA, seguros, comisiones y mora' : ''
    ].filter(Boolean),
    worstCase: academic ? 'Acusar erróneamente a un alumno sin evidencia concluyente.' : 'Tomar una decisión impulsiva con información incompleta.',
    improved: academic ? 'Pedir al alumno una breve defensa oral, fuentes usadas, borradores y explicación del proceso.' : 'Explicar alcance, límites, requisitos, evidencia, costos, riesgos y condiciones verificables.',
    evidenceFound: [
      ...evidence.signals,
      `Elementos verificables detectados: revisar nombres, fechas, cifras y fuentes dentro de ${inputText.phrase}.`,
      missing ? 'Afirmaciones que requieren fuente o metodología adicional.' : 'El contenido incluye algunos elementos que pueden contrastarse.',
      academic ? 'Señales académicas: revisar bibliografía, coherencia del estilo y defensa oral.' : 'No se activó como eje académico principal.',
      financial ? 'Señales financieras: verificar CFT, TEA, TNA, comisiones, seguros e IVA.' : 'No se activó como oferta financiera principal.'
    ].filter(Boolean),
    scoreExplanation: buildScoreExplanation(text, topic.key, inputKind, finalScore, [
      missing ? 'Faltan fuentes o metodología verificable.' : '',
      promise ? 'Hay promesas fuertes o lenguaje absoluto.' : '',
      financial ? 'Faltan costos financieros completos.' : '',
      academic ? 'Falta trazabilidad o contexto metodológico.' : ''
    ].filter(Boolean), verification, reasoning, universalReasoning, weightedResult),
    refutationPoints: [
      'Verificar autor, fecha, fuente original y trazabilidad del contenido.',
      'Pedir respaldo para las afirmaciones centrales.',
      'Distinguir hechos observables de opiniones o inferencias.',
      financial ? 'Exigir contrato completo y costo financiero total.' : '',
      academic ? 'Pedir borradores, fuentes y defensa oral antes de concluir uso de IA.' : ''
    ].filter(Boolean),
    improvementPlan: [...reasoning.recommendations, ...buildRecommendations(text, topic.key, inputKind), ...buildRiskItems(text, inputKind)].filter(Boolean).slice(0, 8),
    topic: topic.key,
    topicLabel: topic.label,
    topicHint: topic.hint
  };
}

function normalizeAI(raw: any, fallback: ReturnType<typeof buildLocalAnalysis>) {
  return {
    ...fallback,
    ...raw,
    documentIcon: String(raw?.documentIcon || fallback.documentIcon),
    documentType: String(raw?.documentType || fallback.documentType),
    documentFocus: String(raw?.documentFocus || fallback.documentFocus),
    score: clamp(Number(raw?.score ?? fallback.score)),
    categoryScores: Array.isArray(raw?.categoryScores) ? raw.categoryScores : fallback.categoryScores,
    modules: Array.isArray(raw?.modules) ? raw.modules : fallback.modules,
    topic: String(raw?.topic || fallback.topic),
    topicLabel: String(raw?.topicLabel || fallback.topicLabel),
    topicHint: String(raw?.topicHint || fallback.topicHint)
  };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const userText = String(form.get('text') || '').trim();
    const url = String(form.get('url') || '').trim();
    const file = form.get('file');

    let fileName = '';
    let fileType = '';
    let extracted = '';
    let extraction: Extraction | null = null;

    if (file instanceof File && file.size > 0) {
      fileName = file.name || '';
      fileType = file.type || '';

      if (/\.pdf$/i.test(fileName) || /pdf/i.test(fileType)) {
        extraction = await extractPdfText(file);
        extracted = extraction.text || `PDF recibido: ${fileName}. ${extraction.note}`;
      } else if (/image\//i.test(fileType) || /\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
        extraction = {
          ok: false,
          text: '',
          pages: null,
          chars: 0,
          note: `Imagen recibida: ${fileName}. OCR real queda para próxima versión.`
        };
        extracted = extraction.note;
      } else {
        extraction = {
          ok: false,
          text: '',
          pages: null,
          chars: 0,
          note: `Documento recibido: ${fileName}. Extracción profunda no disponible.`
        };
        extracted = extraction.note;
      }
    }

    let webText = '';
    if (url) {
      if (/youtu\.be|youtube\.com/i.test(url)) {
        webText = youtubeNote(url);
      } else {
        const web = await extractWebText(url);
        webText = web.text || web.note;
      }
    }

    const inputKind = detectInputKind(fileName, url, fileType);
    const fullText = [extracted, userText ? `PREGUNTA O CONTEXTO DEL USUARIO:\n${userText}` : '', webText]
      .filter(Boolean)
      .join('\n\n');

    if (fullText.length < 20) {
      return NextResponse.json({ error: 'Ingresá texto, una URL o un documento si querés analizar contenido.' }, { status: 400 });
    }

    const fallback = buildLocalAnalysis(fullText, inputKind, fileName, extraction);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(fallback);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Actuá como ChamuyoCheck, auditor documental prudente. Priorizá el contenido extraído del documento o del archivo por encima de la pregunta del usuario. Identificá el tipo de documento/contenido antes del score. Si el PDF no tiene texto extraíble, indicá que necesita OCR. Si el usuario pregunta si fue hecho con IA, respondé como estimación no concluyente: nunca acuses ni afirmes uso de IA/plagio. Respondé SOLO JSON con estas claves: documentIcon, documentType, documentFocus, extractionStatus, extractedChars, extractedPreview, score, risk, confidence, detectedTheme, detectedInput, centralQuestion, summary, prudentConclusion, verdict, categoryScores, modules, flaggedPhrases, issues, questions, missingInformation, worstCase, improved, evidenceFound, scoreExplanation, refutationPoints, improvementPlan, topic, topicLabel, topicHint.

Contenido:
${fullText.slice(0, 18000)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Respondés solo JSON válido y prudente. Nunca afirmes mentira, estafa, plagio, IA o ilegalidad como certeza.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return NextResponse.json(normalizeAI(parsed, fallback));
  } catch (error) {
    console.error('Route.ts error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'No se pudo analizar el contenido.' }, { status: 500 });
  }
}
