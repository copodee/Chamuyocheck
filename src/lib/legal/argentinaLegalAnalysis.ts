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
  legalBranch: 'family' | 'criminal' | 'civil' | 'commercial' | 'administrative' | 'general';
  subtopic: 'family-support' | 'family-divorce' | 'family-parental' | 'sexual-offense' | 'criminal-penalty' | 'debt-enforcement' | 'civil-damages' | 'consumer' | 'insurance' | 'succession' | 'leasing' | 'contract-review' | 'corporate' | 'insolvency' | 'negotiable-instruments' | 'administrative-procedure' | 'tax' | 'public-procurement' | 'general-legal';
  intent: 'validity' | 'amount-or-duration' | 'consequences' | 'next-steps' | 'document-review' | 'general';
  issues: LegalIssue[];
  factsNeeded: string[];
  sourceTargets: string[];
  conclusion: string;
};

function evidence(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match) return '';
  const index = match.index || 0;
  return text.slice(Math.max(0, index - 35), Math.min(text.length, index + match[0].length + 55)).replace(/\s+/g, ' ').trim();
}

export function analyzeArgentinaLegal(text: string, assumeArgentina = false, userInstruction = ''): ArgentinaLegalAnalysis {
  const routingText = userInstruction.trim() || text;
  const legal = assumeArgentina || /ley|legal|ilegal|derecho|contrato|cl[aá]usula|delito|pena|prisi[oó]n|c[aá]rcel|hurto|robo|violaci[oó]n|violador(?:a|es)?|abuso sexual|integridad sexual|divorci\w*|alimentos?|cuota\s+aliment(?:o|aria)|jurisdicci[oó]n|rescisi[oó]n|incumplimiento|sentencia|honorarios?|costas?\s+judiciales?|ejecuci[oó]n\s+judicial/i.test(text);
  const jurisdiction = assumeArgentina || /argentina|argentino|c[oó]digo (?:civil|penal)|infoleg|bolet[ií]n oficial/i.test(text) ? 'argentina' : 'not-specified';
  const family = /divorci\w*|separaci[oó]n|alimentos?|cuota\s+aliment(?:o|aria)|responsabilidad parental|r[eé]gimen de comunicaci[oó]n|bienes gananciales|compensaci[oó]n econ[oó]mica/i.test(routingText);
  const criminal = /\b(?:delito|denuncia\s+penal|causa\s+penal|penas?|prisi[oó]n|c[aá]rcel|condena|hurto|robo|homicidio|lesiones|amenazas|estafa|defraudaci[oó]n|violaci[oó]n|violador(?:a|es)?|abuso sexual|integridad sexual)\b|c[oó]digo penal/i.test(routingText);
  const contracts = /contrato|acuerdo|cl[aá]usula|rescisi[oó]n|incumplimiento|penalidad|jurisdicci[oó]n|t[eé]rminos y condiciones|locaci[oó]n|compraventa|pagar?\b|cuotas?|entreg(?:a|ar|ue)|demandar?/i.test(routingText);
  const administrative = /acto\s+administrativo|procedimiento\s+administrativo|recurso\s+administrativo|administraci[oó]n\s+p[uú]blica|organismo\s+(?:p[uú]blico|estatal)|ministerio|municipalidad|estado\s+nacional|habilitaci[oó]n|licencia|concesi[oó]n|multa\s+(?:administrativa|estatal)|arca|afip|anmat/i.test(routingText);
  const commercial = /acuerdo\s+comercial|operaci[oó]n\s+comercial|sociedad(?:es)?|socios?|accionistas?|acciones|directorio|empresa|concurso\s+preventivo|quiebra|insolvencia|cheque|pagar[eé]|fondo\s+de\s+comercio|ley\s+general\s+de\s+sociedades/i.test(`${routingText}\n${text}`);
  const civil = contracts || /da[ñn]os?|perjuicios?|responsabilidad\s+civil|deuda|acreedor|deudor|embarg|ejecuci[oó]n|sucesi[oó]n|herencia|propiedad|alquiler|obligaci[oó]n|intereses?|honorarios?/i.test(text);
  const legalBranch = family ? 'family' : criminal ? 'criminal' : administrative ? 'administrative' : commercial && contracts ? 'commercial' : civil ? 'civil' : commercial ? 'commercial' : 'general';
  const area = family ? 'family' : criminal ? 'criminal' : contracts ? 'contracts' : 'other-legal';
  const areaLabel = legalBranch === 'family' ? 'Familia' : legalBranch === 'criminal' ? 'Derecho penal' : legalBranch === 'civil' ? 'Derecho civil' : legalBranch === 'commercial' ? 'Derecho comercial' : legalBranch === 'administrative' ? 'Derecho administrativo' : 'Consulta jurídica general';
  const subtopic: ArgentinaLegalAnalysis['subtopic'] = /\bleasing\b|lease[ -]?back|arrendamiento\s+financiero|opci[oó]n\s+de\s+compra/i.test(routingText)
    ? 'leasing'
    : /violaci[oó]n|violador(?:a|es)?|abuso sexual|acceso carnal/i.test(text)
    ? 'sexual-offense'
    : family && /alimentos?|cuota\s+aliment/i.test(text)
      ? 'family-support'
      : family && /divorci|separaci[oó]n|compensaci[oó]n econ[oó]mica|bienes gananciales/i.test(text)
        ? 'family-divorce'
        : family && /responsabilidad parental|cuidado personal|r[eé]gimen de comunicaci[oó]n|adopci[oó]n|filiaci[oó]n/i.test(text)
          ? 'family-parental'
      : /honorarios?|abogad[oa]|embarg|ejecuci[oó]n|intimaci[oó]n|acreedor|deudor|mora|intereses?.{0,40}deuda|deuda.{0,40}intereses?/i.test(text)
        ? 'debt-enforcement'
        : /consumidor|defensa del consumidor|proveedor|garant[ií]a legal|publicidad enga[ñn]osa|bot[oó]n de arrepentimiento/i.test(text)
          ? 'consumer'
          : /seguro|aseguradora|p[oó]liza|siniestro|indemnizaci[oó]n.*seguro/i.test(text)
            ? 'insurance'
            : /sucesi[oó]n|herencia|hereder|testamento|leg[ií]tima hereditaria/i.test(text)
              ? 'succession'
              : /da[ñn]os?|perjuicios?|responsabilidad civil|indemnizaci[oó]n/i.test(text)
                ? 'civil-damages'
                : /concurso preventivo|quiebra|cesaci[oó]n de pagos|verificaci[oó]n de cr[eé]dito/i.test(text)
                  ? 'insolvency'
                  : /sociedad(?:es)?|socios?|accionistas?|directorio|ley general de sociedades/i.test(text)
                    ? 'corporate'
                    : /cheque|pagar[eé]|letra de cambio|t[ií]tulo valor/i.test(text)
                      ? 'negotiable-instruments'
                      : /licitaci[oó]n|contrataci[oó]n p[uú]blica|obra p[uú]blica|proveedor del estado/i.test(text)
                        ? 'public-procurement'
                        : /impuesto|tribut|arca|afip|determinaci[oó]n de oficio|fiscalizaci[oó]n fiscal/i.test(text)
                          ? 'tax'
                          : administrative
                            ? 'administrative-procedure'
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
    /honorarios?|abogad[oa]|embarg|ejecuci[oó]n/i.test(text) ? 'jurisdicción, expediente, regulación o convenio, firmeza, notificación, orden de embargo y liquidación de capital e intereses' : '',
    subtopic === 'consumer' ? 'carácter de consumidor final, proveedor, oferta, contratación, reclamos y comprobantes' : '',
    subtopic === 'insurance' ? 'póliza completa, vigencia, riesgo cubierto, denuncia del siniestro, rechazo y comunicaciones' : '',
    subtopic === 'civil-damages' ? 'hecho, daño acreditable, relación causal, responsables, fecha y seguros involucrados' : '',
    subtopic === 'succession' ? 'último domicilio del causante, vínculo familiar, bienes, testamento y procesos iniciados' : '',
    subtopic === 'corporate' ? 'tipo societario, estatuto, jurisdicción registral, participación, decisiones y actas relevantes' : '',
    subtopic === 'insolvency' ? 'estado de cesación de pagos, procesos abiertos, acreedores, garantías y vencimientos' : '',
    subtopic === 'administrative-procedure' ? 'organismo, acto o expediente, fecha de notificación, vía recursiva y plazo disponible' : '',
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
    : subtopic === 'consumer'
      ? ['Ley 24.240 de Defensa del Consumidor, texto actualizado', 'Código Civil y Comercial de la Nación, contratos y relaciones de consumo', 'Normativa y autoridad de consumo nacional, provincial o municipal competente']
    : subtopic === 'insurance'
      ? ['Ley 17.418 de Seguros, texto actualizado', 'Código Civil y Comercial de la Nación y Ley 24.240 si existe relación de consumo', 'Normativa y registros oficiales de la Superintendencia de Seguros de la Nación']
    : subtopic === 'succession'
      ? ['Código Civil y Comercial de la Nación, transmisión hereditaria, legítimas y sucesiones', 'Código procesal civil de la jurisdicción del último domicilio del causante', 'Registro de Actos de Última Voluntad y registros de bienes pertinentes']
    : subtopic === 'civil-damages'
      ? ['Código Civil y Comercial de la Nación, responsabilidad civil y reparación del daño', 'Ley especial aplicable según el hecho, actividad o relación de consumo', 'Código procesal y jurisprudencia oficial de la jurisdicción correspondiente']
    : subtopic === 'corporate'
      ? ['Ley General de Sociedades 19.550, texto actualizado', 'Estatuto, contrato social, actas y normativa del registro público competente', 'Normativa de IGJ, registro provincial o CNV según sociedad y jurisdicción']
    : subtopic === 'insolvency'
      ? ['Ley de Concursos y Quiebras 24.522, texto actualizado', 'Ley General de Sociedades 19.550 si el deudor es una sociedad', 'Expediente concursal, publicaciones oficiales y régimen de garantías aplicable al crédito']
    : subtopic === 'negotiable-instruments'
      ? ['Ley 24.452 de Cheques, texto actualizado', 'Decreto-Ley 5965/63 para letras de cambio y pagarés', 'Código Civil y Comercial y normativa del BCRA según el instrumento']
    : subtopic === 'administrative-procedure'
      ? ['Ley Nacional de Procedimientos Administrativos 19.549, texto actualizado tras la Ley 27.742, si interviene la Administración nacional', 'Reglamento de Procedimientos Administrativos, Decreto 1759/72, texto actualizado', 'Ley especial del organismo y régimen provincial o municipal si corresponde']
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
        : legalBranch === 'commercial'
          ? ['Ley General de Sociedades 19.550 cuando corresponda', 'Ley de Concursos y Quiebras 24.522 si existe insolvencia o proceso concursal', 'Código Civil y Comercial de la Nación y normativa registral o sectorial aplicable']
          : /honorarios?|abogad[oa]|embarg|ejecuci[oó]n/i.test(text)
          ? ['Ley 27.423 de honorarios profesionales si interviene la justicia nacional o federal', 'Código Procesal Civil y Comercial aplicable a la jurisdicción', 'Código Civil y Comercial de la Nación para intereses y obligaciones']
          : legalBranch === 'civil'
            ? ['Código Civil y Comercial de la Nación', 'Código Procesal Civil y Comercial aplicable a la jurisdicción', 'Ley especial pertinente, como Defensa del Consumidor, locaciones o seguros, según el caso']
            : ['InfoLEG/Argentina.gob.ar', 'Boletín Oficial', 'Normativa de la jurisdicción correspondiente'];
  return {
    applicable: legal,
    jurisdiction,
    area,
    areaLabel,
    legalBranch,
    subtopic,
    intent,
    issues,
    factsNeeded,
    sourceTargets,
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
