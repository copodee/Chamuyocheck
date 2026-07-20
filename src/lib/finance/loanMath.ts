export type LoanNumbers = {
  currency: 'ARS' | 'USD';
  amortizationSystem: 'french' | 'german';
  paymentPeriod: 'monthly';
  paymentTiming: 'arrears';
  cashPrice: number | null;
  principal: number | null;
  downPayment: number | null;
  installment: number | null;
  months: number | null;
  tnaPercent: number | null;
  teaPercent: number | null;
  cftPercent: number | null;
  upfrontFeePercent: number | null;
  upfrontFeeAmount: number | null;
  netDisbursement: number | null;
  installmentEstimated: boolean;
  installmentEstimationBasis: 'contractual-rate' | 'stated-total' | null;
  firstInstallment: number | null;
  lastInstallment: number | null;
  statedTotal: number | null;
  calculatedInstallmentsTotal: number | null;
  calculatedKnownTotal: number | null;
  financingCost: number | null;
  financingCostPercent: number | null;
  impliedMonthlyRatePercent: number | null;
  impliedTnaPercent: number | null;
  impliedTeaPercent: number | null;
  impliedVisibleCftPercent: number | null;
  scenarios: LoanScenario[];
  selectedScenarioReason: string | null;
  missingFields: string[];
  warnings: string[];
  evidence: string[];
  calculationBasis: string[];
  confidence: 'alta' | 'media' | 'baja';
};

export type LoanScenario = {
  months: number;
  installment: number;
  calculatedInstallmentsTotal: number | null;
  financingCost: number | null;
  financingCostPercent: number | null;
  impliedMonthlyRatePercent: number | null;
  impliedTnaPercent: number | null;
  impliedTeaPercent: number | null;
  selected: boolean;
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

function expandMagnitudeAmounts(text: string): string {
  const expand = (raw: string, multiplier: number): string => {
    const parsed = parseLocaleNumber(raw);
    return parsed === null ? raw : String(parsed * multiplier);
  };

  return text
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:mill[oó]n(?:es)?|MM)\b/gi, (_match, amount: string) => expand(amount, 1_000_000))
    .replace(/(\d+(?:[.,]\d+)?)\s*M(?=\s|de\b|$)/gi, (_match, amount: string) => `${expand(amount, 1_000_000)} `)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:mil|K)\b/gi, (_match, amount: string) => expand(amount, 1_000));
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
      || text.match(new RegExp(`([\\d.,]+)\\s*%\\s*(?:de\\s+)?(?:${label})`, 'i'));
    const value = parseLocaleNumber(match?.[1] || '');
    if (value !== null && value >= 0 && value < 10_000) return value;
  }
  return null;
}

function acronymPercent(text: string, acronym: 'TNA' | 'TEA' | 'CFT'): number | null {
  const prefixPattern = acronym === 'CFT'
    ? /\b(?:CFTEAV|CFTEA|CFTNAV|CFTNA|CFT)\b[).:\s-]*(?:con\s+IVA)?\s*(?:de|:|=)?\s*([\d.,]+)\s*%/i
    : new RegExp(`\\b${acronym}V?\\b[).:\\s-]*(?:de|:|=|fija|es)?\\s*([\\d.,]+)\\s*%`, 'i');
  const suffixPattern = acronym === 'CFT'
    ? /([\d.,]+)\s*%\s*(?:de\s+)?(?:CFTEAV|CFTEA|CFTNAV|CFTNA|CFT)\b/i
    : new RegExp(`([\\d.,]+)\\s*%\\s*(?:de\\s+)?${acronym}V?\\b`, 'i');
  return parseLocaleNumber(text.match(prefixPattern)?.[1] || text.match(suffixPattern)?.[1] || '');
}

function allAcronymPercents(text: string, acronym: 'TNA' | 'TEA' | 'CFT'): number[] {
  const prefixSource = acronym === 'CFT'
    ? '\\b(?:CFTEAV|CFTEA|CFTNAV|CFTNA|CFT)\\b[).:\\s-]*(?:con\\s+IVA)?\\s*(?:de|:|=)?\\s*([\\d.,]+)\\s*%'
    : `\\b${acronym}V?\\b[).:\\s-]*(?:de|:|=|fija|es)?\\s*([\\d.,]+)\\s*%`;
  const suffixSource = acronym === 'CFT'
    ? '([\\d.,]+)\\s*%\\s*(?:de\\s+)?(?:CFTEAV|CFTEA|CFTNAV|CFTNA|CFT)\\b'
    : `([\\d.,]+)\\s*%\\s*(?:de\\s+)?${acronym}V?\\b`;
  return [
    ...text.matchAll(new RegExp(prefixSource, 'gi')),
    ...text.matchAll(new RegExp(suffixSource, 'gi')),
  ]
    .map((match) => parseLocaleNumber(match[1] || ''))
    .filter((value): value is number => value !== null)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function solveMonthlyRate(principal: number, payment: number, periods: number): number | null {
  if (principal <= 0 || payment <= 0 || periods <= 0 || payment * periods < principal) return null;
  if (Math.abs(payment * periods - principal) < 0.01) return 0;
  let low = 0;
  let high = 2;
  for (let index = 0; index < 120; index += 1) {
    const rate = (low + high) / 2;
    const presentValue = payment * (1 - Math.pow(1 + rate, -periods)) / rate;
    if (presentValue > principal) low = rate; else high = rate;
  }
  return (low + high) / 2;
}

function levelPayment(principal: number, monthlyRate: number, periods: number): number | null {
  if (principal <= 0 || monthlyRate < 0 || periods <= 0) return null;
  if (monthlyRate === 0) return principal / periods;
  return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -periods));
}

function germanPayments(principal: number, monthlyRate: number, periods: number): number[] {
  if (principal <= 0 || monthlyRate < 0 || periods <= 0) return [];
  const amortization = principal / periods;
  return Array.from({ length: periods }, (_, index) => {
    const openingBalance = principal - amortization * index;
    return amortization + openingBalance * monthlyRate;
  });
}

function solveRateForPayments(principal: number, payments: number[]): number | null {
  if (principal <= 0 || payments.length === 0 || payments.some((payment) => payment <= 0)) return null;
  if (payments.reduce((sum, payment) => sum + payment, 0) < principal) return null;
  let low = 0;
  let high = 2;
  for (let index = 0; index < 120; index += 1) {
    const rate = (low + high) / 2;
    const presentValue = payments.reduce((sum, payment, paymentIndex) => sum + payment / Math.pow(1 + rate, paymentIndex + 1), 0);
    if (presentValue > principal) low = rate; else high = rate;
  }
  return (low + high) / 2;
}

function extractUpfrontFeePercent(text: string): number | null {
  const label = '(?:comisi[oó]n|cargo|gasto)(?:\\s+de\\s+otorgamiento|\\s+inicial|\\s+al\\s+inicio)';
  const after = text.match(new RegExp(`${label}\\s*(?:de|:|=)?\\s*([\\d.,]+)\\s*%`, 'i'));
  const before = text.match(new RegExp(`([\\d.,]+)\\s*%\\s*(?:de\\s+)?${label}`, 'i'));
  return parseLocaleNumber(after?.[1] || before?.[1] || '');
}

function requestedMonthsFromInstruction(instruction: string): number | null {
  const explicit = instruction.match(/(\d{1,3})\s*(?:mes(?:es)?|cuotas?)/i);
  if (explicit) return Number(explicit[1]);
  const nearTerm = instruction.match(/(?:plazo|cuotas?|meses?)\D{0,20}(\d{1,3})/i);
  return nearTerm ? Number(nearTerm[1]) : null;
}

function extractScenarioPairs(text: string): Array<{ months: number; installment: number }> {
  const money = '([\\d]{1,3}(?:[. ][\\d]{3})+(?:,[\\d]{1,2})?|[\\d]+(?:,[\\d]{1,2})?)';
  const direct = [...text.matchAll(new RegExp(`(\\d{1,3})[ \\t]*(?:cuotas?|pagos?)(?:[ \\t]+mensuales?)?(?:[ \\t]+iguales)?[ \\t]*(?:de|a|por|:)[ \\t]*(?:USD|U\\$S|US\\$|ARS|\\$)?[ \\t]*${money}`, 'gi'))]
    .map((match) => ({ months: Number(match[1]), installment: parseLocaleNumber(match[2] || '') }))
    .filter((item): item is { months: number; installment: number } => Number.isFinite(item.months) && item.installment !== null);

  // Muchos simuladores muestran los plazos en una fila y los importes en la
  // siguiente. En ese formato, el orden de lectura conserva la asociación visual.
  const firstTerm = text.search(/\b\d{1,3}[ \t]*cuotas?\b/i);
  if (firstTerm >= 0) {
    const scenarioBlock = text.slice(firstTerm, firstTerm + 900);
    const terms = [...scenarioBlock.matchAll(/\b(\d{1,3})[ \t]*cuotas?\b/gi)].map((match) => Number(match[1]));
    const amounts = [...scenarioBlock.matchAll(new RegExp(`(?:ARS|\\$)[ \\t]*${money}`, 'gi'))]
      .map((match) => parseLocaleNumber(match[1] || ''))
      .filter((value): value is number => value !== null);
    if (terms.length > 1 && amounts.length >= terms.length) {
      return terms.map((months, index) => ({ months, installment: amounts[index] }));
    }
  }
  return direct;
}

type LoanSemanticSlots = {
  principal: number | null;
  months: number | null;
  installment: number | null;
  statedTotal: number | null;
};

const semanticMoney = '([\\d]{1,3}(?:[. ][\\d]{3})+(?:,[\\d]{1,2})?|[\\d]+(?:,[\\d]{1,2})?)';
const semanticCurrency = '(?:USD|U\\$S|US\\$|ARS|\\$)?';
const semanticUnit = '(?:\\s*(?:de\\s+)?(?:pesos?|d[oó]lares?))?';

function firstSemanticAmount(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = parseLocaleNumber(match?.[1] || '');
    if (value !== null) return value;
  }
  return null;
}

function extractLoanSemanticSlots(text: string): LoanSemanticSlots {
  const principal = firstSemanticAmount(text, [
    new RegExp(`(?:vale|cuesta|(?:su|cuyo|el)?\\s*valor(?:\\s+(?:es|de))?|precio(?:\\s+(?:es|de))?)\\s*${semanticCurrency}\\s*${semanticMoney}${semanticUnit}[\\s\\S]{0,160}?\\d{1,3}\\s*(?:cuotas?|meses?)`, 'i'),
    new RegExp(`(?:me\\s+(?:ofrecen|ofrecieron|ofrece|dan|dieron|prestan|prestaron|quieren\\s+prestar)|van\\s+a\\s+prestar(?:me)?|recib(?:o|ir[ií]a)|solicito|pido)(?:\\s+(?:un\\s+pr[eé]stamo|un\\s+cr[eé]dito|la\\s+suma|un\\s+monto|un\\s+total))?(?:\\s+de)?\\s*${semanticCurrency}\\s*${semanticMoney}${semanticUnit}`, 'i'),
    new RegExp(`(?:capital|monto|importe|pr[eé]stamo|cr[eé]dito)(?:\\s+(?:recibido|otorgado|solicitado|financiado|inicial))?(?:\\s+(?:es|de|:|=))?\\s*${semanticCurrency}\\s*${semanticMoney}${semanticUnit}`, 'i'),
    new RegExp(`(?:^|\\s)${semanticCurrency}\\s*${semanticMoney}${semanticUnit}[\\s\\S]{0,140}?(?:a\\s+devolver|a\\s+pagar|financiad[oa]|(?:en|pagar|abon(?:ar|ando))\\s+\\d{1,3}\\s*(?:cuotas?|meses?))`, 'i'),
  ]);

  const monthsMatch = text.match(/(\d{1,3})\s*(?:cuotas?|mes(?:es)?|pagos?\s+mensuales?)/i);
  const parsedMonths = monthsMatch ? Number(monthsMatch[1]) : null;
  const months = parsedMonths && parsedMonths > 0 ? parsedMonths : null;

  const installment = firstSemanticAmount(text, [
    new RegExp(`\\d{1,3}\\s*(?:cuotas?|pagos?)(?:\\s+mensuales?)?(?:\\s+iguales?)?\\s*(?:de|a|por|:)\\s*${semanticCurrency}\\s*${semanticMoney}${semanticUnit}`, 'i'),
    new RegExp(`(?:cuota|pago)(?:\\s+(?:mensual|individual))?(?:\\s+(?:es|de|a|por|:|=))?\\s*${semanticCurrency}\\s*${semanticMoney}${semanticUnit}`, 'i'),
    new RegExp(`(?:cada\\s+cuota|importe\\s+de\\s+(?:cada|la)\\s+cuota|valor\\s+de\\s+(?:cada|la)\\s+cuota)(?:\\s+(?:es|de|:|=))?\\s*${semanticCurrency}\\s*${semanticMoney}${semanticUnit}`, 'i'),
  ]);

  const statedTotal = firstSemanticAmount(text, [
    new RegExp(`(?:total(?:\\s+final)?(?:\\s+a\\s+pagar)?|monto\\s+final|termin(?:ar[eé]|o|ar[ií]a)\\s+pagando|voy\\s+a\\s+pagar\\s+en\\s+total|devolver(?:[eé]|[ií]a)?\\s+en\\s+total)(?:\\s+(?:es|de|:|=))?\\s*${semanticCurrency}\\s*${semanticMoney}${semanticUnit}`, 'i'),
  ]);

  return { principal, months, installment, statedTotal };
}

function argentinaDate(raw: string): Date | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const value = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59));
  return Number.isNaN(value.getTime()) ? null : value;
}

export function extractLoanNumbers(text: string, userInstruction = ''): LoanNumbers {
  const normalized = expandMagnitudeAmounts(text)
    .replace(/\u00a0/g, ' ')
    .replace(/([.,])\s+(?=\d{1,2}\b)/g, '$1')
    .replace(/\bT\.?\s*N\.?\s*A\.?(?:\s*V\.?)?/gi, 'TNAV')
    .replace(/\bT\.?\s*E\.?\s*A\.?(?:\s*V\.?)?/gi, 'TEAV')
    .replace(/\bC\.?\s*F\.?\s*T\.?\s*E\.?\s*A\.?\s*V?\.?/gi, 'CFTEAV')
    .replace(/\bC\.?\s*F\.?\s*T\.?/gi, 'CFT')
    .replace(/[ \t]+/g, ' ');
  const semanticSlots = extractLoanSemanticSlots(normalized);
  const currency: 'ARS' | 'USD' = /(?:\bUSD\b|U\$S|US\$|d[oó]lares?)/i.test(normalized) ? 'USD' : 'ARS';
  const amortizationSystem: 'french' | 'german' = /sistema\s+alem[aá]n/i.test(`${userInstruction}\n${normalized}`) ? 'german' : 'french';
  const paymentPeriod: 'monthly' = 'monthly';
  const paymentTiming: 'arrears' = 'arrears';
  const cashPrice = labeledMoney(normalized, ['precio\\s+de\\s+contado', 'precio\\s+final', 'valor\\s+del\\s+veh[ií]culo']);
  const downPayment = labeledMoney(normalized, ['anticipo', 'entrega\\s+inicial', 'pago\\s+inicial']);
  const principalExample = normalized.match(/(?:pr[eé]stamo|cr[eé]dito)(?:\s+(?:personal|prendario))?\s+de[ \t]*(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const conversationalPrincipal = normalized.match(/(?:me\s+quieren\s+prestar|me\s+prestan|van\s+a\s+prestar(?:me)?|prestar(?:me)?)(?:\s+(?:la\s+suma\s+de|un\s+total\s+de|de))?\s*(?:USD|U\$S|US\$|ARS|\$)?\s*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)\s*(?:de\s+)?(?:d[oó]lares?|pesos?)?/i);
  const delayedPrincipal = normalized.match(/(?:eleg[ií]|seleccion[ae]|indic[ae])?\s*(?:el\s+)?monto\s+(?:de\s+tu|del)?\s*(?:pr[eé]stamo|cr[eé]dito)[\s\S]{0,240}?(?:ARS|\$)\s*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const economicFlowPrincipal = normalized.match(/(?:^|\s)([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)\s*(?:pesos?|d[oó]lares?)\s+(?:a|en)\s+\d{1,3}\s*(?:meses?|cuotas?)/i);
  const principal = labeledMoney(normalized, ['monto\\s+(?:del\\s+)?(?:pr[eé]stamo|cr[eé]dito)', 'monto\\s+financiad[oa]', 'importe\\s+financiad[oa]', 'importe\\s+a\\s+solicitar'])
    ?? parseLocaleNumber(delayedPrincipal?.[1] || '')
    ?? parseLocaleNumber(principalExample?.[1] || '')
    ?? parseLocaleNumber(conversationalPrincipal?.[1] || '')
    ?? parseLocaleNumber(economicFlowPrincipal?.[1] || '')
    ?? semanticSlots.principal;
  const rawScenarios = extractScenarioPairs(normalized);
  const requestedMonths = requestedMonthsFromInstruction(userInstruction);
  const selectedRawScenario = (requestedMonths !== null ? rawScenarios.find((scenario) => scenario.months === requestedMonths) : null)
    ?? (rawScenarios.length === 1 ? rawScenarios[0] : null);
  const installmentFromSeries = normalized.match(/\d{1,3}[ \t]*cuotas[ \t]*(?:iguales[ \t]*)?(?:de|a|:)?[ \t]*(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const disclosedInstallment = normalized.match(/(?:cuota\s+total|primera\s+cuota)[^$\n]{0,180}(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const disclosedInstallmentValue = selectedRawScenario?.installment ?? semanticSlots.installment ?? labeledMoney(normalized, ['valor\\s+(?:de\\s+(?:la\\s+)?)?cuota', 'cuota\\s+(?:mensual|promedio|inicial)', 'cada\\s+cuota'])
    ?? parseLocaleNumber(installmentFromSeries?.[1] || '')
    ?? parseLocaleNumber(disclosedInstallment?.[1] || '');
  const conversationalTotal = normalized.match(/(?:termin(?:ar[eé]|a|ar[ií]a|o)\s+pagando|voy\s+a\s+pagar|devolver(?:[eé]|ia|ía)?)(?:\s+(?:un\s+total\s+de|la\s+suma\s+de))?\s*(?:ARS|USD|U\$S|US\$|\$)?\s*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)\s*(?:de\s+)?(?:pesos?|d[oó]lares?)?/i);
  const statedTotal = semanticSlots.statedTotal ?? labeledMoney(normalized, ['monto\\s+total\\s+(?:a\\s+)?pagar', 'total\\s+(?:a\\s+)?pagar', 'precio\\s+financiado'])
    ?? parseLocaleNumber(conversationalTotal?.[1] || '');
  const countMatch = normalized.match(/(?:cantidad\s+de\s+cuotas|plazo|en)\s*(?:de|:|=)?\s*(\d{1,3})\s*(?:cuotas|meses)/i)
    || normalized.match(/(\d{1,3})\s*(?:cuotas|meses)/i);
  const months = selectedRawScenario?.months ?? semanticSlots.months ?? (countMatch ? Number(countMatch[1]) : null);
  const tnaPercent = acronymPercent(normalized, 'TNA') ?? labeledPercent(normalized, ['tasa\\s+nominal\\s+anual']);
  const teaPercent = acronymPercent(normalized, 'TEA') ?? labeledPercent(normalized, ['tasa\\s+efectiva\\s+anual']);
  const cftPercent = acronymPercent(normalized, 'CFT') ?? labeledPercent(normalized, ['costo\\s+financiero\\s+total']);
  const contractualRateDescription = tnaPercent !== null
    ? 'TNA nominal dividida por 12'
    : teaPercent !== null
      ? 'TEA convertida a tasa efectiva mensual'
      : cftPercent !== null
        ? 'CFT anual convertido a tasa efectiva mensual'
        : 'la tasa contractual informada';
  const upfrontFeePercent = extractUpfrontFeePercent(normalized);
  const financedBase = principal ?? (cashPrice !== null ? Math.max(0, cashPrice - (downPayment || 0)) : null);
  const contractualMonthlyRate = tnaPercent !== null
    ? tnaPercent / 1200
    : teaPercent !== null
      ? Math.pow(1 + teaPercent / 100, 1 / 12) - 1
      : cftPercent !== null
        ? Math.pow(1 + cftPercent / 100, 1 / 12) - 1
        : null;
  const modeledGermanPayments = disclosedInstallmentValue === null && financedBase !== null && months !== null && contractualMonthlyRate !== null && amortizationSystem === 'german'
    ? germanPayments(financedBase, contractualMonthlyRate, months)
    : [];
  const rateEstimatedInstallment = disclosedInstallmentValue === null && financedBase !== null && months !== null && contractualMonthlyRate !== null
    ? amortizationSystem === 'german' ? modeledGermanPayments[0] ?? null : levelPayment(financedBase, contractualMonthlyRate, months)
    : null;
  const totalEstimatedInstallment = disclosedInstallmentValue === null && rateEstimatedInstallment === null && statedTotal !== null && months !== null && months > 0
    ? statedTotal / months
    : null;
  const estimatedInstallment = rateEstimatedInstallment ?? totalEstimatedInstallment;
  const installment = disclosedInstallmentValue ?? estimatedInstallment;
  const installmentEstimated = disclosedInstallmentValue === null && estimatedInstallment !== null;
  const installmentEstimationBasis = rateEstimatedInstallment !== null ? 'contractual-rate' as const : totalEstimatedInstallment !== null ? 'stated-total' as const : null;
  const firstInstallment = amortizationSystem === 'german' && modeledGermanPayments.length > 0 ? modeledGermanPayments[0] : installment;
  const lastInstallment = amortizationSystem === 'german' && modeledGermanPayments.length > 0 ? modeledGermanPayments[modeledGermanPayments.length - 1] : installment;
  const upfrontFeeAmount = financedBase !== null && upfrontFeePercent !== null ? financedBase * upfrontFeePercent / 100 : null;
  const netDisbursement = financedBase !== null ? financedBase - (upfrontFeeAmount || 0) : null;

  const calculatedInstallmentsTotal = modeledGermanPayments.length > 0
    ? modeledGermanPayments.reduce((sum, payment) => sum + payment, 0)
    : installment !== null && months !== null ? installment * months : null;
  const calculatedKnownTotal = calculatedInstallmentsTotal !== null
    ? calculatedInstallmentsTotal + (downPayment || 0) + (upfrontFeeAmount || 0)
    : statedTotal;
  const financingCost = calculatedInstallmentsTotal !== null && financedBase !== null
    ? calculatedInstallmentsTotal + (upfrontFeeAmount || 0) - financedBase
    : null;
  const financingCostPercent = financingCost !== null && financedBase && financedBase > 0
    ? financingCost / financedBase * 100
    : null;
  const impliedMonthlyRate = netDisbursement && modeledGermanPayments.length > 0
    ? solveRateForPayments(netDisbursement, modeledGermanPayments)
    : netDisbursement && installment && months ? solveMonthlyRate(netDisbursement, installment, months) : null;
  const impliedTna = impliedMonthlyRate !== null ? impliedMonthlyRate * 12 * 100 : null;
  const impliedTea = impliedMonthlyRate !== null ? (Math.pow(1 + impliedMonthlyRate, 12) - 1) * 100 : null;
  const scenarios: LoanScenario[] = rawScenarios.map((scenario) => {
    const scenarioTotal = scenario.installment * scenario.months;
    const scenarioCost = financedBase !== null ? scenarioTotal + (upfrontFeeAmount || 0) - financedBase : null;
    const scenarioMonthlyRate = netDisbursement !== null ? solveMonthlyRate(netDisbursement, scenario.installment, scenario.months) : null;
    return {
      months: scenario.months,
      installment: scenario.installment,
      calculatedInstallmentsTotal: scenarioTotal,
      financingCost: scenarioCost,
      financingCostPercent: scenarioCost !== null && financedBase && financedBase > 0 ? scenarioCost / financedBase * 100 : null,
      impliedMonthlyRatePercent: scenarioMonthlyRate !== null ? scenarioMonthlyRate * 100 : null,
      impliedTnaPercent: scenarioMonthlyRate !== null ? scenarioMonthlyRate * 12 * 100 : null,
      impliedTeaPercent: scenarioMonthlyRate !== null ? (Math.pow(1 + scenarioMonthlyRate, 12) - 1) * 100 : null,
      selected: scenario.months === months && scenario.installment === installment,
    };
  });
  const selectedScenarioReason = requestedMonths !== null && selectedRawScenario
    ? `Se priorizó la instrucción del usuario y se seleccionó la alternativa de ${requestedMonths} meses.`
    : requestedMonths !== null && rawScenarios.length > 0
      ? `La instrucción solicitó ${requestedMonths} meses, pero esa alternativa no fue identificada en el contenido.`
      : rawScenarios.length > 1
        ? 'Se detectaron varias alternativas; hace falta indicar el plazo que se desea analizar.'
        : null;

  const missingFields: string[] = [];
  if (financedBase === null) missingFields.push('monto financiado o precio de contado y anticipo');
  if (installment === null) missingFields.push('importe de cada cuota');
  if (months === null) missingFields.push('cantidad de cuotas');
  if (cftPercent === null && impliedTea === null) missingFields.push('CFT o datos suficientes para estimar la tasa implícita');
  const warnings: string[] = [];
  const rateOptions = [allAcronymPercents(normalized, 'TNA'), allAcronymPercents(normalized, 'TEA'), allAcronymPercents(normalized, 'CFT')];
  if (rateOptions.some((values) => values.length > 1)) warnings.push('La página publica más de una tasa o CFT para perfiles de cliente diferentes; no deben combinarse entre sí y hay que identificar qué condición corresponde al solicitante.');
  if (installmentEstimationBasis === 'stated-total') warnings.push(`El total declarado se distribuyó en ${months} cuotas mensuales iguales y vencidas bajo el supuesto de sistema francés. Si existe anticipo, cuota final, período de gracia o cuotas variables, la tasa implícita cambia.`);
  else if (installmentEstimated) warnings.push(amortizationSystem === 'german'
    ? 'Las cuotas fueron estimadas con sistema alemán, amortización constante, interés sobre saldo y pagos mensuales vencidos. Las cuotas son decrecientes.'
    : `La cuota fue estimada con sistema francés, pagos mensuales vencidos y ${contractualRateDescription}. Si el contrato usa otro sistema, cuotas variables o una periodicidad distinta, el resultado cambia.`);
  if (upfrontFeePercent !== null) warnings.push('La comisión inicial se modeló como un pago al momento del desembolso: reduce el dinero neto disponible y eleva la tasa implícita.');
  if (cftPercent === null && impliedTea !== null) warnings.push('El contenido aportado no muestra un CFT oficial. ChamuyoCheck calculó la tasa implícita del flujo visible; puede diferir del CFT contractual si existen seguros, impuestos, comisiones, gastos iniciales o cuotas variables no mostrados.');
  else if (cftPercent === null) warnings.push('Sin CFT ni un flujo completo no puede estimarse una tasa anual que incluya el costo visible.');
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
    principal !== null ? `Monto financiado declarado: ${currency === 'USD' ? 'USD ' : '$'}${principal.toLocaleString('es-AR')}` : '',
    downPayment !== null ? `Anticipo: $${downPayment.toLocaleString('es-AR')}` : '',
    installment !== null ? `${installmentEstimationBasis === 'stated-total' ? 'Cuota mensual equivalente estimada desde el total' : installmentEstimated ? 'Cuota estimada' : 'Cuota'}: ${currency === 'USD' ? 'USD ' : '$'}${installment.toLocaleString('es-AR')}` : '',
    months !== null ? `Plazo: ${months} cuotas/meses` : '',
    installmentEstimated ? `Sistema de amortización supuesto: ${amortizationSystem === 'german' ? 'alemán (cuotas decrecientes)' : 'francés (cuotas iguales)'}.` : '',
    installmentEstimated ? 'Periodicidad y momento de pago: cuotas mensuales vencidas, pagadas al final de cada mes.' : '',
    tnaPercent !== null ? `TNA: ${tnaPercent}%` : '',
    teaPercent !== null ? `TEA: ${teaPercent}%` : '',
    cftPercent !== null ? `CFT: ${cftPercent}%` : '',
    upfrontFeePercent !== null ? `Comisión inicial: ${upfrontFeePercent}% (${currency === 'USD' ? 'USD ' : '$'}${upfrontFeeAmount?.toLocaleString('es-AR')})` : '',
    netDisbursement !== null && upfrontFeeAmount !== null ? `Desembolso neto después de la comisión: ${currency === 'USD' ? 'USD ' : '$'}${netDisbursement.toLocaleString('es-AR')}` : '',
    selectedScenarioReason || '',
    rawScenarios.length > 1 ? `Alternativas visibles: ${rawScenarios.map((scenario) => `${scenario.months} cuotas de $${scenario.installment.toLocaleString('es-AR')}`).join('; ')}.` : '',
    validity ? `Vigencia informada: ${validity[1]} a ${validity[2]}` : '',
  ].filter(Boolean);
  const calculationBasis = [
    installmentEstimationBasis === 'contractual-rate' && amortizationSystem === 'french' ? `Cuota teórica por sistema francés: capital × tasa mensual / [1 − (1 + tasa mensual)^−plazo].` : '',
    installmentEstimationBasis === 'stated-total' ? `Cuota mensual equivalente: total declarado de ${currency === 'USD' ? 'USD ' : '$'}${statedTotal?.toLocaleString('es-AR')} ÷ ${months} meses = ${currency === 'USD' ? 'USD ' : '$'}${installment?.toLocaleString('es-AR')}.` : '',
    installmentEstimated && amortizationSystem === 'german' ? `Sistema alemán: amortización de capital constante de ${currency === 'USD' ? 'USD ' : '$'}${financedBase !== null && months ? (financedBase / months).toLocaleString('es-AR') : '0'} por mes, más interés sobre el saldo pendiente.` : '',
    amortizationSystem === 'german' && modeledGermanPayments.length > 0 ? `Primera cuota estimada: ${currency === 'USD' ? 'USD ' : '$'}${firstInstallment?.toLocaleString('es-AR')}; última cuota estimada: ${currency === 'USD' ? 'USD ' : '$'}${lastInstallment?.toLocaleString('es-AR')}; total de cuotas: ${currency === 'USD' ? 'USD ' : '$'}${calculatedInstallmentsTotal?.toLocaleString('es-AR')}.` : '',
    calculatedInstallmentsTotal !== null && amortizationSystem === 'french' ? `${months} × ${currency === 'USD' ? 'USD ' : '$'}${installment?.toLocaleString('es-AR')} = ${currency === 'USD' ? 'USD ' : '$'}${calculatedInstallmentsTotal.toLocaleString('es-AR')} en cuotas.` : '',
    upfrontFeeAmount !== null && netDisbursement !== null ? `Comisión inicial: ${currency === 'USD' ? 'USD ' : '$'}${upfrontFeeAmount.toLocaleString('es-AR')}; desembolso neto económico: ${currency === 'USD' ? 'USD ' : '$'}${netDisbursement.toLocaleString('es-AR')}.` : '',
    calculatedKnownTotal !== null && downPayment !== null ? `Anticipo + cuotas = $${calculatedKnownTotal.toLocaleString('es-AR')}.` : '',
    financingCost !== null ? `Diferencia total entre cuotas y capital: ${currency === 'USD' ? 'USD ' : '$'}${financingCost.toLocaleString('es-AR')} (${financingCostPercent?.toFixed(2)}% del capital). Si no existen otros conceptos, esta diferencia representa el interés total pagado.` : '',
    impliedMonthlyRate !== null ? `Tasa mensual implícita estimada: ${(impliedMonthlyRate * 100).toFixed(3)}%; TNA estimada: ${impliedTna?.toFixed(2)}%; TEA estimada: ${impliedTea?.toFixed(2)}% (costo anual efectivo visible).` : '',
    impliedMonthlyRate !== null && cftPercent === null ? `CFT visible estimado: ${impliedTea?.toFixed(2)}% efectivo anual, calculado solo con el capital, la cuota y el plazo visibles. No es el CFT oficial y puede aumentar si hay IVA, seguros, comisiones u otros cargos.` : '',
    impliedMonthlyRate !== null ? `Supuesto del cálculo: cuotas mensuales iguales pagadas al final de cada período, ${upfrontFeeAmount !== null ? 'comisión informada pagada al inicio' : 'desembolso neto igual al capital informado'} y ausencia de otros cargos no visibles.` : '',
  ].filter(Boolean);
  const coreFields = [financedBase, installment, months].filter((value) => value !== null).length;
  const confidence = coreFields === 3 ? 'alta' : coreFields === 2 ? 'media' : 'baja';

  return { currency, amortizationSystem, paymentPeriod, paymentTiming, cashPrice, principal: financedBase, downPayment, installment, months, tnaPercent, teaPercent, cftPercent, upfrontFeePercent, upfrontFeeAmount, netDisbursement, installmentEstimated, installmentEstimationBasis, firstInstallment, lastInstallment, statedTotal, calculatedInstallmentsTotal, calculatedKnownTotal, financingCost, financingCostPercent, impliedMonthlyRatePercent: impliedMonthlyRate === null ? null : impliedMonthlyRate * 100, impliedTnaPercent: impliedTna, impliedTeaPercent: impliedTea, impliedVisibleCftPercent: impliedTea, scenarios, selectedScenarioReason, missingFields, warnings, evidence, calculationBasis, confidence };
}
