export type LeasingFinanceInput = {
  assetValue: number;
  financedPercent: number;
  months: number;
  annualNominalRatePercent: number;
  optionPercent: number;
  guaranteeCanons: number;
  structuringFeePercent: number;
};

export type LeasingFinanceResult = {
  financedAmount: number;
  initialContribution: number;
  monthlyCanon: number;
  optionAmount: number;
  guaranteeDeposit: number;
  structuringFee: number;
  lessorMonthlyIrrPercent: number | null;
  lessorEffectiveAnnualIrrPercent: number | null;
};

function monthlyIrr(cashflows: number[]) {
  const npv = (rate: number) => cashflows.reduce((sum, cashflow, index) => sum + cashflow / ((1 + rate) ** index), 0);
  let low = -0.9999;
  let high = 10;
  if (npv(low) * npv(high) > 0) return null;
  for (let index = 0; index < 200; index += 1) {
    const middle = (low + high) / 2;
    if (npv(low) * npv(middle) <= 0) high = middle;
    else low = middle;
  }
  return (low + high) / 2;
}

export function calculateFinancialLeasing(input: LeasingFinanceInput): LeasingFinanceResult {
  const financedPercent = Math.min(100, Math.max(0, input.financedPercent));
  const financedAmount = input.assetValue * financedPercent / 100;
  const initialContribution = input.assetValue - financedAmount;
  const monthlyRate = input.annualNominalRatePercent / 100 / 12;
  const optionAmount = input.assetValue * Math.max(0, input.optionPercent) / 100;
  const optionPresentValue = optionAmount / ((1 + monthlyRate) ** input.months);
  const amortizedAmount = Math.max(0, financedAmount - optionPresentValue);
  const monthlyCanon = monthlyRate === 0
    ? amortizedAmount / input.months
    : amortizedAmount * monthlyRate / (1 - ((1 + monthlyRate) ** -input.months));
  const guaranteeCanons = Math.min(input.months, Math.max(0, Math.floor(input.guaranteeCanons)));
  const guaranteeDeposit = monthlyCanon * guaranteeCanons;
  const structuringFee = financedAmount * Math.max(0, input.structuringFeePercent) / 100;
  const cashflows = [-financedAmount + guaranteeDeposit + structuringFee];
  for (let month = 1; month <= input.months; month += 1) {
    const isCoveredByGuarantee = month > input.months - guaranteeCanons;
    cashflows.push((isCoveredByGuarantee ? 0 : monthlyCanon) + (month === input.months ? optionAmount : 0));
  }
  const irr = monthlyIrr(cashflows);
  return {
    financedAmount,
    initialContribution,
    monthlyCanon,
    optionAmount,
    guaranteeDeposit,
    structuringFee,
    lessorMonthlyIrrPercent: irr === null ? null : irr * 100,
    lessorEffectiveAnnualIrrPercent: irr === null ? null : (((1 + irr) ** 12) - 1) * 100,
  };
}
