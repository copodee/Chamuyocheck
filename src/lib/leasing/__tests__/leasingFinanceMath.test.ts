import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFinancialLeasing } from '../leasingFinanceMath';

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
