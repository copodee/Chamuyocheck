import type { CorporateFinancialAssessment, ExtractedBalance } from '../domain/dossier';

const ratio = (numerator: number | null | undefined, denominator: number | null | undefined) =>
  numerator != null && denominator != null && denominator !== 0 ? numerator / denominator : null;

export function analyzeCorporateFinancials(balance?: ExtractedBalance): CorporateFinancialAssessment {
  if (!balance) {
    return {
      workingCapital: null, currentRatio: null, cashRatio: null, debtToEquity: null,
      liabilitiesToEquity: null, netMargin: null, operatingMargin: null,
      returnOnAssets: null, returnOnEquity: null, financialDebtToSales: null,
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
  const cashRatio = ratio(balance.cash, balance.currentLiabilities);
  const debtToEquity = ratio(balance.financialDebt, balance.equity);
  const liabilitiesToEquity = ratio(totalLiabilities, balance.equity);
  const netMargin = ratio(balance.netProfit, balance.sales);
  const operatingMargin = ratio(balance.operatingProfit, balance.sales);
  const returnOnAssets = ratio(balance.netProfit, totalAssets);
  const returnOnEquity = ratio(balance.netProfit, balance.equity);
  const financialDebtToSales = ratio(balance.financialDebt, balance.sales);

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
  grade(workingCapital, value => value > 0, value => value === 0, 'El capital de trabajo es negativo.');
  grade(liabilitiesToEquity, value => value <= 1.5, value => value <= 2.5, 'El pasivo total es elevado respecto del patrimonio neto.');
  grade(netMargin, value => value > 0.05, value => value >= 0, 'El ejercicio presenta margen neto negativo.');
  grade(returnOnAssets, value => value > 0.03, value => value >= 0, 'La rentabilidad sobre activos es negativa.');
  grade(financialDebtToSales, value => value <= 0.3, value => value <= 0.6, 'La deuda financiera representa una proporción elevada de las ventas anuales.');

  if (balance.extractionConfidence < 60) observations.push('La extracción del balance tiene baja confianza y exige revisión humana.');
  const score = measured ? Math.round((points / (measured * 2)) * 100) : null;
  const status = score == null ? 'insufficient-data'
    : score >= 80 ? 'strong'
      : score >= 60 ? 'adequate'
        : score >= 40 ? 'review'
          : 'weak';
  return {
    workingCapital, currentRatio, cashRatio, debtToEquity, liabilitiesToEquity,
    netMargin, operatingMargin, returnOnAssets, returnOnEquity, financialDebtToSales,
    status, score, observations,
  };
}
