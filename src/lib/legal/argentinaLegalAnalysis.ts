export type LegalIssue = {
  id: string;
  label: string;
  evidence: string;
  explanation: string;
  severity: 'baja' | 'media' | 'alta';
};

export type ArgentinaLegalAnalysis = {
  applicable: boolean;
  jurisdiction: 'argentina' | 'not-specified';
  area: 'contracts' | 'criminal' | 'family' | 'other-legal';
  areaLabel: string;
  legalBranch: 'family' | 'succession' | 'criminal' | 'civil' | 'commercial' | 'administrative' | 'labor' | 'tax' | 'general';
  detectedBranch: 'family' | 'succession' | 'criminal' | 'civil' | 'commercial' | 'administrative' | 'labor' | 'tax' | 'general';
  detectedBranchLabel: string;
  branchSelectionWarning?: string;
  classificationConfidence: number;
  alternativeBranches: Array<{ branch: Exclude<ArgentinaLegalAnalysis['legalBranch'], 'general'>; label: string; score: number }>;
  selectedJurisdiction?: string;
  subtopic: 'family-support' | 'family-divorce' | 'family-parental' | 'family-violence' | 'sexual-offense' | 'criminal-property' | 'criminal-economic' | 'criminal-penalty' | 'debt-enforcement' | 'civil-damages' | 'consumer' | 'insurance' | 'succession' | 'leasing' | 'contract-review' | 'property-rights' | 'leases' | 'corporate' | 'insolvency' | 'negotiable-instruments' | 'administrative-procedure' | 'administrative-sanctions' | 'labor' | 'tax' | 'public-procurement' | 'general-legal';
  intent: 'validity' | 'amount-or-duration' | 'consequences' | 'next-steps' | 'document-review' | 'general';
  issues: LegalIssue[];
  factsNeeded: string[];
  sourceTargets: string[];
  conclusion: string;
};

export type LegalBranchPreference = 'auto' | Exclude<ArgentinaLegalAnalysis['legalBranch'], 'general'>;

function evidence(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match) return '';
  const index = match.index || 0;
  return text.slice(Math.max(0, index - 35), Math.min(text.length, index + match[0].length + 55)).replace(/\s+/g, ' ').trim();
}

function legalSignalScore(text: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

export function analyzeArgentinaLegal(text: string, assumeArgentina = false, userInstruction = '', branchPreference: LegalBranchPreference = 'auto', selectedJurisdiction = ''): ArgentinaLegalAnalysis {
  const routingText = userInstruction.trim() || text;
  const legal = assumeArgentina || /ley|legal|ilegal|derecho|contrato|cl[aá]usula|delito|pena|prisi[oó]n|c[aá]rcel|hurto|robo|violaci[oó]n|violador(?:a|es)?|abuso sexual|integridad sexual|divorci\w*|alimentos?|cuota\s+aliment(?:o|aria)|sucesi[oó]n|herencia|hereder|testamento|jurisdicci[oó]n|rescisi[oó]n|incumplimiento|sentencia|honorarios?|costas?\s+judiciales?|ejecuci[oó]n\s+judicial/i.test(text);
  const jurisdiction = assumeArgentina || /argentina|argentino|c[oó]digo (?:civil|penal)|infoleg|bolet[ií]n oficial/i.test(text) ? 'argentina' : 'not-specified';
  const family = /divorci\w*|separaci[oó]n|alimentos?|cuota\s+aliment(?:o|aria)|responsabilidad parental|r[eé]gimen de comunicaci[oó]n|cuidado personal|filiaci[oó]n|adopci[oó]n|tutela|curatela|violencia familiar|violencia dom[eé]stica|restricci[oó]n de acercamiento|exclusi[oó]n del hogar|bienes gananciales|compensaci[oó]n econ[oó]mica/i.test(routingText);
  const criminal = /\b(?:delito|denuncia\s+penal|causa\s+penal|penas?|prisi[oó]n|c[aá]rcel|condena|hurto|rob(?:o|aron|ado|ada)|homicidio|femicidio|lesiones|amenazas|coacci[oó]n|estafa|defraudaci[oó]n|usurpaci[oó]n|violaci[oó]n|violador(?:a|es)?|abuso sexual|integridad sexual|lavado|cohecho|corrupci[oó]n|ciberdelito)\b|c[oó]digo penal/i.test(routingText);
  const contracts = /contrato|acuerdo|cl[aá]usula|rescisi[oó]n|incumplimiento|penalidad|jurisdicci[oó]n|t[eé]rminos y condiciones|locaci[oó]n|compraventa|pagar?\b|cuotas?|entreg(?:a|ar|ue)|demandar?/i.test(routingText);
  const administrative = /acto\s+administrativo|procedimiento\s+administrativo|recurso\s+administrativo|administraci[oó]n\s+p[uú]blica|organismo\s+(?:p[uú]blico|estatal)|ministerio|municipalidad|estado\s+nacional|habilitaci[oó]n|licencia|concesi[oó]n|multa\s+(?:administrativa|estatal)|arca|afip|anmat/i.test(routingText);
  const labor = /despid|emplead[oa]|empleador|trabajador|relaci[oó]n\s+laboral|contrato\s+de\s+trabajo|salario|sueldo|remuneraci[oó]n|indemnizaci[oó]n\s+laboral|accidente\s+de\s+trabajo|aseguradora\s+de\s+riesgos\s+del\s+trabajo|sindicat|convenio\s+colectivo/i.test(routingText);
  const commercial = /acuerdo\s+comercial|operaci[oó]n\s+comercial|sociedad(?:es)?|socios?|accionistas?|acciones|directorio|empresa|concurso\s+preventivo|quiebra|insolvencia|cheque|pagar[eé]|fondo\s+de\s+comercio|ley\s+general\s+de\s+sociedades/i.test(`${routingText}\n${text}`);
  const succession = /sucesi[oó]n|herencia|hered(?:a|an|ar|ero|era|eros|eras)|testamento|leg[ií]tima hereditaria|causante|viud[oa].{0,40}hij[oa]s?|(?:muri[oó]|muere|falleci[oó]|fallece).{0,80}(?:espos[oa]|mam[aá]|madre|padre|c[oó]nyuge|hij[oa]s?|bienes?|casa)|bien(?:es)?\s+ganancial(?:es)?.{0,80}(?:c[oó]nyuge|hij[oa]s?)/i.test(routingText);
  const civil = contracts || /da[ñn]os?|perjuicios?|responsabilidad\s+civil|deuda|acreedor|deudor|embarg|ejecuci[oó]n|sucesi[oó]n|herencia|propiedad|alquiler|obligaci[oó]n|intereses?|honorarios?/i.test(text);
  const scoredText = `${routingText}\n${text}`;
  const branchScores: Record<Exclude<ArgentinaLegalAnalysis['legalBranch'], 'general'>, number> = {
    succession: legalSignalScore(scoredText, [/sucesi[oó]n|herencia|hered(?:a|an|ar|ero|era|eros|eras)/i, /testamento|leg[ií]tima|causante/i, /falleci[oó]|muri[oó]|viud[oa]/i]),
    family: legalSignalScore(scoredText, [/divorci|separaci[oó]n|compensaci[oó]n econ[oó]mica/i, /alimentos?|cuota aliment/i, /cuidado personal|responsabilidad parental|comunicaci[oó]n/i, /filiaci[oó]n|adopci[oó]n|tutela|curatela/i, /violencia familiar|violencia dom[eé]stica|exclusi[oó]n del hogar/i]),
    criminal: legalSignalScore(scoredText, [/\bdelito\b|denuncia penal|causa penal|c[oó]digo penal/i, /\brob(?:o|aron|ado|ada)\b|\bhurto\b|homicidio|femicidio|lesiones|amenazas|coacci[oó]n/i, /\bestafa\b|defraudaci[oó]n|lavado|cohecho|corrupci[oó]n/i, /violaci[oó]n|abuso sexual|integridad sexual/i, /prisi[oó]n|c[aá]rcel|condena|\bpena\b/i]),
    labor: legalSignalScore(scoredText, [/despid|emplead[oa]|empleador|trabajador/i, /salario|sueldo|remuneraci[oó]n|indemnizaci[oó]n laboral/i, /relaci[oó]n laboral|contrato de trabajo|convenio colectivo|sindicat/i, /accidente de trabajo|aseguradora de riesgos del trabajo|riesgos del trabajo/i]),
    administrative: legalSignalScore(scoredText, [/acto|procedimiento|recurso|sumario|sanci[oó]n/i, /organismo|ministerio|municipalidad|administraci[oó]n p[uú]blica/i, /habilitaci[oó]n|licencia|concesi[oó]n|clausura/i, /licitaci[oó]n|contrataci[oó]n p[uú]blica|proveedor del estado/i]),
    tax: legalSignalScore(scoredText, [/impuesto|tribut|fiscal/i, /arca|afip|agip|arba/i, /determinaci[oó]n de oficio|declaraci[oó]n jurada|retenci[oó]n|percepci[oó]n/i]),
    commercial: legalSignalScore(scoredText, [/sociedad|socios?|accionistas?|directorio|empresa/i, /concurso preventivo|quiebra|cesaci[oó]n de pagos/i, /cheque|pagar[eé]|letra de cambio|t[ií]tulo valor/i, /acuerdo comercial|operaci[oó]n comercial|fondo de comercio/i]),
    civil: legalSignalScore(scoredText, [/contrato|acuerdo|cl[aá]usula|incumplimiento|obligaci[oó]n/i, /deuda|acreedor|deudor|embarg|ejecuci[oó]n|intereses?/i, /da[ñn]os?|perjuicio|responsabilidad civil/i, /alquiler|locaci[oó]n|inquilin|desalojo/i, /dominio|posesi[oó]n|usucapi[oó]n|usufructo|servidumbre/i, /consumidor|garant[ií]a legal|seguro|p[oó]liza/i]),
  };
  const detectedBranch = (Object.entries(branchScores) as Array<[Exclude<ArgentinaLegalAnalysis['legalBranch'], 'general'>, number]>)
    .sort((a, b) => b[1] - a[1])[0];
  const scoredBranch: ArgentinaLegalAnalysis['legalBranch'] = detectedBranch && detectedBranch[1] > 0 ? detectedBranch[0] : 'general';
  // Strong succession language wins common family/civil overlaps; otherwise the score uses all signals instead of one keyword.
  const detectedBranchFinal: ArgentinaLegalAnalysis['legalBranch'] = succession ? 'succession' : scoredBranch;
  const legalBranch: ArgentinaLegalAnalysis['legalBranch'] = branchPreference === 'auto' ? detectedBranchFinal : branchPreference;
  const branchLabels: Record<ArgentinaLegalAnalysis['legalBranch'], string> = {
    family: 'Familia', succession: 'Sucesiones y herencias', criminal: 'Penal', civil: 'Civil y contratos',
    commercial: 'Comercial', administrative: 'Administrativo', labor: 'Laboral', tax: 'Tributario', general: 'Derecho argentino',
  };
  const rankedBranches = (Object.entries(branchScores) as Array<[Exclude<ArgentinaLegalAnalysis['legalBranch'], 'general'>, number]>)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalBranchSignals = rankedBranches.reduce((sum, [, score]) => sum + score, 0);
  const classificationConfidence = detectedBranchFinal === 'general' ? 0 : Math.round(((rankedBranches[0]?.[1] || 1) / Math.max(1, totalBranchSignals)) * 100);
  const alternativeBranches = rankedBranches
    .filter(([branch]) => branch !== detectedBranchFinal)
    .slice(0, 3)
    .map(([branch, score]) => ({ branch, label: branchLabels[branch], score }));
  const compatibleBranches = new Set(['family:succession', 'succession:family', 'civil:succession', 'succession:civil', 'civil:commercial', 'commercial:civil']);
  const branchSelectionWarning = branchPreference !== 'auto' && detectedBranchFinal !== 'general' && detectedBranchFinal !== legalBranch
    && !compatibleBranches.has(`${legalBranch}:${detectedBranchFinal}`)
    ? `La consulta parece corresponder a ${branchLabels[detectedBranchFinal]}, pero seleccionaste ${branchLabels[legalBranch]}. Revisá la categoría antes de usar el resultado.`
    : undefined;
  const area: ArgentinaLegalAnalysis['area'] = legalBranch === 'family' ? 'family' : legalBranch === 'criminal' ? 'criminal' : legalBranch === 'civil' || legalBranch === 'commercial' || legalBranch === 'succession' ? 'contracts' : 'other-legal';
  const areaLabel = legalBranch === 'family' ? 'Familia' : legalBranch === 'succession' ? 'Sucesiones y herencias' : legalBranch === 'criminal' ? 'Derecho penal' : legalBranch === 'civil' ? 'Derecho civil' : legalBranch === 'commercial' ? 'Derecho comercial' : legalBranch === 'administrative' ? 'Derecho administrativo' : legalBranch === 'labor' ? 'Derecho laboral' : legalBranch === 'tax' ? 'Derecho tributario' : 'Consulta jurídica general';
  const subtopic: ArgentinaLegalAnalysis['subtopic'] = /\bleasing\b|lease[ -]?back|arrendamiento\s+financiero|opci[oó]n\s+de\s+compra/i.test(routingText)
    ? 'leasing'
    : legalBranch === 'labor'
    ? 'labor'
    : legalBranch === 'tax'
    ? 'tax'
    : legalBranch === 'succession' || succession
    ? 'succession'
    : /violaci[oó]n|violador(?:a|es)?|abuso sexual|acceso carnal/i.test(text)
    ? 'sexual-offense'
    : /violencia familiar|violencia dom[eé]stica|restricci[oó]n de acercamiento|exclusi[oó]n del hogar/i.test(text)
    ? 'family-violence'
    : family && /alimentos?|cuota\s+aliment/i.test(text)
      ? 'family-support'
      : family && /divorci|separaci[oó]n|compensaci[oó]n econ[oó]mica|bienes gananciales/i.test(text)
        ? 'family-divorce'
        : family && /responsabilidad parental|cuidado personal|r[eé]gimen de comunicaci[oó]n|adopci[oó]n|filiaci[oó]n/i.test(text)
          ? 'family-parental'
      : /honorarios?|abogad[oa]|embarg|ejecuci[oó]n|intimaci[oó]n|acreedor|deudor|\bmora\b|intereses?.{0,40}deuda|deuda.{0,40}intereses?/i.test(text)
        ? 'debt-enforcement'
        : /consumidor|defensa del consumidor|proveedor|garant[ií]a legal|publicidad enga[ñn]osa|bot[oó]n de arrepentimiento/i.test(text)
          ? 'consumer'
            : /seguro|aseguradora|p[oó]liza|siniestro|indemnizaci[oó]n.*seguro/i.test(text)
            ? 'insurance'
            : /sucesi[oó]n|herencia|hereder|testamento|leg[ií]tima hereditaria/i.test(text)
              ? 'succession'
              : /da[ñn]os?|perjuicios?|responsabilidad civil|indemnizaci[oó]n/i.test(text)
                ? 'civil-damages'
                : /alquiler|locaci[oó]n|inquilin|locador|desalojo|dep[oó]sito de garant[ií]a|expensas/i.test(text)
                  ? 'leases'
                  : /dominio|condominio|posesi[oó]n|usucapi[oó]n|servidumbre|usufructo|medianera|propiedad horizontal/i.test(text)
                    ? 'property-rights'
                : /concurso preventivo|quiebra|cesaci[oó]n de pagos|verificaci[oó]n de cr[eé]dito/i.test(text)
                  ? 'insolvency'
                  : /sociedad(?:es)?|socios?|accionistas?|directorio|ley general de sociedades/i.test(text)
                    ? 'corporate'
                    : /cheque|pagar[eé]|letra de cambio|t[ií]tulo valor/i.test(text)
                      ? 'negotiable-instruments'
                      : /licitaci[oó]n|contrataci[oó]n p[uú]blica|obra p[uú]blica|proveedor del estado/i.test(text)
                        ? 'public-procurement'
                        : /sumario administrativo|sanci[oó]n administrativa|multa administrativa|clausura|inhabilitaci[oó]n/i.test(text)
                          ? 'administrative-sanctions'
                        : /impuesto|tribut|arca|afip|determinaci[oó]n de oficio|fiscalizaci[oó]n fiscal/i.test(text)
                          ? 'tax'
                          : administrative
                            ? 'administrative-procedure'
        : criminal && /estafa|defraudaci[oó]n|lavado|cohecho|corrupci[oó]n|administraci[oó]n fraudulenta/i.test(text)
          ? 'criminal-economic'
          : criminal && /hurto|rob(?:o|aron|ado|ada)|usurpaci[oó]n|daño a la propiedad/i.test(text)
            ? 'criminal-property'
            : criminal
              ? 'criminal-penalty'
          : contracts
            ? 'contract-review'
            : 'general-legal';
  const intent = /(?:est[aá]\s+bien|es\s+v[aá]lid[oa]|es\s+legal|corresponde|pueden?|deben?).{0,30}\?/i.test(text)
    ? 'validity'
    : /cu[aá]nt[oa]s?|hasta\s+qu[eé]|monto|porcentaje|tasa|a[ñn]os?|pena/i.test(text)
      ? 'amount-or-duration'
      : /qu[eé]\s+pasa|consecuencias?|no\s+(?:le\s+)?pagu|incumpl|mora/i.test(text)
        ? 'consequences'
        : /qu[eé]\s+(?:puedo|debo|conviene)\s+hacer|c[oó]mo\s+(?:reclamo|impugno|apelo)/i.test(text)
          ? 'next-steps'
          : /revis|analiz|cl[aá]usula|documento|contrato/i.test(text)
            ? 'document-review'
            : 'general';
  const rules = [
    { id: 'unilateral-change', label: 'Modificación unilateral', pattern: /(?:podr[aá]|se reserva el derecho de).{0,55}(?:modificar|cambiar).{0,45}(?:sin aviso|sin consentimiento|unilateralmente)/i, explanation: 'Permite que una parte altere condiciones sin un mecanismo claro de información o aceptación.', severity: 'alta' as const },
    { id: 'automatic-renewal', label: 'Renovación automática', pattern: /renovaci[oó]n autom[aá]tica|se renovar[aá] autom[aá]ticamente/i, explanation: 'Debe revisarse el plazo para cancelar, el medio habilitado y el aviso previo.', severity: 'media' as const },
    { id: 'broad-waiver', label: 'Renuncia amplia de derechos', pattern: /renuncia.{0,55}(?:todo|cualquier).{0,35}(?:derecho|reclamo|acci[oó]n)|no podr[aá].{0,35}(?:reclamar|demandar)/i, explanation: 'Una renuncia general puede exceder lo admisible según el tipo de relación y las normas imperativas aplicables.', severity: 'alta' as const },
    { id: 'one-sided-termination', label: 'Rescisión o suspensión unilateral', pattern: /(?:rescindir|resolver|suspender|cancelar).{0,60}(?:sin causa|sin aviso|en cualquier momento)/i, explanation: 'Conviene comparar las facultades de ambas partes, el preaviso y sus consecuencias económicas.', severity: 'alta' as const },
    { id: 'penalty', label: 'Penalidad o multa contractual', pattern: /(?:penalidad|multa|cl[aá]usula penal|inter[eé]s punitorio).{0,70}/i, explanation: 'Debe verificarse el supuesto de aplicación, la fórmula, los límites y si existe reciprocidad.', severity: 'media' as const },
    { id: 'foreign-forum', label: 'Jurisdicción o ley aplicable', pattern: /(?:jurisdicci[oó]n|tribunales|ley aplicable).{0,80}/i, explanation: 'La validez y conveniencia dependen del domicilio, el tipo de relación y las reglas imperativas.', severity: 'media' as const },
    { id: 'data-authorization', label: 'Uso o cesión amplia de datos', pattern: /(?:datos personales|informaci[oó]n personal).{0,80}(?:ceder|compartir|transferir|terceros)/i, explanation: 'Debe precisarse finalidad, destinatarios, conservación y mecanismo para ejercer derechos.', severity: 'media' as const },
    { id: 'death-penalty', label: 'Pena incompatible con el marco penal argentino', pattern: /(?:horca|pena de muerte|ejecutado)/i, explanation: 'La pena afirmada requiere contraste inmediato con el Código Penal oficial y la calificación concreta del hecho.', severity: 'alta' as const },
  ];
  const issues = rules.flatMap((rule) => {
    const excerpt = evidence(text, rule.pattern);
    return excerpt ? [{ id: rule.id, label: rule.label, evidence: excerpt, explanation: rule.explanation, severity: rule.severity }] : [];
  });
  const factsNeeded = [
    jurisdiction === 'not-specified' ? 'jurisdicción y lugar donde produciría efectos' : '',
    area === 'contracts' && !/(partes|locador|locatario|comprador|vendedor|proveedor|consumidor)/i.test(text) ? 'identidad y carácter de las partes' : '',
    area === 'contracts' && !/(fecha|vigencia|plazo|desde|hasta)/i.test(text) ? 'fecha, vigencia y plazo contractual' : '',
    area === 'criminal' ? 'descripción completa de la conducta, intención, circunstancias y evidencia' : '',
    area === 'criminal' && /violaci[oó]n|violador(?:a|es)?|abuso sexual/i.test(text) ? 'edad de la víctima, modalidad del hecho, existencia de acceso carnal, agravantes, daños y resultado' : '',
    area === 'family' ? 'domicilio de las partes, existencia de hijos, acuerdos, bienes y medidas vigentes' : '',
    subtopic === 'family-support' ? 'edad, necesidades y situación educativa del alimentado; ingresos, cuidados y posibilidades económicas de ambos progenitores' : '',
    subtopic === 'family-divorce' ? 'fecha de separación, propuesta reguladora, vivienda, bienes, deudas y eventual desequilibrio económico' : '',
    subtopic === 'family-parental' ? 'centro de vida del niño, modalidad actual de cuidados, acuerdos y medidas judiciales vigentes' : '',
    subtopic === 'family-violence' ? 'personas en riesgo, hechos recientes, convivencia, armas, lesiones, niñas o niños involucrados, denuncias y medidas vigentes' : '',
    /honorarios?|abogad[oa]|embarg|ejecuci[oó]n/i.test(text) ? 'jurisdicción, expediente, regulación o convenio, firmeza, notificación, orden de embargo y liquidación de capital e intereses' : '',
    subtopic === 'consumer' ? 'carácter de consumidor final, proveedor, oferta, contratación, reclamos y comprobantes' : '',
    subtopic === 'insurance' ? 'póliza completa, vigencia, riesgo cubierto, denuncia del siniestro, rechazo y comunicaciones' : '',
    subtopic === 'civil-damages' ? 'hecho, daño acreditable, relación causal, responsables, fecha y seguros involucrados' : '',
    subtopic === 'leases' ? 'contrato de locación, destino, plazo, canon, depósito, garantías, inventario, pagos, comunicaciones y estado del inmueble' : '',
    subtopic === 'property-rights' ? 'títulos, informes registrales, planos, mensura, antecedentes de posesión, ocupantes, fechas y actos de disposición' : '',
    subtopic === 'succession' ? 'último domicilio del causante; cantidad y vínculo de herederos; estado matrimonial y eventual separación de hecho; carácter propio o ganancial de cada bien; deudas, donaciones, testamento y procesos iniciados' : '',
    subtopic === 'corporate' ? 'tipo societario, estatuto, jurisdicción registral, participación, decisiones y actas relevantes' : '',
    subtopic === 'insolvency' ? 'estado de cesación de pagos, procesos abiertos, acreedores, garantías y vencimientos' : '',
    subtopic === 'administrative-procedure' ? 'organismo, acto o expediente, fecha de notificación, vía recursiva y plazo disponible' : '',
    subtopic === 'administrative-sanctions' ? 'organismo, norma imputada, acta, descargo, prueba, acto sancionatorio, notificación, reincidencia y plazo recursivo' : '',
    subtopic === 'labor' ? 'fecha de ingreso, tareas, modalidad de contratación, registración, remuneración, convenio colectivo, comunicaciones y jurisdicción laboral' : '',
    subtopic === 'tax' ? 'tributo, período fiscal, jurisdicción, acto notificado, vencimiento y etapa administrativa o judicial' : '',
    subtopic === 'public-procurement' ? 'organismo contratante, procedimiento, pliego, oferta, acto cuestionado y etapa del trámite' : '',
    !/(art[ií]culo|ley \d|c[oó]digo|normativa)/i.test(text) ? 'norma o fundamento jurídico invocado' : '',
  ].filter(Boolean);
  const sourceTargets = subtopic === 'leasing'
    ? ['Código Civil y Comercial de la Nación, artículos 1227 a 1250', 'Decreto 1038/2000, con artículo 2 sustituido por el Decreto 152/2022', 'Leyes de Impuesto a las Ganancias e IVA vigentes y normativa ARCA aplicable', 'Registro correspondiente al tipo de bien para la oponibilidad del contrato', 'Textos ordenados vigentes del BCRA si intervienen una entidad financiera, el sector público o pagos al exterior']
    : subtopic === 'family-support'
      ? ['Código Civil y Comercial de la Nación, artículos 658 a 670 y normas concordantes', 'Ley 26.061 de Protección Integral de los Derechos de Niñas, Niños y Adolescentes', 'Código procesal y jurisprudencia oficial de la jurisdicción correspondiente']
    : subtopic === 'family-divorce'
      ? ['Código Civil y Comercial de la Nación, divorcio, convenio regulador y compensación económica', 'Código procesal de familia de la jurisdicción correspondiente', 'Jurisprudencia oficial pertinente según hechos y fechas']
    : subtopic === 'family-parental'
      ? ['Código Civil y Comercial de la Nación, responsabilidad parental, cuidado personal y comunicación', 'Ley 26.061 de Protección Integral de los Derechos de Niñas, Niños y Adolescentes', 'Normativa procesal y organismos de protección de la jurisdicción correspondiente']
    : subtopic === 'family-violence'
      ? ['Ley 26.485 de protección integral contra la violencia hacia las mujeres cuando corresponda', 'Ley 24.417 de protección contra la violencia familiar en su ámbito de aplicación', 'Normativa provincial, juzgado y organismos de protección competentes']
    : subtopic === 'consumer'
      ? ['Ley 24.240 de Defensa del Consumidor, texto actualizado', 'Código Civil y Comercial de la Nación, contratos y relaciones de consumo', 'Normativa y autoridad de consumo nacional, provincial o municipal competente']
    : subtopic === 'insurance'
      ? ['Ley 17.418 de Seguros, texto actualizado', 'Código Civil y Comercial de la Nación y Ley 24.240 si existe relación de consumo', 'Normativa y registros oficiales de la Superintendencia de Seguros de la Nación']
    : subtopic === 'succession'
      ? ['Código Civil y Comercial de la Nación, artículos 2426, 2433, 2437 y normas sobre transmisión hereditaria, legítimas y sucesiones', 'Código procesal civil de la jurisdicción del último domicilio del causante', 'Registro de Actos de Última Voluntad y registros de bienes pertinentes']
    : subtopic === 'civil-damages'
      ? ['Código Civil y Comercial de la Nación, responsabilidad civil y reparación del daño', 'Ley especial aplicable según el hecho, actividad o relación de consumo', 'Código procesal y jurisprudencia oficial de la jurisdicción correspondiente']
    : subtopic === 'leases'
      ? ['Código Civil y Comercial de la Nación, locación de cosas, texto actualizado', 'Normas especiales vigentes aplicables al destino habitacional o comercial', 'Código procesal y régimen local de mediación, desalojo y ejecución']
    : subtopic === 'property-rights'
      ? ['Código Civil y Comercial de la Nación, derechos reales, posesión y prescripción adquisitiva', 'Registro de la Propiedad Inmueble y normativa catastral de la jurisdicción', 'Código procesal aplicable a acciones reales y posesorias']
    : subtopic === 'corporate'
      ? ['Ley General de Sociedades 19.550, texto actualizado', 'Estatuto, contrato social, actas y normativa del registro público competente', 'Normativa de IGJ, registro provincial o CNV según sociedad y jurisdicción']
    : subtopic === 'insolvency'
      ? ['Ley de Concursos y Quiebras 24.522, texto actualizado', 'Ley General de Sociedades 19.550 si el deudor es una sociedad', 'Expediente concursal, publicaciones oficiales y régimen de garantías aplicable al crédito']
    : subtopic === 'negotiable-instruments'
      ? ['Ley 24.452 de Cheques, texto actualizado', 'Decreto-Ley 5965/63 para letras de cambio y pagarés', 'Código Civil y Comercial y normativa del BCRA según el instrumento']
    : subtopic === 'administrative-procedure'
      ? ['Ley Nacional de Procedimientos Administrativos 19.549, texto actualizado tras la Ley 27.742, si interviene la Administración nacional', 'Reglamento de Procedimientos Administrativos, Decreto 1759/72, texto actualizado', 'Ley especial del organismo y régimen provincial o municipal si corresponde']
    : subtopic === 'administrative-sanctions'
      ? ['Régimen sancionatorio especial del organismo y conducta imputada', 'Ley de procedimiento administrativo nacional, provincial o municipal aplicable', 'Acta, expediente, acto sancionatorio y régimen recursivo vigente']
    : subtopic === 'labor'
      ? ['Ley de Contrato de Trabajo 20.744, texto actualizado, si existe una relación laboral privada comprendida', 'Convenio colectivo y estatuto profesional aplicables a la actividad y categoría', 'Ley procesal laboral de la jurisdicción competente y comunicaciones o registros oficiales del vínculo']
    : subtopic === 'tax'
      ? ['Ley 11.683 de Procedimiento Tributario si el tributo es nacional', 'Ley del impuesto y reglamentación ARCA aplicables al período fiscal', 'Código fiscal y ley impositiva vigente de la provincia o municipio competente']
    : subtopic === 'public-procurement'
      ? ['Decreto 1023/2001 de Contrataciones de la Administración Nacional si corresponde', 'Decreto 1030/2016 y pliego aplicable, en texto actualizado', 'Régimen provincial o municipal de contrataciones y expediente administrativo']
    : legalBranch === 'criminal'
    ? ['Código Penal de la Nación en InfoLEG/Argentina.gob.ar', 'Boletín Oficial para reformas y vigencia', 'Jurisprudencia oficial pertinente si la interpretación depende del caso']
    : legalBranch === 'family'
      ? ['Código Civil y Comercial de la Nación en InfoLEG/Argentina.gob.ar', 'Normativa procesal de la jurisdicción correspondiente', 'Jurisprudencia oficial pertinente']
      : legalBranch === 'administrative'
        ? ['Ley Nacional de Procedimientos Administrativos 19.549 si interviene la Administración nacional', 'Decreto 1759/72 reglamentario si corresponde', 'Ley especial del organismo y normativa provincial o municipal según la jurisdicción']
        : legalBranch === 'tax'
          ? ['Ley 11.683 de Procedimiento Tributario si el tributo es nacional', 'Ley del impuesto y reglamentación ARCA aplicables al período fiscal', 'Código fiscal y ley impositiva vigente de la provincia o municipio competente']
        : legalBranch === 'commercial'
          ? ['Ley General de Sociedades 19.550 cuando corresponda', 'Ley de Concursos y Quiebras 24.522 si existe insolvencia o proceso concursal', 'Código Civil y Comercial de la Nación y normativa registral o sectorial aplicable']
          : /honorarios?|abogad[oa]|embarg|ejecuci[oó]n/i.test(text)
          ? ['Ley 27.423 de honorarios profesionales si interviene la justicia nacional o federal', 'Código Procesal Civil y Comercial aplicable a la jurisdicción', 'Código Civil y Comercial de la Nación para intereses y obligaciones']
          : legalBranch === 'civil'
            ? ['Código Civil y Comercial de la Nación', 'Código Procesal Civil y Comercial aplicable a la jurisdicción', 'Ley especial pertinente, como Defensa del Consumidor, locaciones o seguros, según el caso']
            : ['InfoLEG/Argentina.gob.ar', 'Boletín Oficial', 'Normativa de la jurisdicción correspondiente'];
  const jurisdictionSourceTargets = selectedJurisdiction
    ? sourceTargets.map((source) => source.replace(/la jurisdicción correspondiente/gi, selectedJurisdiction).replace(/jurisdicción correspondiente/gi, selectedJurisdiction))
    : sourceTargets;
  return {
    applicable: legal,
    jurisdiction,
    area,
    areaLabel,
    legalBranch,
    detectedBranch: detectedBranchFinal,
    detectedBranchLabel: branchLabels[detectedBranchFinal],
    branchSelectionWarning,
    classificationConfidence,
    alternativeBranches,
    selectedJurisdiction: selectedJurisdiction || undefined,
    subtopic,
    intent,
    issues,
    factsNeeded,
    sourceTargets: jurisdictionSourceTargets,
    conclusion: !legal
      ? 'No se identificó una consulta jurídica dentro del alcance.'
      : jurisdiction === 'not-specified'
        ? 'La jurisdicción no está suficientemente identificada; no corresponde aplicar automáticamente el derecho argentino.'
        : issues.length
          ? 'Se identificaron cláusulas o afirmaciones que requieren contraste normativo y revisión del contexto completo.'
          : subtopic === 'debt-enforcement'
            ? 'La exigibilidad de la deuda, los intereses y el embargo requiere revisar el título, la resolución u orden judicial, las notificaciones, la liquidación y la normativa procesal aplicable.'
            : 'No se detectaron alertas textuales específicas, pero la validez o consecuencia jurídica no puede determinarse sin hechos y normativa aplicable.',
  };
}
