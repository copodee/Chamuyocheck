import type { DomainDetection, ContentDomain } from '../types/contentDomain';

const rules: Array<{domain: ContentDomain; label: string; modules: string[]; patterns: RegExp[]}> = [
  {domain:'academico',label:'Trabajo académico',modules:['Originalidad','IA académica','Plagio estimativo','Bibliografía','Coherencia'],patterns:[/tesis|monograf|ensayo|universidad|facultad|colegio|alumno|bibliograf|referencias|marco te[oó]rico|abstract|paper|docente/i]},
  {domain:'financiero',label:'Oferta financiera / préstamo',modules:['Costo total','CFT','Tasas','Cargos ocultos','Condiciones'],patterns:[/pr[eé]stamo|cr[eé]dito|cuota|cft|tea|tna|inter[eé]s|financiaci[oó]n|mora|comisi[oó]n|seguro|iva|\$\s?\d/i]},
  {domain:'inversion',label:'Inversión o rentabilidad prometida',modules:['Riesgo piramidal','Rentabilidad','Referidos','Sustento económico','Regulación'],patterns:[/inversi[oó]n|rentabilidad|ganancia|referidos|ponzi|piramid|multinivel|ingresos pasivos|trading|cripto|retorno garantizado/i]},
  {domain:'contrato',label:'Contrato / documento legal',modules:['Cláusulas','Obligaciones','Penalidades','Jurisdicción','Vacíos'],patterns:[/contrato|cl[aá]usula|partes|jurisdicci[oó]n|penalidad|rescisi[oó]n|incumplimiento|obligaci[oó]n|t[eé]rminos y condiciones/i]},
  {domain:'salud',label:'Contenido de salud',modules:['Evidencia médica','Riesgo sanitario','Fuentes científicas','Advertencias','Consenso'],patterns:[/salud|m[eé]dico|medicamento|tratamiento|cura|c[aá]ncer|dolor|síntoma|suplemento|dosis|paciente|diagn[oó]stico/i]},
  {domain:'noticia',label:'Noticia / artículo',modules:['Fuente original','Autor','Fecha','Citas','Lenguaje emocional'],patterns:[/noticia|seg[uú]n fuentes|diario|periodista|comunicado|prensa|redacci[oó]n|exclusivo|último momento/i]},
  {domain:'politica',label:'Contenido político',modules:['Propaganda','Datos verificables','Lenguaje emocional','Fuente','Contexto'],patterns:[/gobierno|presidente|ministro|elecci[oó]n|campaña|partido|diputado|senador|municipio|pol[ií]tica/i]},
  {domain:'ciencia',label:'Contenido científico',modules:['Paper','Metodología','Muestra','Resultados','Revisión'],patterns:[/estudio|investigaci[oó]n|paper|ensayo clínico|muestra|metodolog[ií]a|doi|revista científica|universidad/i]},
  {domain:'redes',label:'Publicación de redes sociales',modules:['Viralidad','Captura','Fuente','Contexto','Manipulación'],patterns:[/instagram|whatsapp|facebook|tiktok|x\.com|tweet|posteo|viral|captura/i]},
  {domain:'publicidad',label:'Publicidad / promesa comercial',modules:['Promesas','Condiciones','Garantías','Costo real','Letra chica'],patterns:[/garantizado|sin esfuerzo|aprobaci[oó]n inmediata|oferta|promoci[oó]n|descuento|compr[aá]|curso|millonario/i]},
];

export function detectDomain(text: string, inputType = 'Texto'): DomainDetection {
  const hits = rules.map(rule => {
    const score = rule.patterns.reduce((acc, p) => acc + (p.test(text) ? 1 : 0), 0);
    return { rule, score };
  }).sort((a,b)=>b.score-a.score);

  const best = hits[0];
  if (!best || best.score === 0) {
    return {
      domain:'general',
      label: inputType === 'PDF' ? 'Documento general' : 'Credibilidad general',
      confidence: 52,
      reasons:['No se detectó una temática dominante con suficiente claridad.'],
      recommendedModules:['Credibilidad','Evidencia','Transparencia','Manipulación']
    };
  }

  const confidence = Math.min(98, 55 + best.score * 14);
  return {
    domain: best.rule.domain,
    label: best.rule.label,
    confidence,
    reasons: best.rule.patterns.filter(p=>p.test(text)).slice(0,4).map(p=>`Coincide con patrón ${String(p).slice(1,35)}...`),
    recommendedModules: best.rule.modules
  };
}
