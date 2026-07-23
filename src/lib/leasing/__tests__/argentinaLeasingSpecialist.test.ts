import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DECREE_1038_USEFUL_LIVES,
  minimumFinancialLeaseMonths,
  missingLocalTaxInputs,
  NATIONAL_LEASING_RULES,
} from '../argentinaLeasingSpecialist';

test('covers the national legal, tax, use, registration and amortization core', () => {
  assert.ok(NATIONAL_LEASING_RULES.length >= 8);
  assert.ok(DECREE_1038_USEFUL_LIVES.some((item) => item.assetClass === 'vehicles' && item.usefulLifeYears === 5));
  assert.equal(minimumFinancialLeaseMonths('vehicles'), 30);
  assert.equal(minimumFinancialLeaseMonths('immovable'), 60);
});

test('does not invent municipal or provincial costs without territorial inputs', () => {
  const missing = missingLocalTaxInputs({ province: 'Buenos Aires', fiscalYear: 2026 });
  assert.ok(missing.includes('tipo de bien'));
  assert.ok(missing.some((item) => item.startsWith('municipio')));
});
