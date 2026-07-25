const monthNumbers: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

function amount(value: string) {
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractMonthlyNetSales(text: string) {
  const compact = text.replace(/\r/g, '');
  const expression = /\b(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sept?(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)[-./\s]*(\d{2,4})\s+([\d.]+,\d{2})/gi;
  const rows: Array<{ period: string; year: number; month: number; netSales: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = expression.exec(compact))) {
    const month = monthNumbers[match[1].toLowerCase()];
    const rawYear = Number(match[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const netSales = amount(match[3]);
    if (!month || year < 2000 || year > 2100 || netSales == null || netSales < 0) continue;
    rows.push({ period: `${year}-${String(month).padStart(2, '0')}`, year, month, netSales });
  }
  return [...new Map(rows.map(row => [row.period, row])).values()].sort((left, right) => left.period.localeCompare(right.period));
}

export function latestSixMonthlySales(text: string) {
  return extractMonthlyNetSales(text).slice(-6).map(row => row.netSales);
}
