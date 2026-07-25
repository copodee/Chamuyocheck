export type ExtractedFinancialDebt = {
  totalOutstanding: number | null;
  monthlyDebtService: number | null;
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
  const inferredTotal = totalOutstanding ?? (lineBalances.length ? lineBalances.reduce((sum, value) => sum + value, 0) : null);
  const entities = new Set<string>();
  for (const line of normalized.split(/\r?\n/)) {
    const named = line.match(/(?:entidad|banco|acreedor)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ .&-]{2,45})/i);
    if (named?.[1]) entities.add(named[1].trim().replace(/\s{2,}.*/, ''));
  }
  const warnings: string[] = [];
  if (totalOutstanding == null && inferredTotal != null) warnings.push('El total se obtuvo sumando saldos identificados; debe verificarse contra el documento.');
  if (inferredTotal == null) warnings.push('No se identificó un saldo total de deuda.');
  if (monthlyDebtService == null) warnings.push('El documento no informa claramente el servicio o cuota mensual total.');
  const confidence = Math.min(100,
    (totalOutstanding != null ? 55 : inferredTotal != null ? 35 : 0)
    + (monthlyDebtService != null ? 25 : 0)
    + (entities.size ? 20 : 0));
  return { totalOutstanding: inferredTotal, monthlyDebtService, creditorEntities: [...entities], lineBalances, confidence, warnings };
}
