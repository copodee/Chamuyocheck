import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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

function detectInputKind(fileName: string, url: string, fileType: string) {
  if (url && /youtu\.be|youtube\.com/i.test(url)) return 'YouTube';
  if (url) return 'Web';
  if (/\.pdf$/i.test(fileName) || /pdf/i.test(fileType)) return 'PDF';
  if (/image\//i.test(fileType) || /\.(png|jpg|jpeg|webp)$/i.test(fileName)) return 'Imagen';
  return 'Texto';
}

function detectDomain(text: string, inputKind: string) {
  const all = text.toLowerCase();

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

  if (/inversi[oó]n|rentabilidad|ganancia|referidos|ponzi|piramid|multinivel|ingresos pasivos|trading|cripto|retorno garantizado/.test(all)) {
    return {
      icon: '📈',
      label: 'Inversión o promesa de rentabilidad',
      focus: 'Sustento económico, referidos, rentabilidad y regulación.',
      modules: ['Riesgo piramidal', 'Rentabilidad', 'Referidos', 'Regulación', 'Sustento']
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
    label: inputKind === 'PDF' ? 'Documento general' : 'Credibilidad general',
    focus: 'Evidencia, transparencia, coherencia y riesgos.',
    modules: ['Credibilidad', 'Evidencia faltante', 'Transparencia', 'Manipulación']
  };
}

function evidenceSignals(text: string) {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  const money = text.match(/\$\s?[0-9.]+/g) || [];
  const percents = text.match(/[0-9]+(?:,[0-9]+|\.[0-9]+)?\s?%/g) || [];
  const dates = text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b20\d{2}\b/g) || [];
  const strong = text.match(/garantizad[oa]s?|sin riesgo|sin esfuerzo|100%|comprobado|millonario|cura|definitivo/gi) || [];

  return [
    urls.length ? `${urls.length} enlaces visibles` : 'No se observan enlaces visibles',
    money.length ? `${money.length} montos detectados` : 'No se observan montos relevantes',
    percents.length ? `${percents.length} porcentajes detectados` : 'No se observan porcentajes relevantes',
    dates.length ? `${dates.length} fechas o años detectados` : 'No se observan fechas claras',
    strong.length ? `${strong.length} afirmaciones fuertes o absolutas` : 'No se detectan afirmaciones absolutas dominantes'
  ];
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

  const categoryScores: CategoryScore[] = [
    {
      name: 'Credibilidad',
      score: clamp(100 - riskScore),
      explanation: 'Mide respaldo, coherencia y verificabilidad con la información visible.'
    },
    {
      name: 'Evidencia faltante',
      score: missing ? 82 : 30,
      explanation: 'Sube cuando hay cifras, promesas, autoridad o conclusiones sin fuente verificable.'
    },
    {
      name: 'Transparencia',
      score: financial ? 75 : missing ? 64 : 25,
      explanation: 'Evalúa condiciones, costos, límites, responsables, metodología y letra chica.'
    },
    {
      name: 'Manipulación emocional',
      score: promise ? 65 : 20,
      explanation: 'Detecta urgencia, deseo aspiracional, miedo o promesas extraordinarias.'
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

  const signals = evidenceSignals(text);

  return {
    documentIcon: domain.icon,
    documentType: domain.label,
    documentFocus: domain.focus,
    extractionStatus: extraction?.note || 'Contenido recibido.',
    extractedChars: extraction?.chars || text.length,
    extractedPreview: text.slice(0, 1200),
    score: riskScore,
    risk: riskScore > 74 ? 'Alto' : riskScore > 44 ? 'Medio' : 'Bajo',
    confidence: extraction?.chars ? 'Media/Alta' : 'Media',
    detectedTheme: domain.label,
    detectedInput: inputKind,
    centralQuestion: academic
      ? '¿Hay indicios suficientes para pedir verificación académica sin acusar?'
      : financial
        ? '¿Puedo decidir sin ver el costo total y el contrato?'
        : '¿Puedo confiar en esto sin pedir más evidencia?',
    summary: academic
      ? 'El contenido se analiza como posible trabajo académico. La respuesta debe resaltar indicios, no afirmar autoría ni uso de IA como certeza.'
      : 'El contenido presenta señales que conviene contrastar con evidencia, fuentes y condiciones.',
    prudentConclusion: academic
      ? 'No concluiría que fue hecho con IA; pediría defensa oral, borradores, fuentes y coherencia metodológica.'
      : 'Pediría evidencia y condiciones antes de decidir.',
    verdict: 'Evaluación prudente: indicadores de riesgo, no afirmación definitiva sobre veracidad, autoría, legalidad, plagio, uso de IA o intención.',
    categoryScores,
    modules: categoryScores.filter((c) => c.score > 0).slice(0, 8),
    flaggedPhrases: promise
      ? [{ phrase: text.slice(0, 220), problem: 'Frase o estructura que requiere respaldo, fuente o contexto.', severity: 'Media' }]
      : [],
    issues: [
      extraction?.chars ? 'El análisis usa texto extraído del archivo.' : 'No se pudo leer texto completo del archivo; análisis preliminar.',
      academic ? 'Posible análisis académico: no prueba uso de IA; requiere verificación docente.' : '',
      promise ? 'Promesa o resultado atractivo sin margen claro de incertidumbre.' : '',
      missing ? 'Faltan fuentes o metodología verificable.' : '',
      financial ? 'Faltan costos financieros completos.' : '',
      pyramid ? 'Posible estructura basada en referidos o rentabilidad prometida.' : ''
    ].filter(Boolean),
    questions: [
      '¿Qué fuente independiente respalda la afirmación?',
      '¿Quién es el autor y cuál es la fecha?',
      '¿Qué evidencia verificable aparece dentro del documento?',
      academic ? '¿El autor puede defender oralmente el trabajo y mostrar borradores?' : '',
      financial ? '¿Cuál es el CFT efectivo anual con IVA incluido?' : ''
    ].filter(Boolean),
    missingInformation: [
      'fuentes verificables',
      'autor, fecha y origen del documento',
      'metodología o base del dato',
      academic ? 'borradores, historial de edición, fuentes y defensa oral' : '',
      financial ? 'CFT, TEA, TNA, IVA, seguros, comisiones y mora' : ''
    ].filter(Boolean),
    worstCase: academic
      ? 'Acusar erróneamente a un alumno sin evidencia concluyente.'
      : 'Tomar una decisión impulsiva con información incompleta.',
    improved: academic
      ? 'Pedir al alumno una breve defensa oral, fuentes usadas, borradores y explicación del proceso.'
      : 'Explicar alcance, límites, requisitos, evidencia, costos, riesgos y condiciones verificables.',
    evidenceFound: [
      ...signals,
      'Elementos verificables detectados: revisar nombres, fechas, cifras y fuentes dentro del documento.',
      missing ? 'Afirmaciones que requieren fuente o metodología adicional.' : 'El documento incluye algunos elementos que pueden contrastarse.',
      academic ? 'Señales académicas: revisar bibliografía, coherencia del estilo y defensa oral.' : 'No se activó como eje académico principal.',
      financial ? 'Señales financieras: verificar CFT, TEA, TNA, comisiones, seguros e IVA.' : 'No se activó como oferta financiera principal.'
    ].filter(Boolean),
    scoreExplanation: [
      'El puntaje se calcula ponderando evidencia visible, transparencia, consistencia, riesgos y señales de manipulación.',
      missing ? 'Baja porque faltan fuentes, metodología o respaldo verificable.' : 'Sube porque hay más elementos contrastables.',
      promise ? 'Baja por promesas fuertes o lenguaje absoluto.' : 'No se detectó una promesa extraordinaria dominante.',
      extraction?.chars ? 'Sube la confianza porque se pudo leer texto real del documento.' : 'Baja la confianza porque no se pudo leer el documento completo.'
    ].filter(Boolean),
    refutationPoints: [
      'Verificar autor, fecha, fuente original y trazabilidad del documento.',
      'Pedir respaldo para las afirmaciones centrales.',
      'Distinguir hechos observables de opiniones o inferencias.',
      financial ? 'Exigir contrato completo y costo financiero total.' : '',
      academic ? 'Pedir borradores, fuentes y defensa oral antes de concluir uso de IA.' : ''
    ].filter(Boolean),
    improvementPlan: domain.modules
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
    modules: Array.isArray(raw?.modules) ? raw.modules : fallback.modules
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
      fileName = file.name || 'archivo';
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
          note: `Archivo recibido: ${fileName}. Extracción profunda no disponible.`
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
      return NextResponse.json({ error: 'Ingresá texto, URL o cargá un archivo.' }, { status: 400 });
    }

    const fallback = buildLocalAnalysis(fullText, inputKind, fileName, extraction);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(fallback);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Actuá como ChamuyoCheck, auditor documental prudente. Priorizá el contenido extraído del archivo por encima de la pregunta del usuario. Identificá el tipo de documento/contenido antes del score. Si el PDF no tiene texto extraíble, indicá que necesita OCR. Si el usuario pregunta si fue hecho con IA, respondé como estimación no concluyente: nunca acuses ni afirmes uso de IA/plagio. Respondé SOLO JSON con estas claves: documentIcon, documentType, documentFocus, extractionStatus, extractedChars, extractedPreview, score, risk, confidence, detectedTheme, detectedInput, centralQuestion, summary, prudentConclusion, verdict, categoryScores, modules, flaggedPhrases, issues, questions, missingInformation, worstCase, improved, evidenceFound, scoreExplanation, refutationPoints, improvementPlan.

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
  } catch {
    return NextResponse.json({ error: 'No se pudo analizar el documento.' }, { status: 500 });
  }
}
