import { NextResponse } from 'next/server';
import OpenAI from 'openai';

type Category = {
  name: string;
  score: number;
  explanation: string;
};

type FlaggedPhrase = {
  phrase: string;
  problem: string;
  severity: 'Baja' | 'Media' | 'Alta';
};

type Analysis = {
  score: number;
  risk: string;
  summary: string;
  categoryScores: Category[];
  flaggedPhrases: FlaggedPhrase[];
  issues: string[];
  questions: string[];
  improved: string;
  verdict: string;
};

function clamp(n: unknown, fallback = 50) {
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function demo(text: string): Analysis {
  const lower = text.toLowerCase();
  let score = 38;
  if (/garantiz|100%|seguro|sin riesgo|duplic|mill[oó]n|sin trabajar|sin esfuerzo/.test(lower)) score += 28;
  if (/urgente|hoy|ahora|última oportunidad|exclusivo|no te quedes/.test(lower)) score += 14;
  if (/miles de personas|expertos|secreto|m[eé]todo/.test(lower)) score += 10;
  score = clamp(score, 42);

  return {
    score,
    risk: score >= 80 ? 'Alto' : score >= 60 ? 'Medio/Alto' : score >= 40 ? 'Medio' : 'Bajo',
    summary: 'El texto presenta señales de promesa inflada y requiere evidencia concreta antes de ser tomado como confiable.',
    categoryScores: [
      { name: 'Promesa imposible', score: clamp(score + 8), explanation: 'Usa un beneficio llamativo sin explicar condiciones ni probabilidad real.' },
      { name: 'Evidencia insuficiente', score: clamp(score + 12), explanation: 'No aporta fuentes, metodología, casos comprobables ni datos verificables.' },
      { name: 'Manipulación emocional', score: clamp(score - 4), explanation: 'Puede apoyarse en deseo de ganancia rápida, urgencia o expectativa exagerada.' },
      { name: 'Claridad comercial', score: clamp(score - 10), explanation: 'Faltan límites, costos, requisitos, riesgos y qué ocurre si el resultado no se cumple.' }
    ],
    flaggedPhrases: [
      { phrase: text.slice(0, 90), problem: 'Necesita evidencia externa y condiciones verificables.', severity: score >= 70 ? 'Alta' : 'Media' }
    ],
    issues: [
      'Promete o sugiere un resultado atractivo sin prueba suficiente.',
      'No explica metodología, requisitos, plazos ni condiciones.',
      'No distingue entre posibilidad, probabilidad y garantía.',
      'Puede inducir una decisión impulsiva si se usa como argumento de venta.'
    ],
    questions: [
      '¿Qué evidencia independiente respalda esta afirmación?',
      '¿Cuáles son las condiciones, costos, plazos y exclusiones?',
      '¿Qué porcentaje de usuarios logra realmente ese resultado?',
      '¿Qué pasa si el resultado prometido no ocurre?'
    ],
    improved: 'Una versión más honesta debería explicar el alcance real de la propuesta, sus límites, los requisitos, los riesgos y las pruebas disponibles, evitando prometer resultados como si fueran automáticos.',
    verdict: score >= 70 ? 'Mucho chamuyo: no lo compraría sin pruebas sólidas.' : 'Hay señales discutibles: pediría más evidencia antes de creerlo.'
  };
}

function normalizeAnalysis(raw: any, text: string): Analysis {
  const fallback = demo(text);
  return {
    score: clamp(raw?.score, fallback.score),
    risk: typeof raw?.risk === 'string' ? raw.risk : fallback.risk,
    summary: typeof raw?.summary === 'string' ? raw.summary : fallback.summary,
    categoryScores: Array.isArray(raw?.categoryScores) && raw.categoryScores.length
      ? raw.categoryScores.slice(0, 6).map((c: any) => ({
          name: String(c?.name || 'Categoría'),
          score: clamp(c?.score, 50),
          explanation: String(c?.explanation || '')
        }))
      : fallback.categoryScores,
    flaggedPhrases: Array.isArray(raw?.flaggedPhrases) && raw.flaggedPhrases.length
      ? raw.flaggedPhrases.slice(0, 8).map((f: any) => ({
          phrase: String(f?.phrase || '').slice(0, 220),
          problem: String(f?.problem || ''),
          severity: ['Baja', 'Media', 'Alta'].includes(f?.severity) ? f.severity : 'Media'
        }))
      : fallback.flaggedPhrases,
    issues: Array.isArray(raw?.issues) ? raw.issues.slice(0, 6).map(String) : fallback.issues,
    questions: Array.isArray(raw?.questions) ? raw.questions.slice(0, 6).map(String) : fallback.questions,
    improved: typeof raw?.improved === 'string' ? raw.improved : fallback.improved,
    verdict: typeof raw?.verdict === 'string' ? raw.verdict : fallback.verdict
  };
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return NextResponse.json({ error: 'Pegá un texto de al menos 20 caracteres.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) return NextResponse.json(demo(text));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Analizá este texto para ChamuyoCheck, una herramienta argentina que detecta promesas vacías, humo comercial, exageración, manipulación emocional y afirmaciones sin evidencia.\n\nReglas importantes:\n- No digas \"es falso\" salvo que sea evidente por lógica interna.\n- Sé firme, pero legalmente prudente: usá \"no está respaldado\", \"requiere evidencia\", \"podría inducir a error\".\n- Penalizá promesas garantizadas, números sin fuente, autoridad difusa, urgencia artificial, rentabilidad, salud, cursos milagrosos, política, propaganda y lenguaje corporativo vacío.\n- El score representa nivel de chamuyo: 0 = sólido y verificable; 100 = humo extremo.\n- Adaptá el score al texto concreto. No uses siempre 72.\n\nRespondé SOLO JSON válido con esta forma exacta:\n{\n  \"score\": number,\n  \"risk\": string,\n  \"summary\": string,\n  \"categoryScores\": [{\"name\": string, \"score\": number, \"explanation\": string}],\n  \"flaggedPhrases\": [{\"phrase\": string, \"problem\": string, \"severity\": \"Baja\"|\"Media\"|\"Alta\"}],\n  \"issues\": string[],\n  \"questions\": string[],\n  \"improved\": string,\n  \"verdict\": string\n}\n\nTexto a analizar:\n${text.slice(0, 12000)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sos un auditor de credibilidad, marketing engañoso y argumentación. Respondés en español argentino, claro y directo.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.25
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return NextResponse.json(normalizeAnalysis(parsed, text));
  } catch (e: any) {
    return NextResponse.json({ error: 'Error analizando el texto.' }, { status: 500 });
  }
}
