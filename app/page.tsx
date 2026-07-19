
'use client';
import { useEffect, useRef, useState } from 'react';
import { readLocalHistory, type HistoryItem } from '../src/lib/history/localHistory';
import { TERMS_SECTIONS, TERMS_STORAGE_KEY, TERMS_VERSION } from '../src/lib/legal/terms';
import { extractImageTextInBrowser } from '../src/lib/extractors/browserOcr';
import { getSupabaseClient } from '../src/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';

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
    plan?: {
      claimsRequiringExternalVerification: number;
      suggestedSourceTypes: string[];
      minimumIndependentSources: number;
      recencyRequired: boolean;
      officialSourceRequired: boolean;
      jurisdictions: string[];
    };
    providers?: Array<{ id: string; name: string; status: 'implemented' | 'planned'; sourceTypes: string[] }>;
    sourceAvailability?: Array<{
      sourceType: string;
      status: 'implemented' | 'planned' | 'unregistered';
      providerIds: string[];
    }>;
    claims?: Array<{
      claimIndex: number;
      text: string;
      externalVerificationRequired: boolean;
      externalVerificationPerformed: boolean;
      explicitRequestCount: number;
      pendingReasons: string[];
    }>;
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
    impliedTnaPercent: number | null;
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
    legalBranch: 'family' | 'criminal' | 'civil' | 'commercial' | 'administrative' | 'general';
    subtopic: string;
    intent: string;
    issues: Array<{ id: string; label: string; evidence: string; explanation: string; severity: 'baja' | 'media' | 'alta' }>;
    factsNeeded: string[];
    sourceTargets: string[];
    conclusion: string;
  } | null;
  sourceUrl?: string | null;
  decisionAnswer?: {
    kind: 'loan-cost' | 'financial-product-comparison' | 'investment-project' | 'scam-prevention' | 'legal-document' | 'leasing-specialist' | 'supported-review';
    status: 'answerable' | 'partial' | 'needs-verification';
    title: string;
    directAnswer: string;
    findings: string[];
    sections?: Array<{ title: string; items: string[] }>;
    comparisonTable?: {
      columns: string[];
      rows: Array<{ label: string; values: string[] }>;
    };
    nextActions: string[];
    limitations: string[];
  };
};

type InputMode = 'Texto' | 'PDF' | 'Imagen' | 'Web' | 'YouTube';

type AnalysisCategoryId = 'finance-credit' | 'investment-project' | 'scam-risk' | 'argentina-legal-documents' | 'leasing-specialist';

const ANALYSIS_CATEGORIES: Array<{
  id: AnalysisCategoryId;
  icon: string;
  label: string;
  description: string;
}> = [
  { id: 'finance-credit', icon: '💳', label: 'Finanzas y créditos', description: 'Préstamos, cuotas, tasas, CFT, inflación y costo total.' },
  { id: 'investment-project', icon: '📈', label: 'Inversiones', description: 'Inmuebles, agro, industria, energía, minería y proyectos.' },
  { id: 'scam-risk', icon: '🛡️', label: 'Posibles estafas', description: 'Sitios, ofertas, autotrading, promesas y pedidos de dinero.' },
  { id: 'argentina-legal-documents', icon: '⚖️', label: 'Derecho argentino', description: 'Contratos, documentos, delitos, penas, familia y seguros.' },
  { id: 'leasing-specialist', icon: '🏗️', label: 'Leasing', description: 'Contrato, cánones, impuestos, registros, importación, sector público y comparación internacional.' },
];

const ARGENTINA_JURISDICTIONS = [
  'Ciudad Autónoma de Buenos Aires', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

function Bar({ score }: { score: number }) {
  return <div className="bar"><div className="fill" style={{ ['--w' as any]: `${Math.max(0, Math.min(100, score || 0))}%` }} /></div>;
}

function detectUrlType(s: string) {
  if (/youtu\.be|youtube\.com/i.test(s)) return 'YouTube';
  if (/^https?:\/\//i.test(s)) return 'Web';
  return 'Texto';
}

function verificationSourceLabel(sourceType: string) {
  return sourceType.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function availabilityLabel(status: 'implemented' | 'planned' | 'unregistered') {
  if (status === 'implemented') return 'Disponible';
  if (status === 'planned') return 'Planificada, todavía no disponible';
  return 'Sin conector registrado';
}

function fmt(bytes: number) {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'El email o la clave no son correctos.';
  if (/user already registered/i.test(message)) return 'Ese email ya tiene una cuenta. Probá ingresar.';
  if (/email not confirmed/i.test(message)) return 'Confirmá tu cuenta desde el email que te enviamos.';
  if (/password should be at least/i.test(message)) return 'La clave debe tener al menos 6 caracteres.';
  return 'No se pudo completar el acceso. Revisá los datos y volvé a intentar.';
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

  const answerKind = analysis.decisionAnswer?.kind;
  if (answerKind === 'leasing-specialist') {
    items.push('El puntaje de leasing evalúa por separado contrato, flujo económico, impuestos, registración, riesgo residual, sector público, importación y normativa internacional aplicable.');
  } else if (answerKind === 'legal-document') {
    items.push('El puntaje jurídico aumenta cuando faltan la resolución, la notificación, la liquidación, la jurisdicción o los hechos necesarios para controlar la consecuencia legal.');
  } else if (answerKind === 'loan-cost' || answerKind === 'financial-product-comparison') {
    items.push('El puntaje financiero aumenta cuando faltan costos, tasas, cargos o condiciones visibles.');
  } else if (analysis.topic === 'health') {
    items.push('Se penaliza cuando la afirmación promete efectos o seguridad sin una base clínica clara.');
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
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
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
  const [activeView, setActiveView] = useState<'inicio' | 'leasing' | 'historial' | 'favoritos' | 'plantillas' | 'comparar' | 'mejorar' | 'ajustes' | 'ayuda'>('inicio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [favoritesItems, setFavoritesItems] = useState<string[]>([]);
  const [templatesItems, setTemplatesItems] = useState<string[]>([]);
  const [compareLeft, setCompareLeft] = useState('');
  const [compareRight, setCompareRight] = useState('');
  const [improveDraft, setImproveDraft] = useState('');
  const [showDetailedResults, setShowDetailedResults] = useState(true);
  const [leasingHubProvinceA, setLeasingHubProvinceA] = useState('Ciudad Autónoma de Buenos Aires');
  const [leasingHubProvinceB, setLeasingHubProvinceB] = useState('Buenos Aires');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [instructionError, setInstructionError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AnalysisCategoryId | null>(null);
  const [categoryError, setCategoryError] = useState('');
  const [leasingProvince, setLeasingProvince] = useState('');
  const [leasingContractProvince, setLeasingContractProvince] = useState('Ciudad Autónoma de Buenos Aires');
  const [leasingLessorProvince, setLeasingLessorProvince] = useState('Ciudad Autónoma de Buenos Aires');
  const [leasingComparisonProvince, setLeasingComparisonProvince] = useState('');
  const [leasingProvinceError, setLeasingProvinceError] = useState('');
  const [leasingAssetType, setLeasingAssetType] = useState('Maquinaria o equipo');
  const [leasingAssetValue, setLeasingAssetValue] = useState('');
  const [leasingFinancedPercent, setLeasingFinancedPercent] = useState('100');
  const [leasingMonths, setLeasingMonths] = useState('36');
  const [leasingTna, setLeasingTna] = useState('');
  const [leasingOptionPercent, setLeasingOptionPercent] = useState('5');
  const [leasingOptionMode, setLeasingOptionMode] = useState<'percent' | 'amount'>('percent');
  const [leasingOptionAmount, setLeasingOptionAmount] = useState('');
  const [leasingGuaranteeCanons, setLeasingGuaranteeCanons] = useState('0');
  const [leasingStructuringFeePercent, setLeasingStructuringFeePercent] = useState('3');
  const [preparedFormRequest, setPreparedFormRequest] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const categoryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSessionLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
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
    const detailedPreference = localStorage.getItem('cc_detailed_results');
    if (detailedPreference !== null) setShowDetailedResults(detailedPreference === 'true');
  }, []);
  useEffect(() => {
    if (!preparedFormRequest || activeView !== 'inicio') return;
    const timer = window.setTimeout(() => {
      const form = document.getElementById('inicio-form');
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      form?.querySelector<HTMLElement>('#analysis-instruction')?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeView, preparedFormRequest]);

  async function submitEmailAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthError('Falta configurar Supabase en este entorno.');
      return;
    }
    if (!authEmail.trim() || authPassword.length < 6) {
      setAuthError('Ingresá un email válido y una clave de al menos 6 caracteres.');
      return;
    }
    setAuthLoading(true);
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: { data: { full_name: authName.trim() } },
      })
      : await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
    setAuthLoading(false);
    if (result.error) {
      setAuthError(friendlyAuthError(result.error.message));
      return;
    }
    if (authMode === 'signup' && !result.data.session) {
      setAuthMessage('Revisá tu email y confirmá la cuenta para ingresar.');
    }
  }

  async function signInWithGoogle() {
    setAuthError('');
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthError('Falta configurar Supabase en este entorno.');
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAuthLoading(false);
      setAuthError(friendlyAuthError(error.message));
    }
  }

  async function signOut() {
    const supabase = getSupabaseClient();
    await supabase?.auth.signOut();
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

  const detected = file ? (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : file.type.startsWith('image/') ? 'Imagen' : 'Archivo') : url ? detectUrlType(url) : activeInput;
  const localDoc = inferLocalDoc(text, file, url);

  function onFile(f: File | undefined | null) {
    if (!f) return;
    if (!selectedCategory) {
      setCategoryError('Elegí una categoría antes de cargar contenido.');
      categoryRef.current?.focus();
      return;
    }
    setFile(f);
    setAnalysis(null);
    setActiveInput(f.type.startsWith('image/') ? 'Imagen' : 'PDF');
    if (selectedCategory === 'leasing-specialist' && !text.trim()) {
      setText('Analizá esta cotización de leasing. Extraé automáticamente valor neto e IVA, plazo, cánones, opción de compra, maxi canon, cánones de garantía, comisión, seguro y gastos. Calculá el costo y señalá solamente los datos que falten.');
      setInstructionError('');
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (!selectedCategory) {
      setCategoryError('Elegí una categoría antes de cargar contenido.');
      categoryRef.current?.focus();
      return;
    }
    onFile(e.dataTransfer.files?.[0]);
  }

  function chooseInputMode(mode: InputMode) {
    if (!selectedCategory) {
      setCategoryError('Elegí una categoría antes de seleccionar el tipo de contenido.');
      categoryRef.current?.focus();
      return;
    }
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
    if (!session) {
      setAuthError('Registrate o iniciá sesión para realizar el análisis.');
      document.getElementById('registro')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (!selectedCategory) {
      setCategoryError('Elegí una categoría antes de ingresar tu consulta.');
      categoryRef.current?.focus();
      return;
    }
    if (!text.trim()) {
      setInstructionError('Escribí qué necesitás saber. El análisis se basará siempre en esa consulta.');
      document.querySelector<HTMLTextAreaElement>('#analysis-instruction')?.focus();
      return;
    }
    if (selectedCategory === 'leasing-specialist' && !leasingProvince) {
      setLeasingProvinceError('Elegí la provincia principal del leasing antes de analizar.');
      return;
    }
    setCategoryError('');
    setInstructionError('');
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
      form.append('selectedCategory', selectedCategory);
      if (selectedCategory === 'leasing-specialist') {
        form.append('leasingProvince', leasingProvince);
        form.append('leasingContractProvince', leasingContractProvince);
        form.append('leasingLessorProvince', leasingLessorProvince);
        if (leasingComparisonProvince) form.append('leasingComparisonProvince', leasingComparisonProvince);
        form.append('leasingQuoteUploaded', file ? 'true' : 'false');
        if (!file) {
          form.append('leasingAssetType', leasingAssetType);
          form.append('leasingAssetValue', leasingAssetValue);
          form.append('leasingFinancedPercent', leasingFinancedPercent);
          form.append('leasingMonths', leasingMonths);
          form.append('leasingTna', leasingTna);
          form.append('leasingOptionPercent', leasingOptionPercent);
          form.append('leasingOptionMode', leasingOptionMode);
          form.append('leasingOptionAmount', leasingOptionAmount);
          form.append('leasingGuaranteeCanons', leasingGuaranteeCanons);
          form.append('leasingStructuringFeePercent', leasingStructuringFeePercent);
        }
      }
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
        res = await fetch('/api/analyze', {
          method: 'POST',
          body: form,
          signal: controller.signal,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } finally {
        window.clearTimeout(requestTimeout);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error');
      setAnalysis(data);
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
    setSelectedCategory(null);
    setCategoryError('');
    setInstructionError('');
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
  const openLeasingHub = () => {
    setActiveView('leasing');
    setMobileMenuOpen(false);
    setShowFullSummary(false);
    setShowScoreExplanation(false);
  };
  const openHelp = () => { setActiveView('ayuda'); setMobileMenuOpen(false); };
  const saveFavorite = () => {
    if (!analysis) return;
    const label = analysis.decisionAnswer?.title || analysis.centralQuestion || analysis.documentType;
    const next = Array.from(new Set([label, ...favoritesItems])).slice(0, 20);
    setFavoritesItems(next);
    localStorage.setItem('cc_favorites', JSON.stringify(next));
  };
  const removeFavorite = (label: string) => {
    const next = favoritesItems.filter((item) => item !== label);
    setFavoritesItems(next);
    localStorage.setItem('cc_favorites', JSON.stringify(next));
  };
  const useTemplate = (category: AnalysisCategoryId, prompt: string) => {
    setAnalysis(null);
    setSelectedCategory(category);
    setText(prompt);
    setActiveInput('Texto');
    setActiveView('inicio');
    setMobileMenuOpen(false);
    setPreparedFormRequest((request) => request + 1);
  };
  const compareLeasingProvinces = () => {
    setLeasingContractProvince(leasingHubProvinceA);
    setLeasingProvince(leasingHubProvinceA);
    setLeasingComparisonProvince(leasingHubProvinceB);
    useTemplate('leasing-specialist', `Compará un leasing entre ${leasingHubProvinceA} y ${leasingHubProvinceB}. Explicá en cuál conviene celebrar el contrato y registrar o usar el bien, siempre que exista conexión territorial real. Compará porcentajes, bases, Sellos, Ingresos Brutos del dador, patente, registración, opción de compra, beneficios y exenciones. No sumes impuestos con bases diferentes ni supongas libre elección fiscal.`);
  };
  const compareWords = (value: string) => new Set(value.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
  const leftWords = compareWords(compareLeft);
  const rightWords = compareWords(compareRight);
  const sharedWords = [...leftWords].filter((word) => rightWords.has(word));
  const comparisonReady = compareLeft.trim().length > 20 && compareRight.trim().length > 20;
  const sendImprovementToAnalysis = () => {
    if (!improveDraft.trim()) return;
    setSelectedCategory('argentina-legal-documents');
    setText(`Mejorá la claridad de este documento sin cambiar su sentido. Identificá ambigüedades, datos faltantes y afirmaciones que necesitan fuente.\n\n${improveDraft}`);
    setActiveInput('Texto');
    setActiveView('inicio');
  };
  const sectionTitle = activeView === 'leasing' ? 'Centro de Leasing' : activeView === 'historial' ? 'Historial' : activeView === 'favoritos' ? 'Favoritos' : activeView === 'plantillas' ? 'Plantillas' : activeView === 'comparar' ? 'Comparar' : activeView === 'mejorar' ? 'Mejorar documento' : activeView === 'ajustes' ? 'Ajustes' : activeView === 'ayuda' ? 'Ayuda' : 'Inicio';
  const sectionHint = activeView === 'leasing' ? 'Aprendé el instrumento, compará alternativas y prepará una consulta experta.' : activeView === 'historial' ? 'Se muestra el historial local guardado en este navegador.' : activeView === 'favoritos' ? 'Resultados importantes guardados en este navegador.' : activeView === 'plantillas' ? 'Consultas preparadas para iniciar análisis frecuentes.' : activeView === 'comparar' ? 'Compará dos textos antes de pedir un análisis especializado.' : activeView === 'mejorar' ? 'Prepará un documento para una revisión de claridad, respaldo y riesgos.' : activeView === 'ajustes' ? 'Preferencias locales y control de los datos guardados.' : activeView === 'ayuda' ? 'Guía rápida para obtener respuestas útiles y verificables.' : 'Volvé al formulario principal para cargar un nuevo contenido.';
  const userName = String(session?.user.user_metadata?.full_name || session?.user.email || 'Usuario');
  const userInitial = userName.slice(0, 1).toUpperCase();

  return <div className="appShell">
    {showTerms && <div className="termsBackdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowTerms(false); }}><section className="termsModal" role="dialog" aria-modal="true" aria-labelledby="terms-title"><div className="termsHeader"><div><h2 id="terms-title">Términos y Condiciones</h2><span>Versión {TERMS_VERSION}</span></div><button type="button" className="iconBtn" aria-label="Cerrar términos" onClick={() => setShowTerms(false)}>×</button></div><div className="termsBody"><p>Leé estos términos antes de usar ChamuyoCheck. La aceptación es obligatoria para realizar análisis.</p>{TERMS_SECTIONS.map((section) => <section key={section.title}><h3>{section.title}</h3><p>{section.body}</p></section>)}<p className="legalDisclaimerSubtle">Este texto establece condiciones operativas iniciales y debe ser revisado por asesoría jurídica argentina antes del lanzamiento comercial definitivo.</p></div><div className="termsActions"><button type="button" className="ghost" onClick={() => setShowTerms(false)}>Cerrar</button><button type="button" className="primary" onClick={acceptCurrentTerms}>Acepto los Términos y Condiciones</button></div></section></div>}
    <input ref={fileRef} type="file" accept=".pdf,image/*,.txt,.doc,.docx" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    <aside className="sidebar">
      <div className="brand"><div className="shield">✓</div><div><div className="logo">CHAMUYO<span>CHECK</span></div><div className="tag">Finanzas · Estafas · Derecho</div></div></div>
      <button type="button" className="newBtn" onClick={startNewAnalysis}>＋ Nuevo análisis</button>
      <div className="nav">
        <button type="button" className={activeView === 'inicio' ? 'active' : ''} onClick={openHome}>⌂ Inicio</button>
        <button type="button" className={activeView === 'leasing' ? 'active' : ''} onClick={openLeasingHub}>🏗 Leasing</button>
        <button type="button" className={activeView === 'historial' ? 'active' : ''} onClick={openHistory}>◴ Historial</button>
        <button type="button" className={activeView === 'favoritos' ? 'active' : ''} onClick={openFavorites}>☆ Favoritos</button>
        <button type="button" className={activeView === 'plantillas' ? 'active' : ''} onClick={openTemplates}>▤ Plantillas</button>
        <button type="button" className={activeView === 'comparar' ? 'active' : ''} onClick={openCompare}>⚖ Comparar</button>
        <button type="button" className={activeView === 'mejorar' ? 'active' : ''} onClick={openImprove}>↑ Mejorar documento</button>
        <button type="button" className={activeView === 'ajustes' ? 'active' : ''} onClick={openSettings}>⚙ Ajustes</button>
        <button type="button" className={activeView === 'ayuda' ? 'active' : ''} onClick={openHelp}>? Ayuda</button>
      </div>
      <div className="proBox"><b>ACCESO BETA COMPLETO</b><p>Todos los formatos y análisis están habilitados. No se realizan cobros.</p></div>
      <div className="userBox"><div className="avatar">{session ? userInitial : 'V'}</div><div><b>{session ? userName : 'Sin ingresar'}</b><div className="hint">{session ? 'Beta completa' : 'Registro requerido'}</div></div>{session && <button type="button" className="termsLink" onClick={signOut}>Salir</button>}</div>
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
        <button type="button" className={activeView === 'leasing' ? 'active' : ''} onClick={openLeasingHub}>🏗 Leasing</button>
        <button type="button" className={activeView === 'historial' ? 'active' : ''} onClick={openHistory}>◴ Historial</button>
        <button type="button" className={activeView === 'favoritos' ? 'active' : ''} onClick={openFavorites}>☆ Favoritos</button>
        <button type="button" className={activeView === 'plantillas' ? 'active' : ''} onClick={openTemplates}>▤ Plantillas</button>
        <button type="button" className={activeView === 'comparar' ? 'active' : ''} onClick={openCompare}>⚖ Comparar</button>
        <button type="button" className={activeView === 'mejorar' ? 'active' : ''} onClick={openImprove}>↑ Mejorar documento</button>
        <button type="button" className={activeView === 'ajustes' ? 'active' : ''} onClick={openSettings}>⚙ Ajustes</button>
        <button type="button" className={activeView === 'ayuda' ? 'active' : ''} onClick={openHelp}>? Ayuda</button>
      </div>}
      <div className="topbar">
        <div className="status"><div className="check">✓</div><div><b>{analysis ? 'Análisis finalizado' : 'Nuevo análisis'}</b><div className="hint">9 de julio de 2026</div></div></div>
        <div className="topActions"><button type="button" className="ghost" onClick={() => setAnalysis(null)}>Analizar otro</button><button type="button" className="ghost">Descargar informe⌄</button><button type="button" className="iconBtn">⋮</button></div>
      </div>
      {activeView === 'inicio' ? <>
        {!session && !sessionLoading && <section id="registro" className="panel authPanel" aria-labelledby="auth-title">
          <div>
            <div className="eyebrow">REGISTRO OBLIGATORIO</div>
            <h2 id="auth-title">{authMode === 'signup' ? 'Creá tu cuenta para usar ChamuyoCheck' : 'Ingresá a tu cuenta'}</h2>
            <p>Durante la beta, todo usuario registrado tiene acceso completo a textos, enlaces, imágenes y documentos. No se realizan cobros.</p>
          </div>
          <form className="authForm" onSubmit={submitEmailAuth}>
            {authMode === 'signup' && <label>Nombre<input value={authName} onChange={(event) => setAuthName(event.target.value)} autoComplete="name" /></label>}
            <label>Email<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} autoComplete="email" required /></label>
            <label>Clave<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required /></label>
            {authError && <div className="termsError" role="alert">{authError}</div>}
            {authMessage && <div className="authMessage" role="status">{authMessage}</div>}
            <div className="authActions">
              <button type="submit" className="primary" disabled={authLoading}>{authLoading ? 'Procesando…' : authMode === 'signup' ? 'Crear cuenta' : 'Ingresar'}</button>
              <button type="button" className="ghost" onClick={signInWithGoogle} disabled={authLoading}>Continuar con Google</button>
            </div>
            <button type="button" className="termsLink authSwitch" onClick={() => { setAuthMode((mode) => mode === 'signup' ? 'signin' : 'signup'); setAuthError(''); setAuthMessage(''); }}>{authMode === 'signup' ? 'Ya tengo cuenta' : 'Quiero crear una cuenta'}</button>
          </form>
        </section>}
        <section className="heroGrid heroIntroGrid">
          <div className="panel heroIntroPanel">
            <div className="eyebrow">ANÁLISIS ESPECIALIZADO</div>
            <h1>Antes de pagar, endeudarte o firmar</h1>
            <p className="heroSubtitle">Descubrí cuánto terminás pagando, qué información falta y qué riesgos deberías verificar.</p>
            <div className="leasingModuleBadge">MÓDULO ESPECIAL LEASING</div>
            <p className="heroBody">Subí una captura, una oferta, un enlace o un documento. ChamuyoCheck responde tu pregunta con cálculos reproducibles, señales observables y próximos pasos.</p>
            <div className="heroCta">Preguntá: “¿Cuánto pago en total?”, “¿Me pueden estar estafando?” o “¿Qué obligación estoy aceptando?”.</div>
            <div className="heroHighlights">
              <div><strong>{localDoc.label}</strong><span>{localDoc.focus}</span></div>
              <div><strong>Modo</strong><span>{getInputDisplay(detected)}</span></div>
            </div>
          </div>
          <div className="panel inputPanel" id="inicio-form">
            <div ref={categoryRef} tabIndex={-1} className="categoryPicker" aria-labelledby="category-picker-title">
              <div className="categoryMeta"><span className="categoryStep">PASO 1</span><span className="betaBadge">VERSIÓN BETA</span></div>
              <h2 id="category-picker-title">Elegí la categoría</h2>
              <p>La categoría define el tipo de análisis y las fuentes que corresponden.</p>
              <div className="categoryGrid" role="radiogroup" aria-required="true">
                {ANALYSIS_CATEGORIES.map((category) => <button key={category.id} type="button" role="radio" aria-checked={selectedCategory === category.id} className={`categoryOption ${selectedCategory === category.id ? 'selected' : ''}`} onClick={() => { setSelectedCategory(category.id); setCategoryError(''); setAnalysis(null); setFile(null); setUrl(''); setText(''); setActiveInput('Texto'); }}>
                  <span className="categoryOptionIcon" aria-hidden="true">{category.icon}</span>
                  <span><strong>{category.label}</strong><span>{category.description}</span></span>
                </button>)}
              </div>
              {categoryError && <div className="termsError" role="alert">{categoryError}</div>}
              {selectedCategory === 'leasing-specialist' && <div className="leasingJurisdictionPicker">
                <h3>Provincia del leasing</h3>
                <p>Elegí por separado dónde se celebra el contrato y dónde se usará y registrará el bien. Ambas jurisdicciones pueden tener consecuencias tributarias.</p>
                <div className="leasingProvinceGrid">
                  <label>Uso, guarda y radicación del bien<select value={leasingProvince} onChange={(event) => { setLeasingProvince(event.target.value); setLeasingProvinceError(''); if (event.target.value === leasingComparisonProvince) setLeasingComparisonProvince(''); }}>
                    <option value="">Elegí una provincia</option>
                    {ARGENTINA_JURISDICTIONS.map((province) => <option key={province} value={province}>{province}</option>)}
                  </select></label>
                  <label>Celebración e instrumentación del contrato<select value={leasingContractProvince} onChange={(event) => setLeasingContractProvince(event.target.value)}>
                    {ARGENTINA_JURISDICTIONS.map((province) => <option key={province} value={province}>{province}</option>)}
                  </select></label>
                  <label>Domicilio del dador<select value={leasingLessorProvince} onChange={(event) => setLeasingLessorProvince(event.target.value)}>
                    {ARGENTINA_JURISDICTIONS.map((province) => <option key={province} value={province}>{province}</option>)}
                  </select></label>
                  <label>¿Si el uso fuera en otra provincia, qué diferencia habría? (opcional)<select value={leasingComparisonProvince} onChange={(event) => setLeasingComparisonProvince(event.target.value)}>
                    <option value="">No comparar otra provincia</option>
                    {ARGENTINA_JURISDICTIONS.filter((province) => province !== leasingProvince).map((province) => <option key={province} value={province}>{province}</option>)}
                  </select></label>
                </div>
                <small>Si elegís otra provincia, el comparativo mostrará porcentajes, bases y condiciones —sin montos— y verificará si ese uso o radicación sería jurídicamente posible según domicilio, guarda habitual, lugar de explotación y registro competente. No supone que pueda elegirse una provincia sin conexión real.</small>
                {leasingProvinceError && <div className="termsError" role="alert">{leasingProvinceError}</div>}
                <h3 style={{ marginTop: '20px' }}>Datos del caso práctico</h3>
                <p>Completá lo que conozcas o <b>subí una cotización en PDF o imagen para evitar cargar estos datos a mano</b>. ChamuyoCheck leerá el documento y analizará por defecto un leasing financiero; cuando deba simular un caso usará cánones calculados por sistema francés.</p>
                <div className="leasingProvinceGrid">
                  <label>Tipo de bien<select value={leasingAssetType} onChange={(event) => setLeasingAssetType(event.target.value)}><option>Maquinaria o equipo</option><option>Automotor</option><option>Inmueble</option><option>Embarcación</option><option>Aeronave</option><option>Otro bien mueble</option></select></label>
                  <label>Valor del bien sin IVA<input inputMode="decimal" value={leasingAssetValue} onChange={(event) => setLeasingAssetValue(event.target.value)} placeholder="Ej.: 100000000" /><small>Ingresá el precio neto. El IVA se calcula y analiza por separado.</small></label>
                  <label>Porcentaje a financiar<input type="number" min="1" max="100" value={leasingFinancedPercent} onChange={(event) => setLeasingFinancedPercent(event.target.value)} /><small>100% financia todo; 80% implica 20% de aporte inicial.</small></label>
                  <label>Plazo en meses<input type="number" min="1" max="240" value={leasingMonths} onChange={(event) => setLeasingMonths(event.target.value)} /></label>
                  <label>TNA estimada (opcional)<input type="number" min="0" step="0.01" value={leasingTna} onChange={(event) => setLeasingTna(event.target.value)} placeholder="Ej.: 42" /></label>
                  <label>Cómo está pactada la opción<select value={leasingOptionMode} onChange={(event) => setLeasingOptionMode(event.target.value as 'percent' | 'amount')}><option value="percent">Porcentaje del valor del bien</option><option value="amount">Importe fijo</option></select></label>
                  {leasingOptionMode === 'percent'
                    ? <label>Opción de compra (% del bien)<input type="number" min="0" step="0.01" value={leasingOptionPercent} onChange={(event) => setLeasingOptionPercent(event.target.value)} placeholder="Ej.: 5" /></label>
                    : <label>Valor pactado de la opción<input inputMode="decimal" value={leasingOptionAmount} onChange={(event) => setLeasingOptionAmount(event.target.value)} placeholder="Ej.: 5000000" /></label>}
                  <label>Cánones de garantía al inicio<input type="number" min="0" max="24" value={leasingGuaranteeCanons} onChange={(event) => setLeasingGuaranteeCanons(event.target.value)} /><small>Se reciben como garantía y se aplican a las últimas cuotas; se facturan e imputan al aplicarse.</small></label>
                  <label>Gasto de estructuración (% financiado)<input type="text" inputMode="decimal" value={leasingStructuringFeePercent} onChange={(event) => setLeasingStructuringFeePercent(event.target.value.replace(/[^\d.,]/g, ''))} placeholder="Ej.: 4,5" /><small>Acepta decimales con coma o punto. En el mercado suele cotizarse aproximadamente entre 2% y 5%; confirmá la oferta real.</small></label>
                </div>
                <div className="betaAccessNote"><b>¿Tenés una cotización?</b> Subila como PDF o imagen: se extraerán valor sin IVA, IVA, plazo, cánones, opción, garantías, comisiones y gastos. No hace falta repetirlos en el formulario. Escribí solamente el uso del bien, el perfil del tomador (empresa, autónomo, monotributista o consumidor), quién paga el mantenimiento y cualquier condición especial. Por defecto, el seguro se considera contratado y pagado por el dador y refacturado mensualmente al tomador, salvo que el documento establezca otra mecánica.</div>
              </div>}
            </div>
            <div className={`analysisInputStage ${selectedCategory ? '' : 'locked'}`} aria-disabled={!selectedCategory}>
            <div className="analysisStepTitle"><span>PASO 2</span> Cargá el contenido y escribí tu pregunta</div>
            <div className="tabs">{(['Texto', 'PDF', 'Imagen', 'Web', 'YouTube'] as InputMode[]).map((x) => <button key={x} type="button" disabled={!selectedCategory} className={`tab ${detected === x || (detected === 'Archivo' && x === 'PDF') ? 'active' : ''}`} onClick={() => chooseInputMode(x)}>{x}</button>)}</div>
            <div className={`drop ${drag ? 'drag' : ''}`} onClick={() => { if (!selectedCategory) { setCategoryError('Elegí una categoría antes de cargar contenido.'); categoryRef.current?.focus(); return; } if (activeInput === 'PDF' || activeInput === 'Imagen') fileRef.current?.click(); }} onDragOver={(e) => { e.preventDefault(); if (selectedCategory) setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              <h3>Pegá o arrastrá cualquier contenido</h3>
              <p>Texto · PDF · imágenes · capturas · sitios web · videos de YouTube. La categoría elegida guía el análisis y el sistema identifica el subtema.</p>
              {file && <span className="filePill">{file.name} · {fmt(file.size)}</span>}
            </div>
            {(activeInput === 'Web' || activeInput === 'YouTube') && <input className="urlInput" disabled={!selectedCategory} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={activeInput === 'YouTube' ? 'Pegá la URL de YouTube' : 'Pegá la URL del sitio web'} />}
            <label htmlFor="analysis-instruction"><b>{detected === 'Texto' && !file && !url ? 'Escribí tu consulta' : 'Indicá qué necesitás saber'}</b></label>
            <textarea id="analysis-instruction" disabled={!selectedCategory} value={text} onChange={(e) => { setText(e.target.value); setInstructionError(''); }} placeholder={selectedCategory === 'leasing-specialist' ? 'Ejemplo: La tomadora es una empresa responsable inscripta y usará el vehículo en su actividad gravada. Analizá la cotización, sus costos y beneficios. El mantenimiento estará a cargo del tomador.' : selectedCategory ? (activeInput === 'YouTube' ? 'Ejemplo: analizá si la propuesta del curso es coherente y qué riesgos tiene.' : activeInput === 'Web' ? 'Ejemplo: calculá el costo total del préstamo y explicá sus condiciones.' : activeInput === 'Imagen' || file?.type.startsWith('image/') ? 'Ejemplo: calculá la TNA y el costo anual efectivo para la alternativa de 36 meses.' : 'Explicá con precisión qué necesitás saber sobre el contenido.') : 'Primero elegí una categoría.'} />
            {instructionError && <div className="termsError" role="alert">{instructionError}</div>}
            <div className="termsConsent"><input id="terms-consent" type="checkbox" checked={termsAccepted} onChange={(e) => e.target.checked ? acceptCurrentTerms() : revokeTermsAcceptance()} /><label htmlFor="terms-consent">Leí y acepto los <button type="button" className="termsLink" onClick={(e) => { e.preventDefault(); setShowTerms(true); }}>Términos y Condiciones</button> (versión {TERMS_VERSION}).</label></div>
            {termsError && <div className="termsError" role="alert">{termsError}</div>}
            <div className="ctaRow"><button type="button" className="primary" onClick={analyze} disabled={loading || sessionLoading || !selectedCategory || !text.trim() || (selectedCategory === 'leasing-specialist' && !leasingProvince)}>{loading ? 'Analizando' : 'Analizar'}</button><span className="hint">{session ? `Entrada: ${getInputLabel(detected, Boolean(file))}` : 'Registrate para analizar'}</span></div>
            {session && <div className="betaAccessNote">Beta completa activa: sin límites ni cobros.</div>}
            {loading && <div className="loading">{steps.map((s, i) => <p key={i}>{s}</p>)}</div>}
            </div>
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
        {analysis.decisionAnswer && <div className="panel legalResultPanel decisionAnswerPanel">
          <div className="eyebrow">RESPUESTA A TU CONSULTA</div>
          <h2>{analysis.decisionAnswer.title}</h2>
          <button type="button" className="ghost" onClick={saveFavorite}>☆ Guardar en favoritos</button>
          <p className="decisionDirectAnswer">{analysis.decisionAnswer.directAnswer}</p>
          {analysis.decisionAnswer.comparisonTable && <section className="leasingComparisonSection">
            <h3>Comparación provincial</h3>
            <div className="leasingComparisonTableWrap">
              <table className="leasingComparisonTable">
                <thead><tr><th>Concepto</th>{analysis.decisionAnswer.comparisonTable.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>{analysis.decisionAnswer.comparisonTable.rows.map((row) => <tr key={row.label}><th>{row.label}</th>{row.values.map((value, index) => <td key={`${row.label}-${index}`}>{value}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </section>}
          {analysis.decisionAnswer.sections?.length
            ? <div className="leasingResultSections">{analysis.decisionAnswer.sections.map((section) => <section className="leasingResultSection" key={section.title}><h3>{section.title}</h3><ul>{section.items.map((item, index) => <li key={`${section.title}-${index}`}>{item}</li>)}</ul></section>)}</div>
            : analysis.decisionAnswer.findings.length > 0 && <><h3>Datos y hallazgos</h3><ul>{analysis.decisionAnswer.findings.map((item, index) => <li key={`decision-finding-${index}`}>{item}</li>)}</ul></>}
          {analysis.decisionAnswer.nextActions.length > 0 && <><h3>Qué conviene hacer ahora</h3><ul>{analysis.decisionAnswer.nextActions.map((item, index) => <li key={`decision-action-${index}`}>{item}</li>)}</ul></>}
          {analysis.decisionAnswer.limitations.length > 0 && <details><summary>Supuestos y datos que todavía deben verificarse</summary><ul>{analysis.decisionAnswer.limitations.map((item, index) => <li key={`decision-limit-${index}`}>{item}</li>)}</ul></details>}
        </div>}
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
            {analysis.externalVerification.plan && <div className="verificationRequirements" aria-label="Requisitos de verificación">
              <span><b>{analysis.externalVerification.plan.claimsRequiringExternalVerification}</b> afirmaciones a verificar</span>
              <span><b>{analysis.externalVerification.plan.minimumIndependentSources}</b> fuentes independientes como mínimo</span>
              {analysis.externalVerification.plan.officialSourceRequired && <span>Requiere fuente oficial</span>}
              {analysis.externalVerification.plan.recencyRequired && <span>Requiere información vigente</span>}
            </div>}
            {analysis.externalVerification.sourceAvailability?.length ? <details open={!analysis.externalVerification.externalVerificationPerformed}>
              <summary>Fuentes requeridas y disponibilidad</summary>
              <ul>{analysis.externalVerification.sourceAvailability.map((source) => <li key={source.sourceType}><b>{verificationSourceLabel(source.sourceType)}:</b> {availabilityLabel(source.status)}</li>)}</ul>
            </details> : null}
            {analysis.externalVerification.execution?.records?.length ? <><h3>Fuentes efectivamente consultadas</h3><ul>{analysis.externalVerification.execution.records.map((record, index) => <li key={`${record.url}-${index}`}><a href={record.url} target="_blank" rel="noreferrer">{record.title}</a> <small>({verificationSourceLabel(record.sourceType)}{record.official ? ', oficial' : ''}{record.sourceDate ? `, ${record.sourceDate.slice(0, 10)}` : ''})</small></li>)}</ul></> : <p>No se obtuvieron fuentes auditables suficientes. Las fuentes disponibles o planificadas arriba indican capacidad técnica, no una consulta realizada.</p>}
            {analysis.externalVerification.claims?.some((claim) => claim.externalVerificationRequired && !claim.externalVerificationPerformed) && <details>
              <summary>Afirmaciones pendientes de verificación</summary>
              <ul>{analysis.externalVerification.claims.filter((claim) => claim.externalVerificationRequired && !claim.externalVerificationPerformed).map((claim) => <li key={claim.claimIndex}><b>“{claim.text}”</b>{claim.pendingReasons.length > 0 && <><br /><small>{claim.pendingReasons.join(' ')}</small></>}</li>)}</ul>
            </details>}
            <p className="legalDisclaimerSubtle">El estado sólo cambia a completado cuando existen fuentes reales, fechadas y vinculadas con las afirmaciones correspondientes. La disponibilidad de un conector no prueba ni refuta el contenido.</p>
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
        {showDetailedResults && <><div className="reportTabs">{['Resumen', 'Evidencias', 'Riesgos', 'Finanzas', 'Derecho argentino', 'Recomendaciones', 'Fuentes', 'Datos extraídos'].map((x) => <button key={x} type="button" className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>
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
          <div><h3>↗ Recomendaciones</h3><p>{reportSections?.contextCard ? reportSections.contextCard.items[0] : 'Obtené sugerencias específicas para aumentar calidad y confiabilidad.'}</p><button type="button" className="ghost" onClick={() => { setImproveDraft(analysis.extractedPreview || text); openImprove(); }}>Mejorar documento</button></div>
        </div>
        {reportSections?.contextCard && <div className="section"><h2>{reportSections.contextCard.title}</h2><ul>{reportSections.contextCard.items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        <div className="section"><h2>Recomendaciones de verificación</h2><ul>{reportSections?.recommendations.slice(0, 6).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="section"><h2>Especialistas activados</h2><div className="moduleGrid">{analysis.modules.map(moduleCard)}</div></div>
        <div className="section"><h2>Por qué obtuvo este puntaje</h2><ul>{(analysis.scoreExplanation || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        {analysis.extractedPreview && <div className="section"><h2>Datos extraídos</h2><p>{analysis.extractedPreview}</p></div>}</>}
      </section>}
      </> : <section className="panel viewPanel" style={{ padding: '28px', marginTop: '8px' }}>
        <div className="viewPanelHeader">
          <h2>{sectionTitle}</h2>
          <p className="hint">{sectionHint}</p>
        </div>
        {activeView === 'leasing' && <>
          <div className="panel legalResultPanel" style={{ marginTop: '14px' }}>
            <h3>Comparar ventajas entre dos provincias</h3>
            <p>Elegí dos jurisdicciones. La respuesta separará lugar del contrato, uso o radicación, porcentajes, exenciones y gastos de la opción.</p>
            <div className="cards">
              <label className="card"><b>Provincia A</b><select value={leasingHubProvinceA} onChange={(event) => setLeasingHubProvinceA(event.target.value)}>{ARGENTINA_JURISDICTIONS.map((province) => <option key={`hub-a-${province}`} value={province}>{province}</option>)}</select></label>
              <label className="card"><b>Provincia B</b><select value={leasingHubProvinceB} onChange={(event) => setLeasingHubProvinceB(event.target.value)}>{ARGENTINA_JURISDICTIONS.map((province) => <option key={`hub-b-${province}`} value={province}>{province}</option>)}</select></label>
            </div>
            {leasingHubProvinceA === leasingHubProvinceB && <p className="termsError">Elegí dos provincias diferentes.</p>}
            <button type="button" className="primary" disabled={leasingHubProvinceA === leasingHubProvinceB} onClick={compareLeasingProvinces}>Continuar con la comparación provincial</button>
          </div>
          <div className="cards" style={{ marginTop: '14px' }}>
            <div className="card"><h3>Leasing operativo vs. financiero</h3><p>Diferencias en propiedad, riesgos, servicios, cánones, valor residual y opción de compra.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', 'Explicame y compará leasing operativo y leasing financiero en Argentina. Indicá cómo cambian los cánones, servicios, riesgos, valor residual, devolución y opción de compra; aclarame cuándo una operación puede ser locación y no leasing financiero.')}>Abrir guía comparativa</button></div>
            <div className="card"><h3>Plazos mínimos y beneficios fiscales</h3><p>Decreto 1038/2000 actualizado por el Decreto 152/2022: duración, vida útil y opción.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', 'Explicame los plazos mínimos fiscales del leasing según el Decreto 1038/2000 actualizado por el Decreto 152/2022. Diferenciá bienes muebles e inmuebles, vida útil, precio de opción y requisitos para el tratamiento impositivo. No confundas estos plazos con el artículo 1238 del Código Civil y Comercial.')}>Consultar plazos</button></div>
            <div className="card"><h3>Cómo funciona el leasing</h3><p>Guía educativa: partes, bien, maxi canon, cánones, opción, registro, incumplimiento y finalización.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', 'Enseñame cómo funciona un leasing en Argentina desde el inicio hasta la opción o devolución. Explicá dador, tomador, proveedor, elección del bien, maxi canon, cánones, IVA, seguros, mantenimiento, registro, mora, recupero, opción de compra y transferencia.')}>Abrir guía educativa</button></div>
            <div className="card"><h3>Gastos, beneficios y exenciones</h3><p>Calculá qué paga el tomador y qué conceptos pueden estar exentos según bien, sujeto y provincia.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', 'Quiero saber todos los gastos, beneficios impositivos y exenciones de un leasing. Pedime tipo de bien, tipo fiscal de tomador, provincia del contrato, provincia de uso o registro, maxi canon, cánones, plazo y opción antes de afirmar una exención.')}>Preparar consulta</button></div>
            <div className="card"><h3>Leasing vs. préstamo</h3><p>Comparación del flujo total después de impuestos para el mismo activo y plazo.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', 'Compará leasing, préstamo prendario y compra al contado para el mismo activo y plazo. Mostrá ventajas diferenciales, garantías, IVA, Ganancias, Sellos, costos registrales, mantenimiento, valor residual y opción, sin prometer ahorro automático.')}>Preparar comparación</button></div>
            <div className="card"><h3>Leasing público e importación</h3><p>Normas BCRA, garantías, coparticipación, MULC, proveedor extranjero y registros.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', 'Analizá un leasing para sector público o para importar un bien. Separá autorización presupuestaria, endeudamiento, garantías, posible coparticipación, normas BCRA, acceso al MULC, pago al proveedor, aduana y registro del activo.')}>Preparar consulta avanzada</button></div>
          </div>
        </>}
        {activeView === 'historial' && <>
          {historyItems.length ? <div className="historyMini" style={{ marginTop: '14px' }}>{historyItems.map((item) => <div className="historyItem" key={item.id}><span>{item.score}</span><div>{item.title}<small>{item.documentType} · {item.date}</small></div></div>)}</div> : <div className="paywall" style={{ marginTop: '14px' }}>Todavía no hay historial local disponible.</div>}
        </>}
        {activeView === 'favoritos' && <>
          {favoritesItems.length ? <div className="historyMini" style={{ marginTop: '14px' }}>{favoritesItems.map((item) => <div className="historyItem" key={item}><div>{item}<small>Guardado en este navegador</small></div><button type="button" className="ghost" onClick={() => removeFavorite(item)}>Quitar</button></div>)}</div> : <div className="paywall" style={{ marginTop: '14px' }}>No hay favoritos guardados todavía. Guardá uno desde su respuesta.</div>}
        </>}
        {activeView === 'plantillas' && <>
          <div className="cards" style={{ marginTop: '14px' }}>
            <div className="card"><h3>Leasing: gastos y exenciones</h3><p>Detalla bien, tomador, provincias, cánones y opción.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', 'Quiero analizar un leasing de [TIPO DE BIEN]. El tomador es [EMPRESA / PERSONA HUMANA / MONOTRIBUTISTA]. El contrato se celebra en [PROVINCIA], el bien se usará y registrará en [PROVINCIA]. Informá gastos, porcentajes, exenciones, beneficios fiscales y costo de la opción de compra.')}>Usar plantilla</button></div>
            <div className="card"><h3>Comparar leasing y préstamo</h3><p>Compara el mismo activo y plazo después de impuestos.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', 'Compará este leasing con un préstamo para comprar el mismo bien. Separá anticipo o maxi canon, cánones/cuotas, tasa, IVA, Sellos, comisiones, seguros, mantenimiento, opción, valor residual y beneficios impositivos realmente utilizables.')}>Usar plantilla</button></div>
            <div className="card"><h3>Revisar un contrato</h3><p>Busca obligaciones, costos, riesgos y cláusulas ambiguas.</p><button type="button" className="primary" onClick={() => useTemplate('argentina-legal-documents', 'Revisá este contrato argentino. Explicá obligaciones, costos, plazos, mora, garantías, rescisión, jurisdicción, cláusulas ambiguas y datos que faltan verificar.')}>Usar plantilla</button></div>
          </div>
          {templatesItems.length > 0 && <ul>{templatesItems.map((item, i) => <li key={i}>{item}</li>)}</ul>}
        </>}
        {activeView === 'comparar' && <>
          <div className="cards" style={{ marginTop: '14px' }}><div className="card"><h3>Texto A</h3><textarea value={compareLeft} onChange={(event) => setCompareLeft(event.target.value)} placeholder="Pegá la primera oferta o contrato" /></div><div className="card"><h3>Texto B</h3><textarea value={compareRight} onChange={(event) => setCompareRight(event.target.value)} placeholder="Pegá la segunda oferta o contrato" /></div></div>
          {comparisonReady ? <div className="panel legalResultPanel" style={{ marginTop: '14px' }}><h3>Comparación preliminar</h3><p>Texto A: {compareLeft.length} caracteres. Texto B: {compareRight.length} caracteres.</p><p>Coincidencias relevantes: {sharedWords.slice(0, 20).join(', ') || 'no se detectaron coincidencias claras'}.</p><button type="button" className="primary" onClick={() => useTemplate('leasing-specialist', `Compará estas dos propuestas para el mismo bien. Identificá diferencias de tasa, flujo, impuestos, gastos, opción, garantías y riesgos.\n\nPROPUESTA A:\n${compareLeft}\n\nPROPUESTA B:\n${compareRight}`)}>Analizar la comparación</button></div> : <div className="paywall" style={{ marginTop: '14px' }}>Pegá al menos 20 caracteres en cada texto.</div>}
        </>}
        {activeView === 'mejorar' && <>
          <textarea style={{ marginTop: '14px', width: '100%', minHeight: '240px' }} value={improveDraft} onChange={(event) => setImproveDraft(event.target.value)} placeholder="Pegá el documento que querés mejorar" />
          <button type="button" className="primary" style={{ marginTop: '12px' }} disabled={!improveDraft.trim()} onClick={sendImprovementToAnalysis}>Revisar y mejorar</button>
        </>}
        {activeView === 'ajustes' && <>
          <div className="panel legalResultPanel" style={{ marginTop: '14px' }}><label><input type="checkbox" checked={showDetailedResults} onChange={(event) => { setShowDetailedResults(event.target.checked); localStorage.setItem('cc_detailed_results', String(event.target.checked)); }} /> Mostrar explicaciones detalladas</label><p className="hint">Idioma: español · Jurisdicción legal predeterminada: Argentina</p><button type="button" className="ghost" onClick={() => { localStorage.removeItem('cc_history'); setHistoryItems([]); }}>Borrar historial local</button> <button type="button" className="ghost" onClick={() => { localStorage.removeItem('cc_favorites'); setFavoritesItems([]); }}>Borrar favoritos</button></div>
        </>}
        {activeView === 'ayuda' && <div className="panel legalResultPanel" style={{ marginTop: '14px' }}><h3>Cómo obtener una respuesta útil</h3><ol><li>Elegí la categoría correcta.</li><li>Explicá qué decisión necesitás tomar.</li><li>Incluí documento, importes, tasas, fechas y jurisdicción.</li><li>En leasing indicá tipo de bien, tomador, provincia del contrato, provincia de uso/registro, cánones y opción.</li></ol><h3>Qué hace ChamuyoCheck</h3><p>Separa hechos, cálculos, riesgos, gastos, beneficios condicionados y puntos que necesitan una fuente oficial. No inventa una exención cuando faltan datos.</p></div>}
      </section>}
    </main>
    <div className="legalFooter"><details><summary>🔒 Aviso legal</summary><p>{analysis?.legalSafeguard || 'ChamuyoCheck genera una evaluación automatizada y orientativa. No afirma veracidad, falsedad, autoría, plagio, uso de IA ni ilegalidad; no reemplaza asesoramiento profesional.'}</p></details><span>Resultado automatizado, orientativo y sujeto a revisión humana.</span></div>
  </div>;
}
