import assert from 'node:assert/strict';
import test from 'node:test';
import { LEASING_TAXPAYER_PROFILES, PROVINCIAL_LEASING_STAMP_MATRIX, verifiedProvincialStampProfiles } from '../argentinaLeasingTaxMatrix';

test('includes every Argentine local stamp-tax jurisdiction without inventing exemptions', () => {
  assert.equal(PROVINCIAL_LEASING_STAMP_MATRIX.length, 24);
  assert.equal(new Set(PROVINCIAL_LEASING_STAMP_MATRIX.map((item) => item.jurisdiction)).size, 24);
  assert.ok(PROVINCIAL_LEASING_STAMP_MATRIX.filter((item) => item.status === 'verification-required').every((item) => item.exemptions.length === 0));
});

test('keeps verified local leasing treatments distinct', () => {
  const verified = verifiedProvincialStampProfiles();
  assert.equal(verified.length, 8);
  assert.match(verified.find((item) => item.jurisdiction === 'Ciudad Autónoma de Buenos Aires')?.treatment || '', /0,50%/);
  assert.match(verified.find((item) => item.jurisdiction === 'Buenos Aires')?.treatment || '', /10,5‰/);
  assert.match(verified.find((item) => item.jurisdiction === 'Córdoba')?.treatment || '', /exime/);
  assert.match(verified.find((item) => item.jurisdiction === 'Entre Ríos')?.treatment || '', /pago a cuenta/);
  assert.match(verified.find((item) => item.jurisdiction === 'Santa Fe')?.treatment || '', /25%/);
  assert.match(verified.find((item) => item.jurisdiction === 'Neuquén')?.treatment || '', /14‰/);
  assert.match(verified.find((item) => item.jurisdiction === 'Mendoza')?.treatment || '', /1%/);
  assert.match(verified.find((item) => item.jurisdiction === 'Jujuy')?.treatment || '', /8%/);
});

test('does not promise company benefits to consumers or monotributistas', () => {
  assert.match(LEASING_TAXPAYER_PROFILES.company, /No corresponde prometer/);
  assert.match(LEASING_TAXPAYER_PROFILES.monotributista, /no computa separadamente crédito fiscal/);
  assert.match(LEASING_TAXPAYER_PROFILES.consumer, /consumo personal/);
});
