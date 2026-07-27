import type { ExtractedBalance } from '../domain/dossier';

function normalizedNumber(raw: string): number | null {
  const negativeParentheses = /\(.*\)/.test(raw);
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const decimalComma = cleaned.includes(',') && (!cleaned.includes('.') || cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.'));
  const thousandsDots = !cleaned.includes(',') && /^\-?\d{1,3}(?:\.\d{3})+$/.test(cleaned);
  const canonical = decimalComma
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : thousandsDots ? cleaned.replace(/\./g, '') : cleaned.replace(/,/g, '');
  const value = Number(canonical);
  return Number.isFinite(value) ? (negativeParentheses ? -Math.abs(value) : value) : null;
}

function findAmount(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const expression = new RegExp(label, 'gi');
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = expression.exec(text))) {
      let tail = text.slice(expression.lastIndex, expression.lastIndex + 180);
      tail = tail.replace(/^\s*(?:\((?!\s*-?\d[\d.,]*\s*\))[^)]*\)\s*)+/, '');
      const candidates = [...tail.matchAll(/\(?-?\d[\d.,]*\)?/g)]
        .slice(0, 6)
        .map(match => normalizedNumber(match[0]))
        .filter((value): value is number => value !== null);
      // En balances escaneados suelen aparecer antes del importe el día de
      // cierre, el número de nota o el ejercicio. Priorizamos el primer valor
      // monetario material y sólo usamos el primero como último recurso.
      const material = candidates.find(value => Math.abs(value) >= 1000);
      if (material !== undefined) return material;
      if (candidates.length) return candidates[0];
    }
  }
  return null;
}

function sumFirstAmounts(text: string, label: string, maximum: number): number | null {
  const expression = new RegExp(label, 'gi');
  const values: number[] = [];
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = expression.exec(text)) && values.length < maximum) {
    let tail = text.slice(expression.lastIndex, expression.lastIndex + 180);
    tail = tail.replace(/^\s*(?:\((?!\s*-?\d[\d.,]*\s*\))[^)]*\)\s*)+/, '');
    const amountMatch = tail.match(/^[^\d(+-]{0,25}(\(?-?\d[\d.,]*\)?)/);
    const value = amountMatch?.[1] ? normalizedNumber(amountMatch[1]) : null;
    if (value !== null) values.push(value);
  }
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function verbalDate(day: string, monthName: string, year: string): string | null {
  const month = monthNames.indexOf(monthName.toLowerCase()) + 1;
  return month ? `${day.padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` : null;
}

function monthsBetween(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null;
  const [startDay, startMonth, startYear] = startDate.split('/').map(Number);
  const [endDay, endMonth, endYear] = endDate.split('/').map(Number);
  if (![startDay, startMonth, startYear, endDay, endMonth, endYear].every(Number.isFinite)) return null;
  const months = (endYear - startYear) * 12 + endMonth - startMonth + 1;
  return months > 0 && months <= 24 ? months : null;
}

function normalizeAccountingOcrText(text: string): string {
  return text
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])-\s*\n\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, '$1$2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bactiv[0o]\b/gi, 'activo')
    .replace(/\bpasiv[0o]\b/gi, 'pasivo')
    .replace(/\bpatrimon(?:l|i0|lo)\s+net[0o]\b/gi, 'patrimonio neto')
    .replace(/\bcorr(?:l|i)ente\b/gi, 'corriente')
    .replace(/\bresultad[0o]\b/gi, 'resultado')
    .replace(/\bvent[a4]s\b/gi, 'ventas')
    .replace(/\bdeud[a4]s\b/gi, 'deudas')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractBalanceData(text: string): ExtractedBalance {
  const sourceCompact = text.replace(/\s+/g, ' ');
  const compact = normalizeAccountingOcrText(text);
  const numericClosingDate = compact.match(/(?:fecha de cierre|ejercicio finalizado el|finalizado el|cerrado al|estados contables al)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i)?.[1];
  const verbalClosingDate = compact.match(/(?:ejercicio finalizado el|finalizado el|cerrado al|estados contables al|\bal)\s*[:\-]?\s*(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i);
  const closingDate = numericClosingDate || (verbalClosingDate
    ? verbalDate(verbalClosingDate[1], verbalClosingDate[2], verbalClosingDate[3])
    : null);
  const verbalStartDate = compact.match(/(?:iniciado el|iniciado en)\s*(\d{1,2})?[°º]?\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/i);
  const numericStartDate = compact.match(/(?:iniciado el|desde el)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i)?.[1] || null;
  const periodStartDate = numericStartDate || (verbalStartDate
    ? verbalDate(verbalStartDate[1] || '1', verbalStartDate[2], verbalStartDate[3])
    : null);
  const statedMonthsMatch = compact.match(/per[ií]odo intermedio de\s+(tres|seis|nueve|doce|3|6|9|12)\s+meses/i);
  const statedMonths = statedMonthsMatch
    ? ({ tres: 3, seis: 6, nueve: 9, doce: 12 }[statedMonthsMatch[1].toLowerCase()] || Number(statedMonthsMatch[1]))
    : null;
  const statementKind = /per[ií]odo(?:s)? intermedio|estados contables trimestrales/i.test(compact)
    ? 'interim'
    : /ejercicio anual|ejercicio econ[oó]mico|por el ejercicio (?:iniciado|finalizado)/i.test(compact) ? 'annual' : 'unknown';
  const periodMonths = statedMonths || monthsBetween(periodStartDate, closingDate)
    || (statementKind === 'annual' ? 12 : null);
  const amountScale: 1 | 1000 | 1000000 = /(?:importes |cifras )?expresad[oa]s? en millones/i.test(compact) ? 1000000
    : /(?:importes |cifras )?expresad[oa]s? en miles/i.test(compact) ? 1000 : 1;
  const result: ExtractedBalance = {
    activity: sourceCompact.match(/actividad principal\s*:\s*([^$]{3,120}?)(?=\s+(?:CUIT|domicilio|fecha|duraci[oó]n|inscripci[oó]n|n[°º]?de inscripci[oó]n|$))/i)?.[1]?.trim() || null,
    closingDate,
    periodStartDate,
    periodMonths,
    statementKind,
    currencyBasis: /moneda homog[eé]nea|poder adquisitivo|reexpresad/i.test(compact) ? 'homogeneous'
      : /moneda nominal|valores nominales/i.test(compact) ? 'nominal' : 'unknown',
    amountScale,
    statementScope: /estados? (?:contables |financieros )?consolidados?/i.test(compact) ? 'consolidated'
      : /estados? (?:contables |financieros )?separados?/i.test(compact) ? 'separate'
        : /estados? (?:contables |financieros )?individuales?/i.test(compact) ? 'individual' : 'unknown',
    assuranceLevel: /informe de revisi[oó]n (?:del )?auditor|revisi[oó]n de estados contables de per[ií]odos intermedios/i.test(compact)
      ? 'limited-review'
      : /informe (?:del )?auditor independiente|estados contables auditados/i.test(compact) ? 'audit' : 'unknown',
    currentAssets: findAmount(compact, ['total(?: del| de)? activo corriente', 'activo corriente']),
    nonCurrentAssets: findAmount(compact, ['total(?: del| de)? activo no corriente', 'activo no corriente']),
    currentLiabilities: findAmount(compact, ['total(?: del| de)? pasivo corriente', 'pasivo corriente']),
    nonCurrentLiabilities: findAmount(compact, ['total(?: del| de)? pasivo no corriente', 'pasivo no corriente']),
    equity: findAmount(compact, ['patrimonio neto\\s+seg[uú]n estado respectivo y nota\\s*[\\d.]+', 'patrimonio neto']),
    sales: findAmount(compact, ['ventas netas de bienes y servicios', 'ingresos netos operativos', 'ingresos por productos', 'ingresos por servicios', 'ventas netas', 'ingresos por ventas', 'ventas']),
    grossProfit: findAmount(compact, ['resultado bruto', 'ganancia bruta', 'utilidad bruta']),
    operatingProfit: findAmount(compact, ['resultado operativo', 'ganancia operativa']),
    netProfit: (() => {
      const loss = findAmount(compact, ['p[eé]rdida final del ejercicio', 'resultado final:\\s*p[eé]rdida\\)?', 'p[eé]rdida del ejercicio']);
      if (loss != null) return -Math.abs(loss);
      return findAmount(compact, ['resultado neto del ejercicio', 'resultado del per[ií]odo', 'resultado neto', 'ganancia \\(p[eé]rdida\\) del ejercicio', 'ganancia del ejercicio']);
    })(),
    financialDebt: sumFirstAmounts(compact, 'pr[eé]stamos y otros pasivos financieros', 2)
      ?? sumFirstAmounts(compact, 'deudas financieras', 2)
      ?? findAmount(compact, ['préstamos bancarios', 'deuda bancaria']),
    cash: findAmount(compact, ['caja y bancos', 'disponibilidades', 'efectivo y equivalentes']),
    inventory: findAmount(compact, ['bienes de cambio', 'inventarios']),
    tradeReceivables: findAmount(compact, ['cr[eé]ditos comerciales', 'cr[eé]ditos por ventas', 'cuentas por cobrar comerciales', 'deudores por ventas']),
    costOfSales: findAmount(compact, ['costo de los bienes vendidos y servicios prestados', 'costo de bienes vendidos y servicios prestados', 'costo de ventas', 'costo de la mercader[ií]a\\s*v?\\s*endida', 'costo de mercader[ií]as vendidas', 'costo de servicios prestados']),
    interestExpense: findAmount(compact, ['intereses perdidos', 'intereses y gastos financieros', 'costos financieros', 'gastos financieros']),
    depreciationAndAmortization: findAmount(compact, ['depreciaciones y amortizaciones', 'depreciaci[oó]n(?: de)? bienes de uso', 'amortizaciones']),
    totalAssets: findAmount(compact, ['total(?: del)? activo(?!\\s+(?:corriente|no corriente))']),
    totalLiabilities: findAmount(compact, ['total(?: del)? pasivo(?!\\s+(?:corriente|no corriente|y patrimonio))']),
    ebitda: findAmount(compact, ['ebitda', 'resultado antes de intereses, impuestos, depreciaciones y amortizaciones']),
    extractionConfidence: 0,
    missingFields: [],
  };
  if (amountScale !== 1) {
    const monetaryFields = [
      'currentAssets', 'nonCurrentAssets', 'currentLiabilities', 'nonCurrentLiabilities', 'equity',
      'sales', 'grossProfit', 'operatingProfit', 'netProfit', 'financialDebt', 'cash', 'inventory',
      'tradeReceivables', 'costOfSales', 'interestExpense', 'depreciationAndAmortization',
      'totalAssets', 'totalLiabilities', 'ebitda',
    ] as const;
    for (const field of monetaryFields) {
      const value = result[field];
      if (typeof value === 'number') result[field] = value * amountScale;
    }
  }
  const required: Array<keyof ExtractedBalance> = [
    'currentAssets', 'currentLiabilities', 'equity', 'sales', 'netProfit',
  ];
  result.missingFields = required.filter((field) => result[field] === null).map(String);
  result.extractionConfidence = Math.round(((required.length - result.missingFields.length) / required.length) * 100);
  return result;
}
