function parseArgentineAmount(value: string) {
  const compact = value.replace(/\s/g, '');
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact.replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const parsed = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function labeledAmounts(text: string, labels: string[]) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const label = labels.join('|');
  const expression = new RegExp(`(?:${label})[^\\d]{0,35}(\\d[\\d.\\s]*(?:,\\d{2})?)`, 'gi');
  const values: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = expression.exec(normalized))) {
    const parsed = parseArgentineAmount(match[1]);
    if (parsed != null) values.push(parsed);
  }
  return values;
}

export function extractSalaryNetAmount(text: string) {
  const values = labeledAmounts(text, [
    'neto a cobrar', 'liquido a cobrar', 'total neto', 'remuneracion neta', 'sueldo neto',
  ]);
  return values.length ? values[values.length - 1] : null;
}

export function extractInvoiceTotal(text: string) {
  const values = labeledAmounts(text, [
    'importe total', 'total comprobante', 'total factura', 'total',
  ]);
  return values.length ? Math.max(...values) : null;
}

export type ExtractedInvoice = {
  issuerCuit: string | null;
  receiverCuit: string | null;
  pointOfSale: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  periodKey: string | null;
  total: number | null;
  cae: string | null;
  uniqueKey: string | null;
};

export type InvoiceIncomeAnalysis = {
  invoices: ExtractedInvoice[];
  duplicateCount: number;
  monthlyTotals: Array<{ period: string; total: number; invoiceCount: number }>;
  averageMonthlyIncome: number;
  observedMonths: number;
  warnings: string[];
};

function digits(value: string | undefined) {
  return value?.replace(/\D/g, '') || null;
}

function monthKey(date: string | null) {
  if (!date) return null;
  const [day, month, year] = date.split('/').map(Number);
  return day && month && year ? `${year}-${String(month).padStart(2, '0')}` : null;
}

export function extractInvoiceData(text: string): ExtractedInvoice {
  const original = text.split(/\bDUPLICADO\b/i)[0];
  const pointAndNumber = original.match(/Punto de Venta:\s*(\d+)\s+Comp\.\s*Nro:\s*(\d+)/i);
  const issueDate = original.match(/Fecha de Emisi[oó]n:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] || null;
  const period = original.match(/Per[ií]odo Facturado Desde:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+Hasta:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const cuitMatches = [...original.matchAll(/\bCUIT:\s*(\d{11})\b/gi)].map(match => match[1]);
  const total = extractInvoiceTotal(original);
  const cae = digits(original.match(/CAE\s*N[°º]?:\s*(\d+)/i)?.[1]);
  const issuerCuit = cuitMatches[0] || null;
  const receiverCuit = cuitMatches.find(value => value !== issuerCuit) || null;
  const pointOfSale = digits(pointAndNumber?.[1]);
  const invoiceNumber = digits(pointAndNumber?.[2]);
  const periodFrom = period?.[1] || null;
  const periodTo = period?.[2] || null;
  const uniqueKey = issuerCuit && pointOfSale && invoiceNumber
    ? `${issuerCuit}-${pointOfSale}-${invoiceNumber}`
    : cae;
  return {
    issuerCuit, receiverCuit, pointOfSale, invoiceNumber, issueDate,
    periodFrom, periodTo, periodKey: monthKey(periodFrom || issueDate),
    total, cae, uniqueKey,
  };
}

export function analyzeInvoiceIncome(texts: string[]): InvoiceIncomeAnalysis {
  const unique = new Map<string, ExtractedInvoice>();
  let duplicateCount = 0;
  for (const text of texts) {
    const invoice = extractInvoiceData(text);
    const key = invoice.uniqueKey || `${invoice.issueDate}-${invoice.total}-${unique.size}`;
    if (invoice.uniqueKey && unique.has(key)) {
      duplicateCount += 1;
      continue;
    }
    unique.set(key, invoice);
  }
  const monthMap = new Map<string, { total: number; invoiceCount: number }>();
  for (const invoice of unique.values()) {
    if (!invoice.periodKey || invoice.total == null) continue;
    const current = monthMap.get(invoice.periodKey) || { total: 0, invoiceCount: 0 };
    current.total += invoice.total;
    current.invoiceCount += 1;
    monthMap.set(invoice.periodKey, current);
  }
  const monthlyTotals = [...monthMap.entries()]
    .map(([period, values]) => ({ period, ...values }))
    .sort((left, right) => left.period.localeCompare(right.period))
    .slice(-6);
  const averageMonthlyIncome = monthlyTotals.length
    ? monthlyTotals.reduce((sum, month) => sum + month.total, 0) / monthlyTotals.length
    : 0;
  const warnings: string[] = [];
  if (monthlyTotals.length < 6) warnings.push(`Solo se observaron ${monthlyTotals.length} mes(es); el promedio es preliminar hasta completar seis meses.`);
  if ([...unique.values()].some(invoice => !invoice.periodKey || invoice.total == null)) warnings.push('Alguna factura no permitió identificar período o importe y requiere revisión.');
  return {
    invoices: [...unique.values()], duplicateCount, monthlyTotals,
    averageMonthlyIncome, observedMonths: monthlyTotals.length, warnings,
  };
}
