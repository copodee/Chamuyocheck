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
  { id: 'credential-request', label: 'Solicitud de claves, códigos o acceso remoto', pattern: /(?:compart[ií]|envi[aá]|pasame|pas[aá]|dictame|dict[aá]|decime|inform[aá]|facilit[aá]|ingres[aá])(?:\s+\w+){0,6}\s+(?:tu\s+)?(?:clave|contrase[ñn]a|token|c[oó]digo de verificaci[oó]n|c[oó]digo sms)|(?:instal[aá]|descarg[aá]|habilit[aá])(?:\s+\w+){0,5}\s+(?:acceso remoto|anydesk|teamviewer)/i, weight: 30 },
  { id: 'off-platform-payment', label: 'Pago por canal difícil de revertir o a tercero', pattern: /(?:cripto|usdt|gift card|tarjeta regalo|cuenta de un tercero|cuenta personal|wallet).{0,45}(?:pag|transfer|envi)|(?:pag|transfer|envi).{0,45}(?:cripto|usdt|gift card|cuenta de un tercero|cuenta personal|wallet)/i, weight: 18 },
  { id: 'identity-mismatch', label: 'Identidad o canal no verificable', pattern: /(?:n[uú]mero nuevo|cuenta nueva|perfil nuevo|no llames al banco|soporte por whatsapp|agente por telegram|asesor por telegram)/i, weight: 18 },
  { id: 'unrealistic-return', label: 'Retorno extraordinario en un plazo corto', pattern: /(?:\d{2,4}\s*%|duplic[aá]|triplic[aá]|multiplic[aá]).{0,55}(?:d[ií]a|semana|mes|poco tiempo)|(?:por d[ií]a|diario|semanal|mensual).{0,35}(?:\d{2,4}\s*%|duplic|triplic)/i, weight: 27 },
  { id: 'automated-money-claim', label: 'Promesa de generar dinero mediante IA, algoritmo o autotrading', pattern: /(?:\bia\b|\bai\b|inteligencia artificial|algoritmo|autotrader|auto\s*trader|trading\s*bot|bot de (?:trading|inversi[oó]n)|robot de trading).{0,90}(?:hace|genera|gana|produce|multiplica|rentabilidad|ganancias?|dinero)|(?:dinero|ganancias?|rentabilidad).{0,90}(?:\bia\b|\bai\b|inteligencia artificial|algoritmo|autotrader|trading\s*bot|robot de trading)/i, weight: 22 },
  { id: 'advertising-landing-link', label: 'Enlace de captación con seguimiento publicitario', pattern: /https?:\/\/\S+(?:campaign(?:_id|_name)?=|site_id=|thumbnail=|taboola|outbrain|subc=)\S*/i, weight: 10 },
  { id: 'cross-domain-redirect', label: 'El enlace redirige a un dominio diferente', pattern: /Auditor[ií]a de identidad del enlace\.[\s\S]{0,320}Destino final observado:\s*[^;\n]+; no coincide con el dominio inicial/i, weight: 16 },
];

const scamContext = /estafa|scam|fraude|enga[ñn]o|inversi[oó]n|rentabilidad|ganancia|premio|pr[eé]stamo|cr[eé]dito|transfer|deposit|referid|multinivel|ponzi|pir[aá]mid|phishing|banco|wallet|cripto|usdt|telegram|whatsapp|autotrader|auto\s*trader|trading\s*bot|robot\s+de\s+trading|plataforma\s+de\s+trading/i;

function excerpt(text: string, match: RegExpMatchArray): string {
  const index = match.index || 0;
  return sanitizeEvidence(text.slice(Math.max(0, index - 35), Math.min(text.length, index + match[0].length + 45)));
}

function decodeRepeatedly(value: string): string {
  let decoded = value.replace(/\+/g, ' ');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch { break; }
  }
  return decoded;
}

function safeUrlSummary(raw: string): string {
  try {
    const url = new URL(raw.replace(/[),.;]+$/, ''));
    const path = url.pathname === '/' ? '' : url.pathname.slice(0, 70);
    return `${url.protocol}//${url.hostname}${path}${url.search ? ' (parámetros omitidos)' : ''}`;
  } catch {
    return 'enlace externo (parámetros omitidos)';
  }
}

function sanitizeEvidence(value: string): string {
  const cleaned = value
    .replace(/https?:\/\/[^\s<>"']+/gi, (url) => safeUrlSummary(url))
    .replace(/(?:[?&]|\b)(?:subc|adid|site_id|site_domain|thumbnail|campaign_id|campaign_name|utm_[a-z_]+|gclid|fbclid)=[^\s&]*/gi, '')
    .replace(/[%_+A-Za-z0-9=-]{120,}/g, '[parámetro extenso omitido]')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 240 ? `${cleaned.slice(0, 237).trimEnd()}…` : cleaned;
}

const urlShorteners = new Set(['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rebrand.ly', 'is.gd', 'shorturl.at', 'ow.ly']);
const unusualTlds = /\.(?:top|xyz|click|work|cam|buzz|monster|gq|tk|ml|cf|ga)$/i;

function urlStructureSignals(text: string): ScamSignal[] {
  const rawUrls = [...text.matchAll(/https?:\/\/[^\s<>"']+/gi)].map((match) => match[0].replace(/[),.;]+$/, ''));
  const signals: ScamSignal[] = [];
  const seen = new Set<string>();
  for (const raw of [...new Set(rawUrls)].slice(0, 3)) {
    let url: URL;
    try { url = new URL(raw); } catch { continue; }
    const host = url.hostname.toLowerCase();
    const add = (id: string, label: string, evidence: string, weight: number) => {
      if (seen.has(id)) return;
      seen.add(id);
      signals.push({ id, label, evidence: sanitizeEvidence(evidence), weight });
    };
    if (url.protocol === 'http:') add('url-insecure-http', 'Enlace sin cifrado HTTPS', `El enlace de ${host} usa HTTP sin cifrado.`, 14);
    if (url.username || url.password) add('url-embedded-credentials', 'URL con identidad incrustada antes del dominio', `El enlace incluye datos antes del dominio real ${host}, una técnica que puede confundir sobre el destino.`, 24);
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || /^\[[0-9a-f:]+\]$/i.test(host)) add('url-ip-host', 'Enlace dirigido a una dirección IP', `El destino muestra una dirección IP en lugar de un dominio identificable.`, 18);
    if (host.includes('xn--')) add('url-punycode', 'Dominio internacionalizado que requiere revisar su escritura', `El dominio ${host} usa codificación Punycode y debe compararse carácter por carácter con el sitio oficial.`, 16);
    if (urlShorteners.has(host)) add('url-shortener', 'Destino oculto detrás de un acortador', `El enlace usa ${host}; el destino final debe resolverse antes de confiar.`, 13);
    if (host.split('.').length > 4) add('url-many-subdomains', 'Cantidad inusual de subdominios', `El enlace usa una cadena extensa de subdominios antes de ${host}.`, 9);
    if (unusualTlds.test(host)) add('url-unusual-tld', 'Extensión de dominio que requiere cautela adicional', `El dominio ${host} usa una extensión frecuentemente empleada en sitios de vida corta; no demuestra fraude por sí sola.`, 7);
    if (url.port && !['80', '443'].includes(url.port)) add('url-unusual-port', 'Puerto de red no habitual en el enlace', `El enlace de ${host} utiliza el puerto ${url.port}.`, 10);
    if (/\b(?:login|signin|verify|verification|secure|wallet|support|account|actualizar|verificar|seguridad)\b/i.test(`${host.replace(/[-_.]/g, ' ')} ${url.pathname.replace(/[-_/]/g, ' ')}`)) {
      add('url-sensitive-action', 'Enlace que solicita una acción sensible', `La dirección de ${host} contiene referencias a acceso, verificación, seguridad, billetera o soporte. Debe abrirse desde el canal oficial, no desde el mensaje.`, 9);
    }
  }
  return signals;
}

function signalEvidence(rule: Rule, analysisText: string, match: RegExpMatchArray): string {
  if (rule.id === 'advertising-landing-link') {
    const urlMatch = match[0].match(/https?:\/\/[^\s<>"']+/i);
    if (urlMatch) {
      try {
        const url = new URL(urlMatch[0]);
        return `Enlace de captación en ${url.hostname} con parámetros de seguimiento publicitario.`;
      } catch { /* Use the generic evidence below. */ }
    }
  }
  if (rule.id === 'automated-money-claim') {
    const rawUrl = analysisText.match(/https?:\/\/[^\s<>"']+/i)?.[0];
    if (rawUrl) {
      try {
        const title = new URL(rawUrl).searchParams.get('title');
        if (title) return sanitizeEvidence(`Promesa publicitaria: “${decodeRepeatedly(title)}”.`);
      } catch { /* Use the matched excerpt below. */ }
    }
  }
  return excerpt(analysisText, match);
}

export function analyzeScamRisk(text: string): ScamRiskAnalysis {
  const decodedText = decodeRepeatedly(text);
  const analysisText = `${text}\n${decodedText}`;
  const contentSignals = rules.flatMap((rule) => {
    const match = analysisText.match(rule.pattern);
    return match ? [{ id: rule.id, label: rule.label, evidence: signalEvidence(rule, analysisText, match), weight: rule.weight }] : [];
  });
  const signals = [...contentSignals, ...urlStructureSignals(text)];
  const applicable = scamContext.test(analysisText) || signals.length > 0;
  const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0));
  const level = score >= 70 ? 'muy-alto' : score >= 45 ? 'alto' : score >= 20 ? 'medio' : 'bajo';
  const missingInformation = [
    !/(cuit|raz[oó]n social|nombre legal)/i.test(analysisText) ? 'identidad legal, jurisdicción y CUIT o número registral de la entidad' : '',
    !/(cnv|bcra|registro|matr[ií]cula|autorizad|licen[cs]ia|regulad)/i.test(analysisText) ? 'registro o autorización del organismo competente' : '',
    !/(contrato|t[eé]rminos|condiciones)/i.test(analysisText) ? 'contrato y condiciones completas' : '',
    !/(dominio|https?:\/\/|sitio web)/i.test(analysisText) ? 'dominio y canal oficial verificables' : '',
    !/(retiro|retirar|withdraw|custodia|broker|comisi[oó]n|cargo)/i.test(analysisText) ? 'custodia, intermediario, costos y reglas de retiro de fondos' : '',
    !/(p[eé]rdida|riesgo|drawdown|rendimiento hist[oó]rico|metodolog[ií]a)/i.test(analysisText) ? 'riesgos, pérdidas posibles y metodología verificable del rendimiento anunciado' : '',
  ].filter(Boolean);
  const checks = [
    'Confirmar identidad, CUIT, dominio y canales desde el sitio oficial, sin usar enlaces del mensaje.',
    'Verificar autorización o advertencias en BCRA, CNV y organismos de defensa del consumidor según la actividad.',
    'Comprobar la razón social en el registro de agentes o PSAV de CNV y, si declara operar en otro país, en el regulador de esa jurisdicción.',
    'Revisar quién recibe y custodia los fondos, cómo se retiran, qué comisiones existen y si el rendimiento tiene una metodología auditable.',
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
        ? 'La oferta o el sitio no pudo validarse con los datos visibles. La ausencia de una señal fuerte no acredita legitimidad, autorización ni identidad.'
        : `Se detectaron ${signals.length} señales observables de riesgo. No prueban por sí solas una estafa o un delito.`,
  };
}
