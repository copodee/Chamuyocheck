export type ExtractedFinancialDebt = {
  asOfDate: string | null;
  totalOutstanding: number | null;
  monthlyDebtService: number | null;
  monthlyDebtServiceBasis: 'explicit' | 'portfolio-estimate' | 'missing';
  currencySummaries: Array<{
    currency: 'ARS' | 'USD';
    capital: number;
    weightedDurationYears: number | null;
    weightedAnnualRate: number | null;
    estimatedMonthlyService: number | null;
  }>;
  creditorEntities: string[];
  lineBalances: number[];
  confidence: number;
  warnings: string[];
};

function amount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const commaDecimal = cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.');
  const thousandsDots = !cleaned.includes(',') && /^\d{1,3}(?:\.\d{3})+$/.test(cleaned);
  const canonical = commaDecimal
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : thousandsDots ? cleaned.replace(/\./g, '') : cleaned.replace(/,/g, '');
  const value = Number(canonical);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function scaledAmount(raw: string, scale = ''): number | null {
  const value = amount(raw);
  if (value == null) return null;
  return value * (/MM/i.test(scale) ? 1_000_000 : /M\b/i.test(scale) ? 1_000 : 1);
}

function explicitAmount(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[:\\-]?\\s*\\$?\\s*([\\d.,]+)`, 'i'));
    const value = match?.[1] ? amount(match[1]) : null;
    if (value != null) return value;
  }
  return null;
}

export function extractFinancialDebt(text: string): ExtractedFinancialDebt {
  const normalized = text.replace(/\u00a0/g, ' ');
  const asOfDate = normalized.match(/(?:informaci[oó]n al|operaciones vigentes al|reporte con informaci[oó]n al)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] || null;
  const currencySummaries: ExtractedFinancialDebt['currencySummaries'] = [];
  const summaryPattern = /TOTAL\s+(ARS|USD)\s+([\d.,]+)\s*(MM|M)?\s+100[,.]00%\s+([\d.,]+)\s+([\d.,]+)%/gi;
  let summaryMatch: RegExpExecArray | null;
  while ((summaryMatch = summaryPattern.exec(normalized))) {
    const capital = scaledAmount(summaryMatch[2], summaryMatch[3] || '');
    const duration = amount(summaryMatch[4]);
    const annualRate = amount(summaryMatch[5]);
    if (capital == null) continue;
    const durationMonths = duration && duration > 0 ? duration * 12 : null;
    const estimatedMonthlyService = durationMonths
      ? capital / durationMonths + capital * ((annualRate || 0) / 100) / 12
      : null;
    currencySummaries.push({
      currency: summaryMatch[1].toUpperCase() as 'ARS' | 'USD',
      capital,
      weightedDurationYears: duration,
      weightedAnnualRate: annualRate == null ? null : annualRate / 100,
      estimatedMonthlyService,
    });
  }
  const totalOutstanding = explicitAmount(normalized, [
    'total deuda(?: bancaria y financiera)?', 'saldo total(?: vigente| adeudado)?',
    'total saldo(?: adeudado)?', 'deuda financiera total', 'total financiaciones',
  ]);
  const monthlyDebtService = explicitAmount(normalized, [
    'servicio mensual(?: de deuda)?', 'cuota mensual total', 'total cuotas mensuales',
    'compromiso mensual', 'vencimiento mensual',
  ]);
  const debtLines = normalized.split(/\r?\n/).filter(line =>
    (/(saldo|capital).{0,25}(adeudado|pendiente|vigente)|deuda bancaria|pr[eé]stamo|leasing|descubierto/i.test(line))
    && !/total/i.test(line));
  const lineBalances = debtLines.map(line => {
    const values = [...line.matchAll(/\$?\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d{5,}(?:[.,]\d{1,2})?)/g)]
      .map(match => amount(match[1])).filter((value): value is number => value != null);
    return values.at(-1) ?? null;
  }).filter((value): value is number => value != null);
  const arsSummary = currencySummaries.find(item => item.currency === 'ARS');
  const hasForeignCurrency = currencySummaries.some(item => item.currency !== 'ARS' && item.capital > 0);
  const inferredTotal = totalOutstanding
    ?? (!hasForeignCurrency && arsSummary ? arsSummary.capital : null)
    ?? (!currencySummaries.length && lineBalances.length ? lineBalances.reduce((sum, value) => sum + value, 0) : null);
  const entities = new Set<string>();
  for (const line of normalized.split(/\r?\n/)) {
    const named = line.match(/(?:entidad|banco|acreedor)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ .&-]{2,45})/i);
    if (named?.[1]) entities.add(named[1].trim().replace(/\s{2,}.*/, ''));
    for (const match of line.matchAll(/(?:^|\s)\d+\s+(.+?)\s+(?:ARS|USD)\s+[\d.,]+\s+MM/gi)) {
      if (match[1]) entities.add(match[1].trim());
    }
  }
  const warnings: string[] = [];
  if (currencySummaries.length) warnings.push('El servicio mensual por cartera es una estimación basada en capital, plazo promedio y TNA ponderada; no reemplaza el cronograma contractual de vencimientos.');
  if (hasForeignCurrency) warnings.push('Existe deuda en moneda extranjera. Debe indicarse un tipo de cambio de referencia antes de incorporarla al saldo y servicio mensual en pesos.');
  if (totalOutstanding == null && inferredTotal != null) warnings.push('El total se obtuvo sumando saldos identificados; debe verificarse contra el documento.');
  if (inferredTotal == null && !currencySummaries.length) warnings.push('No se identificó un saldo total de deuda.');
  if (monthlyDebtService == null && !currencySummaries.length) warnings.push('El documento no informa claramente el servicio o cuota mensual total.');
  const confidence = Math.min(100,
    (totalOutstanding != null ? 55 : currencySummaries.length ? 50 : inferredTotal != null ? 35 : 0)
    + (monthlyDebtService != null ? 25 : 0)
    + (entities.size ? 20 : 0));
  return {
    asOfDate, totalOutstanding: inferredTotal, monthlyDebtService,
    monthlyDebtServiceBasis: monthlyDebtService != null ? 'explicit'
      : currencySummaries.length ? 'portfolio-estimate' : 'missing',
    currencySummaries, creditorEntities: [...entities], lineBalances, confidence, warnings,
  };
}
