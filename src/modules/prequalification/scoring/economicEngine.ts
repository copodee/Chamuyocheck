import type { EconomicAssessment, EconomicInputs, ExtractedBalance } from '../domain/dossier';

const POLICY_RATIO = 0.3;
const MONOTRIBUTO_INCOME_COEFFICIENTS: Record<string, number> = {
  'professional-services': 0.55,
  'other-services': 0.45,
  commerce: 0.25,
  production: 0.3,
  transport: 0.35,
  other: 0.3,
};

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

export function evaluateEconomicCapacity(
  inputs: EconomicInputs,
  documentCount: number,
  balance?: ExtractedBalance,
): EconomicAssessment {
  const reasons: string[] = [];
  const conditions: string[] = [];
  let normalizedMonthlyIncome: number | null = null;

  if (inputs.profile === 'employee') {
    normalizedMonthlyIncome = Math.max(0, Number(inputs.employeeNetIncome || 0)) || null;
    reasons.push('Se utilizó el ingreso neto mensual informado o extraído de recibos.');
  } else if (inputs.profile === 'legal-entity') {
    const monthlySales = average(inputs.monthlySales || []);
    const margin = Math.max(0, Math.min(1, Number(inputs.declaredOperatingMargin || 0) / 100));
    normalizedMonthlyIncome = monthlySales && margin ? monthlySales * margin : null;
    if (balance?.operatingProfit && balance?.sales) {
      const balanceMargin = Math.max(0, balance.operatingProfit / balance.sales);
      normalizedMonthlyIncome = monthlySales
        ? monthlySales * Math.min(balanceMargin, margin || balanceMargin)
        : balance.operatingProfit / 12;
      reasons.push('La capacidad se contrastó con ventas posteriores y margen operativo del balance.');
    }
  } else {
    const monthlySales = average(inputs.monthlySales || []);
    const policyCoefficient = inputs.profile === 'monotributista'
      ? MONOTRIBUTO_INCOME_COEFFICIENTS[inputs.activityCategory || 'other']
      : 0;
    const margin = policyCoefficient || Math.max(0, Math.min(1, Number(inputs.declaredOperatingMargin || 0) / 100));
    normalizedMonthlyIncome = monthlySales && margin ? monthlySales * margin : null;
    reasons.push(inputs.profile === 'monotributista'
      ? `La facturación se convirtió en ingreso computable mediante un coeficiente prudencial del ${(margin * 100).toFixed(0)}% según el tipo de actividad.`
      : 'La facturación se convirtió en ingreso estimado mediante el margen declarado.');
  }
  if (inputs.profile !== 'employee' && inputs.hasEmploymentIncome) {
    const employmentIncome = Math.max(0, Number(inputs.additionalEmploymentNetIncome || 0));
    if (employmentIncome > 0) {
      normalizedMonthlyIncome = (normalizedMonthlyIncome || 0) + employmentIncome;
      reasons.push('Se sumó el ingreso neto formal en relación de dependencia declarado y respaldado separadamente.');
    }
  }

  const commitments = Math.max(0, inputs.declaredMonthlyDebtService) + Math.max(0, inputs.proposedMonthlyCanon);
  const ratio = normalizedMonthlyIncome ? commitments / normalizedMonthlyIncome : null;
  const maximumPrudentCanon = normalizedMonthlyIncome
    ? Math.max(0, normalizedMonthlyIncome * POLICY_RATIO - Math.max(0, inputs.declaredMonthlyDebtService))
    : null;
  const canonCoverage = inputs.proposedMonthlyCanon > 0 && normalizedMonthlyIncome
    ? normalizedMonthlyIncome / inputs.proposedMonthlyCanon
    : null;

  let status: EconomicAssessment['status'] = 'manual-review';
  let score = 50;
  if (ratio !== null) {
    if (ratio <= POLICY_RATIO) {
      status = 'compatible';
      score = 84;
    } else if (ratio <= 0.35) {
      status = 'conditional';
      score = 68;
      conditions.push('Reducir el canon, aumentar el anticipo o justificar ingresos adicionales.');
    } else {
      status = 'not-compatible';
      score = 38;
      conditions.push('La suma de compromisos supera el 35% del ingreso computable.');
    }
  } else {
    conditions.push('Falta información suficiente para estimar capacidad mensual.');
  }
  if (inputs.activitySeniorityMonths < 12) {
    score -= 10;
    conditions.push('Antigüedad menor a 12 meses: requiere revisión de política.');
  }
  if (balance && balance.extractionConfidence < 60) {
    score -= 8;
    conditions.push('El balance requiere revisión manual de campos no extraídos.');
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    confidence: documentCount >= 2 ? 'documental' : documentCount === 1 ? 'parcialmente respaldada' : 'declarativa',
    normalizedMonthlyIncome,
    totalMonthlyCommitments: commitments,
    installmentToIncomeRatio: ratio,
    canonCoverage,
    maximumPrudentCanon,
    status,
    reasons,
    conditions,
    balance,
  };
}
