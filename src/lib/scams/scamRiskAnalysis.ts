export type ScamSignal = {
  id: string;
  label: string;
  evidence: string;
  weight: number;
};

export type ScamRiskAnalysis = {
  applicable: boolean;
  score: number;
  level: 'bajo' | 'medio' | 'alto' | 'muy-alto';
  signals: ScamSignal[];
  checks: string[];
  missingInformation: string[];
  conclusion: string;
};

type Rule = { id: string; label: string; pattern: RegExp; weight: number };

const rules: Rule[] = [
  { id: 'guaranteed-return', label: 'Ganancia o rendimiento garantizado', pattern: /(?:ganancia|rentabilidad|retorno|rendimiento|beneficio).{0,35}(?:garantizad[oa]|asegurad[oa]|sin riesgo)|(?:garantizad[oa]|sin riesgo).{0,35}(?:ganancia|rentabilidad|retorno|rendimiento)/i, weight: 28 },
  { id: 'advance-fee', label: 'Pago anticipado para liberar dinero, premio o crédito', pattern: /(?:pag[aá]|transfer[ií]|deposit[aá]|abon[aá]).{0,65}(?:liberar|desbloquear|recibir|habilitar).{0,40}(?:premio|pr[eé]stamo|cr[eé]dito|dinero|fondos)|(?:premio|pr[eé]stamo|cr[eé]dito).{0,70}(?:comisi[oó]n|anticipo|gasto|seguro).{0,25}(?:previo|adelantado|antes)/i, weight: 32 },
  { id: 'recruitment', label: 'Ingresos condicionados a incorporar referidos', pattern: /(?:gan[aá]s?|comisi[oó]n|ingresos?).{0,65}(?:referidos?|invitar|incorporar|reclutar)|(?:pir[aá]mid|ponzi|multinivel)/i, weight: 25 },
  { id: 'urgency', label: 'Presión o urgencia para decidir/pagar', pattern: /(?:solo por hoy|[uú]ltimos? cupos?|ahora mismo|urgente|no lo pienses|oportunidad [uú]nica|vence hoy|transfer[ií].{0,20}ya)/i, weight: 13 },
  { id: 'credential-request', label: 'Solicitud de claves, códigos o acceso remoto', pattern: /(?:clave|contrase[ñn]a|token|c[oó]digo de verificaci[oó]n|c[oó]digo sms|home banking|acceso remoto|anydesk|teamviewer)/i, weight: 30 },
  { id: 'off-platform-payment', label: 'Pago por canal difícil de revertir o a tercero', pattern: /(?:cripto|usdt|gift card|tarjeta regalo|cuenta de un tercero|cuenta personal|wallet).{0,45}(?:pag|transfer|envi)|(?:pag|transfer|envi).{0,45}(?:cripto|usdt|gift card|cuenta de un tercero|cuenta personal|wallet)/i, weight: 18 },
  { id: 'identity-mismatch', label: 'Identidad o canal no verificable', pattern: /(?:n[uú]mero nuevo|cuenta nueva|perfil nuevo|no llames al banco|soporte por whatsapp|agente por telegram|asesor por telegram)/i, weight: 18 },
  { id: 'unrealistic-return', label: 'Retorno extraordinario en un plazo corto', pattern: /(?:\d{2,4}\s*%|duplic[aá]|triplic[aá]|multiplic[aá]).{0,55}(?:d[ií]a|semana|mes|poco tiempo)|(?:por d[ií]a|diario|semanal|mensual).{0,35}(?:\d{2,4}\s*%|duplic|triplic)/i, weight: 27 },
];

const scamContext = /estafa|fraude|enga[ñn]o|inversi[oó]n|rentabilidad|ganancia|premio|pr[eé]stamo|cr[eé]dito|transfer|deposit|referid|multinivel|ponzi|pir[aá]mid|phishing|banco|wallet|cripto|usdt|telegram|whatsapp/i;

function excerpt(text: string, match: RegExpMatchArray): string {
  const index = match.index || 0;
  return text.slice(Math.max(0, index - 35), Math.min(text.length, index + match[0].length + 45)).replace(/\s+/g, ' ').trim();
}

export function analyzeScamRisk(text: string): ScamRiskAnalysis {
  const signals = rules.flatMap((rule) => {
    const match = text.match(rule.pattern);
    return match ? [{ id: rule.id, label: rule.label, evidence: excerpt(text, match), weight: rule.weight }] : [];
  });
  const applicable = scamContext.test(text) || signals.length > 0;
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0));
  const level = score >= 70 ? 'muy-alto' : score >= 45 ? 'alto' : score >= 20 ? 'medio' : 'bajo';
  const missingInformation = [
    !/(cuit|raz[oó]n social|nombre legal)/i.test(text) ? 'identidad legal y CUIT de la entidad' : '',
    !/(cnv|bcra|registro|matr[ií]cula|autorizad)/i.test(text) ? 'registro o autorización del organismo competente' : '',
    !/(contrato|t[eé]rminos|condiciones)/i.test(text) ? 'contrato y condiciones completas' : '',
    !/(dominio|https?:\/\/|sitio web)/i.test(text) ? 'dominio y canal oficial verificables' : '',
  ].filter(Boolean);
  const checks = [
    'Confirmar identidad, CUIT, dominio y canales desde el sitio oficial, sin usar enlaces del mensaje.',
    'Verificar autorización o advertencias en BCRA, CNV y organismos de defensa del consumidor según la actividad.',
    'No transferir, compartir claves ni instalar acceso remoto mientras existan señales pendientes.',
    'Guardar anuncio, conversación, comprobantes, URL y datos del destinatario para una revisión posterior.',
  ];
  return {
    applicable,
    score,
    level,
    signals,
    checks,
    missingInformation,
    conclusion: !applicable
      ? 'No se detectó una oferta o interacción evaluable como posible estafa.'
      : signals.length === 0
        ? 'No se detectaron patrones fuertes en el texto visible, pero eso no acredita legitimidad ni identidad.'
        : `Se detectaron ${signals.length} señales observables de riesgo. No prueban por sí solas una estafa o un delito.`,
  };
}
