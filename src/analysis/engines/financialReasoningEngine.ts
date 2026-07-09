export type FinancialClaim = {
  initialAmount: number | null;      // ej: 100000
  annualRatePercent: number | null;  // ej: 10 (%)
  promisedAmount: number | null;     // ej: 500000
  timeframeDays: number | null;      // ej: 15
  timeframeMonths: number | null;
  timeframeYears: number | null;
  isAdvanceFee: boolean;             // "ganá un premio / solo pagá para recibir"
  isMultiplication: boolean;         // "duplica/triplica tu dinero"
  isGuaranteed: boolean;             // "garantizado / riesgo cero"
};

export type FinancialValidation = {
  hasFinancialClaim: boolean;
  hasMathInconsistency: boolean;
  severity: 'extreme' | 'high' | 'medium' | 'none';
  claim: FinancialClaim;
  expectedAmount: number | null;
  discrepancyFactor: number | null;   // promisedAmount / expectedAmount
  explanation: string;
  risks: string[];
  recommendations: string[];
};

// Parse numbers from Spanish text (handles "100.000", "100000", "100 mil", "1 millón")
function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\./g, '').replace(/,/g, '.').replace(/\s+/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function extractMoney(text: string): number | null {
  // "100.000 pesos", "$100000", "100 mil pesos", "1 millón de pesos"
  const milMatch = text.match(/(\d[\d.,]*)\s*mil\s*(?:pesos|de\s*pesos)?/i);
  if (milMatch) {
    const n = parseNumber(milMatch[1]);
    if (n !== null) return n * 1000;
  }
  const millonMatch = text.match(/(\d[\d.,]*)\s*mill[oó]n(?:es)?\s*(?:de\s*pesos)?/i);
  if (millonMatch) {
    const n = parseNumber(millonMatch[1]);
    if (n !== null) return n * 1_000_000;
  }
  // "$100.000" or "100.000 pesos"
  const pesoMatch = text.match(/\$\s*([\d.,]+)|\b([\d.,]{4,})\s*(?:pesos|peso)\b/i);
  if (pesoMatch) {
    const raw = pesoMatch[1] || pesoMatch[2];
    return parseNumber(raw);
  }
  // Plain large number: 500000
  const plainMatch = text.match(/\b(\d{5,})\b/);
  if (plainMatch) return parseNumber(plainMatch[1]);
  return null;
}

function extractAnnualRate(text: string): number | null {
  // "10% anual", "tasa del 10% por año", "10 por ciento anual"
  const match = text.match(/([\d.,]+)\s*%\s*(?:anual|por\s*a[ñn]o|anuales?)/i)
    || text.match(/([\d.,]+)\s*por\s*ciento\s*(?:anual|por\s*a[ñn]o)/i);
  if (match) return parseNumber(match[1]);
  return null;
}

function extractTimeframe(text: string): { days: number | null; months: number | null; years: number | null } {
  const dayMatch = text.match(/(\d+)\s*d[ií]as?/i);
  const monthMatch = text.match(/(\d+)\s*mes(?:es)?/i);
  const yearMatch = text.match(/(\d+)\s*a[ñn]os?/i);
  return {
    days: dayMatch ? parseInt(dayMatch[1]) : null,
    months: monthMatch ? parseInt(monthMatch[1]) : null,
    years: yearMatch ? parseInt(yearMatch[1]) : null
  };
}

function extractPromisedAmount(text: string, initialAmount: number | null): number | null {
  // Find all numeric amounts in text
  const amounts: number[] = [];
  const milRegex = /(\d[\d.,]*)\s*mil\s*(?:pesos|de\s*pesos)?/gi;
  const millonRegex = /(\d[\d.,]*)\s*mill[oó]n(?:es)?\s*(?:de\s*pesos)?/gi;
  const pesoRegex = /\$\s*([\d.,]+)|\b([\d.,]{4,})\s*(?:pesos|peso)\b/gi;
  const plainRegex = /\b(\d{5,})\b/g;

  let m;
  while ((m = milRegex.exec(text)) !== null) {
    const n = parseNumber(m[1]);
    if (n !== null) amounts.push(n * 1000);
  }
  while ((m = millonRegex.exec(text)) !== null) {
    const n = parseNumber(m[1]);
    if (n !== null) amounts.push(n * 1_000_000);
  }
  while ((m = pesoRegex.exec(text)) !== null) {
    const raw = m[1] || m[2];
    const n = parseNumber(raw);
    if (n !== null) amounts.push(n);
  }
  while ((m = plainRegex.exec(text)) !== null) {
    const n = parseNumber(m[1]);
    if (n !== null) amounts.push(n);
  }

  // The "promised" amount is the largest that is different from the initial
  const candidates = amounts.filter((a) => a !== initialAmount && a > (initialAmount ?? 0));
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

// Calculate expected value with compound interest
function calculateExpected(principal: number, annualRatePercent: number, days: number | null, months: number | null, years: number | null): number {
  const rate = annualRatePercent / 100;
  if (days !== null) {
    return principal * (1 + rate * days / 365);
  }
  if (months !== null) {
    return principal * Math.pow(1 + rate / 12, months);
  }
  if (years !== null) {
    return principal * Math.pow(1 + rate, years);
  }
  return principal * (1 + rate); // default 1 year
}

export function validateFinancialClaims(text: string): FinancialValidation {
  const lower = text.toLowerCase();

  // Advance fee / prize scam detection
  const advanceFeePattern = /(gan[eéa]|ganaste|ganaron|te\s*toc[oó]|te\s*regal[aá]|recibi[r]?[aá][s]?|premi[ao])(?:\s|,|\.|!)[^]{0,80}?(pag[aá][r]?|depos[íi]tar|transfer[íi]r|abonar|enviar)[^]{0,40}?(?:\$|pesos|\d)/i;
  const isAdvanceFee = advanceFeePattern.test(text);

  // Multiplication promise
  const multiPattern = /(duplic[ao]|triplic[ao]|multiplicar|5x|10x|\bx\d+\b|multiplicar\s*tu\s*dinero)/i;
  const isMultiplication = multiPattern.test(lower);

  // Guaranteed / no risk
  const guaranteedPattern = /(garantizado|garantizad[ao]|riesgo\s*cero|sin\s*riesgo|100%\s*seguro|infalible)/i;
  const isGuaranteed = guaranteedPattern.test(lower);

  // No financial content at all
  const hasFinancialContext = /(invert[íi][r]?|inversi[oó]n|invertir|ganancia|rentabilidad|inter[eé]s|tasa|rendimiento|pr[eé]stamo|financiaci[oó]n|\$\s*\d|pesos\b|retorno)/i.test(text);

  if (!hasFinancialContext && !isAdvanceFee) {
    return {
      hasFinancialClaim: false,
      hasMathInconsistency: false,
      severity: 'none',
      claim: { initialAmount: null, annualRatePercent: null, promisedAmount: null, timeframeDays: null, timeframeMonths: null, timeframeYears: null, isAdvanceFee: false, isMultiplication: false, isGuaranteed: false },
      expectedAmount: null,
      discrepancyFactor: null,
      explanation: '',
      risks: [],
      recommendations: []
    };
  }

  // Advance fee — no math needed, always extreme
  if (isAdvanceFee) {
    return {
      hasFinancialClaim: true,
      hasMathInconsistency: true,
      severity: 'extreme',
      claim: { initialAmount: null, annualRatePercent: null, promisedAmount: null, timeframeDays: null, timeframeMonths: null, timeframeYears: null, isAdvanceFee: true, isMultiplication: false, isGuaranteed: false },
      expectedAmount: null,
      discrepancyFactor: null,
      explanation: 'Patrón detectado: "ganaste un premio / solo tenés que pagar para recibirlo". Este es un esquema conocido de estafa por anticipo (advance fee).',
      risks: [
        'Estafa clásica de anticipo: el premio o beneficio no existe.',
        'Una vez pagado el anticipo, el beneficio nunca se entrega.',
        'Los montos pedidos pueden escalar con excusas adicionales.'
      ],
      recommendations: [
        'No realizar ningún pago.',
        'Los premios legítimos no requieren pago previo para recibirlos.',
        'Consultar con el organismo oficial si la empresa o sorteo existe.'
      ]
    };
  }

  // Extract financial data
  const initialAmount = extractMoney(text);
  const annualRate = extractAnnualRate(text);
  const timeframe = extractTimeframe(text);
  const promisedAmount = extractPromisedAmount(text, initialAmount);

  const claim: FinancialClaim = {
    initialAmount,
    annualRatePercent: annualRate,
    promisedAmount,
    timeframeDays: timeframe.days,
    timeframeMonths: timeframe.months,
    timeframeYears: timeframe.years,
    isAdvanceFee: false,
    isMultiplication,
    isGuaranteed
  };

  // Math validation: only when we have all three components
  if (initialAmount !== null && annualRate !== null && promisedAmount !== null &&
      (timeframe.days !== null || timeframe.months !== null || timeframe.years !== null)) {
    const expected = calculateExpected(initialAmount, annualRate, timeframe.days, timeframe.months, timeframe.years);
    const factor = promisedAmount / expected;

    if (factor >= 2.5) {
      const periodLabel = timeframe.days !== null ? `${timeframe.days} días` : timeframe.months !== null ? `${timeframe.months} meses` : `${timeframe.years} años`;
      const expectedRounded = Math.round(expected);
      const annualEarning = Math.round(initialAmount * annualRate / 100);

      const explanation =
        `La promesa contradice la matemática financiera declarada. ` +
        `Un ${annualRate}% anual sobre $${initialAmount.toLocaleString('es-AR')} equivale a $${annualEarning.toLocaleString('es-AR')} por año; ` +
        `en ${periodLabel} serían aproximadamente $${expectedRounded.toLocaleString('es-AR')}, no $${promisedAmount.toLocaleString('es-AR')}.`;

      // factor >= 4 = extreme (catches 4.98x = ~5x as extreme)
      const severity: 'extreme' | 'high' = factor >= 4 ? 'extreme' : 'high';

      return {
        hasFinancialClaim: true,
        hasMathInconsistency: true,
        severity,
        claim,
        expectedAmount: expectedRounded,
        discrepancyFactor: Math.round(factor * 10) / 10,
        explanation,
        risks: [
          'Promesa de rentabilidad incompatible con la tasa informada.',
          'Retorno extraordinario en plazo muy corto.',
          'Inconsistencia matemática grave entre tasa declarada y resultado prometido.'
        ],
        recommendations: [
          'No avanzar sin verificar entidad, contrato, regulación y cálculo real.',
          'Consultar fuentes oficiales como CNV, BCRA o el organismo regulador correspondiente.',
          'Pedir el cálculo detallado y la documentación contractual antes de invertir.'
        ]
      };
    }

    // Math is consistent
    return {
      hasFinancialClaim: true,
      hasMathInconsistency: false,
      severity: 'none',
      claim,
      expectedAmount: Math.round(expected),
      discrepancyFactor: Math.round(factor * 10) / 10,
      explanation: `La proyección financiera es matemáticamente coherente con la tasa declarada.`,
      risks: [],
      recommendations: []
    };
  }

  // Has financial context but incomplete data — check for soft red flags
  if (isMultiplication || isGuaranteed) {
    return {
      hasFinancialClaim: true,
      hasMathInconsistency: true,
      severity: 'high',
      claim,
      expectedAmount: null,
      discrepancyFactor: null,
      explanation: isGuaranteed
        ? 'La promesa de rentabilidad garantizada o riesgo cero es una señal de alarma financiera; toda inversión tiene riesgo.'
        : 'La promesa de multiplicar dinero en poco tiempo sin detalle de tasa o mecanismo es una señal de alarma.',
      risks: [
        isGuaranteed ? 'Ninguna inversión legítima puede garantizar retornos sin riesgo.' : 'Multiplicación de capital sin explicación de mecanismo es señal de fraude.',
        'Falta de información sobre tasa real, plazo y condiciones contractuales.'
      ],
      recommendations: [
        'Pedir documentación del mecanismo de inversión y tasa real.',
        'Verificar que la entidad esté registrada en el organismo regulador.'
      ]
    };
  }

  return {
    hasFinancialClaim: true,
    hasMathInconsistency: false,
    severity: 'none',
    claim,
    expectedAmount: null,
    discrepancyFactor: null,
    explanation: '',
    risks: [],
    recommendations: []
  };
}
