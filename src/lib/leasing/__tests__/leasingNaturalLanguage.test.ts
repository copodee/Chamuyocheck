import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLeasingNaturalLanguage } from '../leasingNaturalLanguage';

test('extracts the mobile free-text leasing example and flags the missing option value', () => {
  const result = extractLeasingNaturalLanguage(
    'Me ofrecen comprar un auto de 5000000 me piden un maxicanon de 10% y 36 cuotas por el resto al 38% tna mas la opción de compra. Cuanto termino pagando?',
  );

  assert.deepEqual(result, {
    assetValue: 5_000_000,
    maxiCanonPercent: 10,
    financedPercent: 90,
    months: 36,
    annualNominalRatePercent: 38,
    optionPercent: undefined,
    optionAmount: undefined,
    mentionsOptionWithoutValue: true,
  });
});
