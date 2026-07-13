export type LoanNumbers = {
  cashPrice: number | null;
  principal: number | null;
  downPayment: number | null;
  installment: number | null;
  months: number | null;
  tnaPercent: number | null;
  teaPercent: number | null;
  cftPercent: number | null;
  statedTotal: number | null;
  calculatedInstallmentsTotal: number | null;
  calculatedKnownTotal: number | null;
  financingCost: number | null;
  financingCostPercent: number | null;
  impliedMonthlyRatePercent: number | null;
  impliedTeaPercent: number | null;
  missingFields: string[];
  warnings: string[];
  evidence: string[];
  calculationBasis: string[];
  confidence: 'alta' | 'media' | 'baja';
};

function parseLocaleNumber(raw: string): number | null {
  let value = raw.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!value) return null;
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma > lastDot) value = value.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && /,/.test(value)) value = value.replace(/,/g, '');
  else if ((value.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(value)) value = value.replace(/\./g, '');
  else if ((value.match(/,/g) || []).length > 1 || /,\d{3}$/.test(value)) value = value.replace(/,/g, '');
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function labeledMoney(text: string, labels: string[]): number | null {
  const amount = '([\\d]{1,3}(?:[. ][\\d]{3})+(?:,[\\d]{1,2})?|[\\d]+(?:,[\\d]{1,2})?)';
  for (const label of labels) {
    const after = text.match(new RegExp(`(?:${label})[ \\t]*(?:de|:|=)?[ \\t]*(?:ARS|\\$)?[ \\t]*${amount}`, 'i'));
    const before = text.match(new RegExp(`(?:ARS|\\$)[ \\t]*${amount}[ \\t]*(?:${label})`, 'i'));
    const value = parseLocaleNumber(after?.[1] || before?.[1] || '');
    if (value !== null) return value;
  }
  return null;
}

function labeledPercent(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:${label})\\s*(?:de|:|=)?\\s*([\\d.,]+)\\s*%`, 'i'))
      || text.match(new RegExp(`([\\d.,]+)\\s*%\\s*(?:${label})`, 'i'));
    const value = parseLocaleNumber(match?.[1] || '');
    if (value !== null && value >= 0 && value < 10_000) return value;
  }
  return null;
}

function acronymPercent(text: string, acronym: 'TNA' | 'TEA' | 'CFT'): number | null {
  const pattern = acronym === 'CFT'
    ? /\b(?:CFTEAV|CFTEA|CFTNAV|CFTNA|CFT)\b[).:\s-]*(?:con\s+IVA)?\s*(?:de|:|=)?\s*([\d.,]+)\s*%/i
    : new RegExp(`\\b${acronym}V?\\b[).:\\s-]*(?:de|:|=|fija)?\\s*([\\d.,]+)\\s*%`, 'i');
  return parseLocaleNumber(text.match(pattern)?.[1] || '');
}

function allAcronymPercents(text: string, acronym: 'TNA' | 'TEA' | 'CFT'): number[] {
  const source = acronym === 'CFT'
    ? '\\b(?:CFTEAV|CFTEA|CFTNAV|CFTNA|CFT)\\b[).:\\s-]*(?:con\\s+IVA)?\\s*(?:de|:|=)?\\s*([\\d.,]+)\\s*%'
    : `\\b${acronym}V?\\b[).:\\s-]*(?:de|:|=|fija)?\\s*([\\d.,]+)\\s*%`;
  return [...text.matchAll(new RegExp(source, 'gi'))]
    .map((match) => parseLocaleNumber(match[1] || ''))
    .filter((value): value is number => value !== null)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function solveMonthlyRate(principal: number, payment: number, periods: number): number | null {
  if (principal <= 0 || payment <= 0 || periods <= 0 || payment * periods <= principal) return null;
  let low = 0;
  let high = 2;
  for (let index = 0; index < 120; index += 1) {
    const rate = (low + high) / 2;
    const presentValue = payment * (1 - Math.pow(1 + rate, -periods)) / rate;
    if (presentValue > principal) low = rate; else high = rate;
  }
  return (low + high) / 2;
}

function argentinaDate(raw: string): Date | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const value = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59));
  return Number.isNaN(value.getTime()) ? null : value;
}

export function extractLoanNumbers(text: string): LoanNumbers {
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/\bT\.?\s*N\.?\s*A\.?\s*V?\.?/gi, 'TNAV')
    .replace(/\bT\.?\s*E\.?\s*A\.?\s*V?\.?/gi, 'TEAV')
    .replace(/\bC\.?\s*F\.?\s*T\.?\s*(?:E\.?\s*A\.?\s*V?\.?)?/gi, (value) => /E/i.test(value) ? 'CFTEAV' : 'CFT')
    .replace(/[ \t]+/g, ' ');
  const cashPrice = labeledMoney(normalized, ['precio\\s+de\\s+contado', 'precio\\s+final', 'valor\\s+del\\s+veh[ií]culo']);
  const downPayment = labeledMoney(normalized, ['anticipo', 'entrega\\s+inicial', 'pago\\s+inicial']);
  const principalExample = normalized.match(/(?:pr[eé]stamo|cr[eé]dito)(?:\s+(?:personal|prendario))?\s+de[ \t]*(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const principal = labeledMoney(normalized, ['monto\\s+(?:del\\s+)?(?:pr[eé]stamo|cr[eé]dito)', 'monto\\s+financiad[oa]', 'importe\\s+financiad[oa]'])
    ?? parseLocaleNumber(principalExample?.[1] || '');
  const installmentFromSeries = normalized.match(/\d{1,3}[ \t]*cuotas[ \t]*(?:iguales[ \t]*)?(?:de|a|:)?[ \t]*(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const disclosedInstallment = normalized.match(/(?:cuota\s+total|primera\s+cuota)[^$\n]{0,180}(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const installment = labeledMoney(normalized, ['valor\\s+(?:de\\s+(?:la\\s+)?)?cuota', 'cuota\\s+(?:mensual|promedio|inicial)', 'cada\\s+cuota'])
    ?? parseLocaleNumber(installmentFromSeries?.[1] || '')
    ?? parseLocaleNumber(disclosedInstallment?.[1] || '');
  const statedTotal = labeledMoney(normalized, ['monto\\s+total\\s+(?:a\\s+)?pagar', 'total\\s+(?:a\\s+)?pagar', 'precio\\s+financiado']);
  const countMatch = normalized.match(/(?:cantidad\s+de\s+cuotas|plazo|en)\s*(?:de|:|=)?\s*(\d{1,3})\s*(?:cuotas|meses)/i)
    || normalized.match(/(\d{1,3})\s*(?:cuotas|meses)/i);
  const months = countMatch ? Number(countMatch[1]) : null;
  const tnaPercent = acronymPercent(normalized, 'TNA') ?? labeledPercent(normalized, ['tasa\\s+nominal\\s+anual']);
  const teaPercent = acronymPercent(normalized, 'TEA') ?? labeledPercent(normalized, ['tasa\\s+efectiva\\s+anual']);
  const cftPercent = acronymPercent(normalized, 'CFT') ?? labeledPercent(normalized, ['costo\\s+financiero\\s+total']);

  const calculatedInstallmentsTotal = installment !== null && months !== null ? installment * months : null;
  const calculatedKnownTotal = calculatedInstallmentsTotal !== null
    ? calculatedInstallmentsTotal + (downPayment || 0)
    : statedTotal;
  const financedBase = principal ?? (cashPrice !== null ? Math.max(0, cashPrice - (downPayment || 0)) : null);
  const financingCost = calculatedInstallmentsTotal !== null && financedBase !== null
    ? calculatedInstallmentsTotal - financedBase
    : null;
  const financingCostPercent = financingCost !== null && financedBase && financedBase > 0
    ? financingCost / financedBase * 100
    : null;
  const impliedMonthlyRate = financedBase && installment && months ? solveMonthlyRate(financedBase, installment, months) : null;
  const impliedTea = impliedMonthlyRate !== null ? (Math.pow(1 + impliedMonthlyRate, 12) - 1) * 100 : null;

  const missingFields: string[] = [];
  if (financedBase === null) missingFields.push('monto financiado o precio de contado y anticipo');
  if (installment === null) missingFields.push('importe de cada cuota');
  if (months === null) missingFields.push('cantidad de cuotas');
  if (cftPercent === null) missingFields.push('CFT');
  const warnings: string[] = [];
  const rateOptions = [allAcronymPercents(normalized, 'TNA'), allAcronymPercents(normalized, 'TEA'), allAcronymPercents(normalized, 'CFT')];
  if (rateOptions.some((values) => values.length > 1)) warnings.push('La página publica más de una tasa o CFT para perfiles de cliente diferentes; no deben combinarse entre sí y hay que identificar qué condición corresponde al solicitante.');
  if (cftPercent === null) warnings.push('Sin CFT no puede afirmarse que el costo informado incluya todos los cargos, impuestos y seguros.');
  if (/seguro/i.test(normalized) && !/(seguro[^.\n]{0,50}(?:sin\s+costo|bonificad[oa]|(?:\$|ARS)\s*[\d.,]+))/i.test(normalized)) warnings.push('Se menciona un seguro, pero no se identificó su importe.');
  if (/(?:primera\s+cuota|cuota\s+(?:inicial|desde)|cuota\s+total[^.\n]{0,180}primer\s+per[ií]odo)[^.\n]{0,180}(?:\$|ARS)\s*[\d.,]+/i.test(normalized)) warnings.push('La cuota publicada corresponde a una cuota inicial o período particular y podría variar durante el plazo.');
  const validity = normalized.match(/(?:tasas?\s+)?vigentes?\s+del\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const validityEnd = argentinaDate(validity?.[2] || '');
  if (validityEnd && validityEnd.getTime() < Date.now()) warnings.push(`Las tasas publicadas indican vigencia hasta el ${validity?.[2]}; deben confirmarse valores actuales antes de contratar.`);
  if (statedTotal !== null && calculatedKnownTotal !== null && Math.abs(statedTotal - calculatedKnownTotal) > Math.max(100, statedTotal * 0.01)) warnings.push('El total declarado no coincide con la suma de las cuotas y el anticipo extraídos.');
  const annualComparisonRate = cftPercent ?? teaPercent;
  if (annualComparisonRate !== null && impliedTea !== null && Math.abs(annualComparisonRate - impliedTea) > Math.max(3, annualComparisonRate * 0.08)) warnings.push(`La tasa anual implícita de las cuotas no coincide con el ${cftPercent !== null ? 'CFT' : 'TEA'} declarado; pueden existir cargos, seguros o cuotas variables.`);

  const evidence = [
    cashPrice !== null ? `Precio de contado: $${cashPrice.toLocaleString('es-AR')}` : '',
    principal !== null ? `Monto financiado declarado: $${principal.toLocaleString('es-AR')}` : '',
    downPayment !== null ? `Anticipo: $${downPayment.toLocaleString('es-AR')}` : '',
    installment !== null ? `Cuota: $${installment.toLocaleString('es-AR')}` : '',
    months !== null ? `Plazo: ${months} cuotas/meses` : '',
    tnaPercent !== null ? `TNA: ${tnaPercent}%` : '',
    teaPercent !== null ? `TEA: ${teaPercent}%` : '',
    cftPercent !== null ? `CFT: ${cftPercent}%` : '',
    validity ? `Vigencia informada: ${validity[1]} a ${validity[2]}` : '',
  ].filter(Boolean);
  const calculationBasis = [
    calculatedInstallmentsTotal !== null ? `${months} × $${installment?.toLocaleString('es-AR')} = $${calculatedInstallmentsTotal.toLocaleString('es-AR')} en cuotas.` : '',
    calculatedKnownTotal !== null && downPayment !== null ? `Anticipo + cuotas = $${calculatedKnownTotal.toLocaleString('es-AR')}.` : '',
    financingCost !== null ? `Costo nominal conocido sobre el monto financiado: $${financingCost.toLocaleString('es-AR')} (${financingCostPercent?.toFixed(2)}%).` : '',
    impliedMonthlyRate !== null ? `Tasa mensual implícita aproximada: ${(impliedMonthlyRate * 100).toFixed(3)}%; TEA implícita: ${impliedTea?.toFixed(2)}%.` : '',
  ].filter(Boolean);
  const coreFields = [financedBase, installment, months].filter((value) => value !== null).length;
  const confidence = coreFields === 3 ? 'alta' : coreFields === 2 ? 'media' : 'baja';

  return { cashPrice, principal: financedBase, downPayment, installment, months, tnaPercent, teaPercent, cftPercent, statedTotal, calculatedInstallmentsTotal, calculatedKnownTotal, financingCost, financingCostPercent, impliedMonthlyRatePercent: impliedMonthlyRate === null ? null : impliedMonthlyRate * 100, impliedTeaPercent: impliedTea, missingFields, warnings, evidence, calculationBasis, confidence };
}
