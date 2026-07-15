export type SupportedProductArea = 'finance-credit' | 'investment-project' | 'scam-risk' | 'argentina-legal-documents';

export type ProductScopeResult = {
  supported: boolean;
  primaryArea: SupportedProductArea | null;
  secondaryAreas: SupportedProductArea[];
  confidence: number;
  reason: string;
  matchedSignals: string[];
};

const financePatterns = [
  /\b(?:pr[eé]stamos?|cr[eé]ditos?|microcr[eé]ditos?|leasing|arrendamiento\s+financiero|tarjetas?|cuotas?|cft|cftea|tea|tna|tasa\s+efectiva|tasa\s+nominal|inter[eé]s|mora|financiaci[oó]n|comisi[oó]n|seguro\s+de\s+saldo|capital\s+adeudado)\b/i,
  /\b(?:inversi[oó]n|rentabilidad|rendimiento|ganancia|retorno|broker|bono|acci[oó]n|fondo\s+com[uú]n|plazo\s+fijo|criptomoneda|bitcoin|ethereum|wallet)\b/i,
  /(?:\$|usd|ars)\s*\d[\d.,]*|\b\d+(?:[.,]\d+)?\s*%\b/i,
  /https?:\/\/[^\s]*(?:creditos?|prestamos?|microcreditos?|leasing|financiacion|hipotecario|prendario)[^\s]*/i,
  /\b(?:inflaci[oó]n|ipc|indec|rem|bcra|poder\s+adquisitivo|valor\s+real|tasa\s+(?:real|contra\s+inflaci[oó]n))\b/i,
  /\b\d[\d.,]*\s*(?:pesos?|d[oó]lares?)\b[\s\S]{0,100}\b(?:\d{1,3}\s*(?:meses?|cuotas?)|termin(?:ar[eé]|a|ar[ií]a)\s+pagando|total\s+(?:a\s+)?pagar)\b/i,
];

const loanCalculationPatterns = [
  /\b(?:pr[eé]stamo|cr[eé]dito|cuota|cft|tea|tna|financiaci[oó]n|inter[eé]s|leasing|microcr[eé]dito)\b/i,
  /\b\d[\d.,]*\s*(?:pesos?|d[oó]lares?)\b[\s\S]{0,120}\b(?:\d{1,3}\s*(?:meses?|cuotas?)|termin(?:ar[eé]|a|ar[ií]a)\s+pagando|total\s+(?:a\s+)?pagar)\b/i,
];

const investmentProjectPatterns = [
  /\b(?:proyecto\s+de\s+inversi[oó]n|inversi[oó]n\s+(?:inmobiliaria|productiva|agropecuaria)|viabilidad|flujo\s+de\s+fondos|tasa\s+interna\s+de\s+retorno|\btir\b|\bvan\b|per[ií]odo\s+de\s+recupero)\b/i,
  /\b(?:inmueble|departamento|propiedad|alquiler|metro(?:s)?\s+cuadrad|hect[aá]rea|campo|ganader|soja|ma[ií]z|trigo|uva|vino|yerba|frut|exportaci[oó]n|comercio\s+exterior)\b[\s\S]{0,120}\b(?:invertir|inversi[oó]n|rentabilidad|renta|proyecto|retorno|precio|demanda)\b/i,
  /\b(?:sector\s+automotriz|inmobiliario|productivo|agropecuario|ganadero|transporte|log[ií]stica|servicios?)\b[\s\S]{0,100}\b(?:proyecci[oó]n|inversi[oó]n|viabilidad|demanda|rentabilidad)\b/i,
  /\b(?:miner[ií]a|minero|litio|cobre|oro|plata|uranio|potasio|petr[oó]leo|gas\s+natural|hidrocarburos?|vaca\s+muerta|yacimiento|pozo)\b[\s\S]{0,140}\b(?:inversi[oó]n|proyecto|rentabilidad|retorno|producci[oó]n|tierras?|alquiler(?:es)?|viviendas?)\b/i,
  /\b(?:inversi[oó]n|proyecto|rentabilidad|retorno|producci[oó]n)\b[\s\S]{0,140}\b(?:miner[ií]a|minero|litio|cobre|oro|plata|uranio|potasio|petr[oó]leo|gas\s+natural|hidrocarburos?|vaca\s+muerta|yacimiento|pozo)\b/i,
  /\b(?:tierras?|terrenos?|viviendas?|alquiler(?:es)?)\b[\s\S]{0,120}\b(?:vaca\s+muerta|a[nñ]elo|neuqu[eé]n|zona\s+(?:petrolera|minera|energ[eé]tica))\b/i,
];

const scamPatterns = [
  /\b(?:estafa|scam|fraude|enga[ñn]o|ponzi|pir[aá]mid(?:e|al)|multinivel|referidos?|suplantaci[oó]n|phishing|cuenta\s+m[uú]la)\b/i,
  /\b(?:autotrader|auto\s*trader|trading\s*bot|bot\s+de\s+(?:trading|inversi[oó]n)|robot\s+de\s+trading|plataforma\s+de\s+trading|inversi[oó]n\s+automatizada)\b/i,
  /\b(?:ia|ai|inteligencia\s+artificial|algoritmo|robot)\b[+\s\S]{0,80}\b(?:hace|genera|gana|produce|multiplica)\b[+\s\S]{0,30}\b(?:dinero|ganancias?|rentabilidad|ingresos?)\b/i,
  /(?:https?:\/\/\S+)[\s\S]{0,180}\b(?:es\s+(?:real|leg[ií]tim[oa]|segur[oa])|scam|estafa|fraude|confiable)\b/i,
  /\b(?:ganancia|rentabilidad|retorno|beneficio)\s+(?:garantizad[oa]|asegurad[oa])\b/i,
  /\b(?:curso|mentor[ií]a|coaching|masterclass|capacitaci[oó]n|programa)\b.{0,80}\b(?:negocios?|emprendimientos?|ventas|facturaci[oó]n|[eé]xito|libertad financiera)\b/i,
  /\b(?:transfer[ií]|deposit[aá]|pag[aá])\b[\s\S]{0,80}\b(?:antes|anticipo|liberar|premio|cr[eé]dito|pr[eé]stamo)\b/i,
  /\b(?:sin\s+riesgo|dinero\s+f[aá]cil|duplic[aá]|triplic[aá]|ingresos?\s+pasivos?)\b/i,
];

const legalPatterns = [
  /\b(?:ley|leyes|legal|ilegal|derecho|normativa|c[oó]digo\s+(?:penal|civil)|art[ií]culo\s+\d+|delito|pena|prisi[oó]n|condena|denuncia|demanda\s+judicial|demandar|sentencia|tribunal|juez|abogad[oa])\b/i,
  /\b(?:contrato|cl[aá]usula|obligaci[oó]n|incumplimiento|rescisi[oó]n|jurisdicci[oó]n|penalidad|intimaci[oó]n|carta\s+documento)\b/i,
  /\b(?:divorcio|separaci[oó]n|alimentos|cuota\s+alimentaria|r[eé]gimen\s+de\s+comunicaci[oó]n|responsabilidad\s+parental|bienes\s+gananciales|compensaci[oó]n\s+econ[oó]mica)\b/i,
  /\b(?:robo|hurto|homicidio|lesiones|amenazas|defraudaci[oó]n|violencia\s+de\s+g[eé]nero)\b/i,
];

function matches(patterns: RegExp[], text: string): string[] {
  return patterns.flatMap((pattern) => text.match(pattern)?.[0] || []).slice(0, 4);
}

export function hasFinancialEconomicSignals(text: string): boolean {
  return matches(financePatterns, text).length > 0;
}

export function hasLoanCalculationSignals(text: string): boolean {
  return matches(loanCalculationPatterns, text).length > 0;
}

export function classifyProductScope(documentText: string, userInstruction = ''): ProductScopeResult {
  const rawText = `${userInstruction}\n${documentText}`.trim();
  let decodedText = rawText.replace(/\+/g, ' ');
  try {
    decodedText = decodeURIComponent(decodedText);
  } catch {
    // Una URL mal escapada no debe impedir la clasificación del contenido visible.
  }
  const text = `${rawText}\n${decodedText}`;
  const candidates: Array<{ area: SupportedProductArea; signals: string[] }> = [
    { area: 'scam-risk', signals: matches(scamPatterns, text) },
    { area: 'argentina-legal-documents', signals: matches(legalPatterns, text) },
    { area: 'investment-project', signals: matches(investmentProjectPatterns, text) },
    { area: 'finance-credit', signals: matches(financePatterns, text) },
  ];
  const ranked = candidates.filter((item) => item.signals.length > 0);
  if (!ranked.length) {
    return {
      supported: false,
      primaryArea: null,
      secondaryAreas: [],
      confidence: 0.95,
      reason: 'La consulta no corresponde a finanzas y créditos, posibles estafas ni derecho argentino y documentos legales.',
      matchedSignals: [],
    };
  }
  ranked.sort((a, b) => b.signals.length - a.signals.length);
  return {
    supported: true,
    primaryArea: ranked[0].area,
    secondaryAreas: ranked.slice(1).map((item) => item.area),
    confidence: Math.min(0.98, 0.72 + ranked[0].signals.length * 0.08),
    reason: `La consulta contiene señales suficientes para activar ${ranked[0].area}.`,
    matchedSignals: ranked.flatMap((item) => item.signals).slice(0, 6),
  };
}
