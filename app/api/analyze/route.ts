import { NextResponse } from 'next/server';
import OpenAI from 'openai';

type Category = { name: string; score: number; explanation: string };
type FlaggedPhrase = { phrase: string; problem: string; severity: 'Baja' | 'Media' | 'Alta' };
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
  annualImpliedRate?: number | null;
  missingFields: string[];
  warnings: string[];
  questions: string[];
  plainEnglish: string;
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
  financialMath?: FinancialMath;
};

function clamp(n: unknown, fallback = 50) {
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}
function pct(n: number) { return Math.round(n * 10000) / 100; }
function moneyFrom(match?: string | null) {
  if (!match) return null;
  const cleaned = match.replace(/\$/g, '').replace(/ars|pesos|peso/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
function detectFinancialMath(text: string): FinancialMath {
  const lower = text.toLowerCase();
  const isFinancial = /(pr[eé]stamo|cr[eé]dito|cuota|tna|tea|cft|inter[eé]s|financiaci[oó]n|adelanto|monto|costo financiero|comisi[oó]n)/.test(lower);
  if (!isFinancial) return { detected:false, missingFields:[], warnings:[], questions:[], plainEnglish:'' };

  const amount = moneyFrom((lower.match(/(?:pr[eé]stamo|cr[eé]dito|monto|te damos|hasta)\s*(?:de|por)?\s*\$?\s*([0-9][0-9\.,]*)/) || [])[1]);
  const installment = moneyFrom((lower.match(/(?:cuota|pag[aá]s|cuotas? de)\s*(?:de)?\s*\$?\s*([0-9][0-9\.,]*)/) || [])[1]);
  const monthsMatch = lower.match(/([0-9]{1,3})\s*(?:cuotas|meses|m)/);
  const months = monthsMatch ? Number(monthsMatch[1]) : null;
  const explicitRate = (lower.match(/(?:tna|tea|cft|inter[eé]s|tasa)[^0-9]{0,12}([0-9]+(?:[\.,][0-9]+)?\s*%)/) || [])[0] || null;

  const totalPaid = installment && months ? installment * months : null;
  const hiddenCost = totalPaid && amount ? totalPaid - amount : null;
  const hiddenCostPercent = hiddenCost && amount ? pct(hiddenCost / amount) : null;
  let monthlyImpliedRate: number | null = null;
  let annualImpliedRate: number | null = null;
  if (amount && installment && months && installment * months > amount) {
    let lo = 0, hi = 1;
    for (let i=0;i<80;i++) {
      const r = (lo + hi) / 2;
      const pv = installment * (1 - Math.pow(1 + r, -months)) / r;
      if (pv > amount) lo = r; else hi = r;
    }
    monthlyImpliedRate = pct((lo+hi)/2);
    annualImpliedRate = pct(Math.pow(1 + ((lo+hi)/2), 12) - 1);
  }

  const missingFields = [
    !/cft/.test(lower) ? 'CFT' : '',
    !/tea/.test(lower) ? 'TEA' : '',
    !/tna/.test(lower) ? 'TNA' : '',
    !/(comisi[oó]n|gasto|seguro|iva|sellado|mantenimiento|otorgamiento)/.test(lower) ? 'comisiones, seguros, impuestos y gastos' : '',
    !/(cancelaci[oó]n|prepago|mora|punitorio)/.test(lower) ? 'costo por mora o cancelación anticipada' : ''
  ].filter(Boolean);

  const warnings = [
    'En préstamos argentinos el dato clave no es solo la cuota: hay que mirar CFT, comisiones, seguros, IVA, gastos y condiciones.',
    totalPaid && amount ? `Con los datos visibles, el total a pagar sería aprox. $${Math.round(totalPaid).toLocaleString('es-AR')}, es decir $${Math.round(hiddenCost || 0).toLocaleString('es-AR')} por encima del capital informado.` : 'No hay datos suficientes para calcular el costo total real.',
    monthlyImpliedRate ? `La tasa mensual implícita estimada por cuota y plazo sería aprox. ${monthlyImpliedRate}% mensual (${annualImpliedRate}% efectivo anual).` : 'Faltan monto, cuota o plazo para estimar una tasa implícita.'
  ];

  return {
    detected:true, amount, installment, months, explicitRate, totalPaid, hiddenCost, hiddenCostPercent, monthlyImpliedRate, annualImpliedRate,
    missingFields, warnings,
    questions:[
      '¿Cuál es el CFT efectivo anual con IVA incluido?',
      '¿Qué comisiones, seguros, gastos administrativos o cargos de otorgamiento se suman?',
      '¿La cuota publicada es fija, variable o promocional?',
      '¿Qué pasa si pago tarde o cancelo anticipadamente?',
      '¿El monto acreditado es igual al capital publicado o descuentan cargos al inicio?'
    ],
    plainEnglish: totalPaid && amount ? `No mires solo la cuota: si tomás $${Math.round(amount).toLocaleString('es-AR')} y pagás ${months} cuotas de $${Math.round(installment || 0).toLocaleString('es-AR')}, devolverías aprox. $${Math.round(totalPaid).toLocaleString('es-AR')}. Ese es el primer número que una publicación debería mostrar con claridad.` : 'La publicación parece financiera, pero omite datos necesarios para calcular el costo real.'
  };
}

function demo(text: string): Analysis {
  const lower = text.toLowerCase();
  const fm = detectFinancialMath(text);
  let score = 34;
  if (/garantiz|100%|seguro|sin riesgo|duplic|mill[oó]n|sin trabajar|sin esfuerzo/.test(lower)) score += 28;
  if (/urgente|hoy|ahora|última oportunidad|exclusivo|no te quedes/.test(lower)) score += 14;
  if (/miles de personas|expertos|secreto|m[eé]todo/.test(lower)) score += 10;
  if (fm.detected) score += 10 + Math.min(20, fm.missingFields.length * 4);
  score = clamp(score, 42);

  const financialCats = fm.detected ? [
    { name: 'Costo financiero oculto', score: clamp(55 + fm.missingFields.length * 7), explanation: 'Evalúa si la publicación muestra CFT, cargos, impuestos, seguros y costo total.' },
    { name: 'Claridad de cuota', score: fm.totalPaid ? 45 : 78, explanation: 'Mide si permite calcular cuánto se devuelve realmente.' }
  ] : [];

  return {
    score,
    risk: score >= 80 ? 'Alto' : score >= 60 ? 'Medio/Alto' : score >= 40 ? 'Medio' : 'Bajo',
    summary: fm.detected ? 'El texto parece una oferta financiera. La prioridad es calcular costo total, tasa implícita y cargos omitidos antes de creer la cuota publicada.' : 'El texto presenta señales de promesa inflada y requiere evidencia concreta antes de ser tomado como confiable.',
    categoryScores: [
      ...financialCats,
      { name: 'Promesa imposible', score: clamp(score + 6), explanation: 'Usa un beneficio llamativo sin explicar condiciones ni probabilidad real.' },
      { name: 'Evidencia insuficiente', score: clamp(score + 10), explanation: 'No aporta fuentes, metodología, casos comprobables ni datos verificables.' },
      { name: 'Manipulación emocional', score: clamp(score - 6), explanation: 'Puede apoyarse en deseo de ganancia rápida, urgencia o expectativa exagerada.' },
      { name: 'Claridad comercial', score: clamp(score - 8), explanation: 'Faltan límites, costos, requisitos, riesgos y qué ocurre si el resultado no se cumple.' }
    ].slice(0,6),
    flaggedPhrases: [
      { phrase: text.slice(0, 160), problem: fm.detected ? 'Debe contrastarse contra CFT, total a pagar, comisiones y condiciones.' : 'Necesita evidencia externa y condiciones verificables.', severity: score >= 70 ? 'Alta' : 'Media' }
    ],
    issues: fm.detected ? fm.warnings : [
      'Promete o sugiere un resultado atractivo sin prueba suficiente.',
      'No explica metodología, requisitos, plazos ni condiciones.',
      'No distingue entre posibilidad, probabilidad y garantía.',
      'Puede inducir una decisión impulsiva si se usa como argumento de venta.'
    ],
    questions: fm.detected ? fm.questions : [
      '¿Qué evidencia independiente respalda esta afirmación?',
      '¿Cuáles son las condiciones, costos, plazos y exclusiones?',
      '¿Qué porcentaje de usuarios logra realmente ese resultado?',
      '¿Qué pasa si el resultado prometido no ocurre?'
    ],
    improved: fm.detected ? 'Una versión más honesta debería mostrar monto neto acreditado, cuota, plazo, CFT con IVA, comisiones, seguros, gastos, mora, cancelación anticipada y total a pagar.' : 'Una versión más honesta debería explicar el alcance real de la propuesta, sus límites, los requisitos, los riesgos y las pruebas disponibles.',
    verdict: fm.detected ? 'Oferta financiera: no decidiría por la cuota hasta ver CFT, total a pagar y cargos completos.' : (score >= 70 ? 'Mucho chamuyo: no lo compraría sin pruebas sólidas.' : 'Hay señales discutibles: pediría más evidencia antes de creerlo.'),
    financialMath: fm.detected ? fm : undefined
  };
}

function normalizeFinancial(raw: any, text: string): FinancialMath | undefined {
  const fm = detectFinancialMath(text);
  if (!fm.detected && !raw?.detected) return undefined;
  return { ...fm, ...raw, detected: true, missingFields: Array.isArray(raw?.missingFields) ? raw.missingFields.map(String) : fm.missingFields, warnings: Array.isArray(raw?.warnings) ? raw.warnings.map(String) : fm.warnings, questions: Array.isArray(raw?.questions) ? raw.questions.map(String) : fm.questions, plainEnglish: typeof raw?.plainEnglish === 'string' ? raw.plainEnglish : fm.plainEnglish };
}

function normalizeAnalysis(raw: any, text: string): Analysis {
  const fallback = demo(text);
  return {
    score: clamp(raw?.score, fallback.score),
    risk: typeof raw?.risk === 'string' ? raw.risk : fallback.risk,
    summary: typeof raw?.summary === 'string' ? raw.summary : fallback.summary,
    categoryScores: Array.isArray(raw?.categoryScores) && raw.categoryScores.length
      ? raw.categoryScores.slice(0, 8).map((c: any) => ({ name: String(c?.name || 'Categoría'), score: clamp(c?.score, 50), explanation: String(c?.explanation || '') }))
      : fallback.categoryScores,
    flaggedPhrases: Array.isArray(raw?.flaggedPhrases) && raw.flaggedPhrases.length
      ? raw.flaggedPhrases.slice(0, 10).map((f: any) => ({ phrase: String(f?.phrase || '').slice(0, 220), problem: String(f?.problem || ''), severity: ['Baja', 'Media', 'Alta'].includes(f?.severity) ? f.severity : 'Media' }))
      : fallback.flaggedPhrases,
    issues: Array.isArray(raw?.issues) ? raw.issues.slice(0, 8).map(String) : fallback.issues,
    questions: Array.isArray(raw?.questions) ? raw.questions.slice(0, 8).map(String) : fallback.questions,
    improved: typeof raw?.improved === 'string' ? raw.improved : fallback.improved,
    verdict: typeof raw?.verdict === 'string' ? raw.verdict : fallback.verdict,
    financialMath: normalizeFinancial(raw?.financialMath, text) || fallback.financialMath
  };
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length < 20) return NextResponse.json({ error: 'Pegá un texto de al menos 20 caracteres.' }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json(demo(text));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const fm = detectFinancialMath(text);
    const prompt = `Analizá este texto para ChamuyoCheck, una herramienta argentina que detecta chamuyo comercial, financiero, político y publicitario.\n\nReglas:\n- No digas "es falso" salvo que sea evidente por lógica interna. Usá "requiere evidencia", "no está respaldado", "podría inducir a error".\n- Score: 0 = sólido/verificable; 100 = humo extremo.\n- Penalizá garantías, rentabilidad, promesas de resultado, urgencia artificial, números sin fuente, autoridad difusa y letra chica omitida.\n- Si es un préstamo/crédito/financiación, analizá matemáticamente: monto, cuota, plazo, total a pagar, diferencia sobre capital, tasa implícita estimada, CFT/TNA/TEA omitidos, comisiones, seguros, IVA, mora y cancelación anticipada.\n- En ofertas financieras, no alcanza con decir "cuota baja": explicá el costo real y qué datos faltan.\n\nCálculo local detectado por ChamuyoCheck:\n${JSON.stringify(fm)}\n\nRespondé SOLO JSON válido con esta forma:\n{ "score": number, "risk": string, "summary": string, "categoryScores": [{"name": string,"score": number,"explanation": string}], "flaggedPhrases": [{"phrase": string,"problem": string,"severity": "Baja"|"Media"|"Alta"}], "issues": string[], "questions": string[], "improved": string, "verdict": string, "financialMath": {"detected": boolean,"amount": number|null,"installment": number|null,"months": number|null,"explicitRate": string|null,"totalPaid": number|null,"hiddenCost": number|null,"hiddenCostPercent": number|null,"monthlyImpliedRate": number|null,"annualImpliedRate": number|null,"missingFields": string[],"warnings": string[],"questions": string[],"plainEnglish": string} }\n\nTexto:\n${text.slice(0, 12000)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sos un auditor argentino de credibilidad, marketing engañoso y costos financieros. Sabés explicar préstamos, CFT, tasas, cuotas y costos ocultos en lenguaje simple.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    return NextResponse.json(normalizeAnalysis(JSON.parse(raw), text));
  } catch {
    return NextResponse.json({ error: 'Error analizando el texto.' }, { status: 500 });
  }
}
