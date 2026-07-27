import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedTermMonths, isAllowedTerm } from './assetPolicy';

test('habilita 12, 18, 24 y 36 meses para embarcaciones de personas humanas y monotributistas', () => {
  assert.deepEqual(allowedTermMonths('persona-humana', 'embarcacion'), [12, 18, 24, 36]);
  assert.equal(isAllowedTerm('persona-humana', 'embarcacion', 24), true);
  assert.equal(isAllowedTerm('persona-humana', 'embarcacion', 48), false);
});

test('habilita únicamente 36 meses para embarcaciones de empresas', () => {
  assert.deepEqual(allowedTermMonths('persona-juridica', 'embarcacion'), [36]);
  assert.equal(isAllowedTerm('persona-juridica', 'embarcacion', 36), true);
  assert.equal(isAllowedTerm('persona-juridica', 'embarcacion', 24), false);
});

test('conserva los plazos existentes para los demás bienes', () => {
  assert.deepEqual(allowedTermMonths('persona-juridica', 'equipo'), [12, 18, 24, 36, 48, 60, 72, 84]);
});
