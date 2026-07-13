
'use client';
import { useEffect, useRef, useState } from 'react';
import { readLocalHistory, type HistoryItem } from '../src/lib/history/localHistory';
import { TERMS_SECTIONS, TERMS_STORAGE_KEY, TERMS_VERSION } from '../src/lib/legal/terms';
import { extractImageTextInBrowser } from '../src/lib/extractors/browserOcr';

type Cat = { name: string; score: number; explanation: string };
type Analysis = {
  scopeStatus?: 'supported' | 'out-of-scope';
  scopeReason?: string;
  supportedAreas?: string[];
  documentIcon: string;
  documentType: string;
  documentFocus: string;
  extractionStatus: string;
  extractedChars: number;
  extractedPreview?: string;
  score: number;
  risk: string;
  confidence: string;
  detectedTheme: string;
  detectedInput: string;
  centralQuestion: string;
  summary: string;
  prudentConclusion: string;
  verdict: string;
  categoryScores: Cat[];
  modules: Cat[];
  flaggedPhrases: { phrase: string; problem: string; severity: string }[];
  issues: string[];
  questions: string[];
  missingInformation: string[];
  worstCase: string;
  improved: string;
  legalSafeguard: string;
  evidenceFound?: string[];
  scoreExplanation?: string[];
  resultJustification?: string[];
  legalNotice?: {
    limitations: string[];
    prohibitedSoleUses: string[];
  };
  refutationPoints?: string[];
  improvementPlan?: string[];
  topic?: string;
  topicLabel?: string;
  topicHint?: string;
  externalVerification?: {
    externalVerificationRequired: boolean;
    externalVerificationPerformed: boolean;
    conclusion?: string;
    rationale?: string;
    execution?: {
      status: string;
      records: Array<{ url: string; title: string; sourceType: string; sourceDate?: string; official: boolean }>;
      errors: string[];
    } | null;
  };
  financialAnalysis?: {
    principal: number | null;
    cashPrice: number | null;
    downPayment: number | null;
    installment: number | null;
    months: number | null;
    tnaPercent: number | null;
    teaPercent: number | null;
    cftPercent: number | null;
    calculatedInstallmentsTotal: number | null;
    calculatedKnownTotal: number | null;
    financingCost: number | null;
    financingCostPercent: number | null;
    impliedMonthlyRatePercent: number | null;
    impliedTeaPercent: number | null;
    missingFields: string[];
    warnings: string[];
    evidence: string[];
    calculationBasis: string[];
    confidence: string;
  } | null;
  scamRiskAnalysis?: {
    applicable: boolean;
    score: number;
    level: 'bajo' | 'medio' | 'alto' | 'muy-alto';
    signals: Array<{ id: string; label: string; evidence: string; weight: number }>;
    checks: string[];
    missingInformation: string[];
    conclusion: string;
  } | null;
  commercialCourseAnalysis?: {
    applicable: boolean;
    offerType: string;
    observedPromises: string[];
    disclosedConditions: string[];
    evidenceClaims: string[];
    coherenceIssues: string[];
    missingInformation: string[];
    conclusion: string;
  } | null;
  argentinaLegalAnalysis?: {
    applicable: boolean;
    jurisdiction: 'argentina' | 'not-specified';
    area: 'contracts' | 'criminal' | 'family' | 'other-legal';
    areaLabel: string;
    issues: Array<{ id: string; label: string; evidence: string; explanation: string; severity: 'baja' | 'media' | 'alta' }>;
    factsNeeded: string[];
    sourceTargets: string[];
    conclusion: string;
  } | null;
  sourceUrl?: string | null;
};

type InputMode = 'Texto' | 'PDF' | 'Imagen' | 'Web' | 'YouTube';

const FREE_LIMIT = 3;
const FREE_CHARS = 250;

function Bar({ score }: { score: number }) {
  return <div className="bar"><div className="fill" style={{ ['--w' as any]: `${Math.max(0, Math.min(100, score || 0))}%` }} /></div>;
}

function detectUrlType(s: string) {
  if (/youtu\.be|youtube\.com/i.test(s)) return 'YouTube';
  if (/^https?:\/\//i.test(s)) return 'Web';
  return 'Texto';
}

function fmt(bytes: number) {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function inferLocalDoc(text: string, file: File | null, url: string) {
  const source = (text + ' ' + (file?.name || '') + ' ' + url).toLowerCase();
  if (file?.type?.includes('pdf') || file?.name?.toLowerCase().endsWith('.pdf')) return { icon: '📄', label: 'PDF recibido', focus: 'Se leerá el contenido real del PDF antes de responder' };
  if (file?.type?.startsWith('image/')) return { icon: '🖼️', label: 'Imagen/captura recibida', focus: 'Preparada para análisis visual' };
  if (/youtu\.be|youtube\.com/.test(source)) return { icon: '▶️', label: 'Video de YouTube detectado', focus: 'Analizando enlace y texto disponible' };
  if (/^https?:\/\//.test(url)) return { icon: '🌐', label: 'Página web detectada', focus: 'Analizando enlace y texto disponible' };
  if (/estafa|fraude|ponzi|pir[aá]mid|referidos|rentabilidad garantizada/.test(source)) return { icon: '⚠️', label: 'Posible estafa u oferta engañosa', focus: 'Promesas, identidad, autorización y evidencia' };
  if (/pr[eé]stamo|cuota|cft|tea|tna|\$/.test(source)) return { icon: '💳', label: 'Oferta financiera posible', focus: 'Costos ocultos y CFT' };
  if (/contrato|cl[aá]usula|ley|delito|pena|divorcio|alimentos/.test(source)) return { icon: '⚖️', label: 'Consulta legal o documento', focus: 'Normativa argentina, obligaciones y alcance' };
  return { icon: '📝', label: 'Consulta recibida', focus: 'Primero se verificará si está dentro del alcance' };
}

function getInputLabel(kind: string, hasRealFile = false) {
  switch (kind) {
    case 'PDF':
      return 'documento PDF';
    case 'Imagen':
      return 'imagen';
    case 'Web':
      return 'sitio web';
    case 'YouTube':
      return 'video de YouTube';
    case 'Archivo':
      return hasRealFile ? 'archivo' : 'texto ingresado';
    default:
      return 'texto ingresado';
  }
}

function getInputDisplay(kind: string) {
  switch (kind) {
    case 'PDF':
      return 'PDF';
    case 'Imagen':
      return 'Imagen';
    case 'Web':
      return 'Web';
    case 'YouTube':
      return 'YouTube';
    default:
      return 'Texto';
  }
}

function getTopicMeta(topic?: string) {
  switch (topic) {
    case 'health':
      return {
        label: 'Salud',
        hint: 'Revisá evidencia médica, riesgos y advertencias.',
        advice: ['Verificá si hay respaldo clínico o referencias científicas.', 'Contrastá la recomendación con fuentes médicas reputadas.']
      };
    case 'finance':
      return {
        label: 'Finanzas',
        hint: 'Revisá costos reales, tasas y condiciones.',
        advice: ['Pedí el costo total, las tasas y la letra chica.', 'Contrastá la oferta con condiciones regulatorias o de contrato.']
      };
    case 'legal':
      return {
        label: 'Legal',
        hint: 'Revisá obligaciones, penalidades y cláusulas.',
        advice: ['Contrastá cláusulas con el contrato o el marco legal.', 'Pedí contexto legal antes de tomar una decisión.']
      };
    case 'academic':
      return {
        label: 'Académico',
        hint: 'Revisá fuentes, métodos y trazabilidad.',
        advice: ['Pedí fuentes y contexto metodológico.', 'No concluí autoría o uso de IA sin respaldo.']
      };
    case 'commercial-promise':
      return {
        label: 'Promesa comercial',
        hint: 'Revisá garantías, urgencia y respaldo.',
        advice: ['Pedí el respaldo de la promesa y los términos.', 'Contrastá la oferta con la realidad del producto o servicio.']
      };
    case 'employment':
      return {
        label: 'Empleo',
        hint: 'Revisá condiciones, sueldo y contexto de contratación.',
        advice: ['Pedí detalles del puesto y la empresa.', 'Contrastá lo anunciado con condiciones reales.']
      };
    case 'public-claim':
      return {
        label: 'Afirmación pública',
        hint: 'Revisá la fuente, el contexto y la fecha.',
        advice: ['Buscá la fuente original y la fecha de publicación.', 'Verificá si la afirmación se sostiene en múltiples fuentes.']
      };
    case 'product-service':
      return {
        label: 'Producto o servicio',
        hint: 'Revisá desempeño, garantías y comparativas.',
        advice: ['Pedí pruebas reales o reseñas verificables.', 'Contrastá la promesa con experiencia o datos.']
      };
    default:
      return {
        label: 'Credibilidad general',
        hint: 'Conviene verificar la afirmación y su contexto.',
        advice: ['Pedí una fuente secundaria o primaria para contrastar.', 'Tomá la conclusión como orientación, no como verdad absoluta.']
      };
  }
}

function getTopicSectionTemplates(topic: string | undefined, inputLabel: string, shortText: boolean, inputKind: string) {
  switch (topic) {
    case 'health':
      return {
        strengths: ['Se identifican señales de riesgo o contexto clínico que conviene revisar.', 'La revisión prioriza respaldo médico y advertencias de seguridad.'],
        weaknesses: ['Faltan referencias clínicas, contexto del paciente o contraindicaciones visibles.', 'No se observan dosis, duración ni límites claros del uso.'],
        risks: ['La recomendación podría implicar riesgos si se toma sin verificación médica.', 'Hay margen para confusión entre evidencia y consejo clínico.'],
        verify: ['¿Qué guías o fuentes médicas respaldan la recomendación?', '¿Hay dosis, contraindicaciones o contexto de uso explícitos?'],
        recommendations: ['Pedí respaldo médico o fuentes científicas antes de actuar.', 'Contrastá la recomendación con guías clínicas y contexto real.']
      };
    case 'finance':
      return {
        strengths: ['Se reconoce el intento de mostrar costos y condiciones de forma explícita.', 'La revisión resalta la necesidad de ver la letra chica y el costo total.'],
        weaknesses: ['Faltan CFT, TEA, TNA, comisiones, seguros o IVA visibles.', 'No se observan condiciones completas del contrato o del financiamiento.'],
        risks: ['La oferta puede esconder costos o condiciones desfavorables.', 'Hay riesgo de asumir una promesa sin revisar el costo real.'],
        verify: ['¿Cuál es el costo total real con todas las cargas incluidas?', '¿Qué condiciones, comisiones y límites aparecen en el contrato?'],
        recommendations: ['Pedí el costo total y la letra chica antes de decidir.', 'Verificá tasas, cargos y condiciones regulatorias.']
      };
    case 'legal':
      return {
        strengths: ['Se identifican cláusulas, derechos o obligaciones que merecen revisión.', 'La lectura pone foco en obligaciones y contexto contractual.'],
        weaknesses: ['Faltan términos claros, excepciones o jurisdicción visible.', 'No se observan obligaciones, penalidades o alcance completo.'],
        risks: ['Una cláusula ambigua puede generar obligaciones o pérdidas inesperadas.', 'La decisión puede basarse en un texto incompleto o poco claro.'],
        verify: ['¿Qué cláusulas son clave y qué obligaciones implican?', '¿Qué marco legal o jurisdicción rige el documento?'],
        recommendations: ['Contrastá cláusulas con el contrato real y el marco aplicable.', 'Pedí aclaraciones sobre obligaciones, penalidades y derechos.']
      };
    case 'employment':
      return {
        strengths: ['Se identifican detalles del puesto, empresa o condiciones que conviene revisar.', 'La revisión señala si hay elementos de contratación o responsabilidades visibles.'],
        weaknesses: ['Faltan salario, requisitos, responsabilidades o contexto de contratación.', 'No se observan condiciones claras de contratación o empresa.'],
        risks: ['La oferta puede ser engañosa o incompleta si no se revisan los detalles.', 'Hay riesgo de asumir condiciones reales sin respaldo.'],
        verify: ['¿Qué salario, requisitos o condiciones de contratación aparecen?', '¿Qué datos de la empresa o del puesto están faltando?'],
        recommendations: ['Pedí detalles del puesto, empresa y condiciones reales.', 'Contrastá la oferta con información verificable antes de postularte.']
      };
    case 'academic':
      return {
        strengths: ['Se nota estructura, argumentación o referencias que pueden respaldar la revisión.', 'La evaluación aprovecha fuentes, método o trazabilidad cuando existen.'],
        weaknesses: ['Faltan fuentes, método, bibliografía o defensa del trabajo.', 'No se observan pruebas de autoría, trazabilidad o proceso claro.'],
        risks: ['La conclusión puede ser excesiva si no hay base metodológica o bibliográfica.', 'Hay riesgo de asumir autoría o uso de IA sin pruebas.'],
        verify: ['¿Qué fuentes, método o borradores sostienen el trabajo?', '¿Puede el autor defender el resultado con evidencia concreta?'],
        recommendations: ['Pedí fuentes y contexto metodológico antes de concluir.', 'No tomes como prueba de autoría o IA sin respaldo.']
      };
    case 'public-claim':
      return {
        strengths: ['Se reconocen señales de fuente, fecha o contexto que conviene revisar.', 'La revisión prioriza la trazabilidad del mensaje y su origen.'],
        weaknesses: ['Faltan fuente original, fecha o contexto verificable.', 'No se observa contraste con otras fuentes o referencias.'],
        risks: ['La afirmación puede circular sin respaldo suficiente.', 'Hay riesgo de compartir información fuera de contexto.'],
        verify: ['¿Cuál es la fuente original y la fecha de publicación?', '¿Se sostiene la afirmación en otras fuentes independientes?'],
        recommendations: ['Buscá la fuente original y el contexto antes de compartirla.', 'Contrastá la afirmación con fuentes independientes.']
      };
    case 'product-service':
      return {
        strengths: ['Se reconocen características, garantías o datos de producto o servicio.', 'La revisión pone foco en desempeño, respaldo y comparativas.'],
        weaknesses: ['Faltan pruebas reales, reseñas verificables o garantías claras.', 'No se observan comparativas o respaldo del desempeño.'],
        risks: ['La promesa puede ser exagerada o no verificable.', 'Hay riesgo de asumir calidad o rendimiento sin comprobación.'],
        verify: ['¿Qué pruebas reales o testimonios verificables respaldan la oferta?', '¿Qué garantías, condiciones o comparativas están evidenciadas?'],
        recommendations: ['Pedí pruebas reales o reseñas verificables antes de decidir.', 'Contrastá la promesa con la experiencia o los datos del producto.']
      };
    default:
      return {
        strengths: [`El ${inputLabel} aporta contexto suficiente para orientar la revisión.`],
        weaknesses: [shortText && inputKind === 'Texto' ? 'La afirmación requiere verificación externa y contexto adicional.' : `Conviene completar la verificación del ${inputLabel} con fuentes o condiciones claras.`],
        risks: [`El ${inputLabel} necesita contraste antes de tomar una decisión.`],
        verify: [`¿Qué evidencia externa respalda esta afirmación sobre ${inputLabel}?`],
        recommendations: ['Pedí una fuente secundaria o primaria para contrastar la afirmación.']
      };
  }
}

function buildEvidenceBasedSections(text: string, inputKind: string) {
  const lowerText = text.toLowerCase();
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risks: string[] = [];

  const hasStatistics = /%|porcentaje|estad|cifra|cifras|promedio|monto|millones|miles|crec[ií]o|ca[ií]da/.test(lowerText);
  const hasTemporal = /\b(año|años|mes|meses|semana|trimestre|cuatrimestre|per[ií]odo|fecha|agosto|enero|febrero|marzo|abril|mayo|junio|julio|septiembre|octubre|noviembre|diciembre)\b|\b\d{4}\b/i.test(text);
  const hasInstitutionalSource = /(secretar[ií]a|ministerio|sipa|banco|instituto|organismo|gobierno|oficina|comisi[oó]n|consejo|autoridad|federal|provincial|nacional|municipal)/i.test(text);
  const hasAuthor = /\bautor\b|\bfirma\b|\bfirma[s]?\b|\bresponsable\b|\bredacci[oó]n\b/i.test(text);
  const hasSource = /\bfuente\b|\bfuentes\b|\bseg[uú]n\b|\binforme\b|\bcomunicado\b|\bnota\b/i.test(text);
  const hasMethodology = /metodolog|m[eé]todo|muestra|encuesta|c[aá]lculo|criterio|procedimiento|muestreo/i.test(lowerText);
  const hasLinks = /https?:\/\//i.test(text);
  const hasDate = /\b\d{4}\b|\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(text);

  if (hasStatistics) strengths.push('Se citan estadísticas y porcentajes.');
  if (hasTemporal) strengths.push('Se identifica un período temporal.');
  if (hasInstitutionalSource) strengths.push('Se mencionan organismos oficiales o fuentes institucionales.');
  if (hasLinks) strengths.push('Se incluyen enlaces a fuentes o referencias.');
  if (hasMethodology) strengths.push('Se explicita una metodología o criterio de análisis.');
  if (hasSource) strengths.push('Se identifica una fuente o referencia.');
  if (hasAuthor) strengths.push('Se identifica un autor o responsable.');

  if (!strengths.length) strengths.push('No se identificaron fortalezas objetivas.');

  if (!hasSource) weaknesses.push('No hay una fuente o referencia claramente identificada.');
  if (!hasLinks) weaknesses.push('No hay enlace a la fuente original.');
  if (!hasMethodology) weaknesses.push('Falta metodología o criterio explícito.');
  if (!hasDate) weaknesses.push('No se especifica la fecha.');
  if (!hasAuthor) weaknesses.push('No se identifica el autor o responsable.');

  if (text.trim().length < 220) risks.push('Puede omitir contexto relevante.');
  if (hasStatistics && !hasLinks) risks.push('Requiere contrastar con la fuente oficial.');
  if (inputKind === 'PDF' && text.trim().length > 0) risks.push('Puede resumir información sin el informe completo.');
  if (!risks.length) risks.push('Requiere contrastar la interpretación con la fuente original.');

  return {
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    risks: risks.slice(0, 4)
  };
}

function buildReportSections(analysis: Analysis, inputKind: string, text: string, hasRealFile = false) {
  const shortText = inputKind === 'Texto' && text.trim().length < 220;
  const topic = getTopicMeta(analysis.topic);
  const inputLabel = getInputLabel(inputKind, hasRealFile);
  const templates = getTopicSectionTemplates(analysis.topic, inputLabel, shortText, inputKind);
  const evidenceSections = buildEvidenceBasedSections(text, inputKind);

  const strengths = evidenceSections.strengths;
  const weaknesses = evidenceSections.weaknesses;
  const risks = evidenceSections.risks;
  const verify = (analysis.questions || []).filter(Boolean).slice(0, 4);
  const recommendations = (analysis.improvementPlan || []).filter(Boolean).slice(0, 4);

  if (verify.length < 2) {
    verify.push(...templates.verify.filter((item) => !verify.includes(item)).slice(0, 2));
  }
  if (recommendations.length < 2) {
    recommendations.push(...templates.recommendations.filter((item) => !recommendations.includes(item)).slice(0, 2));
  }

  return {
    strengths,
    weaknesses,
    risks,
    verify,
    recommendations,
    contextCard: topic.label === 'Credibilidad general' ? null : { title: `Verificación de ${topic.label.toLowerCase()}`, items: topic.advice }
  };
}

function moduleCard(c: Cat, i: number) {
  return <div className="module" key={i}><b>{c.name}</b><Bar score={c.score} /><p>{c.explanation}</p></div>;
}

function getScoreExplanationItems(analysis: Analysis, inputKind: string, text: string, hasRealFile = false) {
  const items: string[] = [];
  const inputLabel = getInputLabel(inputKind, hasRealFile);

  (analysis.categoryScores || []).filter((cat) => Number(cat?.score) > 0).slice(0, 6).forEach((cat) => {
    if (cat?.name) {
      items.push(`${cat.name}: ${cat.score}/100 — ${cat.explanation}`);
    }
  });

  (analysis.issues || []).filter(Boolean).slice(0, 4).forEach((issue) => {
    items.push(`Señal de revisión: ${issue}`);
  });

  if (text.trim()) {
    const hints = [] as string[];
    if (/\$\s?\d/.test(text)) hints.push('hay montos o cifras visibles');
    if (/%/.test(text)) hints.push('hay porcentajes visibles');
    if (/https?:\/\//i.test(text)) hints.push('hay enlaces visibles');
    if (/\b\d{4}\b/.test(text)) hints.push('hay fechas o años visibles');
    if (hints.length) {
      items.push(`Contexto detectado: el ${inputLabel} ${hints.join(', ')}.`);
    }
  }

  if (analysis.topic === 'health') {
    items.push('Se penaliza cuando la afirmación promete efectos o seguridad sin una base clínica clara.');
  } else if (analysis.topic === 'finance') {
    items.push('Se penaliza cuando faltan costos, tasas, cargos o condiciones visibles.');
  } else if (analysis.topic === 'legal') {
    items.push('Se penaliza cuando hay cláusulas ambiguas o ausencia de contexto contractual.');
  } else if (analysis.topic === 'employment') {
    items.push('Se penaliza cuando no hay condiciones de contratación, puesto o empresa verificables.');
  } else if (analysis.topic === 'academic') {
    items.push('Se penaliza cuando faltan fuentes, método o trazabilidad del trabajo.');
  } else if (analysis.topic === 'public-claim') {
    items.push('Se penaliza cuando la afirmación carece de fuente original, fecha o contexto.');
  } else if (analysis.topic === 'product-service') {
    items.push('Se penaliza cuando la oferta carece de pruebas reales o garantías verificables.');
  }

  if (!items.length) {
    items.push(...(analysis.scoreExplanation || []));
  }

  return items.slice(0, 8);
}

export default function Page() {
  const [plan, setPlan] = useState<'starter' | 'pro'>('pro');
  const [used, setUsed] = useState(0);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [tab, setTab] = useState('Resumen');
  const [activeInput, setActiveInput] = useState<InputMode>('Texto');
  const [showFullSummary, setShowFullSummary] = useState(false);
  const [showScoreExplanation, setShowScoreExplanation] = useState(false);
  const [activeView, setActiveView] = useState<'inicio' | 'historial' | 'favoritos' | 'plantillas' | 'comparar' | 'mejorar' | 'ajustes'>('inicio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [favoritesItems, setFavoritesItems] = useState<string[]>([]);
  const [templatesItems, setTemplatesItems] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsError, setTermsError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setUsed(Number(localStorage.getItem('cc_used') || '0')); }, []);
  useEffect(() => {
    try {
      const acceptance = JSON.parse(localStorage.getItem(TERMS_STORAGE_KEY) || '{}');
      setTermsAccepted(acceptance.version === TERMS_VERSION && Boolean(acceptance.acceptedAt));
    } catch {
      setTermsAccepted(false);
    }
  }, []);
  useEffect(() => {
    setHistoryItems(readLocalHistory());
    if (typeof window === 'undefined') return;
    try {
      setFavoritesItems(JSON.parse(localStorage.getItem('cc_favorites') || '[]'));
      setTemplatesItems(JSON.parse(localStorage.getItem('cc_templates') || '[]'));
    } catch {
      setFavoritesItems([]);
      setTemplatesItems([]);
    }
  }, []);

  function setUsage(n: number) {
    setUsed(n);
    localStorage.setItem('cc_used', String(n));
  }

  function acceptCurrentTerms() {
    localStorage.setItem(TERMS_STORAGE_KEY, JSON.stringify({ version: TERMS_VERSION, acceptedAt: new Date().toISOString() }));
    setTermsAccepted(true);
    setTermsError('');
    setShowTerms(false);
  }

  function revokeTermsAcceptance() {
    localStorage.removeItem(TERMS_STORAGE_KEY);
    setTermsAccepted(false);
  }

  const isPro = plan === 'pro';
  const detected = file ? (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : file.type.startsWith('image/') ? 'Imagen' : 'Archivo') : url ? detectUrlType(url) : activeInput;
  const localDoc = inferLocalDoc(text, file, url);
  const locked = !isPro && used >= FREE_LIMIT;
  const textTooLong = !isPro && text.length > FREE_CHARS;
  const proInput = !isPro && detected !== 'Texto';

  function onFile(f: File | undefined | null) {
    if (!f) return;
    setFile(f);
    setAnalysis(null);
    setActiveInput(f.type.startsWith('image/') ? 'Imagen' : 'PDF');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    onFile(e.dataTransfer.files?.[0]);
  }

  function chooseInputMode(mode: InputMode) {
    setActiveInput(mode);
    if (mode === 'PDF' || mode === 'Imagen') {
      setUrl('');
      setFile(null);
      fileRef.current?.click();
    } else {
      setFile(null);
      if (mode === 'Web' || mode === 'YouTube') {
        setUrl('');
      }
    }
    setAnalysis(null);
  }

  async function analyze() {
    if (locked || textTooLong || proInput) return;
    if (!termsAccepted) {
      setTermsError('Debés leer y aceptar los Términos y Condiciones antes de analizar contenido.');
      setShowTerms(true);
      return;
    }
    setLoading(true);
    setSteps([]);
    setAnalysis(null);
    const seq = ['Contenido recibido', 'Extrayendo texto del documento', 'Clasificando el alcance', 'Activando la especialidad correspondiente', 'Verificando evidencia disponible', 'Generando informe'];
    for (const s of seq) {
      setSteps((p) => [...p, '✓ ' + s]);
      await new Promise((r) => setTimeout(r, 180));
    }
    try {
      const form = new FormData();
      form.append('text', text);
      form.append('url', url);
      form.append('inputType', detected);
      form.append('termsAccepted', 'true');
      form.append('termsVersion', TERMS_VERSION);
      if (file?.type.startsWith('image/')) {
        setSteps((previous) => [...previous, '✓ Leyendo la imagen en este dispositivo']);
        const ocr = await extractImageTextInBrowser(file);
        if (!ocr.ok) throw new Error(ocr.note);
        form.append('ocrText', ocr.text);
        form.append('ocrConfidence', String(ocr.confidence));
        form.append('clientFileName', file.name);
        form.append('clientFileType', file.type);
      } else if (file) {
        form.append('file', file);
      }
      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), 60_000);
      let res: Response;
      try {
        res = await fetch('/api/analyze', { method: 'POST', body: form, signal: controller.signal });
      } finally {
        window.clearTimeout(requestTimeout);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error');
      setAnalysis(data);
      if (!isPro) setUsage(used + 1);
      setTimeout(() => document.getElementById('informe')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) {
      alert(e?.name === 'AbortError'
        ? 'El análisis superó el tiempo máximo. La página quedó liberada para que puedas volver a intentar.'
        : e.message || 'No se pudo analizar');
    } finally {
      setLoading(false);
    }
  }

  const score = analysis?.score ?? 35;
  const getChamuyoColor = (s: number) => s > 80 ? '#8b0000' : s > 60 ? 'var(--red)' : s > 40 ? 'var(--yellow)' : 'var(--green)';
  const getChamuyoLabel = (s: number) => s > 80 ? 'Chamuyo extremo' : s > 60 ? 'Alto chamuyo' : s > 40 ? 'Requiere verificación' : s > 20 ? 'Bajo chamuyo' : 'Muy poco chamuyo';
  const getChamuyoAdvice = (s: number) => s > 80 ? { txt: 'Contenido muy dudoso, no recomendado', color: '#8b0000' } : s > 60 ? { txt: 'Hay se\u00f1ales de manipulaci\u00f3n', color: 'var(--red)' } : s > 40 ? { txt: 'Conviene verificar algunos puntos', color: 'var(--yellow)' } : s > 20 ? { txt: 'Bajo riesgo de manipulaci\u00f3n', color: 'var(--green)' } : { txt: 'Contenido s\u00f3lido y confiable', color: 'var(--green)' };
  const semaforo = getChamuyoAdvice(score);
  const reportSections = analysis ? buildReportSections(analysis, detected, text, Boolean(file)) : null;
  const scoreExplanationItems = analysis ? getScoreExplanationItems(analysis, analysis.detectedInput || detected, text, Boolean(file)) : [];
  const shouldShowScoreExplanationPanel = showScoreExplanation && scoreExplanationItems.length > 0;
  const toggleScoreExplanation = () => setShowScoreExplanation((value) => !value);
  const executiveSummaryText = showFullSummary ? analysis?.summary : analysis?.verdict;
  const openHome = () => {
    setActiveView('inicio');
    setMobileMenuOpen(false);
    setShowFullSummary(false);
    setShowScoreExplanation(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => document.getElementById('inicio-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };
  const startNewAnalysis = () => {
    setAnalysis(null);
    setText('');
    setUrl('');
    setFile(null);
    setActiveInput('Texto');
    setShowFullSummary(false);
    setShowScoreExplanation(false);
    setActiveView('inicio');
    setMobileMenuOpen(false);
    setTab('Resumen');
    setLoading(false);
    setSteps([]);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => document.getElementById('inicio-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };
  const openHistory = () => {
    setActiveView('historial');
    setMobileMenuOpen(false);
    setShowFullSummary(false);
    setShowScoreExplanation(false);
  };
  const openFavorites = () => {
    setActiveView('favoritos');
    setMobileMenuOpen(false);
    setShowFullSummary(false);
    setShowScoreExplanation(false);
  };
  const openTemplates = () => {
    setActiveView('plantillas');
    setMobileMenuOpen(false);
    setShowFullSummary(false);
    setShowScoreExplanation(false);
  };
  const openCompare = () => {
    setActiveView('comparar');
    setMobileMenuOpen(false);
    setShowFullSummary(false);
    setShowScoreExplanation(false);
  };
  const openImprove = () => {
    setActiveView('mejorar');
    setMobileMenuOpen(false);
    setShowFullSummary(false);
    setShowScoreExplanation(false);
  };
  const openSettings = () => {
    setActiveView('ajustes');
    setMobileMenuOpen(false);
    setShowFullSummary(false);
    setShowScoreExplanation(false);
  };
  const sectionTitle = activeView === 'historial' ? 'Historial' : activeView === 'favoritos' ? 'Favoritos' : activeView === 'plantillas' ? 'Plantillas' : activeView === 'comparar' ? 'Comparar' : activeView === 'mejorar' ? 'Mejorar documento' : activeView === 'ajustes' ? 'Ajustes' : 'Inicio';
  const sectionHint = activeView === 'historial' ? 'Se muestra el historial local guardado en este navegador.' : activeView === 'favoritos' ? 'Acá aparecerán los elementos marcados como favoritos.' : activeView === 'plantillas' ? 'Podés reutilizar plantillas para análisis y mejoras.' : activeView === 'comparar' ? 'La comparación de documentos está disponible para usuarios Pro.' : activeView === 'mejorar' ? 'Este panel permite proponer mejoras de claridad, respaldo y verificación.' : activeView === 'ajustes' ? 'Configuración básica del producto y preferencias del análisis.' : 'Volvé al formulario principal para cargar un nuevo contenido.';

  return <div className="appShell">
    {showTerms && <div className="termsBackdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowTerms(false); }}><section className="termsModal" role="dialog" aria-modal="true" aria-labelledby="terms-title"><div className="termsHeader"><div><h2 id="terms-title">Términos y Condiciones</h2><span>Versión {TERMS_VERSION}</span></div><button type="button" className="iconBtn" aria-label="Cerrar términos" onClick={() => setShowTerms(false)}>×</button></div><div className="termsBody"><p>Leé estos términos antes de usar ChamuyoCheck. La aceptación es obligatoria para realizar análisis.</p>{TERMS_SECTIONS.map((section) => <section key={section.title}><h3>{section.title}</h3><p>{section.body}</p></section>)}<p className="legalDisclaimerSubtle">Este texto establece condiciones operativas iniciales y debe ser revisado por asesoría jurídica argentina antes del lanzamiento comercial definitivo.</p></div><div className="termsActions"><button type="button" className="ghost" onClick={() => setShowTerms(false)}>Cerrar</button><button type="button" className="primary" onClick={acceptCurrentTerms}>Acepto los Términos y Condiciones</button></div></section></div>}
    <input ref={fileRef} type="file" accept=".pdf,image/*,.txt,.doc,.docx" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    <aside className="sidebar">
      <div className="brand"><div className="shield">✓</div><div><div className="logo">CHAMUYO<span>CHECK</span></div><div className="tag">Finanzas · Estafas · Derecho</div></div></div>
      <button type="button" className="newBtn" onClick={startNewAnalysis}>＋ Nuevo análisis</button>
      <div className="nav">
        <button type="button" className={activeView === 'inicio' ? 'active' : ''} onClick={openHome}>⌂ Inicio</button>
        <button type="button" className={activeView === 'historial' ? 'active' : ''} onClick={openHistory}>◴ Historial</button>
        <button type="button" className={activeView === 'favoritos' ? 'active' : ''} onClick={openFavorites}>☆ Favoritos</button>
        <button type="button" className={activeView === 'plantillas' ? 'active' : ''} onClick={openTemplates}>▤ Plantillas</button>
        <button type="button" className={activeView === 'comparar' ? 'active' : ''} onClick={openCompare}>⚖ Comparar <small>PRO</small></button>
        <button type="button" className={activeView === 'mejorar' ? 'active' : ''} onClick={openImprove}>↑ Mejorar documento</button>
        <button type="button" className={activeView === 'ajustes' ? 'active' : ''} onClick={openSettings}>⚙ Ajustes</button>
        <button type="button">? Ayuda</button>
      </div>
      <div className="proBox"><b>🔎 CHAMUYOCHECK</b><p>Revisá créditos, posibles estafas y documentos legales argentinos.</p><button type="button" onClick={() => setPlan('pro')}>Ver planes</button></div>
      <div className="userBox"><div className="avatar">V</div><div><b>Visitante</b><div className="hint">{isPro ? 'Plan Pro' : 'Plan Starter'}</div></div></div>
    </aside>
    <main className="main">
      <div className="mobileTopbar">
        <div className="mobileTopbarBrand">
          <div className="shield">✓</div>
          <div>
            <div className="logo">CHAMUYO<span>CHECK</span></div>
            <div className="tag">Finanzas · Estafas · Derecho</div>
          </div>
        </div>
        <div className="mobileTopbarActions">
          <button type="button" className="newBtn" onClick={startNewAnalysis}>＋ Nuevo análisis</button>
          <button type="button" className="ghost mobileMenuBtn" onClick={() => setMobileMenuOpen((value) => !value)}>{mobileMenuOpen ? '✕' : '☰ Menú'}</button>
        </div>
      </div>
      {mobileMenuOpen && <div className="mobileNav">
        <button type="button" className={activeView === 'inicio' ? 'active' : ''} onClick={openHome}>⌂ Inicio</button>
        <button type="button" className={activeView === 'historial' ? 'active' : ''} onClick={openHistory}>◴ Historial</button>
        <button type="button" className={activeView === 'favoritos' ? 'active' : ''} onClick={openFavorites}>☆ Favoritos</button>
        <button type="button" className={activeView === 'plantillas' ? 'active' : ''} onClick={openTemplates}>▤ Plantillas</button>
        <button type="button" className={activeView === 'comparar' ? 'active' : ''} onClick={openCompare}>⚖ Comparar <small>PRO</small></button>
        <button type="button" className={activeView === 'mejorar' ? 'active' : ''} onClick={openImprove}>↑ Mejorar documento</button>
        <button type="button" className={activeView === 'ajustes' ? 'active' : ''} onClick={openSettings}>⚙ Ajustes</button>
      </div>}
      <div className="topbar">
        <div className="status"><div className="check">✓</div><div><b>{analysis ? 'Análisis finalizado' : 'Nuevo análisis'}</b><div className="hint">9 de julio de 2026</div></div></div>
        <div className="topActions"><button type="button" className="ghost" onClick={() => setAnalysis(null)}>Analizar otro</button><button type="button" className="ghost">Descargar informe⌄</button><button type="button" className="iconBtn">⋮</button></div>
      </div>
      {activeView === 'inicio' ? <>
        <section className="heroGrid heroIntroGrid">
          <div className="panel heroIntroPanel">
            <div className="eyebrow">ANÁLISIS ESPECIALIZADO</div>
            <h1>Créditos, estafas y derecho argentino</h1>
            <p className="heroSubtitle">Entendé costos, detectá señales de engaño y revisá documentos antes de decidir.</p>
            <p className="heroBody">ChamuyoCheck ofrece análisis especializado de finanzas, créditos, posibles estafas, ofertas engañosas, documentos legales y cuestiones de derecho argentino.</p>
            <div className="heroCta">Pegá una consulta, un contrato o una oferta y recibí un análisis con alcance y evidencia claros.</div>
            <div className="heroHighlights">
              <div><strong>{localDoc.label}</strong><span>{localDoc.focus}</span></div>
              <div><strong>Modo</strong><span>{getInputDisplay(detected)}</span></div>
            </div>
          </div>
          <div className="panel inputPanel" id="inicio-form">
            <div className="tabs">{(['Texto', 'PDF', 'Imagen', 'Web', 'YouTube'] as InputMode[]).map((x) => <button key={x} type="button" className={`tab ${detected === x || (detected === 'Archivo' && x === 'PDF') ? 'active' : ''}`} onClick={() => x === 'PDF' || x === 'Imagen' ? chooseInputMode(x) : chooseInputMode(x)}>{x}</button>)}</div>
            <div className={`drop ${drag ? 'drag' : ''}`} onClick={() => { if (activeInput === 'PDF' || activeInput === 'Imagen') fileRef.current?.click(); }} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              <h3>Pegá o arrastrá cualquier contenido</h3>
              <p>Texto · PDF · imágenes · capturas · sitios web · videos de YouTube. La temática se detecta automáticamente.</p>
              {file && <span className="filePill">{file.name} · {fmt(file.size)}</span>}
            </div>
            {(activeInput === 'Web' || activeInput === 'YouTube') && <input className="urlInput" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={activeInput === 'YouTube' ? 'Pegá la URL de YouTube' : 'Pegá la URL del sitio web'} />}
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={activeInput === 'YouTube' ? 'Agregá una pregunta financiera, sobre una posible estafa o sobre derecho argentino.' : activeInput === 'Web' ? 'Indicá qué querés revisar de la oferta, entidad o documento legal.' : 'Ejemplo: calculá el costo real del crédito, revisá esta posible estafa o explicá esta cláusula según el derecho argentino.'} />
            {!isPro && <div className={`counter ${textTooLong ? 'bad' : ''}`}>{text.length}/{FREE_CHARS}</div>}
            <div className="termsConsent"><input id="terms-consent" type="checkbox" checked={termsAccepted} onChange={(e) => e.target.checked ? acceptCurrentTerms() : revokeTermsAcceptance()} /><label htmlFor="terms-consent">Leí y acepto los <button type="button" className="termsLink" onClick={(e) => { e.preventDefault(); setShowTerms(true); }}>Términos y Condiciones</button> (versión {TERMS_VERSION}).</label></div>
            {termsError && <div className="termsError" role="alert">{termsError}</div>}
            <div className="ctaRow"><button type="button" className="primary" onClick={analyze} disabled={loading || locked || textTooLong || proInput}>{loading ? 'Analizando' : 'Analizar'}</button><span className="hint">Entrada: {getInputLabel(detected, Boolean(file))}</span></div>
            {(locked || textTooLong || proInput) && <div className="paywall">Starter permite 3 análisis de texto de hasta 250 caracteres. Pasá a Pro para todas las funciones.</div>}
            {loading && <div className="loading">{steps.map((s, i) => <p key={i}>{s}</p>)}</div>}
          </div>
        </section>
        {analysis?.scopeStatus === 'out-of-scope' ? <section id="informe" className="analysisSection">
          <div className="panel legalResultPanel">
            <h2>Consulta fuera del alcance actual</h2>
            <p>{analysis.summary}</p>
            <p><b>Motivo:</b> {analysis.scopeReason}</p>
            <h3>ChamuyoCheck analiza actualmente</h3>
            <ul>{analysis.supportedAreas?.map((area, index) => <li key={index}>{area}</li>)}</ul>
            <p className="legalDisclaimerSubtle">No se calculó ChamuyoScore ni se simuló una búsqueda externa. Esta limitación evita presentar como confiable un análisis para el que el producto todavía no tiene cobertura especializada.</p>
          </div>
        </section> : analysis && <section id="informe" className="analysisSection">
        <div className="heroGrid">
          <div className="panel scoreCard">
            <div className="scoreWrap">
              <div className="circleScore" style={{ ['--p' as any]: score, background: `conic-gradient(${getChamuyoColor(score)} calc(${score}*1%), #293241 0)` }}><div><span style={{ color: getChamuyoColor(score) }}>{score}</span><small>/100</small></div></div>
              <div className="scoreText"><h2>ChamuyoScore™</h2><h3>{getChamuyoLabel(score)}</h3><p className="chamuyoDisclaimer">El ChamuyoScore mide el nivel de señales de manipulación, falta de evidencia o contenido dudoso. No representa un porcentaje de verdad.</p><p>{analysis.summary}</p><button type="button" className="ghost" onClick={toggleScoreExplanation} aria-expanded={showScoreExplanation}>{showScoreExplanation ? 'Ocultar explicación del puntaje' : 'Ver explicación del puntaje'}</button>{shouldShowScoreExplanationPanel && <div className="scoreExplanationPanel" role="region" aria-live="polite"><ul>{scoreExplanationItems.map((item, i) => <li key={i} style={{whiteSpace: item === '' ? 'normal' : 'pre-wrap', fontWeight: item.includes('FUNDAMENTO') || item.includes('CONCLUSIÓN') || item.includes('HECHOS') || item.includes('INTERPRETACIÓN') || item.includes('CRITERIOS') || item.includes('LIMITACIÓN') || item.includes('POR QUÉ') ? '600' : 'normal', color: item.includes('⚠️') ? '#e74c3c' : 'inherit'}}>{item}</li>)}</ul></div>}</div>
            </div>
          </div>
          <div className="panel decisionCard"><div className="light" style={{ background: semaforo.color }}></div><div><h2>Semáforo de decisiones</h2><h3 style={{ color: semaforo.color }}>{semaforo.txt}</h3><p>{analysis.prudentConclusion}</p></div></div>
          <div className="panel legalResultPanel"><h2>Fundamento y alcance del resultado</h2><ul>{(analysis.resultJustification || []).map((item, i) => <li key={i}>{item}</li>)}</ul><p className="legalDisclaimerSubtle">{analysis.legalSafeguard}</p>{analysis.legalNotice && <details><summary>Limitaciones y usos no permitidos como única evidencia</summary><h3>Limitaciones</h3><ul>{analysis.legalNotice.limitations.map((item, i) => <li key={`limit-${i}`}>{item}</li>)}</ul><h3>No usar como única base para</h3><ul>{analysis.legalNotice.prohibitedSoleUses.map((item, i) => <li key={`use-${i}`}>{item}</li>)}</ul></details>}</div>
          {analysis.externalVerification?.externalVerificationRequired && <div className="panel legalResultPanel">
            <h2>Verificación externa</h2>
            <p><b>Estado:</b> {analysis.externalVerification.externalVerificationPerformed ? 'Completada con fuentes auditables' : 'Inconclusa o no completada'}</p>
            <p><b>Conclusión:</b> {analysis.externalVerification.conclusion || 'No existe evidencia suficiente para responder con certeza.'}</p>
            {analysis.externalVerification.rationale && <p>{analysis.externalVerification.rationale}</p>}
            {analysis.externalVerification.execution?.records?.length ? <ul>{analysis.externalVerification.execution.records.map((record, index) => <li key={`${record.url}-${index}`}><a href={record.url} target="_blank" rel="noreferrer">{record.title}</a> <small>({record.sourceType}{record.official ? ', oficial' : ''}{record.sourceDate ? `, ${record.sourceDate.slice(0, 10)}` : ''})</small></li>)}</ul> : <p>No se obtuvieron suficientes fuentes reales que cumplan los requisitos del dominio.</p>}
          </div>}
          {analysis.financialAnalysis && <div className="panel legalResultPanel">
            <h2>Cálculo financiero extraído</h2>
            {analysis.sourceUrl && <p><b>Fuente analizada:</b> <a href={analysis.sourceUrl} target="_blank" rel="noreferrer">abrir página original</a></p>}
            <p><b>Confianza de la extracción:</b> {analysis.financialAnalysis.confidence}</p>
            {analysis.financialAnalysis.evidence.length > 0 ? <><h3>Datos identificados</h3><ul>{analysis.financialAnalysis.evidence.map((item, index) => <li key={`financial-evidence-${index}`}>{item}</li>)}</ul></> : <p>No se identificaron importes suficientes para calcular el crédito.</p>}
            {analysis.financialAnalysis.calculationBasis.length > 0 && <><h3>Cálculos reproducibles</h3><ul>{analysis.financialAnalysis.calculationBasis.map((item, index) => <li key={`financial-calculation-${index}`}>{item}</li>)}</ul></>}
            {analysis.financialAnalysis.warnings.length > 0 && <><h3>Advertencias</h3><ul>{analysis.financialAnalysis.warnings.map((item, index) => <li key={`financial-warning-${index}`}>{item}</li>)}</ul></>}
            {analysis.financialAnalysis.missingFields.length > 0 && <p><b>Datos faltantes:</b> {analysis.financialAnalysis.missingFields.join(', ')}.</p>}
            <p className="legalDisclaimerSubtle">El total calculado incluye únicamente importes visibles y extraídos. Seguros, impuestos, gastos administrativos, sellados, prendas y cuotas variables deben sumarse cuando no estén incluidos expresamente en el CFT.</p>
          </div>}
          {analysis.scamRiskAnalysis?.applicable && <div className="panel legalResultPanel">
            <h2>Señales de posible estafa</h2>
            <p><b>Nivel de alerta:</b> {analysis.scamRiskAnalysis.level.replace('-', ' ')} ({analysis.scamRiskAnalysis.score}/100)</p>
            <p>{analysis.scamRiskAnalysis.conclusion}</p>
            {analysis.scamRiskAnalysis.signals.length > 0 ? <><h3>Señales observadas</h3><ul>{analysis.scamRiskAnalysis.signals.map((signal) => <li key={signal.id}><b>{signal.label}:</b> “{signal.evidence}”</li>)}</ul></> : <p>No se detectaron patrones fuertes en el contenido visible.</p>}
            {analysis.scamRiskAnalysis.missingInformation.length > 0 && <p><b>Falta verificar:</b> {analysis.scamRiskAnalysis.missingInformation.join(', ')}.</p>}
            <h3>Antes de pagar o compartir datos</h3><ul>{analysis.scamRiskAnalysis.checks.map((check, index) => <li key={`scam-check-${index}`}>{check}</li>)}</ul>
            <p className="legalDisclaimerSubtle">Estas señales permiten priorizar verificaciones y medidas preventivas. No determinan por sí solas que una persona o entidad haya cometido una estafa o un delito.</p>
          </div>}
          {analysis.commercialCourseAnalysis?.applicable && <div className="panel legalResultPanel">
            <h2>Coherencia de la propuesta del curso</h2>
            <p><b>Oferta identificada:</b> {analysis.commercialCourseAnalysis.offerType}</p>
            <p>{analysis.commercialCourseAnalysis.conclusion}</p>
            {analysis.commercialCourseAnalysis.observedPromises.length > 0 && <><h3>Promesas observadas</h3><ul>{analysis.commercialCourseAnalysis.observedPromises.map((item, index) => <li key={`course-promise-${index}`}>“{item}”</li>)}</ul></>}
            {analysis.commercialCourseAnalysis.coherenceIssues.length > 0 && <><h3>Problemas de coherencia</h3><ul>{analysis.commercialCourseAnalysis.coherenceIssues.map((item, index) => <li key={`course-issue-${index}`}>{item}</li>)}</ul></>}
            {analysis.commercialCourseAnalysis.disclosedConditions.length > 0 && <><h3>Condiciones mencionadas</h3><ul>{analysis.commercialCourseAnalysis.disclosedConditions.map((item, index) => <li key={`course-condition-${index}`}>“{item}”</li>)}</ul></>}
            {analysis.commercialCourseAnalysis.missingInformation.length > 0 && <p><b>Información faltante:</b> {analysis.commercialCourseAnalysis.missingInformation.join(', ')}.</p>}
            <p className="legalDisclaimerSubtle">El análisis se basa en la transcripción pública disponible. No evalúa gestos, imágenes, gráficos ni textos que aparezcan únicamente dentro del video.</p>
          </div>}
          {analysis.argentinaLegalAnalysis?.applicable && <div className="panel legalResultPanel">
            <h2>Análisis jurídico estructurado</h2>
            <p><b>Materia identificada:</b> {analysis.argentinaLegalAnalysis.areaLabel}</p>
            <p><b>Jurisdicción:</b> {analysis.argentinaLegalAnalysis.jurisdiction === 'argentina' ? 'Argentina identificada en el contenido' : 'No especificada'}</p>
            <p>{analysis.argentinaLegalAnalysis.conclusion}</p>
            {analysis.argentinaLegalAnalysis.issues.length > 0 && <><h3>Cláusulas o afirmaciones para revisar</h3><ul>{analysis.argentinaLegalAnalysis.issues.map((issue) => <li key={issue.id}><b>{issue.label} ({issue.severity}):</b> {issue.explanation}<br /><small>Fragmento: “{issue.evidence}”</small></li>)}</ul></>}
            {analysis.argentinaLegalAnalysis.factsNeeded.length > 0 && <><h3>Hechos o datos faltantes</h3><ul>{analysis.argentinaLegalAnalysis.factsNeeded.map((item, index) => <li key={`legal-fact-${index}`}>{item}</li>)}</ul></>}
            <h3>Fuentes que corresponden</h3><ul>{analysis.argentinaLegalAnalysis.sourceTargets.map((item, index) => <li key={`legal-source-${index}`}>{item}</li>)}</ul>
            <p className="legalDisclaimerSubtle">La clasificación y las señales textuales no determinan validez, delito, pena aplicable ni responsabilidad. La conclusión depende del documento completo, los hechos, la jurisdicción y la normativa vigente efectivamente consultada.</p>
          </div>}
          <div className="panel metaCard">
            <div className="meta"><small>Tipo</small><b>{analysis.documentType}</b></div>
            <div className="meta"><small>Entrada</small><b>{getInputLabel(analysis.detectedInput)}</b></div>
            <div className="meta"><small>Caracteres</small><b>{analysis.extractedChars || text.length}</b></div>
            <div className="meta"><small>Idioma</small><b>Español</b></div>
            <div className="meta"><small>Confianza</small><b>{analysis.confidence}</b></div>
          </div>
        </div>
        <div className="reportTabs">{['Resumen', 'Evidencias', 'Riesgos', 'Finanzas', 'Derecho argentino', 'Recomendaciones', 'Fuentes', 'Datos extraídos'].map((x) => <button key={x} type="button" className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>
        <div className="cards">
          <div className="card executiveCard">
            <div className="cardHead">
              <h3>▣ Resumen ejecutivo</h3>
              <button type="button" className="ghost" onClick={() => setShowFullSummary((v) => !v)}>{showFullSummary ? 'Ocultar resumen' : 'Leer resumen completo'}</button>
            </div>
            <p>{executiveSummaryText}</p>
          </div>
          <div className="card"><h3 className="ok">✓ Fortalezas</h3><ul>{reportSections?.strengths.slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          <div className="card"><h3 className="warn">! Debilidades</h3><ul>{reportSections?.weaknesses.slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          <div className="card"><h3 className="bad">◇ Riesgos principales</h3><ul>{reportSections?.risks.slice(0, 5).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        </div>
        <div className="verifyBand">
          <div><h3>💡 ¿Qué deberías verificar?</h3><p>Antes de tomar una decisión basada en este contenido, conviene contrastar los puntos clave con evidencia externa.</p></div>
          <div className="verifyList">{reportSections?.verify.slice(0, 6).map((x, i) => <div key={i}><span className="num">{i + 1}</span>{x}</div>)}</div>
          <div><h3>↗ Recomendaciones</h3><p>{reportSections?.contextCard ? reportSections.contextCard.items[0] : 'Obtené sugerencias específicas para aumentar calidad y confiabilidad.'}</p><button type="button" className="ghost">Mejorar documento</button></div>
        </div>
        {reportSections?.contextCard && <div className="section"><h2>{reportSections.contextCard.title}</h2><ul>{reportSections.contextCard.items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        <div className="section"><h2>Recomendaciones de verificación</h2><ul>{reportSections?.recommendations.slice(0, 6).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="section"><h2>Especialistas activados</h2><div className="moduleGrid">{analysis.modules.map(moduleCard)}</div></div>
        <div className="section"><h2>Por qué obtuvo este puntaje</h2><ul>{(analysis.scoreExplanation || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        {analysis.extractedPreview && <div className="section"><h2>Datos extraídos</h2><p>{analysis.extractedPreview}</p></div>}
      </section>}
      </> : <section className="panel viewPanel" style={{ padding: '28px', marginTop: '8px' }}>
        <div className="viewPanelHeader">
          <h2>{sectionTitle}</h2>
          <p className="hint">{sectionHint}</p>
        </div>
        {activeView === 'historial' && <>
          {historyItems.length ? <div className="historyMini" style={{ marginTop: '14px' }}>{historyItems.map((item) => <div className="historyItem" key={item.id}><span>{item.score}</span><div>{item.title}<small>{item.documentType} · {item.date}</small></div></div>)}</div> : <div className="paywall" style={{ marginTop: '14px' }}>Todavía no hay historial local disponible.</div>}
        </>}
        {activeView === 'favoritos' && <>
          {favoritesItems.length ? <ul style={{ color: '#ddd4f4', lineHeight: 1.6, marginTop: '14px' }}>{favoritesItems.map((item, i) => <li key={i}>{item}</li>)}</ul> : <div className="paywall" style={{ marginTop: '14px' }}>No hay favoritos guardados todavía.</div>}
        </>}
        {activeView === 'plantillas' && <>
          {templatesItems.length ? <ul style={{ color: '#ddd4f4', lineHeight: 1.6, marginTop: '14px' }}>{templatesItems.map((item, i) => <li key={i}>{item}</li>)}</ul> : <div className="paywall" style={{ marginTop: '14px' }}>Todavía no hay plantillas guardadas.</div>}
        </>}
        {activeView === 'comparar' && <>
          {isPro ? <div className="paywall" style={{ marginTop: '14px' }}>Compará dos documentos y revisá diferencias de riesgo, contexto y evidencia.</div> : <div className="paywall" style={{ marginTop: '14px' }}>Activá Pro para comparar documentos y acceder a funciones avanzadas.</div>}
        </>}
        {activeView === 'mejorar' && <>
          <div className="paywall" style={{ marginTop: '14px' }}>Podés abrir el panel de mejora desde aquí para revisar la estructura, las fuentes y los puntos a reforzar.</div>
        </>}
        {activeView === 'ajustes' && <>
          <div className="paywall" style={{ marginTop: '14px' }}>Ajustes de cuenta, idioma y preferencias del flujo de análisis aparecerán aquí.</div>
        </>}
      </section>}
    </main>
    <div className="legalFooter"><details><summary>🔒 Aviso legal</summary><p>{analysis?.legalSafeguard || 'ChamuyoCheck genera una evaluación automatizada y orientativa. No afirma veracidad, falsedad, autoría, plagio, uso de IA ni ilegalidad; no reemplaza asesoramiento profesional.'}</p></details><span>Resultado automatizado, orientativo y sujeto a revisión humana.</span></div>
  </div>;
}
