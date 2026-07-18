import { describeInput } from './inputClassifier';
import { detectReproductiveBiologyQuestion } from './healthBiologyEngine';
import { detectSensitivePersonalClaim } from './sensitivePersonalClaim';

const employmentSignals = /\b(vacante|vacancy|postulaci[oó]n|enviar cv|curriculum vitae|curriculum|recruiter|reclutador|entrevista laboral|entrevista|requisitos para el puesto|requisitos del puesto|requisitos para el cargo|requisitos del cargo|contrataci[oó]n individual|oferta de trabajo|oferta laboral|beneficios del puesto|sueldo ofrecido para una posici[oó]n|puesto vacante|cargo vacante|candidato|empleador|empleado)\b/i;

const publicEconomicSignals = /(salario real|inflaci[oó]n|empleo registrado|sipa|convenios colectivos|remuneraciones|secretar[ií]a de trabajo|poder adquisitivo|nota period[ií]stica|informe econ[oó]mico|econom[ií]a|empleo formal|remuneraci[oó]n real|mercado laboral|empleo formal|costo de vida)/i;
const publicReleaseSignals = /(comunicado|comunicación|nota de prensa|press release|prensa|institucional|declaración|afirmación pública|comunicado de prensa|anuncio institucional|boletín|nota oficial|nota|public statement|company note|empresa|gobierno|grupo|mensaje institucional)/i;
const healthSignals = /salud|medicamento|tratamiento|cura|c[aá]ncer|dolor|síntoma|suplemento|dosis|paciente|diagn[oó]stico/i;
const financeSignals = /pr[eé]stamo|cr[eé]dito|cuota|cft|tea|tna|inter[eé]s|financiaci[oó]n|comisi[oó]n|seguro|bitcoin|criptomoneda|cripto|ethereum|inversi[oó]n|invertir|rentabilidad|ganancia|retorno|acciones|bolsa|mercado burs[aá]til|fondo mutuo|\$\s?\d/i;
const publicPolicySignals = /pol[ií]tica p[uú]blica|gasto p[uú]blico|presupuesto p[uú]blico|inversi[oó]n p[uú]blica|pol[ií]tica social|servicios p[uú]blicos|educaci[oó]n p[uú]blica|salud p[uú]blica|bienestar p[uú]blico|infancia|ni[ñn]ez|familia|pobreza|desigualdad/i;
const legalSignals = /contrato|cl[aá]usula|jurisdicci[oó]n|penalidad|rescisi[oó]n|incumplimiento|obligaci[oó]n|t[eé]rminos y condiciones/i;
const academicSignals = /tesis|monograf|ensayo|universidad|facultad|colegio|alumno|bibliograf|referencias|docente|hecho con ia|hecha con ia|chatgpt/i;
const politicsSignals = /gobierno|presidente|ministro|elecci[oó]n|campaña|partido|diputado|senador|municipio|pol[ií]tica/i;
const scienceSignals = /estudio|investigaci[oó]n|paper|ensayo clínico|muestra|metodolog[ií]a|doi|revista científica|universidad/i;
const techSignals = /ia|inteligencia artificial|algoritmo|software|tecnolog[ií]a|startup|app|plataforma|chatgpt|openai/i;
const commercialSignals = /promesa|garant[aí]a|oferta|publicidad|descuento|promo|producto|servicio|marketing|venta|sin esfuerzo|millonario|100%/i;
const productSignals = /producto|servicio|garant[ií]a|comparativa|reseña|calidad|rendimiento/i;

export function detectTopic(text: string, inputKind: string, selectedCategory?: string | null) {
  const all = text.toLowerCase();
  const input = describeInput(inputKind);

  // SENSITIVE ALLEGATION — must check FIRST before any other classifier
  // Detects: identifiable public figure + sexual/intimate allegation
  const sensitiveAllegation = detectSensitivePersonalClaim(text).detected;

  if (sensitiveAllegation) {
    return {
      key: 'sensitive-allegation',
      label: 'Afirmación personal sensible no verificada',
      hint: 'No difundir sin verificación externa rigurosa.',
      summary: 'La entrada atribuye un dato personal sensible a una persona identificable sin aportar una fuente primaria, atribución ni evidencia verificable. ChamuyoCheck no confirma ni desmiente esa atribución. Por el riesgo de desinformación, invasión de privacidad y daño reputacional, no debe difundirse como verdadera.',
      prudentConclusion: 'No afirmaría ni negaría la acusación sin evidencia verificable. La ausencia de fuente o atribución la convierte en rumor no confirmado.',
      verdict: 'NO DIFUNDIR SIN VERIFICACIÓN: acusación grave sin evidencia ni fuente verificable.',
      modules: ['Atribución', 'Fuente primaria', 'Corroboración independiente', 'Daño reputacional'],
      recommendations: [
        'No difundir la acusación sin verificación de al menos dos fuentes independientes.',
        'Verificar si existe denuncia formal, declaración pública o cobertura periodística verificada.',
        'Considerar el daño reputacional ante afirmaciones no verificadas.',
      ]
    };
  }

  // La categoría elegida por la persona es el contexto primario. El detector
  // léxico sólo identifica el subtema dentro de esa categoría y no puede
  // reemplazarla por otra debido a palabras ambiguas.
  if (selectedCategory === 'argentina-legal-documents') {
    return {
      key: 'legal', label: 'Derecho argentino', hint: 'Revisá hechos, resolución, documentos, jurisdicción y norma aplicable.',
      summary: `La consulta requiere identificar la consecuencia jurídica aplicable y los documentos o hechos necesarios para controlarla.`,
      prudentConclusion: `La respuesta debe distinguir la regla general de lo que sólo puede confirmarse revisando el expediente, documento o acto correspondiente.`,
      verdict: `Evaluación jurídica orientativa para ${input.noun}: corresponde verificar hechos, documentos, jurisdicción y normativa aplicable.`,
      modules: ['Hechos relevantes', 'Norma aplicable', 'Documentación', 'Jurisdicción', 'Próximos pasos'],
      recommendations: ['Reuní el documento o resolución pertinente.', 'Verificá jurisdicción, vigencia, notificación y plazos antes de actuar.'],
    };
  }
  if (selectedCategory === 'finance-credit') {
    return {
      key: 'finance', label: 'Finanzas y créditos', hint: 'Revisá costos reales, tasas y condiciones.',
      summary: `La consulta se analiza como una operación financiera o crediticia.`, prudentConclusion: `Conviene calcular el flujo completo y contrastar las condiciones contractuales.`,
      verdict: `Evaluación financiera para ${input.noun}: revisá costo total, tasas, cargos y condiciones.`, modules: ['Costo total', 'CFT', 'Tasas', 'Cargos', 'Condiciones'],
      recommendations: ['Pedí el costo total y las condiciones completas.', 'Verificá tasas, comisiones, seguros e impuestos.'],
    };
  }
  if (selectedCategory === 'scam-risk') {
    return {
      key: 'product-service', label: 'Posible estafa', hint: 'Revisá identidad, promesas, pagos y evidencia independiente.',
      summary: `La consulta se analiza para detectar señales observables de una posible estafa.`, prudentConclusion: `No corresponde afirmar fraude sin evidencia, pero sí identificar señales y verificaciones necesarias.`,
      verdict: `Evaluación preventiva para ${input.noun}: verificá identidad, autorización, promesas y canales de pago.`, modules: ['Identidad', 'Promesas', 'Pagos', 'Trazabilidad', 'Verificación'],
      recommendations: ['No pagues ni compartas credenciales hasta verificar la contraparte.', 'Contrastá identidad, dominio y autorización en fuentes independientes.'],
    };
  }
  if (selectedCategory === 'investment-project') {
    return {
      key: 'finance', label: 'Inversiones y proyectos', hint: 'Revisá supuestos, flujo, escenarios y evidencia sectorial.',
      summary: `La consulta se analiza como una inversión o proyecto productivo.`, prudentConclusion: `La viabilidad depende de supuestos verificables y escenarios comparables.`,
      verdict: `Evaluación de inversión para ${input.noun}: contrastá supuestos, retornos, riesgos y escenarios.`, modules: ['Supuestos', 'Flujo', 'Escenarios', 'Riesgos', 'Fuentes sectoriales'],
      recommendations: ['Construí escenarios adverso, base y favorable.', 'Verificá precios, demanda, costos y permisos con fuentes pertinentes.'],
    };
  }

  const reproductiveBio = detectReproductiveBiologyQuestion(all);

  if (reproductiveBio.isReproductiveBiology) {
    return {
      key: 'health-biology-question',
      label: 'Salud / biología / reproducción',
      hint: 'Pregunta factual sobre biología humana y reproducción.',
      summary: `El análisis responde una pregunta de biología humana. ${reproductiveBio.contextualAnswer}`,
      prudentConclusion: `La respuesta se apoya en conocimiento biomédico. ${reproductiveBio.ambiguity}`,
      verdict: `Pregunta factual sobre ${input.noun}: podés avanzar con verificación básica de contexto.`,
      modules: ['Biología humana', 'Reproducción', 'Contexto de identidad', 'Bases médicas'],
      recommendations: ['Si es situación personal, consultá con especialistas en salud o reproducción.', 'Aclaá el contexto: ¿se refiere a varón cisgénero, persona trans o intersex?']
    };
  }

  // Check public policy BEFORE health to distinguish "salud pública" policy from medical claims
  if (publicPolicySignals.test(all)) {
    return {
      key: 'public-policy',
      label: 'Política pública',
      hint: 'Revisá datos, contexto e impacto de la política.',
      summary: `El contenido parece una opinión sobre política pública y conviene verificar el impacto, contexto y datos.`,
      prudentConclusion: `No lo tomaría como conclusión cerrada sobre efectividad; pediría datos y contexto de implementación.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar impacto y contexto de política.`,
      modules: ['Datos', 'Contexto', 'Impacto', 'Implementación'],
      recommendations: ['Buscá datos sobre la política y su impacto real.', 'Contrastá argumentos con evidencia de implementación.']
    };
  }

  if (healthSignals.test(all)) {
    return {
      key: 'health',
      label: 'Salud',
      hint: 'Revisá evidencia médica, riesgos y advertencias.',
      summary: `El análisis se enfoca en ${input.noun} y conviene contrastar cualquier recomendación con evidencia médica y contexto clínico.`,
      prudentConclusion: `No afirmaría que la recomendación es fiable; pediría verificación médica, fuentes y contexto antes de actuar.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar fuentes, riesgos y contexto antes de actuar.`,
      modules: ['Evidencia médica', 'Riesgos', 'Fuentes clínicas', 'Advertencias'],
      recommendations: ['Verificá si la recomendación está respaldada por fuentes médicas.', 'Contrastá riesgos, dosis y contexto clínico.']
    };
  }

  if (financeSignals.test(all)) {
    return {
      key: 'finance',
      label: 'Finanzas',
      hint: 'Revisá costos reales, tasas y condiciones.',
      summary: `El análisis se acerca a una oferta financiera y conviene verificar costos, tasas y condiciones antes de decidir.`,
      prudentConclusion: `No lo trataría como una verdad financiera; pediría el costo total, contrato y condiciones antes de decidir.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene revisar costos, tasas y letra chica.`,
      modules: ['Costo total', 'CFT', 'Tasas', 'Cargos ocultos', 'Condiciones'],
      recommendations: ['Pedí el costo total y las condiciones completas.', 'Verificá tasas, comisiones, seguros y cláusulas relevantes.']
    };
  }

  if (legalSignals.test(all)) {
    return {
      key: 'legal',
      label: 'Legal',
      hint: 'Revisá obligaciones, penalidades y cláusulas.',
      summary: `El contenido parece legal o contractual; conviene revisar cláusulas, obligaciones y contexto antes de actuar.`,
      prudentConclusion: `No concluiría sobre validez o cumplimiento sin revisar el contrato y el marco aplicable.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar cláusulas y obligaciones.`,
      modules: ['Cláusulas', 'Obligaciones', 'Penalidades', 'Jurisdicción'],
      recommendations: ['Contrastá las cláusulas con el contrato y la normativa aplicable.', 'Pedí aclaraciones sobre obligaciones y penalidades.']
    };
  }

  if (academicSignals.test(all)) {
    return {
      key: 'academic',
      label: 'Académico',
      hint: 'Revisá fuentes, métodos y trazabilidad.',
      summary: `El contenido se analiza como posible contexto académico y conviene revisar fuentes, método y trazabilidad.`,
      prudentConclusion: `No afirmaría autoría ni uso de IA sin respaldo; pediría fuentes, método y defensa del trabajo.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene revisar fuentes, método y contexto.`,
      modules: ['Fuentes', 'Método', 'Originalidad', 'Trazabilidad'],
      recommendations: ['Pedí fuentes y contexto metodológico.', 'No concluyas uso de IA sin respaldo.']
    };
  }

  // Check public-economic BEFORE politics so economic data doesn't get classified as political
  if (publicEconomicSignals.test(all) && !employmentSignals.test(all)) {
    return {
      key: 'public-economic',
      label: 'Economía / información pública / nota periodística',
      hint: 'Revisá la fuente, el contexto, la fecha y la trazabilidad.',
      summary: `El contenido se analiza como una nota o afirmación pública relacionada con economía y conviene verificar la fuente original y el contexto.`,
      prudentConclusion: `No lo trataría como comprobado; pediría la fuente original, la fecha y el contexto antes de compartirlo.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar fuente, contexto y trazabilidad.`,
      modules: ['Fuente', 'Fecha', 'Contexto', 'Trazabilidad'],
      recommendations: ['Buscá la fuente original y la fecha de publicación.', 'Verificá si la afirmación se sostiene en múltiples fuentes.']
    };
  }

  if (politicsSignals.test(all)) {
    return {
      key: 'politics',
      label: 'Política',
      hint: 'Revisá datos, contexto y fuentes.',
      summary: `El contenido parece político y conviene revisar el contexto, la fuente y las cifras antes de tomarlo como hecho.`,
      prudentConclusion: `No lo trataría como conclusión cerrada sin revisar fuentes, contexto y datos.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar contexto y fuente.`,
      modules: ['Fuente', 'Contexto', 'Cifras', 'Propaganda'],
      recommendations: ['Buscá la fuente original y el contexto político.', 'Contrastá datos con otras fuentes verificadas.']
    };
  }

  if (scienceSignals.test(all)) {
    return {
      key: 'science',
      label: 'Ciencia',
      hint: 'Revisá metodologías, muestra y alcance.',
      summary: `El contenido se analiza como ciencia o investigación y conviene revisar metodología, alcance y trazabilidad.`,
      prudentConclusion: `No concluiría sobre validez científica sin revisar metodología, muestra y fuentes.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene revisar metodología y alcance.`,
      modules: ['Método', 'Muestra', 'Resultados', 'Fuentes'],
      recommendations: ['Pedí la metodología y el estudio completo.', 'Contrastá hallazgos con otras fuentes científicas.']
    };
  }

  if (techSignals.test(all)) {
    return {
      key: 'technology',
      label: 'Tecnología / IA',
      hint: 'Revisá capacidades, límites y respaldo.',
      summary: `El contenido parece referirse a tecnología o IA y conviene revisar lo que se afirma con fuentes y contexto.`,
      prudentConclusion: `No asumiría que la afirmación es cierta sin revisar la base técnica y el contexto de uso.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar capacidades y respaldo.`,
      modules: ['Capacidades', 'Límites', 'Respaldo', 'Contexto'],
      recommendations: ['Pedí evidencia técnica o pruebas verificables.', 'Contrastá las afirmaciones con documentación o benchmarks.']
    };
  }

  if (employmentSignals.test(all)) {
    return {
      key: 'employment',
      label: 'Empleo',
      hint: 'Revisá condiciones, sueldo y contexto de contratación.',
      summary: `El contenido se analiza como una oferta o propuesta de empleo y conviene verificar condiciones reales.`,
      prudentConclusion: `No lo tomaría como certeza de contratación o condiciones; pediría contexto y detalles concretos.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar condiciones y contexto.`,
      modules: ['Condiciones', 'Sueldo', 'Responsabilidades', 'Empresa'],
      recommendations: ['Pedí detalles sobre el puesto y la empresa.', 'Contrastá lo anunciado con condiciones reales.']
    };
  }

  if (commercialSignals.test(all) || productSignals.test(all)) {
    return {
      key: 'commercial-promise',
      label: 'Promesa comercial',
      hint: 'Revisá garantías, urgencia y respaldo.',
      summary: `El contenido parece una promesa comercial y conviene verificar la oferta, el respaldo y los términos.`,
      prudentConclusion: `No asumiría que la promesa es cierta sin revisar respaldo, condiciones y contexto.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar la oferta y sus condiciones.`,
      modules: ['Garantías', 'Términos', 'Respaldo', 'Contexto'],
      recommendations: ['Pedí el respaldo de la promesa y los términos.', 'Contrastá la oferta con el producto o servicio real.']
    };
  }

  if (publicReleaseSignals.test(all)) {
    return {
      key: 'public-claim',
      label: 'Afirmación pública',
      hint: 'Revisá la fuente, el contexto y la fecha.',
      summary: `El contenido se analiza como una afirmación pública y conviene contrastar fuente, contexto y fecha.`,
      prudentConclusion: `No lo trataría como comprobado; pediría la fuente original y el contexto antes de compartirlo.`,
      verdict: `Evaluación prudente para ${input.noun}: conviene verificar fuente y contexto.`,
      modules: ['Fuente', 'Autor', 'Fecha', 'Contexto'],
      recommendations: ['Buscá la fuente original y la fecha de publicación.', 'Verificá si la afirmación se sostiene en varias fuentes.']
    };
  }

  return {
    key: 'general-credibility',
    label: 'Credibilidad general',
    hint: 'Conviene verificar la afirmación y su contexto.',
    summary: `El contenido se analiza con criterio prudente para ${input.noun}; conviene contrastar lo que se afirma con evidencia externa.`,
    prudentConclusion: `No lo trataría como verdadero o falso; pediría contexto, fuente y verificación antes de decidir.`,
    verdict: `Evaluación prudente para ${input.noun}: conviene comprobar la afirmación con evidencia externa.`,
    modules: ['Credibilidad', 'Evidencia faltante', 'Transparencia', 'Manipulación'],
    recommendations: ['Pedí una fuente secundaria o primaria para contrastar.', 'Tomá la conclusión como orientación y no como verdad absoluta.']
  };
}
