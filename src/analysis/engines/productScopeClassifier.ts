export type SupportedProductArea = 'finance-credit' | 'scam-risk' | 'argentina-legal-documents';

export type ProductScopeResult = {
  supported: boolean;
  primaryArea: SupportedProductArea | null;
  secondaryAreas: SupportedProductArea[];
  confidence: number;
  reason: string;
  matchedSignals: string[];
};

const financePatterns = [
  /\b(?:pr[eé]stamo|cr[eé]dito|tarjeta|cuota|cft|costo\s+financiero\s+total|tea|tna|tasa\s+efectiva|tasa\s+nominal|inter[eé]s|mora|financiaci[oó]n|comisi[oó]n|seguro\s+de\s+saldo|capital\s+adeudado)\b/i,
  /\b(?:inversi[oó]n|rentabilidad|rendimiento|ganancia|retorno|broker|bono|acci[oó]n|fondo\s+com[uú]n|plazo\s+fijo|criptomoneda|bitcoin|ethereum|wallet)\b/i,
  /(?:\$|usd|ars)\s*\d[\d.,]*|\b\d+(?:[.,]\d+)?\s*%\b/i,
];

const scamPatterns = [
  /\b(?:estafa|fraude|enga[ñn]o|ponzi|pir[aá]mid(?:e|al)|multinivel|referidos?|suplantaci[oó]n|phishing|cuenta\s+m[uú]la)\b/i,
  /\b(?:ganancia|rentabilidad|retorno|beneficio)\s+(?:garantizad[oa]|asegurad[oa])\b/i,
  /\b(?:curso|mentor[ií]a|coaching|masterclass|capacitaci[oó]n|programa)\b.{0,80}\b(?:negocios?|emprendimientos?|ventas|facturaci[oó]n|[eé]xito|libertad financiera)\b/i,
  /\b(?:transfer[ií]|deposit[aá]|pag[aá])\b[\s\S]{0,80}\b(?:antes|anticipo|liberar|premio|cr[eé]dito|pr[eé]stamo)\b/i,
  /\b(?:sin\s+riesgo|dinero\s+f[aá]cil|duplic[aá]|triplic[aá]|ingresos?\s+pasivos?)\b/i,
];

const legalPatterns = [
  /\b(?:ley|leyes|legal|ilegal|derecho|normativa|c[oó]digo\s+(?:penal|civil)|art[ií]culo\s+\d+|delito|pena|prisi[oó]n|condena|denuncia|demanda|sentencia|tribunal|juez|abogad[oa])\b/i,
  /\b(?:contrato|cl[aá]usula|obligaci[oó]n|incumplimiento|rescisi[oó]n|jurisdicci[oó]n|penalidad|intimaci[oó]n|carta\s+documento)\b/i,
  /\b(?:divorcio|separaci[oó]n|alimentos|cuota\s+alimentaria|r[eé]gimen\s+de\s+comunicaci[oó]n|responsabilidad\s+parental|bienes\s+gananciales|compensaci[oó]n\s+econ[oó]mica)\b/i,
  /\b(?:robo|hurto|homicidio|lesiones|amenazas|defraudaci[oó]n|violencia\s+de\s+g[eé]nero)\b/i,
];

function matches(patterns: RegExp[], text: string): string[] {
  return patterns.flatMap((pattern) => text.match(pattern)?.[0] || []).slice(0, 4);
}

/**
 * Product-level gate. It intentionally does not treat isolated words such as
 * “economía”, a public job title or a PDF upload as sufficient evidence of scope.
 */
export function classifyProductScope(documentText: string, userInstruction = ''): ProductScopeResult {
  const text = `${userInstruction}\n${documentText}`.trim();
  const finance = matches(financePatterns, text);
  const scam = matches(scamPatterns, text);
  const legal = matches(legalPatterns, text);
  const candidates: Array<{ area: SupportedProductArea; signals: string[] }> = [
    { area: 'scam-risk', signals: scam },
    { area: 'argentina-legal-documents', signals: legal },
    { area: 'finance-credit', signals: finance },
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
