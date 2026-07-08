
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

type Severity = 'Baja' | 'Media' | 'Alta';

type Category = {
  name: string;
  score: number;
  explanation: string;
};

type FlaggedPhrase = {
  phrase: string;
  problem: string;
  severity: Severity;
};

type FinancialMath = {
  detected: boolean;
  amount?: number | null;
  installment?: number | null;
  months?: number | null;
  explicitRate?: string | null;
  totalPaid?: number | null;
  hiddenCost?: number | null;
  hiddenCostPercent?: number | null;
  monthlyImpliedRate?: number | null;
  annualEffectiveRate?: number | null;
  missingData: string[];
  summary: string;
};

type Analysis = {
  score: number;
  risk: string;
  confidence: string;
  detectedType: string;
  centralQuestion: string;
  summary: string;
  prudentConclusion: string;
  verdict: string;
  categoryScores: Category[];
  specialistCommittee: Category[];
  flaggedPhrases: FlaggedPhrase[];
  issues: string[];
  questions: string[];
  missingInformation: string[];
  worstCase: string;
  improved: string;
  financial: FinancialMath;
  pyramidRisk: Category;
  academicAI: Category;
  plagiarism: Category;
  sourceComparison: Category;
  legalSafeguard: string;
};

function clamp(n: any, fallback = 50) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function parseMoney(s: string): number | null {
  const matches = s.match(/\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]+)(?:,[0-9]{1,2})?/g);
  if (!matches || !matches.length) return null;
  const nums = matches
    .map(m => Number(m.replace(/[^\d]/g, '')))
    .filter(n => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return Math.max(...nums);
}

function extractFinancial(text: string): FinancialMath {
  const lower = text.toLowerCase();
  const financialWords = /(pr[eé]stamo|cuota|cuotas|tna|tea|cft|financiaci[oó]n|inter[eé]s|mora|comisi[oó]n|seguro|gasto|cr[eé]dito|anticipo|capital|ars|\$)/i.test(text);
  const moneyMatches = text.match(/\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]+)(?:,[0-9]{1,2})?/g) || [];
  const nums = moneyMatches.map(m => Number(m.replace(/[^\d]/g, ''))).filter(n => Number.isFinite(n) && n > 0);
  const monthsMatch = lower.match(/(\d{1,3})\s*(cuotas|meses|mensuales|pagos)/);
  const months = monthsMatch ? Number(monthsMatch[1]) : null;

  let amount: number | null = null;
  let installment: number | null = null;

  const loanMatch = lower.match(/(?:pr[eé]stamo|cr[eé]dito|monto|capital|te damos|recib[ií]s|recibes)[^\d$]{0,40}\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]+)/);
  if (loanMatch) amount = Number(loanMatch[1].replace(/[^\d]/g, ''));

  const installmentMatch = lower.match(/(?:cuota|cuotas|pagos?)[^\d$]{0,40}\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]+)/);
  if (installmentMatch) installment = Number(installmentMatch[1].replace(/[^\d]/g, ''));

  if (!amount && nums.length >= 2) amount = Math.max(...nums);
  if (!installment && nums.length >= 2) installment = Math.min(...nums.filter(n => n !== amount));

  const totalPaid = installment && months ? installment * months : null;
  const hiddenCost = amount && totalPaid ? totalPaid - amount : null;
  const hiddenCostPercent = amount && hiddenCost ? (hiddenCost / amount) * 100 : null;

  let monthlyImpliedRate: number | null = null;
  let annualEffectiveRate: number | null = null;

  if (amount && installment && months && installment * months > amount) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 80; i++) {
      const r = (lo + hi) / 2;
      const pv = installment * (1 - Math.pow(1 + r, -months)) / r;
      if (pv > amount) lo = r;
      else hi = r;
    }
    monthlyImpliedRate = ((lo + hi) / 2) * 100;
    annualEffectiveRate = (Math.pow(1 + ((lo + hi) / 2), 12) - 1) * 100;
  }

  const missingData = [
    !/cft/i.test(text) ? 'CFT' : '',
    !/tea/i.test(text) ? 'TEA' : '',
    !/tna/i.test(text) ? 'TNA' : '',
    !/iva/i.test(text) ? 'IVA' : '',
    !/comisi/i.test(text) ? 'comisiones' : '',
    !/seguro/i.test(text) ? 'seguros' : '',
    !/gasto/i.test(text) ? 'gastos administrativos' : '',
    !/mora|punitorio/i.test(text) ? 'mora y punitorios' : '',
    !/cancelaci[oó]n anticipada/i.test(text) ? 'cancelación anticipada' : '',
    !/monto neto|acreditado/i.test(text) ? 'monto neto efectivamente acreditado' : ''
  ].filter(Boolean);

  return {
    detected: financialWords,
    amount,
    installment,
    months,
    explicitRate: (text.match(/(CFT|TEA|TNA)[^.,;\n]*/i)?.[0] || null),
    totalPaid,
    hiddenCost,
    hiddenCostPercent,
    monthlyImpliedRate,
    annualEffectiveRate,
    missingData,
    summary: financialWords
      ? totalPaid && amount
        ? `Con los datos visibles, el total a pagar sería aproximadamente $${Math.round(totalPaid).toLocaleString('es-AR')}. Eso implica $${Math.round((hiddenCost || 0)).toLocaleString('es-AR')} por encima del capital informado.`
        : 'El texto activa el módulo financiero: para decidir hacen falta costo total, CFT, cargos, seguros, IVA, mora y condiciones completas.'
      : 'No se detectó una oferta financiera principal.'
  };
}

function localHeuristics(text: string): Analysis {
  const lower = text.toLowerCase();
  const financial = extractFinancial(text);
  const promise = /(garantiz|asegur|sin esfuerzo|millonari|duplic|triplic|100%|riesgo cero|gan[aá]s|ganar[aá]s|resultado)/i.test(text);
  const urgency = /(hoy|ahora|última oportunidad|ultimos cupos|cupos limitados|inmediata|ya|no te quedes afuera)/i.test(text);
  const evidenceMissing = !/(fuente|estudio|metodolog|contrato|bases|condiciones|cft|tea|tna|garantía escrita|reglamento|casos comprobables)/i.test(text);
  const pyramid = /(referido|referidos|equipo|red|multinivel|pasivos|ingresos pasivos|invitar|sponsor|mentor|downline|rentabilidad garantizada|sin vender|ponzi|pir[aá]mid)/i.test(text);
  const academic = /(trabajo pr[aá]ctico|ensayo|monograf[ií]a|tesis|facultad|colegio|alumno|docente|bibliograf[ií]a|introducci[oó]n|conclusi[oó]n)/i.test(text);
  const aiSignals = /(en conclusi[oó]n|cabe destacar|es importante mencionar|en resumen|este trabajo tiene como objetivo|a lo largo de este|por otro lado|en la actualidad)/i.test(text);
  const hasUrl = /https?:\/\/|www\./i.test(text);
  const hasYoutube = /youtube\.com|youtu\.be/i.test(text);
  const imageLike = /\.(png|jpg|jpeg|webp)|whatsapp|instagram|captura/i.test(text);

  let baseRisk = 25;
  if (promise) baseRisk += 25;
  if (evidenceMissing) baseRisk += 18;
  if (urgency) baseRisk += 10;
  if (financial.detected) baseRisk += 18;
  if (pyramid) baseRisk += 28;
  if (academic && aiSignals) baseRisk += 8;

  const score = clamp(baseRisk, 42);
  const credibility = clamp(100 - score + (evidenceMissing ? -12 : 8), 48);
  const transparency = clamp(100 - (evidenceMissing ? 45 : 15) - (financial.detected && financial.missingData.length > 5 ? 22 : 0), 50);
  const evidence = clamp(evidenceMissing ? 78 : 34, 50);
  const manipulation = clamp((promise ? 25 : 5) + (urgency ? 20 : 0), 15);
  const financialRisk = financial.detected ? clamp(55 + (financial.missingData.length * 4) + (financial.hiddenCostPercent ? Math.min(25, financial.hiddenCostPercent / 10) : 0), 70) : 0;
  const pyramidScore = pyramid ? 82 : 0;
  const academicScore = academic ? clamp((aiSignals ? 60 : 32) + (evidenceMissing ? 12 : 0), 40) : 0;

  const missingInformation = [
    evidenceMissing ? 'fuentes verificables' : '',
    evidenceMissing ? 'metodología o base del dato' : '',
    promise ? 'probabilidad real del resultado' : '',
    urgency ? 'tiempo real para decidir' : '',
    'condiciones completas',
    'alternativas razonables',
    financial.detected ? 'CFT / TEA / TNA / IVA / comisiones / seguros / mora' : '',
    pyramid ? 'modelo de ingresos, obligación de referidos y origen real de la rentabilidad' : '',
    academic ? 'borradores, proceso de trabajo, bibliografía y defensa oral del alumno' : ''
  ].filter(Boolean);

  const questions = [
    '¿Qué fuente independiente respalda la afirmación?',
    '¿Cuál es la muestra, fecha o metodología?',
    '¿Qué condiciones deberían cumplirse?',
    '¿Qué cambia si espero y comparo?',
    '¿La emoción usada está reemplazando evidencia?',
    promise ? '¿Qué porcentaje de usuarios logra realmente ese resultado?' : '',
    financial.detected ? '¿Cuál es el CFT efectivo anual con IVA incluido?' : '',
    financial.detected ? '¿Qué comisiones, seguros, gastos, mora y cargos no están incluidos en la cuota?' : '',
    pyramid ? '¿El ingreso depende de vender un producto real o de sumar referidos?' : '',
    academic ? '¿El alumno puede explicar oralmente las ideas, fuentes y decisiones de escritura?' : ''
  ].filter(Boolean);

  const flagged: FlaggedPhrase[] = [];
  if (promise) flagged.push({ phrase: text.slice(0, 180), problem: 'Promesa fuerte o resultado presentado con poca incertidumbre visible.', severity: 'Alta' });
  if (financial.detected) flagged.push({ phrase: text.slice(0, 180), problem: 'Oferta financiera que debe contrastarse contra CFT, total a pagar, seguros, comisiones e impuestos.', severity: 'Alta' });
  if (pyramid) flagged.push({ phrase: text.slice(0, 180), problem: 'Señales compatibles con esquema de referidos, ingresos pasivos o estructura piramidal. Requiere verificación adicional.', severity: 'Alta' });
  if (academic && aiSignals) flagged.push({ phrase: text.slice(0, 180), problem: 'Estilo posiblemente genérico o asistido por IA. No prueba autoría: requiere evaluación docente.', severity: 'Media' });
  if (hasUrl) flagged.push({ phrase: text.match(/https?:\/\/\S+|www\.\S+/i)?.[0] || 'enlace detectado', problem: 'Se detectó un enlace. Esta versión analiza el texto visible y la URL pegada; no reemplaza una verificación externa completa del sitio.', severity: 'Media' });
  if (hasYoutube) flagged.push({ phrase: 'Video de YouTube detectado', problem: 'Para análisis profundo se recomienda pegar transcripción, descripción o claims del video.', severity: 'Media' });
  if (imageLike) flagged.push({ phrase: 'Imagen/captura mencionada', problem: 'Para capturas, el sistema debe analizar el texto extraído o ingresado manualmente si no hay OCR integrado.', severity: 'Media' });

  return {
    score,
    risk: score >= 75 ? 'Alto' : score >= 45 ? 'Medio' : 'Bajo',
    confidence: evidenceMissing ? 'Media' : 'Alta',
    detectedType: financial.detected ? 'Oferta financiera / préstamo' : pyramid ? 'Inversión o referidos' : academic ? 'Texto académico' : hasYoutube ? 'Video / contenido externo' : hasUrl ? 'Página web / enlace' : 'Texto comercial / argumento',
    centralQuestion: financial.detected ? '¿Puedo decidir por la cuota sin ver el costo total?' : academic ? '¿Hay indicios de IA suficientes para pedir defensa o proceso de trabajo?' : '¿Puedo confiar en este texto sin pedir más evidencia?',
    summary: financial.detected
      ? 'El texto activa el módulo financiero: la prioridad es mirar costo total, CFT, cargos omitidos y condiciones antes de decidir.'
      : pyramid
      ? 'El texto activa señales de estructura piramidal o de referidos: hay que verificar origen real de la rentabilidad y dependencia de nuevos participantes.'
      : academic
      ? 'El texto puede revisarse como trabajo académico: el resultado no prueba uso de IA, solo orienta una verificación docente prudente.'
      : 'El texto presenta señales que conviene contrastar con evidencia, condiciones y fuentes antes de decidir.',
    prudentConclusion: financial.detected
      ? 'No decidiría por la cuota hasta ver el costo financiero total, el contrato completo y todos los cargos.'
      : academic
      ? 'No acusaría al alumno solo por este análisis; pediría defensa oral, borradores, fuentes y explicación del proceso.'
      : 'Puede ser razonable, pero necesita más información para una decisión segura.',
    verdict: 'Evaluación prudente: se observan indicadores que requieren verificación. No es una afirmación definitiva sobre veracidad, autoría o legalidad.',
    categoryScores: [
      { name: 'Credibilidad', score: credibility, explanation: 'Mide qué tan respaldado y verificable parece el texto con la información visible.' },
      { name: 'Evidencia faltante', score: evidence, explanation: 'Sube cuando hay cifras, promesas o autoridades sin fuentes verificables.' },
      { name: 'Transparencia', score: transparency, explanation: 'Evalúa si muestra costos, condiciones, riesgos, responsable y letra chica.' },
      { name: 'Manipulación emocional', score: manipulation, explanation: 'Mide urgencia, miedo, FOMO, deseo aspiracional o presión para decidir rápido.' },
      { name: 'Riesgo financiero', score: financialRisk, explanation: 'Se activa cuando hay préstamos, cuotas, tasas, inversiones o financiación.' },
      { name: 'Riesgo piramidal/Ponzi', score: pyramidScore, explanation: 'Se activa ante referidos, ingresos pasivos, rentabilidad garantizada o ausencia de negocio real claro.' }
    ],
    specialistCommittee: [
      { name: 'Auditor de evidencia', score: evidence, explanation: evidenceMissing ? 'No se observan fuentes, metodología ni respaldo verificable suficiente.' : 'Incluye algunos elementos verificables, aunque igual conviene contrastar.' },
      { name: 'Auditor financiero', score: financialRisk, explanation: financial.summary },
      { name: 'Detector de ingeniería psicológica', score: manipulation, explanation: urgency || promise ? 'Busca presión emocional, urgencia artificial, autoridad difusa, prueba social o deseo de ganancia rápida.' : 'No se observan grandes señales de presión emocional.' },
      { name: 'Auditor legal prudente', score: 20, explanation: 'Reformula hallazgos como indicadores y no como acusaciones categóricas.' },
      { name: 'Detector académico IA', score: academicScore, explanation: academic ? 'Evalúa señales de estilo, genericidad, consistencia y necesidad de defensa oral. No prueba autoría.' : 'No parece un caso académico principal.' },
      { name: 'Comparador documental', score: 0, explanation: 'Para comparar dos documentos, pegá o subí ambos contenidos y revisá coincidencias, contradicciones y dependencia de fuentes.' }
    ],
    flaggedPhrases: flagged,
    issues: [
      promise ? 'Promesa o beneficio fuerte sin margen claro de incertidumbre.' : '',
      evidenceMissing ? 'Faltan fuentes, metodología o datos verificables.' : '',
      urgency ? 'Puede inducir decisión impulsiva por urgencia o inmediatez.' : '',
      financial.detected ? 'La cuota o monto visible no alcanza para decidir: falta costo total y condiciones.' : '',
      pyramid ? 'Hay señales de referidos, rentabilidad garantizada o ingresos pasivos que requieren verificación.' : '',
      academic && aiSignals ? 'Hay señales de escritura genérica o posiblemente asistida, pero no concluyentes.' : ''
    ].filter(Boolean),
    questions,
    missingInformation,
    worstCase: financial.detected
      ? 'Aceptar la oferta mirando solo la cuota y descubrir después cargos, seguros, mora, IVA o un CFT mucho mayor al esperado.'
      : pyramid
      ? 'Ingresar por expectativa de rentabilidad y que el ingreso real dependa de sumar personas, no de un negocio sustentable.'
      : academic
      ? 'Acusar injustamente a un alumno por señales estilísticas que podrían explicarse por ayuda, plantillas o buena edición.'
      : 'Tomar una decisión impulsiva basada en una promesa atractiva que luego dependa de condiciones no informadas.',
    improved: financial.detected
      ? 'Una versión más transparente debería mostrar monto neto acreditado, cuota, plazo, CFT con IVA, TEA, TNA, comisiones, seguros, gastos, mora, cancelación anticipada y total a pagar.'
      : academic
      ? 'Una evaluación más justa debería pedir fuentes, borradores, historial de edición, defensa oral y explicación de decisiones, sin tratar el detector como prueba definitiva.'
      : 'Una versión más honesta debería explicar alcance, límites, requisitos, costos, riesgos, evidencia y condiciones verificables.',
    financial,
    pyramidRisk: {
      name: 'Radar piramidal / Ponzi',
      score: pyramidScore,
      explanation: pyramid ? 'Hay señales de estructura basada en referidos, ingresos pasivos o rentabilidad prometida. Pedir modelo de negocio, fuente de pagos y contrato.' : 'No se detectan señales piramidales fuertes en el texto visible.'
    },
    academicAI: {
      name: 'Posible IA académica',
      score: academicScore,
      explanation: academic ? 'Estimación no concluyente. Debe usarse como alerta para pedir defensa, borradores, fuentes y explicación oral.' : 'No se detectó un trabajo académico principal.'
    },
    plagiarism: {
      name: 'Plagio / copiado',
      score: academic ? 35 : 0,
      explanation: academic ? 'Esta versión detecta señales internas y coincidencias entre textos pegados. Para plagio web real hace falta búsqueda externa o base de comparación.' : 'Sin texto académico o fuente de comparación no se evalúa plagio.'
    },
    sourceComparison: {
      name: 'Comparación documental',
      score: 0,
      explanation: 'Pegá dos documentos o sus extractos para comparar coincidencias, omisiones, contradicciones y dependencia de fuentes.'
    },
    legalSafeguard: 'ChamuyoCheck genera una evaluación automatizada basada exclusivamente en el contenido ingresado. No afirma que una persona o empresa mienta, no determina ilicitud, autoría ni plagio, y no reemplaza asesoramiento legal, financiero, médico, educativo ni profesional. Sus resultados son indicadores de riesgo y deben verificarse con fuentes, documentos y criterio humano.'
  };
}

function normalize(raw: any, text: string): Analysis {
  const fallback = localHeuristics(text);
  const financial = extractFinancial(text);
  return {
    ...fallback,
    score: clamp(raw?.score, fallback.score),
    risk: typeof raw?.risk === 'string' ? raw.risk : fallback.risk,
    confidence: typeof raw?.confidence === 'string' ? raw.confidence : fallback.confidence,
    detectedType: typeof raw?.detectedType === 'string' ? raw.detectedType : fallback.detectedType,
    centralQuestion: typeof raw?.centralQuestion === 'string' ? raw.centralQuestion : fallback.centralQuestion,
    summary: typeof raw?.summary === 'string' ? raw.summary : fallback.summary,
    prudentConclusion: typeof raw?.prudentConclusion === 'string' ? raw.prudentConclusion : fallback.prudentConclusion,
    verdict: typeof raw?.verdict === 'string' ? raw.verdict : fallback.verdict,
    categoryScores: Array.isArray(raw?.categoryScores) ? raw.categoryScores.slice(0, 8).map((c:any) => ({
      name: String(c?.name || 'Categoría'),
      score: clamp(c?.score, 50),
      explanation: String(c?.explanation || '')
    })) : fallback.categoryScores,
    specialistCommittee: Array.isArray(raw?.specialistCommittee) ? raw.specialistCommittee.slice(0, 8).map((c:any) => ({
      name: String(c?.name || 'Especialista'),
      score: clamp(c?.score, 50),
      explanation: String(c?.explanation || '')
    })) : fallback.specialistCommittee,
    flaggedPhrases: Array.isArray(raw?.flaggedPhrases) ? raw.flaggedPhrases.slice(0, 8).map((f:any) => ({
      phrase: String(f?.phrase || '').slice(0, 240),
      problem: String(f?.problem || ''),
      severity: ['Baja','Media','Alta'].includes(f?.severity) ? f.severity : 'Media'
    })) : fallback.flaggedPhrases,
    issues: Array.isArray(raw?.issues) ? raw.issues.slice(0, 8).map(String) : fallback.issues,
    questions: Array.isArray(raw?.questions) ? raw.questions.slice(0, 10).map(String) : fallback.questions,
    missingInformation: Array.isArray(raw?.missingInformation) ? raw.missingInformation.slice(0, 12).map(String) : fallback.missingInformation,
    worstCase: typeof raw?.worstCase === 'string' ? raw.worstCase : fallback.worstCase,
    improved: typeof raw?.improved === 'string' ? raw.improved : fallback.improved,
    financial: { ...financial, ...(raw?.financial || {}), detected: financial.detected || Boolean(raw?.financial?.detected), missingData: financial.missingData },
    pyramidRisk: raw?.pyramidRisk ? { name: String(raw.pyramidRisk.name || 'Radar piramidal'), score: clamp(raw.pyramidRisk.score, fallback.pyramidRisk.score), explanation: String(raw.pyramidRisk.explanation || fallback.pyramidRisk.explanation) } : fallback.pyramidRisk,
    academicAI: raw?.academicAI ? { name: String(raw.academicAI.name || 'Posible IA académica'), score: clamp(raw.academicAI.score, fallback.academicAI.score), explanation: String(raw.academicAI.explanation || fallback.academicAI.explanation) } : fallback.academicAI,
    plagiarism: raw?.plagiarism ? { name: String(raw.plagiarism.name || 'Plagio / copiado'), score: clamp(raw.plagiarism.score, fallback.plagiarism.score), explanation: String(raw.plagiarism.explanation || fallback.plagiarism.explanation) } : fallback.plagiarism,
    sourceComparison: raw?.sourceComparison ? { name: String(raw.sourceComparison.name || 'Comparación documental'), score: clamp(raw.sourceComparison.score, fallback.sourceComparison.score), explanation: String(raw.sourceComparison.explanation || fallback.sourceComparison.explanation) } : fallback.sourceComparison,
    legalSafeguard: fallback.legalSafeguard
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body?.text || '').trim();
    const mode = String(body?.mode || 'text');
    const compareText = String(body?.compareText || '').trim();
    const url = String(body?.url || '').trim();
    const fileNotes = Array.isArray(body?.files) ? body.files.map((f:any) => `${f.name || 'archivo'} (${f.type || 'tipo desconocido'})`).join(', ') : '';

    const fullText = [
      text,
      compareText ? `\n\n--- DOCUMENTO O FUENTE DE COMPARACIÓN ---\n${compareText}` : '',
      url ? `\n\n--- ENLACE INGRESADO ---\n${url}` : '',
      fileNotes ? `\n\n--- ARCHIVOS SUBIDOS ---\n${fileNotes}` : ''
    ].join('');

    if (!fullText || fullText.length < 20) {
      return NextResponse.json({ error: 'Pegá un texto, enlace o descripción de archivo de al menos 20 caracteres.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(localHeuristics(fullText));
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
Actuá como ChamuyoCheck V6, un comité prudente de auditoría de credibilidad.
Analizá el contenido ingresado. Modo: ${mode}.

Reglas legales obligatorias:
- No digas "es mentira", "es falso", "es estafa", "es plagio" ni "fue hecho con IA" salvo que el texto lo admita literalmente.
- Usá lenguaje prudente: "presenta indicadores", "requiere evidencia", "podría inducir a error", "no alcanza para decidir".
- No reemplazás asesoramiento legal, financiero, médico, educativo ni profesional.
- Para trabajos académicos, el detector de IA es estimativo y no prueba autoría: recomendar defensa oral, borradores, fuentes y criterio docente.
- Para plagio, si no hay búsqueda externa o fuente comparativa, aclarar que solo hay señales internas.
- Para PDF, imagen, YouTube o web, si no se extrajo contenido completo, aclarar que el análisis se basa en texto visible/ingresado.

Evaluá:
1) credibilidad,
2) evidencia faltante,
3) transparencia,
4) manipulación emocional,
5) riesgo financiero y matemática de préstamos si hay monto/cuota/plazo,
6) riesgo piramidal/Ponzi/referidos,
7) posible uso de IA académica,
8) plagio/copiar-pegar,
9) comparación entre documentos si hay fuente comparativa,
10) peor escenario razonable,
11) preguntas prioritarias para decidir.

Respondé SOLO JSON válido con esta forma:
{
 "score": number,
 "risk": string,
 "confidence": string,
 "detectedType": string,
 "centralQuestion": string,
 "summary": string,
 "prudentConclusion": string,
 "verdict": string,
 "categoryScores": [{"name": string, "score": number, "explanation": string}],
 "specialistCommittee": [{"name": string, "score": number, "explanation": string}],
 "flaggedPhrases": [{"phrase": string, "problem": string, "severity": "Baja"|"Media"|"Alta"}],
 "issues": string[],
 "questions": string[],
 "missingInformation": string[],
 "worstCase": string,
 "improved": string,
 "financial": {"detected": boolean, "summary": string},
 "pyramidRisk": {"name": string, "score": number, "explanation": string},
 "academicAI": {"name": string, "score": number, "explanation": string},
 "plagiarism": {"name": string, "score": number, "explanation": string},
 "sourceComparison": {"name": string, "score": number, "explanation": string}
}

Contenido:
${fullText.slice(0, 15000)}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sos un auditor prudente. Respondés únicamente JSON válido.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return NextResponse.json(normalize(raw, fullText));
  } catch (e) {
    return NextResponse.json({ error: 'Error analizando el contenido. Revisá el texto ingresado o intentá nuevamente.' }, { status: 500 });
  }
}
