import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateBuenosAiresVehiclePatent2026, estimateCabaVehiclePatent2026 } from '../vehiclePatent';

test('calculates Buenos Aires 2026 annual patent from fiscal valuation', () => {
  assert.deepEqual(estimateBuenosAiresVehiclePatent2026(20_000_000), {
    valuation: 20_000_000,
    taxableBase: 19_000_000,
    annualTax: 242_000,
    isNew: false,
  });
});

test('uses the full valuation for a new vehicle', () => {
  assert.equal(estimateBuenosAiresVehiclePatent2026(20_000_000, { isNew: true })?.annualTax, 272_000);
});

test('calculates CABA 2026 patent including the subway fund increment', () => {
  assert.deepEqual(estimateCabaVehiclePatent2026(20_000_000), {
    valuation: 20_000_000,
    taxBeforeSubwayFund: 635_175,
    annualTaxBeforeTransitionCap: 698_692.5,
    annualTax: 698_692.5,
    effectiveRatePercent: 3.493462,
    transitionCapApplied: false,
  });
});

test('applies the CABA statutory effective-rate ceiling', () => {
  assert.equal(estimateCabaVehiclePatent2026(100_000_000)?.annualTax, 6_000_000);
});

test('applies the CABA 2026 IPCBA transition cap when prior-year tax is supplied', () => {
  const result = estimateCabaVehiclePatent2026(20_000_000, { priorYearTax: 400_000 });
  assert.equal(result?.annualTaxBeforeTransitionCap, 698_692.5);
  assert.equal(result?.annualTax, 527_200);
  assert.equal(result?.transitionCapApplied, true);
});
