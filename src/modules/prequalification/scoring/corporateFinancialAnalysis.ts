import type { CorporateEvolutionAssessment, CorporateFinancialAssessment, ExtractedBalance } from '../domain/dossier';

const ratio = (numerator: number | null | undefined, denominator: number | null | undefined) =>
  numerator != null && denominator != null && denominator !== 0 ? numerator / denominator : null;

export function analyzeCorporateFinancials(balance?: ExtractedBalance, previous?: ExtractedBalance): CorporateFinancialAssessment {
  if (!balance) {
    return {
      workingCapital: null, currentRatio: null, quickRatio: null, cashRatio: null, debtToEquity: null,
      liabilitiesToEquity: null, netMargin: null, grossMargin: null, operatingMargin: null,
      returnOnAssets: null, returnOnEquity: null, financialDebtToSales: null,
      assetTurnover: null, inventoryTurnover: null, receivablesTurnover: null, interestCoverage: null,
      status: 'insufficient-data', score: null,
      observations: ['Falta un balance legible para calcular indicadores empresariales.'],
    };
  }

  const totalAssets = balance.totalAssets ??
    (balance.currentAssets != null && balance.nonCurrentAssets != null
      ? balance.currentAssets + balance.nonCurrentAssets : null);
  const totalLiabilities = balance.totalLiabilities ??
    (balance.currentLiabilities != null && balance.nonCurrentLiabilities != null
      ? balance.currentLiabilities + balance.nonCurrentLiabilities : null);
  const workingCapital = balance.currentAssets != null && balance.currentLiabilities != null
    ? balance.currentAssets - balance.currentLiabilities : null;
  const currentRatio = ratio(balance.currentAssets, balance.currentLiabilities);
  const quickRatio = balance.currentAssets != null
    ? ratio(balance.currentAssets - Math.max(0, balance.inventory || 0), balance.currentLiabilities)
    : null;
  const cashRatio = ratio(balance.cash, balance.currentLiabilities);
  const debtToEquity = ratio(balance.financialDebt, balance.equity);
  const liabilitiesToEquity = ratio(totalLiabilities, balance.equity);
  const netMargin = ratio(balance.netProfit, balance.sales);
  const grossMargin = ratio(balance.grossProfit, balance.sales);
  const operatingMargin = ratio(balance.operatingProfit, balance.sales);
  const previousTotalAssets = previous?.totalAssets ??
    (previous?.currentAssets != null && previous?.nonCurrentAssets != null
      ? previous.currentAssets + previous.nonCurrentAssets : null);
  const averageAssets = totalAssets != null && previousTotalAssets != null ? (totalAssets + previousTotalAssets) / 2 : totalAssets;
  const averageEquity = balance.equity != null && previous?.equity != null ? (balance.equity + previous.equity) / 2 : balance.equity;
  const averageInventory = balance.inventory != null && previous?.inventory != null
    ? (balance.inventory + previous.inventory) / 2 : balance.inventory;
  const averageReceivables = balance.tradeReceivables != null && previous?.tradeReceivables != null
    ? (balance.tradeReceivables + previous.tradeReceivables) / 2 : balance.tradeReceivables;
  const returnOnAssets = ratio(balance.netProfit, averageAssets);
  const returnOnEquity = ratio(balance.netProfit, averageEquity);
  const financialDebtToSales = ratio(balance.financialDebt, balance.sales);
  const assetTurnover = ratio(balance.sales, averageAssets);
  const inventoryTurnover = ratio(balance.costOfSales == null ? null : Math.abs(balance.costOfSales), averageInventory);
  const receivablesTurnover = ratio(balance.sales, averageReceivables);
  const interestCoverage = ratio(balance.operatingProfit, balance.interestExpense == null ? null : Math.abs(balance.interestExpense));

  const observations: string[] = [];
  let points = 0;
  let measured = 0;
  const grade = (value: number | null, good: (value: number) => boolean, warning: (value: number) => boolean, weak: string) => {
    if (value == null) return;
    measured += 1;
    if (good(value)) points += 2;
    else if (warning(value)) points += 1;
    else observations.push(weak);
  };
  grade(currentRatio, value => value >= 1.2, value => value >= 1, 'La liquidez corriente es inferior a 1.');
  grade(quickRatio, value => value >= 1, value => value >= 0.7, 'La liquidez ácida es reducida frente al pasivo corriente.');
  grade(workingCapital, value => value > 0, value => value === 0, 'El capital de trabajo es negativo.');
  grade(liabilitiesToEquity, value => value <= 1.5, value => value <= 2.5, 'El pasivo total es elevado respecto del patrimonio neto.');
  grade(netMargin, value => value > 0.05, value => value >= 0, 'El ejercicio presenta margen neto negativo.');
  grade(returnOnAssets, value => value > 0.03, value => value >= 0, 'La rentabilidad sobre activos es negativa.');
  grade(financialDebtToSales, value => value <= 0.3, value => value <= 0.6, 'La deuda financiera representa una proporción elevada de las ventas anuales.');
  grade(interestCoverage, value => value >= 2, value => value >= 1, 'El resultado operativo no cubre adecuadamente los intereses.');

  if (balance.extractionConfidence < 60) observations.push('La extracción del balance tiene baja confianza y exige revisión humana.');
  const score = measured ? Math.round((points / (measured * 2)) * 100) : null;
  const status = score == null ? 'insufficient-data'
    : score >= 80 ? 'strong'
      : score >= 60 ? 'adequate'
        : score >= 40 ? 'review'
          : 'weak';
  return {
    workingCapital, currentRatio, quickRatio, cashRatio, debtToEquity, liabilitiesToEquity,
    netMargin, grossMargin, operatingMargin, returnOnAssets, returnOnEquity, financialDebtToSales,
    assetTurnover, inventoryTurnover, receivablesTurnover, interestCoverage,
    status, score, observations,
  };
}

export function analyzeCorporateEvolution(current?: ExtractedBalance, previous?: ExtractedBalance): CorporateEvolutionAssessment {
  const empty = {
    currentClosingDate: current?.closingDate || null,
    previousClosingDate: previous?.closingDate || null,
    salesChange: null, equityChange: null, netProfitChange: null,
    currentRatioChange: null, liabilitiesToEquityChange: null,
  };
  if (!current || !previous) {
    return { ...empty, trend: 'insufficient-data', observations: ['Se necesitan dos balances separados para medir la evolución interanual.'] };
  }
  const currentMetrics = analyzeCorporateFinancials(current);
  const previousMetrics = analyzeCorporateFinancials(previous);
  const change = (latest: number | null | undefined, prior: number | null | undefined) =>
    latest != null && prior != null && prior !== 0 ? (latest - prior) / Math.abs(prior) : null;
  const salesChange = change(current.sales, previous.sales);
  const equityChange = change(current.equity, previous.equity);
  const netProfitChange = change(current.netProfit, previous.netProfit);
  const currentRatioChange = change(currentMetrics.currentRatio, previousMetrics.currentRatio);
  const liabilitiesToEquityChange = change(currentMetrics.liabilitiesToEquity, previousMetrics.liabilitiesToEquity);
  const signals = [
    salesChange == null ? null : salesChange >= 0 ? 1 : -1,
    equityChange == null ? null : equityChange >= 0 ? 1 : -1,
    netProfitChange == null ? null : netProfitChange >= 0 ? 1 : -1,
    currentRatioChange == null ? null : currentRatioChange >= 0 ? 1 : -1,
    liabilitiesToEquityChange == null ? null : liabilitiesToEquityChange <= 0 ? 1 : -1,
  ].filter((value): value is number => value != null);
  const total = signals.reduce((sum, value) => sum + value, 0);
  const trend = signals.length < 3 ? 'insufficient-data'
    : total >= 2 ? 'improving'
      : total <= -2 ? 'deteriorating'
        : 'stable';
  const observations: string[] = [];
  if (salesChange != null && salesChange < 0) observations.push('Las ventas disminuyeron frente al ejercicio anterior.');
  if (equityChange != null && equityChange < 0) observations.push('El patrimonio neto disminuyó frente al ejercicio anterior.');
  if (netProfitChange != null && netProfitChange < 0) observations.push('El resultado neto se deterioró frente al ejercicio anterior.');
  if (currentRatioChange != null && currentRatioChange < 0) observations.push('La liquidez corriente se redujo.');
  if (liabilitiesToEquityChange != null && liabilitiesToEquityChange > 0) observations.push('Aumentó el pasivo total respecto del patrimonio.');
  return {
    currentClosingDate: current.closingDate, previousClosingDate: previous.closingDate,
    salesChange, equityChange, netProfitChange, currentRatioChange, liabilitiesToEquityChange,
    trend, observations,
  };
}
