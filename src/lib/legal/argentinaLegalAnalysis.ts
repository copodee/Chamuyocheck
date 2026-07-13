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

export function analyzeArgentinaLegal(text: string): ArgentinaLegalAnalysis {
  const legal = /ley|legal|ilegal|derecho|contrato|cl[aá]usula|delito|pena|prisi[oó]n|hurto|robo|divorcio|alimentos|jurisdicci[oó]n|rescisi[oó]n|incumplimiento/i.test(text);
  const jurisdiction = /argentina|argentino|c[oó]digo (?:civil|penal)|infoleg|bolet[ií]n oficial/i.test(text) ? 'argentina' : 'not-specified';
  const family = /divorcio|separaci[oó]n|alimentos|cuota alimentaria|responsabilidad parental|r[eé]gimen de comunicaci[oó]n|bienes gananciales|compensaci[oó]n econ[oó]mica/i.test(text);
  const criminal = /\b(?:delito|penas?|prisi[oó]n|condena|hurto|robo|homicidio|lesiones|amenazas|defraudaci[oó]n)\b|c[oó]digo penal/i.test(text);
  const contracts = /contrato|cl[aá]usula|rescisi[oó]n|incumplimiento|penalidad|jurisdicci[oó]n|t[eé]rminos y condiciones|locaci[oó]n|compraventa/i.test(text);
  const area = family ? 'family' : criminal ? 'criminal' : contracts ? 'contracts' : 'other-legal';
  const areaLabel = area === 'family' ? 'Familia y divorcio' : area === 'criminal' ? 'Derecho penal' : area === 'contracts' ? 'Contratos y obligaciones' : 'Consulta jurídica general';
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
    area === 'family' ? 'domicilio de las partes, existencia de hijos, acuerdos, bienes y medidas vigentes' : '',
    !/(art[ií]culo|ley \d|c[oó]digo|normativa)/i.test(text) ? 'norma o fundamento jurídico invocado' : '',
  ].filter(Boolean);
  const sourceTargets = area === 'criminal'
    ? ['Código Penal de la Nación en InfoLEG/Argentina.gob.ar', 'Boletín Oficial para reformas y vigencia', 'Jurisprudencia oficial pertinente si la interpretación depende del caso']
    : area === 'family'
      ? ['Código Civil y Comercial de la Nación en InfoLEG/Argentina.gob.ar', 'Normativa procesal de la jurisdicción correspondiente', 'Jurisprudencia oficial pertinente']
      : area === 'contracts'
        ? ['Código Civil y Comercial de la Nación en InfoLEG/Argentina.gob.ar', 'Ley de Defensa del Consumidor cuando exista relación de consumo', 'Boletín Oficial para vigencia y modificaciones']
        : ['InfoLEG/Argentina.gob.ar', 'Boletín Oficial', 'Normativa de la jurisdicción correspondiente'];
  return {
    applicable: legal,
    jurisdiction,
    area,
    areaLabel,
    issues,
    factsNeeded,
    sourceTargets,
    conclusion: !legal
      ? 'No se identificó una consulta jurídica dentro del alcance.'
      : jurisdiction === 'not-specified'
        ? 'La jurisdicción no está suficientemente identificada; no corresponde aplicar automáticamente el derecho argentino.'
        : issues.length
          ? 'Se identificaron cláusulas o afirmaciones que requieren contraste normativo y revisión del contexto completo.'
          : 'No se detectaron alertas textuales específicas, pero la validez o consecuencia jurídica no puede determinarse sin hechos y normativa aplicable.',
  };
}
