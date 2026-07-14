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

function requestedMonthsFromInstruction(instruction: string): number | null {
  const explicit = instruction.match(/(\d{1,3})\s*(?:mes(?:es)?|cuotas?)/i);
  if (explicit) return Number(explicit[1]);
  const nearTerm = instruction.match(/(?:plazo|cuotas?|meses?)\D{0,20}(\d{1,3})/i);
  return nearTerm ? Number(nearTerm[1]) : null;
}

function extractScenarioPairs(text: string): Array<{ months: number; installment: number }> {
  const money = '([\\d]{1,3}(?:[. ][\\d]{3})+(?:,[\\d]{1,2})?|[\\d]+(?:,[\\d]{1,2})?)';
  const direct = [...text.matchAll(new RegExp(`(\\d{1,3})[ \\t]*cuotas?(?:[ \\t]+iguales)?[ \\t]*(?:de|a|:)?[ \\t]*(?:ARS|\\$)[ \\t]*${money}`, 'gi'))]
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

function argentinaDate(raw: string): Date | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const value = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59));
  return Number.isNaN(value.getTime()) ? null : value;
}

export function extractLoanNumbers(text: string, userInstruction = ''): LoanNumbers {
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/([.,])\s+(?=\d{1,2}\b)/g, '$1')
    .replace(/\bT\.?\s*N\.?\s*A\.?\s*V?\.?/gi, 'TNAV')
    .replace(/\bT\.?\s*E\.?\s*A\.?\s*V?\.?/gi, 'TEAV')
    .replace(/\bC\.?\s*F\.?\s*T\.?\s*(?:E\.?\s*A\.?\s*V?\.?)?/gi, (value) => /E/i.test(value) ? 'CFTEAV' : 'CFT')
    .replace(/[ \t]+/g, ' ');
  const cashPrice = labeledMoney(normalized, ['precio\\s+de\\s+contado', 'precio\\s+final', 'valor\\s+del\\s+veh[ií]culo']);
  const downPayment = labeledMoney(normalized, ['anticipo', 'entrega\\s+inicial', 'pago\\s+inicial']);
  const principalExample = normalized.match(/(?:pr[eé]stamo|cr[eé]dito)(?:\s+(?:personal|prendario))?\s+de[ \t]*(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const delayedPrincipal = normalized.match(/(?:eleg[ií]|seleccion[ae]|indic[ae])?\s*(?:el\s+)?monto\s+(?:de\s+tu|del)?\s*(?:pr[eé]stamo|cr[eé]dito)[\s\S]{0,240}?(?:ARS|\$)\s*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const principal = labeledMoney(normalized, ['monto\\s+(?:del\\s+)?(?:pr[eé]stamo|cr[eé]dito)', 'monto\\s+financiad[oa]', 'importe\\s+financiad[oa]', 'importe\\s+a\\s+solicitar'])
    ?? parseLocaleNumber(delayedPrincipal?.[1] || '')
    ?? parseLocaleNumber(principalExample?.[1] || '');
  const rawScenarios = extractScenarioPairs(normalized);
  const requestedMonths = requestedMonthsFromInstruction(userInstruction);
  const selectedRawScenario = (requestedMonths !== null ? rawScenarios.find((scenario) => scenario.months === requestedMonths) : null)
    ?? (rawScenarios.length === 1 ? rawScenarios[0] : null);
  const installmentFromSeries = normalized.match(/\d{1,3}[ \t]*cuotas[ \t]*(?:iguales[ \t]*)?(?:de|a|:)?[ \t]*(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const disclosedInstallment = normalized.match(/(?:cuota\s+total|primera\s+cuota)[^$\n]{0,180}(?:ARS|\$)[ \t]*([\d]{1,3}(?:[. ][\d]{3})+(?:,[\d]{1,2})?|[\d]+(?:,[\d]{1,2})?)/i);
  const installment = selectedRawScenario?.installment ?? labeledMoney(normalized, ['valor\\s+(?:de\\s+(?:la\\s+)?)?cuota', 'cuota\\s+(?:mensual|promedio|inicial)', 'cada\\s+cuota'])
    ?? parseLocaleNumber(installmentFromSeries?.[1] || '')
    ?? parseLocaleNumber(disclosedInstallment?.[1] || '');
  const statedTotal = labeledMoney(normalized, ['monto\\s+total\\s+(?:a\\s+)?pagar', 'total\\s+(?:a\\s+)?pagar', 'precio\\s+financiado']);
  const countMatch = normalized.match(/(?:cantidad\s+de\s+cuotas|plazo|en)\s*(?:de|:|=)?\s*(\d{1,3})\s*(?:cuotas|meses)/i)
    || normalized.match(/(\d{1,3})\s*(?:cuotas|meses)/i);
  const months = selectedRawScenario?.months ?? (countMatch ? Number(countMatch[1]) : null);
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
  const impliedTna = impliedMonthlyRate !== null ? impliedMonthlyRate * 12 * 100 : null;
  const impliedTea = impliedMonthlyRate !== null ? (Math.pow(1 + impliedMonthlyRate, 12) - 1) * 100 : null;
  const scenarios: LoanScenario[] = rawScenarios.map((scenario) => {
    const scenarioTotal = scenario.installment * scenario.months;
    const scenarioCost = financedBase !== null ? scenarioTotal - financedBase : null;
    const scenarioMonthlyRate = financedBase !== null ? solveMonthlyRate(financedBase, scenario.installment, scenario.months) : null;
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
  if (cftPercent === null && impliedTea !== null) warnings.push('La entidad no muestra un CFT oficial en la captura. ChamuyoCheck calculó la tasa implícita del flujo visible; puede diferir del CFT contractual si existen seguros, impuestos, comisiones, gastos iniciales o cuotas variables no mostrados.');
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
    principal !== null ? `Monto financiado declarado: $${principal.toLocaleString('es-AR')}` : '',
    downPayment !== null ? `Anticipo: $${downPayment.toLocaleString('es-AR')}` : '',
    installment !== null ? `Cuota: $${installment.toLocaleString('es-AR')}` : '',
    months !== null ? `Plazo: ${months} cuotas/meses` : '',
    tnaPercent !== null ? `TNA: ${tnaPercent}%` : '',
    teaPercent !== null ? `TEA: ${teaPercent}%` : '',
    cftPercent !== null ? `CFT: ${cftPercent}%` : '',
    selectedScenarioReason || '',
    rawScenarios.length > 1 ? `Alternativas visibles: ${rawScenarios.map((scenario) => `${scenario.months} cuotas de $${scenario.installment.toLocaleString('es-AR')}`).join('; ')}.` : '',
    validity ? `Vigencia informada: ${validity[1]} a ${validity[2]}` : '',
  ].filter(Boolean);
  const calculationBasis = [
    calculatedInstallmentsTotal !== null ? `${months} × $${installment?.toLocaleString('es-AR')} = $${calculatedInstallmentsTotal.toLocaleString('es-AR')} en cuotas.` : '',
    calculatedKnownTotal !== null && downPayment !== null ? `Anticipo + cuotas = $${calculatedKnownTotal.toLocaleString('es-AR')}.` : '',
    financingCost !== null ? `Diferencia total entre cuotas y capital: $${financingCost.toLocaleString('es-AR')} (${financingCostPercent?.toFixed(2)}% del capital). Si no existen otros conceptos, esta diferencia representa el interés total pagado.` : '',
    impliedMonthlyRate !== null ? `Tasa mensual implícita estimada: ${(impliedMonthlyRate * 100).toFixed(3)}%; TNA estimada: ${impliedTna?.toFixed(2)}%; TEA estimada: ${impliedTea?.toFixed(2)}% (costo anual efectivo visible).` : '',
    impliedMonthlyRate !== null && cftPercent === null ? `CFT visible estimado: ${impliedTea?.toFixed(2)}% efectivo anual, calculado solo con el capital, la cuota y el plazo visibles. No es el CFT oficial y puede aumentar si hay IVA, seguros, comisiones u otros cargos.` : '',
    impliedMonthlyRate !== null ? 'Supuesto del cálculo: cuotas mensuales iguales pagadas al final de cada período, desembolso neto igual al capital informado y ausencia de cargos iniciales no visibles.' : '',
  ].filter(Boolean);
  const coreFields = [financedBase, installment, months].filter((value) => value !== null).length;
  const confidence = coreFields === 3 ? 'alta' : coreFields === 2 ? 'media' : 'baja';

  return { cashPrice, principal: financedBase, downPayment, installment, months, tnaPercent, teaPercent, cftPercent, statedTotal, calculatedInstallmentsTotal, calculatedKnownTotal, financingCost, financingCostPercent, impliedMonthlyRatePercent: impliedMonthlyRate === null ? null : impliedMonthlyRate * 100, impliedTnaPercent: impliedTna, impliedTeaPercent: impliedTea, impliedVisibleCftPercent: impliedTea, scenarios, selectedScenarioReason, missingFields, warnings, evidence, calculationBasis, confidence };
}
