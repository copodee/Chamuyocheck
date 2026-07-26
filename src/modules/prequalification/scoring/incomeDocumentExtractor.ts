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

export type SalaryReceiptKind = 'regular' | 'sac' | 'retroactive' | 'extraordinary';

export type ExtractedSalaryReceipt = {
  receiptNumber: string | null;
  paymentPeriod: string | null;
  periodKeys: string[];
  paymentDate: string | null;
  netAmount: number | null;
  kind: SalaryReceiptKind;
  earningConcepts: Array<{ code: string; name: string }>;
};

export type SalaryIncomeAnalysis = {
  receipts: ExtractedSalaryReceipt[];
  monthlyTotals: Array<{ period: string; regularNet: number; retroactiveNet: number; totalRecurringNet: number }>;
  regularMonthlyAverage: number;
  sacMonthlyEquivalent: number;
  normalizedMonthlyIncome: number;
  observedRegularMonths: number;
  recurringAdditionalConcepts: string[];
  warnings: string[];
};

const spanishMonths: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function salaryPeriodKeys(value: string | null) {
  if (!value) return [];
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const year = Number(normalized.match(/\b(20\d{2})\b/)?.[1]);
  if (!year) return [];
  return Object.entries(spanishMonths)
    .filter(([name]) => new RegExp(`\\b${name}\\b`, 'i').test(normalized))
    .map(([, month]) => `${year}-${String(month).padStart(2, '0')}`)
    .filter((key, index, values) => values.indexOf(key) === index);
}

export function extractSalaryReceipt(text: string): ExtractedSalaryReceipt {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const paymentPeriod = normalized.match(/Per[ií]odo\s+de\s+pago:\s*([^\r\n]+)/i)?.[1]?.trim() || null;
  const hasSac = /\b(?:SAC|aguinaldo|sueldo\s+anual\s+complementario)\b/i.test(normalized);
  const hasRetroactive = /\b(?:retro(?:activo)?|ajuste\s+salarial|diferencia\s+salarial)\b/i.test(normalized);
  const hasRegularSalary = /\bsueldo\s+mensual\b/i.test(normalized);
  const earningConcepts = [...normalized.matchAll(/^\s*(\d{3})-([A-Z][A-Z .]*?)(?=\s+\d|\s+A[nñ]os:|\s*$)/gim)]
    .map(match => ({ code: match[1], name: match[2].replace(/\s+/g, ' ').trim() }))
    .filter(concept => Number(concept.code) < 700)
    .filter((concept, index, concepts) => concepts.findIndex(item => item.code === concept.code) === index);
  return {
    receiptNumber: normalized.match(/Recibo\s+de\s+Sueldo\s+N[uú]mero:\s*(\d+)/i)?.[1] || null,
    paymentPeriod,
    periodKeys: salaryPeriodKeys(paymentPeriod),
    paymentDate: normalized.match(/\bFecha:\s*(\d{1,2}\/\d{1,2}\/20\d{2})/i)?.[1] || null,
    netAmount: extractSalaryNetAmount(text),
    kind: hasSac ? 'sac' : hasRetroactive ? 'retroactive' : hasRegularSalary ? 'regular' : 'extraordinary',
    earningConcepts,
  };
}

export function analyzeSalaryIncome(texts: string[]): SalaryIncomeAnalysis {
  const receipts = texts.map(extractSalaryReceipt);
  const conceptMonths = new Map<string, Set<string>>();
  for (const receipt of receipts) {
    for (const concept of receipt.earningConcepts) {
      if (concept.code === '311' || /sueldo mensual/i.test(concept.name)) continue;
      const periods = conceptMonths.get(`${concept.code}|${concept.name}`) || new Set<string>();
      receipt.periodKeys.forEach(period => periods.add(period));
      conceptMonths.set(`${concept.code}|${concept.name}`, periods);
    }
  }
  const recurringAdditionalConcepts = [...conceptMonths.entries()]
    .filter(([, periods]) => periods.size >= 2)
    .map(([key]) => key.split('|')[1]);
  const regularMonths = new Map<string, { regularNet: number; retroactiveNet: number }>();
  for (const receipt of receipts.filter(item => item.kind === 'regular' && item.netAmount != null)) {
    const period = receipt.periodKeys[0];
    if (!period) continue;
    const current = regularMonths.get(period) || { regularNet: 0, retroactiveNet: 0 };
    current.regularNet += receipt.netAmount || 0;
    regularMonths.set(period, current);
  }
  for (const receipt of receipts.filter(item => item.kind === 'retroactive' && item.netAmount != null && item.periodKeys.length)) {
    const allocation = (receipt.netAmount || 0) / receipt.periodKeys.length;
    for (const period of receipt.periodKeys) {
      // El retroactivo complementa un mes observado; no convierte un período
      // sin recibo mensual en un mes completo artificialmente bajo.
      const current = regularMonths.get(period);
      if (current) current.retroactiveNet += allocation;
    }
  }
  for (const receipt of receipts.filter(item => item.kind === 'extraordinary' && item.netAmount != null && item.periodKeys.length)) {
    const isRecurring = receipt.earningConcepts.some(concept =>
      recurringAdditionalConcepts.includes(concept.name),
    );
    if (!isRecurring) continue;
    const current = regularMonths.get(receipt.periodKeys[0]);
    if (current) current.retroactiveNet += receipt.netAmount || 0;
  }
  const monthlyTotals = [...regularMonths.entries()]
    .map(([period, values]) => ({ period, ...values, totalRecurringNet: values.regularNet + values.retroactiveNet }))
    .sort((left, right) => left.period.localeCompare(right.period))
    .slice(-6);
  const regularMonthlyAverage = monthlyTotals.length
    ? monthlyTotals.reduce((sum, month) => sum + month.totalRecurringNet, 0) / monthlyTotals.length
    : 0;
  const sacReceipts = receipts.filter(item => item.kind === 'sac' && item.netAmount != null);
  const sacTotal = sacReceipts.reduce((sum, item) => sum + (item.netAmount || 0), 0);
  // Un SAC semestral se prorratea en seis meses. Si se observan los dos SAC
  // del año, se prorratea su suma en doce meses.
  const sacMonthlyEquivalent = sacReceipts.length === 1 ? sacTotal / 6 : sacReceipts.length > 1 ? sacTotal / 12 : 0;
  const warnings: string[] = [];
  if (monthlyTotals.length < 6) warnings.push(`Solo se observaron ${monthlyTotals.length} recibo(s) mensual(es) completos; el promedio es preliminar hasta completar seis meses.`);
  if (receipts.some(item => item.netAmount == null || !item.periodKeys.length)) warnings.push('Algún recibo no permitió identificar período o neto y requiere revisión.');
  if (receipts.some(item => item.kind === 'extraordinary')) warnings.push('Se detectó un comprobante extraordinario que no se incorporó al ingreso mensual recurrente.');
  return {
    receipts,
    monthlyTotals,
    regularMonthlyAverage,
    sacMonthlyEquivalent,
    normalizedMonthlyIncome: regularMonthlyAverage + sacMonthlyEquivalent,
    observedRegularMonths: monthlyTotals.length,
    recurringAdditionalConcepts,
    warnings,
  };
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
