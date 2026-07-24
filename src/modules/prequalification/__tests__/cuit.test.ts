import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidCuit, normalizeCuit } from '../domain/cuit';

test('normaliza y valida un CUIT con dígito verificador correcto', () => {
  assert.equal(normalizeCuit('30-71234567-1'), '30712345671');
  assert.equal(isValidCuit('30-71234567-1'), true);
});

test('rechaza CUIT incompleto, repetido o con dígito incorrecto', () => {
  assert.equal(isValidCuit('30-71234567-7'), false);
  assert.equal(isValidCuit('11-11111111-1'), false);
  assert.equal(isValidCuit('123'), false);
});
