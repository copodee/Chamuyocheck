import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateProvincialContractStamp, LEASING_TAXPAYER_PROFILES, PROVINCIAL_LEASING_STAMP_MATRIX, verifiedProvincialStampProfiles } from '../argentinaLeasingTaxMatrix';

test('includes every Argentine local stamp-tax jurisdiction without inventing exemptions', () => {
  assert.equal(PROVINCIAL_LEASING_STAMP_MATRIX.length, 24);
  assert.equal(new Set(PROVINCIAL_LEASING_STAMP_MATRIX.map((item) => item.jurisdiction)).size, 24);
  assert.ok(PROVINCIAL_LEASING_STAMP_MATRIX
    .filter((item) => item.status === 'verification-required')
    .every((item) => item.stampRatePercent === undefined && item.grossIncomeRatePercent === undefined));
});

test('keeps verified local leasing treatments distinct', () => {
  const verified = verifiedProvincialStampProfiles();
  assert.ok(verified.length >= 18);
  assert.match(verified.find((item) => item.jurisdiction === 'Ciudad Autónoma de Buenos Aires')?.treatment || '', /0,50%/);
  assert.match(verified.find((item) => item.jurisdiction === 'Buenos Aires')?.treatment || '', /10,5‰/);
  assert.equal(verified.find((item) => item.jurisdiction === 'Ciudad Autónoma de Buenos Aires')?.grossIncomeRatePercent, 8);
  assert.equal(verified.find((item) => item.jurisdiction === 'Buenos Aires')?.grossIncomeRatePercent, 9);
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

test('separates Chubut contract base from the purchase-option transfer', () => {
  const chubut = PROVINCIAL_LEASING_STAMP_MATRIX.find((item) => item.jurisdiction === 'Chubut');
  assert.equal(chubut?.status, 'verified-current');
  assert.equal(chubut?.stampRatePercent, 0.6);
  assert.match(chubut?.treatment || '', /sumatoria de las cuotas de canon/is);
  assert.match(chubut?.treatment || '', /valor residual/is);
  assert.match(chubut?.treatment || '', /opción/is);
  assert.match(JSON.stringify(chubut?.exemptions), /2%.*0,5%.*0,2%/s);
});

test('does not promise company benefits to consumers or monotributistas', () => {
  assert.match(LEASING_TAXPAYER_PROFILES.company, /No corresponde prometer/);
  assert.match(LEASING_TAXPAYER_PROFILES.monotributista, /no computa separadamente crédito fiscal/);
  assert.match(LEASING_TAXPAYER_PROFILES.consumer, /consumo personal/);
});

test('pending provinces expose verified structure without inventing the missing annual rate', () => {
  const pending = Object.fromEntries(PROVINCIAL_LEASING_STAMP_MATRIX
    .filter((item) => item.status === 'verification-required')
    .map((item) => [item.jurisdiction, item]));
  assert.match(pending['La Pampa']?.treatment || '', /cánones mensuales.*opción.*Anexo G.*2026/is);
  assert.match(pending.Misiones?.treatment || '', /2235060.*2235061.*transferencia/is);
  assert.match(pending['San Juan']?.treatment || '', /dos etapas.*cánones.*residual.*2026/is);
  assert.match(pending['Santa Cruz']?.treatment || '', /cánones.*residual.*pago a cuenta/is);
  assert.match(pending['Santiago del Estero']?.treatment || '', /cánones.*valor residual.*prórrogas/is);
  for (const profile of Object.values(pending)) {
    assert.equal(profile.stampRatePercent, undefined);
  }
});

test('does not add the purchase option to provinces whose contract base is canons only', () => {
  const chubut = PROVINCIAL_LEASING_STAMP_MATRIX.find((item) => item.jurisdiction === 'Chubut');
  const tucuman = PROVINCIAL_LEASING_STAMP_MATRIX.find((item) => item.jurisdiction === 'Tucumán');
  const cashflow = { canonsTotal: 206_040_000, guaranteeDeposit: 12_120_000, maxiCanonAmount: 0, optionAmount: 6_060_000 };
  const chubutEstimate = estimateProvincialContractStamp(chubut!, cashflow);
  const tucumanEstimate = estimateProvincialContractStamp(tucuman!, cashflow);
  assert.deepEqual(chubutEstimate, { base: 206_040_000, amount: 1_236_240 });
  assert.deepEqual(tucumanEstimate, { base: 206_040_000, amount: 4_120_800 });
});
