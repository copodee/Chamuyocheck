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

