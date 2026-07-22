import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinancialLeasing, calculateQuotedLeasingCashflow } from '../leasingFinanceMath';

test('calcula canon francés con opción residual y porcentaje financiado', () => {
  const result = calculateFinancialLeasing({ assetValue: 100_000, financedPercent: 80, months: 24, annualNominalRatePercent: 36, optionPercent: 10, guaranteeCanons: 0, structuringFeePercent: 0 });
  assert.equal(result.financedAmount, 80_000);
  assert.equal(result.initialContribution, 20_000);
  assert.ok(result.monthlyCanon > 3_000 && result.monthlyCanon < 5_000);
  assert.equal(result.optionAmount, 10_000);
});

test('los cánones de garantía y el gasto inicial elevan la TIR del dador sin duplicar las últimas cuotas', () => {
  const base = calculateFinancialLeasing({ assetValue: 100_000, financedPercent: 100, months: 36, annualNominalRatePercent: 30, optionPercent: 5, guaranteeCanons: 0, structuringFeePercent: 0 });
  const enhanced = calculateFinancialLeasing({ assetValue: 100_000, financedPercent: 100, months: 36, annualNominalRatePercent: 30, optionPercent: 5, guaranteeCanons: 3, structuringFeePercent: 3 });
  assert.ok(enhanced.guaranteeDeposit > 0);
  assert.equal(enhanced.structuringFee, 3_000);
  assert.ok((enhanced.lessorEffectiveAnnualIrrPercent || 0) > (base.lessorEffectiveAnnualIrrPercent || 0));
});

test('calcula el flujo completo de una cotización sin duplicar cánones de garantía', () => {
  const result = calculateQuotedLeasingCashflow({
    assetValueNet: 125_826_000,
    months: 36,
    regularCanonCount: 34,
    regularCanonAmount: 6_060_000,
    optionAmount: 6_060_000,
    guaranteeCanons: 2,
    guaranteeAmount: 12_120_000,
    structuringFeePercent: 3,
  });

  assert.equal(result.regularCanonsTotal, 206_040_000);
  assert.equal(result.guaranteeDeposit, 12_120_000);
  assert.equal(result.structuringFee, 3_774_780);
  assert.equal(result.totalNominalOutflow, 227_994_780);
  assert.equal(result.nominalFinancingCost, 102_168_780);
  assert.ok(result.monthlyIrrPercent !== null && result.monthlyIrrPercent > 0);
  assert.ok(result.effectiveAnnualRatePercent !== null && result.effectiveAnnualRatePercent > 0);
});

test('no inventa una garantía económica cuando los cánones informados ya cubren todo el plazo', () => {
  const result = calculateQuotedLeasingCashflow({
    assetValueNet: 10_000_000,
    months: 12,
    regularCanonCount: 12,
    regularCanonAmount: 1_000_000,
    guaranteeCanons: 2,
    guaranteeAmount: 2_000_000,
    optionAmount: 500_000,
  });

  assert.equal(result.guaranteeDeposit, 0);
  assert.equal(result.totalNominalOutflow, 12_500_000);
});

test('incorpora costos iniciales cuantificados y separa el IVA financiero estimado', () => {
  const result = calculateQuotedLeasingCashflow({
    assetValueNet: 125_826_000,
    months: 36,
    regularCanonCount: 34,
    regularCanonAmount: 6_060_000,
    optionAmount: 6_060_000,
    guaranteeCanons: 2,
    guaranteeAmount: 12_120_000,
    structuringFeePercent: 3,
    directInitialCosts: 2_156_677,
    vatRatePercent: 21,
  });

  assert.equal(result.directInitialCosts, 2_156_677);
  assert.equal(result.totalNominalOutflow, 230_151_457);
  assert.equal(result.estimatedVatCashOutflow, 47_878_903.8);
  assert.equal(result.totalCashOutflowWithEstimatedVat, 278_030_360.8);
});
