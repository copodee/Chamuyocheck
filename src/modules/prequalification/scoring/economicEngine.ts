import type { EconomicAssessment, EconomicInputs, ExtractedBalance, RegulatoryExposureAssessment } from '../domain/dossier';
import { analyzeCorporateEvolution, analyzeCorporateFinancials } from './corporateFinancialAnalysis';

const POLICY_RATIO = 0.3;

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

export function evaluateRegulatoryExposure(inputs: EconomicInputs, balance?: ExtractedBalance): RegulatoryExposureAssessment {
  if (inputs.profile !== 'legal-entity') {
    return {
      applicable: false, computableNetWorth: null, existingComputableFinancing: 0,
      requestedFinancing: 0, totalExposure: 0, exposureToNetWorthRatio: null,
      basicMarginAvailable: null, status: 'not-applicable', label: 'No aplicable', conditions: [],
    };
  }
  const computableNetWorth = Math.max(0, Number(inputs.computableNetWorth || balance?.equity || 0)) || null;
  const existingComputableFinancing = Math.max(0, Number(inputs.existingComputableFinancing ?? balance?.financialDebt ?? 0));
  const requestedFinancing = Math.max(0, Number(inputs.requestedFinancing || 0));
  const totalExposure = existingComputableFinancing + requestedFinancing;
  const basicMarginAvailable = computableNetWorth === null ? null : Math.max(0, computableNetWorth - existingComputableFinancing);

  if (!computableNetWorth || !requestedFinancing) {
    return {
      applicable: true, computableNetWorth, existingComputableFinancing, requestedFinancing,
      totalExposure, exposureToNetWorthRatio: null, basicMarginAvailable,
      status: 'missing-data', label: 'No evaluable',
      conditions: [
        !computableNetWorth ? 'Informá el patrimonio computable para verificar la graduación del crédito.' : '',
        !requestedFinancing ? 'Informá el monto neto que se solicita financiar.' : '',
      ].filter(Boolean),
    };
  }
  const ratio = totalExposure / computableNetWorth;
  if (ratio <= 1) {
    return { applicable: true, computableNetWorth, existingComputableFinancing, requestedFinancing, totalExposure, exposureToNetWorthRatio: ratio, basicMarginAvailable, status: 'basic-margin', label: 'Dentro del margen básico', conditions: [] };
  }
  if (ratio <= 2) {
    return {
      applicable: true, computableNetWorth, existingComputableFinancing, requestedFinancing, totalExposure,
      exposureToNetWorthRatio: ratio, basicMarginAvailable, status: 'complementary-margin',
      label: 'Sujeta a margen complementario',
      conditions: ['Supera el 100% del patrimonio computable: requiere aprobación especial y verificar el límite respecto de la RPC de la entidad otorgante.'],
    };
  }
  if (ratio <= 3 && inputs.qualifyingGuarantee === 'sgr-public-fund') {
    return {
      applicable: true, computableNetWorth, existingComputableFinancing, requestedFinancing, totalExposure,
      exposureToNetWorthRatio: ratio, basicMarginAvailable, status: 'guaranteed-special-margin',
      label: 'Sujeta a margen especial con garantía',
      conditions: ['Solo puede encuadrar con garantía elegible de SGR o fondo público y verificando el límite respecto de la RPC de la entidad otorgante.'],
    };
  }
  return {
    applicable: true, computableNetWorth, existingComputableFinancing, requestedFinancing, totalExposure,
    exposureToNetWorthRatio: ratio, basicMarginAvailable, status: 'outside-regulatory-margin',
    label: 'Fuera del margen regulatorio informado',
    conditions: [ratio <= 3
      ? 'La exposición supera el 200% y no se informó una garantía elegible de SGR o fondo público.'
      : 'La exposición supera el 300% del patrimonio computable.'],
  };
}

export function evaluateEconomicCapacity(
  inputs: EconomicInputs,
  documentCount: number,
  balance?: ExtractedBalance,
  previousBalance?: ExtractedBalance,
): EconomicAssessment {
  const reasons: string[] = [];
  const conditions: string[] = [];
  let normalizedMonthlyIncome: number | null = null;
  const regulatoryExposure = evaluateRegulatoryExposure(inputs, balance);
  const corporateFinancials = inputs.profile === 'legal-entity' ? analyzeCorporateFinancials(balance, previousBalance) : undefined;
  const corporateEvolution = inputs.profile === 'legal-entity' ? analyzeCorporateEvolution(balance, previousBalance) : undefined;

  if (inputs.profile === 'employee') {
    normalizedMonthlyIncome = Math.max(0, Number(inputs.employeeNetIncome || 0)) || null;
    reasons.push('Se utilizó íntegramente el ingreso neto mensual declarado.');
  } else if (inputs.profile === 'legal-entity') {
    const monthlySales = average(inputs.monthlySales || []);
    const balanceResult = balance?.operatingProfit ?? balance?.netProfit;
    if (balanceResult != null && balance?.sales) {
      const balanceMargin = Math.max(0, balanceResult / balance.sales);
      normalizedMonthlyIncome = monthlySales
        ? monthlySales * balanceMargin
        : balanceResult / 12;
      reasons.push(`El margen del ${(balanceMargin * 100).toFixed(1)}% se calculó automáticamente con el resultado y las ventas del último balance.`);
    } else {
      normalizedMonthlyIncome = null;
      conditions.push('El balance debe informar ventas y resultado operativo o neto para calcular automáticamente el margen.');
    }
  } else if (inputs.profile === 'monotributista') {
    normalizedMonthlyIncome = Math.max(0, Number(inputs.declaredMonthlyNetIncome || 0)) || average(inputs.monthlySales || []) || null;
    reasons.push('Se utilizó íntegramente el ingreso mensual neto declarado. Los comprobantes solo determinan si el dato está respaldado.');
  } else {
    const monthlySales = average(inputs.monthlySales || []);
    const margin = Math.max(0, Math.min(1, Number(inputs.declaredOperatingMargin || 0) / 100));
    normalizedMonthlyIncome = monthlySales && margin ? monthlySales * margin : null;
    reasons.push('La facturación se convirtió en ingreso estimado mediante el margen declarado.');
  }

  if (inputs.profile !== 'employee' && inputs.hasEmploymentIncome) {
    const employmentIncome = Math.max(0, Number(inputs.additionalEmploymentNetIncome || 0));
    if (employmentIncome > 0) {
      normalizedMonthlyIncome = (normalizedMonthlyIncome || 0) + employmentIncome;
      reasons.push('Se sumó íntegramente el ingreso neto declarado en relación de dependencia.');
    }
  }
  if (inputs.profile === 'employee' && inputs.hasMonotributoIncome) {
    const monotributoIncome = Math.max(0, Number(inputs.additionalMonotributoNetIncome || 0));
    if (monotributoIncome > 0) {
      normalizedMonthlyIncome = (normalizedMonthlyIncome || 0) + monotributoIncome;
      reasons.push('Se sumó íntegramente el ingreso neto declarado de la actividad monotributista.');
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
  if (!(inputs.proposedMonthlyCanon > 0)) {
    conditions.push('Ingresá el canon mensual propuesto para evaluar la relación cuota/ingreso.');
  } else if (ratio !== null) {
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

  if (regulatoryExposure.applicable) {
    conditions.push(...regulatoryExposure.conditions);
    if (regulatoryExposure.status === 'missing-data') {
      status = 'manual-review';
      score = Math.min(score, 50);
    } else if (regulatoryExposure.status === 'complementary-margin' || regulatoryExposure.status === 'guaranteed-special-margin') {
      status = 'conditional';
      score = Math.min(score, 68);
    } else if (regulatoryExposure.status === 'outside-regulatory-margin') {
      status = 'not-compatible';
      score = Math.min(score, 30);
    }
  }
  if (inputs.activitySeniorityMonths < 12) {
    score -= 10;
    conditions.push('Antigüedad menor a 12 meses: requiere revisión de política.');
  }
  if (documentCount === 0) {
    conditions.push('Ingresos declarativos sin comprobantes adjuntos: solicitar respaldo antes de una decisión definitiva.');
  }
  if (balance && balance.extractionConfidence < 60) {
    conditions.push('El balance requiere revisión manual de campos no extraídos.');
  }
  if (corporateFinancials?.status === 'weak') {
    status = 'manual-review';
    score = Math.min(score, 45);
    conditions.push('Los indicadores del último balance requieren revisión crediticia antes de continuar.');
  }
  if (corporateEvolution?.trend === 'deteriorating') {
    status = status === 'not-compatible' ? status : 'conditional';
    score = Math.min(score, 65);
    conditions.push('La evolución entre los dos últimos balances es desfavorable y requiere revisión.');
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
    corporateFinancials,
    corporateEvolution,
    regulatoryExposure,
  };
}
