import type { ExtractedBalance } from '../domain/dossier';

function normalizedNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const decimalComma = cleaned.includes(',') && (!cleaned.includes('.') || cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.'));
  const thousandsDots = !cleaned.includes(',') && /^\-?\d{1,3}(?:\.\d{3})+$/.test(cleaned);
  const canonical = decimalComma
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : thousandsDots ? cleaned.replace(/\./g, '') : cleaned.replace(/,/g, '');
  const value = Number(canonical);
  return Number.isFinite(value) ? value : null;
}

function findAmount(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const expression = new RegExp(`${label}\\s*[:\\-]?\\s*[$]?\\s*([\\d.,]+)`, 'i');
    const match = text.match(expression);
    const value = match?.[1] ? normalizedNumber(match[1]) : null;
    if (value !== null) return value;
  }
  return null;
}

export function extractBalanceData(text: string): ExtractedBalance {
  const compact = text.replace(/\s+/g, ' ');
  const closingDate = compact.match(/(?:fecha de cierre|ejercicio finalizado el|cerrado al)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i)?.[1] || null;
  const result: ExtractedBalance = {
    closingDate,
    currentAssets: findAmount(compact, ['activo corriente']),
    nonCurrentAssets: findAmount(compact, ['activo no corriente']),
    currentLiabilities: findAmount(compact, ['pasivo corriente']),
    nonCurrentLiabilities: findAmount(compact, ['pasivo no corriente']),
    equity: findAmount(compact, ['patrimonio neto']),
    sales: findAmount(compact, ['ventas netas', 'ingresos por ventas', 'ventas']),
    grossProfit: findAmount(compact, ['resultado bruto', 'ganancia bruta']),
    operatingProfit: findAmount(compact, ['resultado operativo', 'ganancia operativa']),
    netProfit: findAmount(compact, ['resultado neto', 'ganancia del ejercicio', 'pérdida del ejercicio']),
    financialDebt: findAmount(compact, ['deudas financieras', 'préstamos bancarios', 'deuda bancaria']),
    cash: findAmount(compact, ['caja y bancos', 'disponibilidades', 'efectivo y equivalentes']),
    inventory: findAmount(compact, ['bienes de cambio', 'inventarios']),
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
