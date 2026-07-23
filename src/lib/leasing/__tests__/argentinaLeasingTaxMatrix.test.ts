import assert from 'node:assert/strict';
import test from 'node:test';
import { LEASING_TAXPAYER_PROFILES, PROVINCIAL_LEASING_STAMP_MATRIX, verifiedProvincialStampProfiles } from '../argentinaLeasingTaxMatrix';

test('includes every Argentine local stamp-tax jurisdiction without inventing exemptions', () => {
  assert.equal(PROVINCIAL_LEASING_STAMP_MATRIX.length, 24);
  assert.equal(new Set(PROVINCIAL_LEASING_STAMP_MATRIX.map((item) => item.jurisdiction)).size, 24);
  assert.ok(PROVINCIAL_LEASING_STAMP_MATRIX
    .filter((item) => item.status === 'verification-required')
    .every((item) => item.stampRatePercent === undefined && item.grossIncomeRatePercent === undefined));
});

test('keeps verified local leasing treatments distinct', () => {
  const verified = verifiedProvincialStampProfiles();
  assert.ok(verified.length >= 17);
  assert.match(verified.find((item) => item.jurisdiction === 'Ciudad Autónoma de Buenos Aires')?.treatment || '', /0,50%/);
  assert.match(verified.find((item) => item.jurisdiction === 'Buenos Aires')?.treatment || '', /10,5‰/);
  assert.match(verified.find((item) => item.jurisdiction === 'Córdoba')?.treatment || '', /exime/);
  assert.match(verified.find((item) => item.jurisdiction === 'Entre Ríos')?.treatment || '', /pago a cuenta/);
  assert.match(verified.find((item) => item.jurisdiction === 'Santa Fe')?.treatment || '', /25%/);
  assert.match(verified.find((item) => item.jurisdiction === 'Neuquén')?.treatment || '', /14‰/);
  assert.match(verified.find((item) => item.jurisdiction === 'Mendoza')?.treatment || '', /1%/);
  assert.match(verified.find((item) => item.jurisdiction === 'Jujuy')?.treatment || '', /8%/);
  assert.match(verified.find((item) => item.jurisdiction === 'Salta')?.treatment || '', /0‰.*8%/i);
  assert.match(verified.find((item) => item.jurisdiction === 'Chaco')?.treatment || '', /649100.*2,90%/i);
  assert.equal(verified.find((item) => item.jurisdiction === 'Chaco')?.stampRatePercent, undefined);
  assert.match(verified.find((item) => item.jurisdiction === 'Río Negro')?.treatment || '', /10‰.*9%/i);
  assert.equal(verified.find((item) => item.jurisdiction === 'Río Negro')?.stampRatePercent, 1);
  assert.match(verified.find((item) => item.jurisdiction === 'Tierra del Fuego')?.treatment || '', /1%/);
  assert.equal(verified.find((item) => item.jurisdiction === 'Tierra del Fuego')?.stampRatePercent, 1);
  const cabaRules = JSON.stringify(verified.find((item) => item.jurisdiction === 'Ciudad Autónoma de Buenos Aires'));
  assert.match(cabaRules, /Ley CABA 6\.926.*tomador.*guarda habitual.*uso o explotación/is);
  assert.doesNotMatch(cabaRules, /dador está domiciliado|dador se halle domiciliado/is);
});

test('keeps Formosa bases and La Rioja contract treatment distinct from option transfers', () => {
  const formosa = PROVINCIAL_LEASING_STAMP_MATRIX.find((item) => item.jurisdiction === 'Formosa');
  const laRioja = PROVINCIAL_LEASING_STAMP_MATRIX.find((item) => item.jurisdiction === 'La Rioja');
  assert.equal(formosa?.status, 'verified-current');
  assert.match(formosa?.treatment || '', /cánones.*pago a cuenta/is);
  assert.equal(laRioja?.status, 'verified-current');
  assert.equal(laRioja?.stampRatePercent, 0);
  assert.match(laRioja?.stampRateCondition || '', /no instrumente una transferencia inmobiliaria/i);
});

test('applies Tucumán rate to the contract without hiding the option transfer', () => {
  const tucuman = PROVINCIAL_LEASING_STAMP_MATRIX.find((item) => item.jurisdiction === 'Tucumán');
  assert.equal(tucuman?.status, 'verified-current');
  assert.equal(tucuman?.stampRatePercent, 2);
  assert.match(tucuman?.treatment || '', /total de cánones.*valor residual/is);
});

test('separates Catamarca contract, transfer and annual vehicle tax', () => {
  const catamarca = PROVINCIAL_LEASING_STAMP_MATRIX.find((item) => item.jurisdiction === 'Catamarca');
  assert.equal(catamarca?.status, 'verified-current');
  assert.equal(catamarca?.stampRatePercent, 0);
  assert.match(catamarca?.treatment || '', /0%.*transferencia.*1%.*2%/is);
});

test('separates San Luis stamp tax from the lessor gross income rate', () => {
  const sanLuis = PROVINCIAL_LEASING_STAMP_MATRIX.find((item) => item.jurisdiction === 'San Luis');
  assert.equal(sanLuis?.status, 'verified-current');
  assert.equal(sanLuis?.stampRatePercent, 1.2);
  assert.equal(sanLuis?.grossIncomeRatePercent, 6.5);
  assert.match(sanLuis?.treatment || '', /12‰.*649100.*6,50%/is);
});

test('does not promise company benefits to consumers or monotributistas', () => {
  assert.match(LEASING_TAXPAYER_PROFILES.company, /No corresponde prometer/);
  assert.match(LEASING_TAXPAYER_PROFILES.monotributista, /no computa separadamente crédito fiscal/);
  assert.match(LEASING_TAXPAYER_PROFILES.consumer, /consumo personal/);
});
