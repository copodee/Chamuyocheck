import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateBuenosAiresVehiclePatent2026 } from '../vehiclePatent';

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
