import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLeasingTransparencyScore } from '../leasingTransparencyScore';

test('LeasingScore rewards financial transparency instead of measuring chamuyo', () => {
  const complete = calculateLeasingTransparencyScore('Dador Banco, tomador Empresa. Bien automotor marca y modelo. Valor neto sin IVA 100 e IVA 21. Financiado 100%. Plazo 36 meses. 34 cánones fijos de $10. TNA 40%, TEA 48%, CFTEA 55%. Opción de compra 5%. Comisión de estructuración 4,5%. Seguro y mantenimiento informados. Dos cánones en garantía que se aplican al final. Sellos e impuestos discriminados. Registración y jurisdicción informadas.');
  const incomplete = calculateLeasingTransparencyScore('Me ofrecen un leasing de un auto.');
  assert.ok(complete.score >= 85);
  assert.ok(incomplete.score < 30);
  assert.ok(incomplete.missing.includes('CFTEA o costo financiero total'));
});
