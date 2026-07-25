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
      const amountMatch = tail.match(/^[^\d(+-]{0,25}(\(?-?\d[\d.,]*\)?)/);
      const value = amountMatch?.[1] ? normalizedNumber(amountMatch[1]) : null;
      if (value !== null) return value;
    }
  }
  return null;
}

export function extractBalanceData(text: string): ExtractedBalance {
  const compact = text.replace(/\s+/g, ' ');
  const numericClosingDate = compact.match(/(?:fecha de cierre|ejercicio finalizado el|cerrado al|estados contables al)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i)?.[1];
  const verbalClosingDate = compact.match(/(?:ejercicio finalizado el|cerrado al|estados contables al|\bal)\s*[:\-]?\s*(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i);
  const month = verbalClosingDate ? ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'].indexOf(verbalClosingDate[2].toLowerCase()) + 1 : 0;
  const closingDate = numericClosingDate || (verbalClosingDate && month
    ? `${verbalClosingDate[1].padStart(2, '0')}/${String(month).padStart(2, '0')}/${verbalClosingDate[3]}`
    : null);
  const result: ExtractedBalance = {
    closingDate,
    currentAssets: findAmount(compact, ['activo corriente']),
    nonCurrentAssets: findAmount(compact, ['activo no corriente']),
    currentLiabilities: findAmount(compact, ['pasivo corriente']),
    nonCurrentLiabilities: findAmount(compact, ['pasivo no corriente']),
    equity: findAmount(compact, ['patrimonio neto']),
    sales: findAmount(compact, ['ventas netas', 'ingresos por ventas', 'ventas']),
    grossProfit: findAmount(compact, ['resultado bruto', 'ganancia bruta', 'utilidad bruta']),
    operatingProfit: findAmount(compact, ['resultado operativo', 'ganancia operativa']),
    netProfit: findAmount(compact, ['resultado neto del ejercicio', 'resultado neto', 'ganancia del ejercicio', 'p[eé]rdida del ejercicio']),
    financialDebt: findAmount(compact, ['deudas financieras', 'préstamos bancarios', 'deuda bancaria']),
    cash: findAmount(compact, ['caja y bancos', 'disponibilidades', 'efectivo y equivalentes']),
    inventory: findAmount(compact, ['bienes de cambio', 'inventarios']),
    tradeReceivables: findAmount(compact, ['cr[eé]ditos comerciales', 'cr[eé]ditos por ventas', 'cuentas por cobrar comerciales', 'deudores por ventas']),
    costOfSales: findAmount(compact, ['costo de ventas', 'costo de la mercader[ií]a\\s*v?\\s*endida', 'costo de mercader[ií]as vendidas', 'costo de servicios prestados']),
    interestExpense: findAmount(compact, ['intereses perdidos', 'intereses y gastos financieros', 'costos financieros', 'gastos financieros']),
    depreciationAndAmortization: findAmount(compact, ['depreciaciones y amortizaciones', 'depreciaci[oó]n(?: de)? bienes de uso', 'amortizaciones']),
    totalAssets: findAmount(compact, ['total del activo', 'total activo']),
    totalLiabilities: findAmount(compact, ['total del pasivo', 'total pasivo']),
    ebitda: findAmount(compact, ['ebitda', 'resultado antes de intereses, impuestos, depreciaciones y amortizaciones']),
    extractionConfidence: 0,
    missingFields: [],
  };
  const required: Array<keyof ExtractedBalance> = [
    'currentAssets', 'currentLiabilities', 'equity', 'sales', 'netProfit',
  ];
  result.missingFields = required.filter((field) => result[field] === null).map(String);
  result.extractionConfidence = Math.round(((required.length - result.missingFields.length) / required.length) * 100);
  return result;
}
