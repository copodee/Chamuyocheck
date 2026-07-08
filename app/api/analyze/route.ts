import { NextResponse } from 'next/server';
import OpenAI from 'openai';

type Severity = 'Baja' | 'Media' | 'Alta';
type Category = { name: string; score: number; explanation: string };
type FlaggedPhrase = { phrase: string; problem: string; severity: Severity };
type IntelligenceModule = {
  id: string;
  title: string;
  detected: boolean;
  risk: number;
  summary: string;
  signals: string[];
  missingInformation: string[];
  questions: string[];
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
  annualImpliedRate?: number | null;
  missingFields: string[];
  warnings: string[];
  questions: string[];
  plainEnglish: string;
};
type PyramidRisk = {
  detected: boolean;
  risk: number;
  level: string;
  signals: string[];
  explanation: string;
  questions: string[];
};
type LegalGuard = {
  disclaimer: string;
  prohibitedLanguagePolicy: string;
  confidence: 'Baja' | 'Media' | 'Alta';
};
type Analysis = {
  documentType: string;
  decisionQuestion: string;
  score: number;
  risk: string;
  confidence: string;
  summary: string;
  categoryScores: Category[];
  modules: IntelligenceModule[];
  flaggedPhrases: FlaggedPhrase[];
  issues: string[];
  questions: string[];
  missingInformation: string[];
  worstReasonableScenario: string;
  improved: string;
  verdict: string;
  legalGuard: LegalGuard;
  financialMath?: FinancialMath;
  pyramidRisk?: PyramidRisk;
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
function riskLabel(score: number) {
  if (score >= 82) return 'Alto';
  if (score >= 65) return 'Medio/Alto';
  if (score >= 42) return 'Medio';
  return 'Bajo';
}
function detectDocumentType(text: string) {
  const lower = text.toLowerCase();
  if (/(pr[eé]stamo|cr[eé]dito|cuota|tna|tea|cft|financiaci[oó]n|inter[eé]s|monto|banco)/.test(lower)) return 'Oferta financiera / préstamo';
  if (/(rentabilidad|inversi[oó]n|cripto|trading|ganancia mensual|retorno|roi|staking)/.test(lower)) return 'Inversión / oportunidad financiera';
  if (/(referid|traer gente|equipo|red|nivel|patrocinador|ingreso pasivo|libertad financiera)/.test(lower)) return 'Oportunidad multinivel o referidos';
  if (/(vot|gobierno|candidato|ministerio|prometemos|campaña|estado|municipio)/.test(lower)) return 'Discurso o comunicación política';
  if (/(cura|m[eé]dico|salud|suplemento|tratamiento|cl[ií]nica|paciente|dolor)/.test(lower)) return 'Salud / bienestar';
  if (/(contrato|cl[aá]usula|obligaci[oó]n|penalidad|rescindir|alquiler|locaci[oó]n)/.test(lower)) return 'Contrato / documento legal';
  if (/(curso|mentor[ií]a|masterclass|capacitaci[oó]n|m[eé]todo|aprend[eé])/ .test(lower)) return 'Curso / mentoría / infoproducto';
  return 'Texto comercial o publicitario';
}
function detectFinancialMath(text: string): FinancialMath {
  const lower = text.toLowerCase();
  const isFinancial = /(pr[eé]stamo|cr[eé]dito|cuota|tna|tea|cft|inter[eé]s|financiaci[oó]n|adelanto|monto|costo financiero|comisi[oó]n|tarjeta|mínimo|minimo|leasing|anticipo)/.test(lower);
  if (!isFinancial) return { detected:false, missingFields:[], warnings:[], questions:[], plainEnglish:'' };

  const amount = moneyFrom((lower.match(/(?:pr[eé]stamo|cr[eé]dito|monto|te damos|hasta|capital|recib[ií]s|recibes)\s*(?:de|por)?\s*\$?\s*([0-9][0-9\.,]*)/) || [])[1]);
  const installment = moneyFrom((lower.match(/(?:cuota|pag[aá]s|cuotas? de|devolv[eé]s|devuelves)\s*(?:de)?\s*\$?\s*([0-9][0-9\.,]*)/) || [])[1]);
  const monthsMatch = lower.match(/([0-9]{1,3})\s*(?:cuotas|meses|m)/);
  const months = monthsMatch ? Number(monthsMatch[1]) : null;
  const explicitRate = (lower.match(/(?:tna|tea|cft|inter[eé]s|tasa)[^0-9]{0,16}([0-9]+(?:[\.,][0-9]+)?\s*%)/) || [])[0] || null;

  const totalPaid = installment && months ? installment * months : null;
  const hiddenCost = totalPaid && amount ? totalPaid - amount : null;
  const hiddenCostPercent = hiddenCost && amount ? pct(hiddenCost / amount) : null;
  let monthlyImpliedRate: number | null = null;
  let annualImpliedRate: number | null = null;
  if (amount && installment && months && installment * months > amount) {
    let lo = 0.000001, hi = 1;
    for (let i=0;i<90;i++) {
      const r = (lo + hi) / 2;
      const pv = installment * (1 - Math.pow(1 + r, -months)) / r;
      if (pv > amount) lo = r; else hi = r;
    }
    const r = (lo+hi)/2;
    monthlyImpliedRate = pct(r);
    annualImpliedRate = pct(Math.pow(1 + r, 12) - 1);
  }

  const missingFields = [
    !/cft/.test(lower) ? 'CFT' : '',
    !/tea/.test(lower) ? 'TEA' : '',
    !/tna/.test(lower) ? 'TNA' : '',
    !/(comisi[oó]n|gasto|seguro|iva|sellado|mantenimiento|otorgamiento|administrativo)/.test(lower) ? 'comisiones, seguros, impuestos y gastos' : '',
    !/(cancelaci[oó]n|prepago|mora|punitorio|atraso)/.test(lower) ? 'mora, punitorios y cancelación anticipada' : '',
    !/(monto neto|acreditado|descuento inicial)/.test(lower) ? 'monto neto efectivamente acreditado' : ''
  ].filter(Boolean);

  const warnings = [
    'En una oferta financiera, la cuota sola no alcanza para decidir: hay que mirar CFT, cargos, seguros, IVA, gastos y condiciones.',
    totalPaid && amount ? `Con los datos visibles, el total a pagar sería aprox. $${Math.round(totalPaid).toLocaleString('es-AR')}, es decir $${Math.round(hiddenCost || 0).toLocaleString('es-AR')} por encima del capital informado.` : 'No hay datos suficientes para calcular el costo total real.',
    monthlyImpliedRate ? `La tasa implícita estimada por cuota y plazo sería aprox. ${monthlyImpliedRate}% mensual (${annualImpliedRate}% efectivo anual).` : 'Faltan monto, cuota o plazo para estimar una tasa implícita.',
    missingFields.length ? `La publicación omite o no muestra con claridad: ${missingFields.join(', ')}.` : 'La publicación incluye algunos datos financieros relevantes, aunque igual conviene verificar contrato y simulación formal.'
  ];

  return {
    detected:true, amount, installment, months, explicitRate, totalPaid, hiddenCost, hiddenCostPercent, monthlyImpliedRate, annualImpliedRate,
    missingFields, warnings,
    questions:[
      '¿Cuál es el CFT efectivo anual con IVA incluido?',
      '¿Qué comisiones, seguros, gastos administrativos o cargos de otorgamiento se suman?',
      '¿La cuota publicada es fija, variable, promocional o sujeta a condiciones?',
      '¿Qué pasa si pago tarde o cancelo anticipadamente?',
      '¿El monto acreditado es igual al capital publicado o descuentan cargos al inicio?',
      '¿Cuál es el total final a pagar si cumplo todo el plan?'
    ],
    plainEnglish: totalPaid && amount ? `No mires solo la cuota: si tomás $${Math.round(amount).toLocaleString('es-AR')} y pagás ${months} cuotas de $${Math.round(installment || 0).toLocaleString('es-AR')}, devolverías aprox. $${Math.round(totalPaid).toLocaleString('es-AR')}. Ese dato debería aparecer con claridad junto al CFT.` : 'La publicación parece financiera, pero omite datos necesarios para calcular el costo real.'
  };
}
function detectPyramidRisk(text: string): PyramidRisk {
  const lower = text.toLowerCase();
  const signals: string[] = [];
  if (/(referid|traer gente|sumar personas|invitar amigos|arm[aá] tu equipo|red de distribuidores|niveles)/.test(lower)) signals.push('Menciona referidos, red, niveles o incorporación de nuevos participantes.');
  if (/(rentabilidad garantizada|ganancia garantizada|sin riesgo|retorno fijo|12% mensual|20% mensual|duplic[aá] tu dinero)/.test(lower)) signals.push('Promete rentabilidad elevada, garantizada o sin riesgo.');
  if (/(ingreso pasivo|libertad financiera|vivir sin trabajar|gana mientras duermes|millonario)/.test(lower)) signals.push('Apela a ingresos pasivos extraordinarios o libertad financiera.');
  if (/(cupos limitados|entr[aá] hoy|última oportunidad|solo hoy|no te quedes afuera)/.test(lower)) signals.push('Usa urgencia o escasez para acelerar la decisión.');
  if (!/(producto|servicio|cliente final|factura|contrato|cuit|regulad|cnv|bcra|domicilio|responsable)/.test(lower) && signals.length) signals.push('No se observa explicación clara del producto, actividad real, regulación o responsable identificado.');
  const risk = clamp(signals.length * 22, 0);
  return {
    detected: signals.length > 0,
    risk,
    level: risk >= 75 ? 'Alto' : risk >= 45 ? 'Medio' : risk > 0 ? 'Bajo/Medio' : 'No detectado',
    signals,
    explanation: signals.length ? 'El texto presenta indicadores compatibles con modelos que merecen verificación reforzada. Esto no implica afirmar que exista una estafa; indica que conviene exigir evidencia documental, regulación y explicación del origen económico de los pagos.' : '',
    questions: signals.length ? [
      '¿De dónde sale exactamente el dinero para pagar la rentabilidad o los premios?',
      '¿La ganancia depende de vender un producto real a clientes finales o de sumar nuevos participantes?',
      '¿Hay contrato, CUIT, domicilio, responsable legal y condiciones escritas?',
      '¿Está regulado por CNV, BCRA u otro organismo cuando corresponde?',
      '¿Qué pasa si dejan de entrar nuevos participantes?'
    ] : []
  };
}
function buildModules(text: string, fm: FinancialMath, pyramid: PyramidRisk): IntelligenceModule[] {
  const lower = text.toLowerCase();
  const promiseSignals = [
    /garantiz|100%|seguro|sin riesgo/.test(lower) ? 'Usa garantías absolutas o promesas sin margen de incertidumbre.' : '',
    /duplic|millon|gan[aá].*semana|sin trabajar|sin esfuerzo/.test(lower) ? 'Promete resultados extraordinarios o poco realistas.' : ''
  ].filter(Boolean);
  const evidenceSignals = [
    /[0-9]+\s*%|\$\s*[0-9]|mill[oó]n|miles/.test(lower) ? 'Incluye números o cifras que deberían tener fuente y contexto.' : '',
    !/(fuente|estudio|informe|link|según|segun|metodolog[ií]a)/.test(lower) ? 'No se observan fuentes, metodología ni respaldo verificable.' : ''
  ].filter(Boolean);
  const psychSignals = [
    /(hoy|ahora|última oportunidad|cupos|exclusivo|no te quedes afuera)/.test(lower) ? 'Usa urgencia, escasez o FOMO.' : '',
    /(miedo|fracaso|no pierdas|te vas a arrepentir|libertad financiera|vida soñada)/.test(lower) ? 'Apela a miedo, ambición o deseo aspiracional.' : ''
  ].filter(Boolean);
  const modules: IntelligenceModule[] = [
    {
      id:'evidence', title:'Auditor de evidencia', detected:true, risk:clamp(40 + evidenceSignals.length*22),
      summary:'Evalúa si las afirmaciones traen fuentes, metodología, condiciones y datos verificables.',
      signals:evidenceSignals.length ? evidenceSignals : ['No hay grandes cifras detectadas, pero igual conviene pedir respaldo si el texto induce una decisión.'],
      missingInformation:['fuentes verificables', 'condiciones de aplicación', 'metodología o base del dato'],
      questions:['¿Qué fuente independiente respalda la afirmación?', '¿Cuál es la muestra, fecha o metodología?', '¿Qué condiciones deberían cumplirse?']
    },
    {
      id:'psychology', title:'Detector de ingeniería psicológica', detected:psychSignals.length>0, risk:clamp(25 + psychSignals.length*28),
      summary:'Busca presión emocional, urgencia artificial, autoridad difusa, prueba social o deseo de ganancia rápida.',
      signals:psychSignals,
      missingInformation:['tiempo real para decidir', 'condiciones completas', 'alternativas razonables'],
      questions:['¿Por qué debería decidir ahora?', '¿Qué cambia si espero y comparo?', '¿La emoción usada está reemplazando evidencia?']
    },
    {
      id:'promise', title:'Detector de promesas', detected:promiseSignals.length>0, risk:clamp(30 + promiseSignals.length*30),
      summary:'Identifica garantías, resultados extraordinarios o beneficios presentados como casi seguros.',
      signals:promiseSignals,
      missingInformation:['probabilidad real del resultado', 'casos negativos', 'condiciones y limitaciones'],
      questions:['¿Qué porcentaje de usuarios consigue ese resultado?', '¿Qué pasa si no se cumple?', '¿Existe garantía contractual o solo una frase comercial?']
    }
  ];
  if (fm.detected) modules.push({
    id:'financial', title:'Inteligencia matemática financiera', detected:true, risk:clamp(45 + fm.missingFields.length*7 + (fm.hiddenCostPercent ? Math.min(25, fm.hiddenCostPercent/8) : 0)),
    summary:'Calcula costo visible, detecta información financiera omitida y traduce la cuota a costo real.',
    signals:fm.warnings,
    missingInformation:fm.missingFields,
    questions:fm.questions
  });
  if (pyramid.detected) modules.push({
    id:'pyramid', title:'Radar de pirámide / Ponzi / referidos', detected:true, risk:pyramid.risk,
    summary:pyramid.explanation,
    signals:pyramid.signals,
    missingInformation:['origen económico de los pagos', 'producto real', 'regulación', 'responsable legal', 'contrato'],
    questions:pyramid.questions
  });
  return modules;
}
function legalGuard(confidence: 'Baja'|'Media'|'Alta' = 'Media'): LegalGuard {
  return {
    confidence,
    disclaimer:'ChamuyoCheck genera una evaluación automatizada basada exclusivamente en el texto ingresado. No afirma que una persona o empresa mienta, no determina ilicitud y no reemplaza asesoramiento legal, financiero, médico ni profesional.',
    prohibitedLanguagePolicy:'El sistema debe evitar afirmaciones categóricas como “es estafa”, “miente” o “es fraude”. Debe usar formulaciones prudentes: “presenta indicadores”, “requiere evidencia”, “podría inducir a error” o “conviene verificar”.'
  };
}
function sanitizeLegalLanguage(value: string) {
  return value
    .replace(/\bes una estafa\b/gi, 'presenta indicadores que justifican verificación reforzada')
    .replace(/\bes un fraude\b/gi, 'presenta señales de riesgo que requieren análisis adicional')
    .replace(/\bmiente\b/gi, 'no aporta evidencia suficiente para respaldar esa afirmación')
    .replace(/\bengaña\b/gi, 'podría inducir a error si no se aporta información complementaria');
}
function demo(text: string): Analysis {
  const lower = text.toLowerCase();
  const fm = detectFinancialMath(text);
  const pyramid = detectPyramidRisk(text);
  const modules = buildModules(text, fm, pyramid);
  let score = 28;
  if (/garantiz|100%|seguro|sin riesgo|duplic|mill[oó]n|sin trabajar|sin esfuerzo/.test(lower)) score += 24;
  if (/urgente|hoy|ahora|última oportunidad|exclusivo|no te quedes/.test(lower)) score += 12;
  if (/miles de personas|expertos|secreto|m[eé]todo|revolucionario/.test(lower)) score += 9;
  if (fm.detected) score += 8 + Math.min(18, fm.missingFields.length * 4);
  if (pyramid.detected) score += Math.min(24, pyramid.risk/4);
  score = clamp(score, 38);
  const categoryScores = [
    { name:'Credibilidad', score:clamp(100-score), explanation:'Mide qué tan respaldado y verificable parece el texto con la información visible.' },
    { name:'Evidencia faltante', score:clamp(45 + (/(fuente|estudio|según|segun)/.test(lower) ? 5 : 30)), explanation:'Sube cuando hay cifras, promesas o autoridades sin fuentes verificables.' },
    { name:'Transparencia', score:clamp(75 - fm.missingFields.length*8 - (pyramid.detected ? 16 : 0)), explanation:'Evalúa si muestra costos, condiciones, riesgos, responsable y letra chica.' },
    { name:'Manipulación emocional', score:clamp(modules.find(m=>m.id==='psychology')?.risk || 25), explanation:'Mide urgencia, miedo, FOMO, deseo aspiracional o presión para decidir rápido.' },
    { name:'Riesgo financiero', score:fm.detected ? clamp(modules.find(m=>m.id==='financial')?.risk || 60) : 0, explanation:'Se activa cuando hay préstamos, cuotas, tasas, inversiones o financiación.' },
    { name:'Riesgo piramidal/Ponzi', score:pyramid.detected ? pyramid.risk : 0, explanation:'Se activa ante referidos, ingresos pasivos, rentabilidad garantizada o ausencia de negocio real claro.' }
  ];
  return {
    documentType: detectDocumentType(text),
    decisionQuestion:'¿Puedo confiar en este texto para tomar una decisión sin pedir más información?',
    score, risk:riskLabel(score), confidence: text.length > 250 ? 'Media/Alta' : 'Media',
    summary: fm.detected ? 'El texto activa el módulo financiero: la prioridad es mirar costo total, CFT, cargos omitidos y condiciones antes de decidir.' : pyramid.detected ? 'El texto activa el radar de referidos/pirámide: no implica una acusación, pero sí pide verificación reforzada.' : 'El texto presenta señales de persuasión o promesa que conviene contrastar con evidencia, condiciones y fuentes.',
    categoryScores, modules,
    flaggedPhrases:[{ phrase:text.slice(0,180), problem: fm.detected ? 'Debe contrastarse contra CFT, total a pagar, comisiones, seguros e impuestos.' : pyramid.detected ? 'Contiene señales que requieren verificar origen de ingresos, producto real y regulación.' : 'La afirmación necesita evidencia externa, condiciones y límites claros.', severity: score>=70?'Alta':'Media' }],
    issues:[...modules.flatMap(m=>m.signals).slice(0,8), 'El análisis es una alerta de riesgo, no una afirmación definitiva sobre veracidad o legalidad.'],
    questions:[...new Set(modules.flatMap(m=>m.questions))].slice(0,10),
    missingInformation:[...new Set(modules.flatMap(m=>m.missingInformation))].slice(0,10),
    worstReasonableScenario: fm.detected ? 'El peor escenario razonable es aceptar la oferta mirando solo la cuota y descubrir después cargos, seguros, mora o un CFT mucho mayor al esperado.' : pyramid.detected ? 'El peor escenario razonable es entrar por expectativa de ganancias y que el ingreso dependa de sumar participantes, sin flujo económico sostenible o documentación suficiente.' : 'El peor escenario razonable es tomar una decisión impulsiva basada en una promesa atractiva que luego dependa de condiciones no informadas.',
    improved: fm.detected ? 'Una versión más transparente debería mostrar monto neto acreditado, cuota, plazo, CFT con IVA, TEA, TNA, comisiones, seguros, gastos, mora, cancelación anticipada y total a pagar.' : pyramid.detected ? 'Una versión más transparente debería explicar producto real, fuente de ingresos, contrato, responsable, regulación, riesgos y qué ocurre si no ingresan nuevos participantes.' : 'Una versión más honesta debería explicar alcance, límites, requisitos, costos, riesgos, evidencia y condiciones verificables.',
    verdict: fm.detected ? 'No decidiría por la cuota hasta ver el costo financiero total y el contrato completo.' : pyramid.detected ? 'No lo descartaría automáticamente, pero pediría documentación fuerte antes de avanzar.' : score>=70 ? 'Requiere evidencia sólida antes de creerlo o comprar.' : 'Puede ser razonable, pero necesita más información para una decisión segura.',
    legalGuard: legalGuard(text.length > 400 ? 'Alta' : 'Media'),
    financialMath: fm.detected ? fm : undefined,
    pyramidRisk: pyramid.detected ? pyramid : undefined
  };
}
function normalizeArray(value: any, fallback: string[] = []) { return Array.isArray(value) ? value.map(String).filter(Boolean) : fallback; }
function normalizeModule(m: any): IntelligenceModule {
  return {
    id:String(m?.id || 'module'), title:String(m?.title || 'Módulo'), detected:Boolean(m?.detected ?? true), risk:clamp(m?.risk,50), summary:String(m?.summary || ''), signals:normalizeArray(m?.signals), missingInformation:normalizeArray(m?.missingInformation), questions:normalizeArray(m?.questions)
  };
}
function normalizeAnalysis(raw: any, text: string): Analysis {
  const fallback = demo(text);
  const pyramid = raw?.pyramidRisk?.detected ? { ...fallback.pyramidRisk, ...raw.pyramidRisk, detected:true, risk:clamp(raw.pyramidRisk.risk, fallback.pyramidRisk?.risk || 50), signals:normalizeArray(raw.pyramidRisk.signals, fallback.pyramidRisk?.signals || []), questions:normalizeArray(raw.pyramidRisk.questions, fallback.pyramidRisk?.questions || []) } as PyramidRisk : fallback.pyramidRisk;
  const fm = raw?.financialMath?.detected ? { ...fallback.financialMath, ...raw.financialMath, detected:true, missingFields:normalizeArray(raw.financialMath.missingFields, fallback.financialMath?.missingFields || []), warnings:normalizeArray(raw.financialMath.warnings, fallback.financialMath?.warnings || []), questions:normalizeArray(raw.financialMath.questions, fallback.financialMath?.questions || []), plainEnglish:String(raw.financialMath.plainEnglish || fallback.financialMath?.plainEnglish || '') } as FinancialMath : fallback.financialMath;
  return {
    documentType:String(raw?.documentType || fallback.documentType),
    decisionQuestion:String(raw?.decisionQuestion || fallback.decisionQuestion),
    score:clamp(raw?.score, fallback.score),
    risk:String(raw?.risk || fallback.risk),
    confidence:String(raw?.confidence || fallback.confidence),
    summary:sanitizeLegalLanguage(String(raw?.summary || fallback.summary)),
    categoryScores:Array.isArray(raw?.categoryScores) && raw.categoryScores.length ? raw.categoryScores.slice(0,8).map((c:any)=>({name:String(c?.name||'Categoría'),score:clamp(c?.score,50),explanation:sanitizeLegalLanguage(String(c?.explanation||''))})) : fallback.categoryScores,
    modules:Array.isArray(raw?.modules) && raw.modules.length ? raw.modules.slice(0,8).map(normalizeModule) : fallback.modules,
    flaggedPhrases:Array.isArray(raw?.flaggedPhrases) && raw.flaggedPhrases.length ? raw.flaggedPhrases.slice(0,6).map((f:any)=>({phrase:String(f?.phrase||'').slice(0,240),problem:sanitizeLegalLanguage(String(f?.problem||'')),severity:['Baja','Media','Alta'].includes(f?.severity)?f.severity:'Media'})) : fallback.flaggedPhrases,
    issues:normalizeArray(raw?.issues, fallback.issues).map(sanitizeLegalLanguage).slice(0,10),
    questions:normalizeArray(raw?.questions, fallback.questions).slice(0,12),
    missingInformation:normalizeArray(raw?.missingInformation, fallback.missingInformation).slice(0,12),
    worstReasonableScenario:sanitizeLegalLanguage(String(raw?.worstReasonableScenario || fallback.worstReasonableScenario)),
    improved:sanitizeLegalLanguage(String(raw?.improved || fallback.improved)),
    verdict:sanitizeLegalLanguage(String(raw?.verdict || fallback.verdict)),
    legalGuard:legalGuard(['Baja','Media','Alta'].includes(raw?.legalGuard?.confidence)?raw.legalGuard.confidence:'Media'),
    financialMath:fm,
    pyramidRisk:pyramid
  };
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length < 20) return NextResponse.json({ error:'Pegá un texto de al menos 20 caracteres.' }, { status:400 });
    const cleanText = text.trim();
    if (!process.env.OPENAI_API_KEY) return NextResponse.json(demo(cleanText));
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const local = demo(cleanText);
    const prompt = `Analizá este texto para ChamuyoCheck V4, un sistema argentino de auditoría de credibilidad.\n\nPrincipios legales obligatorios:\n- No afirmes que alguien miente, estafa, defrauda o comete un delito.\n- Hablá como auditor de riesgo: "presenta indicadores", "requiere evidencia", "podría inducir a error", "conviene verificar".\n- El resultado no es veredicto legal ni verdad objetiva.\n\nArquitectura V4:\n1) Identificá tipo de documento.\n2) Activá módulos: evidencia, psicología, promesas, financiero, pirámide/Ponzi/referidos, jurídico/regulatorio si corresponde.\n3) Si hay préstamos/cuotas/tasas/inversiones, usá el cálculo local y explicá costo real.\n4) Si hay referidos/rentabilidad garantizada/ingreso pasivo, activá radar piramidal con lenguaje prudente.\n5) Indicá información faltante y peor escenario razonable.\n\nCálculo local y baseline:\n${JSON.stringify(local)}\n\nRespondé SOLO JSON válido con esta estructura exacta:\n{ "documentType": string, "decisionQuestion": string, "score": number, "risk": string, "confidence": string, "summary": string, "categoryScores": [{"name": string,"score": number,"explanation": string}], "modules": [{"id": string,"title": string,"detected": boolean,"risk": number,"summary": string,"signals": string[],"missingInformation": string[],"questions": string[]}], "flaggedPhrases": [{"phrase": string,"problem": string,"severity":"Baja"|"Media"|"Alta"}], "issues": string[], "questions": string[], "missingInformation": string[], "worstReasonableScenario": string, "improved": string, "verdict": string, "financialMath": object|null, "pyramidRisk": object|null }\n\nTexto:\n${cleanText.slice(0,12000)}`;
    const completion = await openai.chat.completions.create({
      model:'gpt-4o-mini',
      messages:[
        { role:'system', content:'Sos un comité de auditores prudente: financiero, matemático, jurídico preventivo, psicología comercial y evidencia. Tu tarea es ayudar a decidir, no acusar.' },
        { role:'user', content:prompt }
      ],
      response_format:{ type:'json_object' },
      temperature:0.15
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    return NextResponse.json(normalizeAnalysis(JSON.parse(raw), cleanText));
  } catch (e) {
    return NextResponse.json({ error:'Error analizando el texto.' }, { status:500 });
  }
}
