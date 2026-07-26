import type { EconomicProfile } from '../domain/dossier';

export type DocumentAdmission = {
  action: 'accept' | 'review' | 'discard';
  kind: string;
  stage: 2 | 3;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
};

export function normalizedDocumentText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function extractDocumentCuits(value: string) {
  const matches = normalizedDocumentText(value).match(/(?:20|23|24|27|30|33|34)[\s.-]?\d{8}[\s.-]?\d/g) || [];
  return [...new Set(matches.map(match => match.replace(/\D/g, '')).filter(match => match.length === 11))];
}

function nextAvailable(prefix: string, maximum: number, usedKinds: Set<string>) {
  for (let index = 1; index <= maximum; index += 1) {
    const kind = `${prefix}-${index}`;
    if (!usedKinds.has(kind)) return kind;
  }
  return `${prefix}-${maximum}`;
}

export function classifyPrequalificationDocument(input: {
  profile: EconomicProfile;
  fileName: string;
  extractedText: string;
  targetCuit: string;
  usedKinds: Set<string>;
}): DocumentAdmission {
  const content = normalizedDocumentText(`${input.fileName} ${input.extractedText.slice(0, 24000)}`);
  const has = (...patterns: string[]) => patterns.some(pattern => content.includes(pattern));
  const targetCuit = input.targetCuit.replace(/\D/g, '');
  const documentCuits = extractDocumentCuits(`${input.fileName} ${input.extractedText}`);

  if (has('requisitos - personas fisicas', 'documentacion requerida', 'lista de requisitos') && !has('estado de situacion patrimonial')) {
    return { action: 'discard', kind: 'requirements-list', stage: 2, confidence: 'high', reason: 'Es una lista de requisitos, no un respaldo económico del cliente.' };
  }
  if (targetCuit && documentCuits.length && !documentCuits.includes(targetCuit)) {
    return { action: 'review', kind: 'different-subject', stage: 2, confidence: 'high', reason: 'El documento contiene un CUIT diferente al expediente. Debe indicarse si pertenece a un garante o empresa vinculada.' };
  }
  if (has('documento nacional de identidad', 'registro nacional de las personas', 'idarg')) {
    const reverse = has('domicilio', 'lugar de nacimiento', 'pulgar', 'idarg') || has('reverso', 'dorso');
    return { action: 'accept', kind: reverse ? 'representative-identity-back' : 'representative-identity-front', stage: 3, confidence: 'high', reason: `DNI ${reverse ? 'dorso' : 'frente'} detectado.` };
  }
  if (has('designacion de autoridades', 'designación de autoridades', 'eleccion de autoridades', 'elección de autoridades')) {
    return { action: 'accept', kind: 'authorities-act', stage: 3, confidence: 'high', reason: 'Acta de designación de autoridades detectada.' };
  }
  if (has('acta de asamblea', 'acta de directorio') && has('aprobacion', 'aprobación', 'estados contables', 'balance')) {
    return { action: 'accept', kind: 'balance-approval-act', stage: 3, confidence: 'high', reason: 'Acta de aprobación de estados contables detectada.' };
  }
  if (has('estatuto social', 'contrato social', 'estatuto o contrato')) {
    return { action: 'accept', kind: 'statute', stage: 3, confidence: 'high', reason: 'Estatuto o contrato social detectado.' };
  }
  if (has('poder general', 'poder especial', 'apoderado')) {
    return { action: 'accept', kind: 'signer-power', stage: 3, confidence: 'medium', reason: 'Posible poder del firmante detectado.' };
  }

  if (input.profile === 'legal-entity') {
    if (has('notas a los estados contables', 'informacion complementaria a los estados contables')
      || (has('nota n°', 'nota nº', 'nota no') && has('criterios de valuacion', 'composicion de los rubros'))) {
      return { action: 'accept', kind: 'balance-notes', stage: 2, confidence: 'high', reason: 'Notas complementarias de los estados contables detectadas.' };
    }
    if (has('detalle de deuda', 'deuda bancaria', 'deuda financiera', 'prestamos bancarios', 'entidades acreedoras')) return { action: 'accept', kind: 'financial-debt', stage: 2, confidence: 'high', reason: 'Detalle de deuda financiera detectado.' };
    if (has('f.2051', 'f2051', 'formulario 2051', 'ventas netas de iva', 'ventas posteriores', 'ventas post balance', 'detalle mensual de ventas')) return { action: 'accept', kind: 'post-balance-sales', stage: 2, confidence: 'high', reason: 'Declaración mensual o detalle de ventas detectado.' };
    if (has('f.713', 'f713', 'declaracion jurada ganancias sociedades', 'impuesto a las ganancias sociedades')) return { action: 'accept', kind: 'corporate-income-tax', stage: 2, confidence: 'high', reason: 'Declaración anual de Ganancias de la sociedad detectada.' };
    if (has('estado de situacion patrimonial', 'patrimonio neto', 'estado de resultados', 'balance general', 'ejercicio economico', 'estados contables', 'eecc')) return { action: 'accept', kind: nextAvailable('balance', 2, input.usedKinds), stage: 2, confidence: 'high', reason: 'Estados contables detectados.' };
  }
  if (input.profile === 'responsable-inscripto') {
    if (has('declaracion jurada de iva', 'f. 2002', 'formulario 2002', 'saldo tecnico iva', 'f.2051', 'f2051')) return { action: 'accept', kind: nextAvailable('vat', 6, input.usedKinds), stage: 2, confidence: 'high', reason: 'Declaración mensual de IVA detectada.' };
    if (has('impuesto a las ganancias', 'declaracion jurada ganancias', 'f.711', 'f711')) return { action: 'accept', kind: 'income-tax', stage: 2, confidence: 'high', reason: 'Declaración de Ganancias detectada.' };
    if (has('constancia de inscripcion', 'sistema registral', 'datos registrales')) return { action: 'accept', kind: 'tax-proof', stage: 2, confidence: 'high', reason: 'Constancia de inscripción detectada.' };
  }
  if (input.profile === 'monotributista') {
    if (has('constancia de opcion', 'categoria actual', 'monotributo')) return { action: 'accept', kind: 'monotributo-proof', stage: 2, confidence: 'medium', reason: 'Constancia de monotributo detectada.' };
    if (has('factura c', 'comprobante', 'punto de venta', 'cae')) return { action: 'accept', kind: nextAvailable('monotributo-invoices', 6, input.usedKinds), stage: 2, confidence: 'medium', reason: 'Factura de monotributista detectada.' };
    if (has('manifestacion de bienes', 'bienes personales')) return { action: 'accept', kind: 'asset-statement', stage: 2, confidence: 'high', reason: 'Manifestación patrimonial detectada.' };
  }
  if (input.profile === 'employee') {
    if (has('recibo de sueldo', 'remuneracion neta', 'haberes', 'empleador', 'sueldo neto')) return { action: 'accept', kind: nextAvailable('salary-slip', 6, input.usedKinds), stage: 2, confidence: 'high', reason: 'Recibo de sueldo detectado.' };
    if (has('impuesto a las ganancias', 'declaracion jurada ganancias')) return { action: 'accept', kind: 'income-tax', stage: 2, confidence: 'high', reason: 'Declaración de Ganancias detectada.' };
    if (has('manifestacion de bienes', 'bienes personales')) return { action: 'accept', kind: 'personal-assets', stage: 2, confidence: 'high', reason: 'Manifestación patrimonial detectada.' };
  }
  return { action: 'review', kind: 'unclassified', stage: 2, confidence: 'low', reason: 'No se pudo determinar el tipo con seguridad.' };
}
