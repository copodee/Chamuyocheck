import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as analyzePost } from '../../../app/api/analyze/route';
import { POST as checkoutPost } from '../../../app/api/checkout/route';
import { billingEnforcementEnabled } from '../billing/config';

test('el endpoint de análisis rechaza solicitudes sin una cuenta autenticada', async () => {
  const form = new FormData();
  form.append('text', 'Analizá esta propuesta de préstamo');
  const response = await analyzePost(new Request('http://localhost/api/analyze', {
    method: 'POST',
    body: form,
  }));

  assert.equal(response.status, 401);
  assert.match(String((await response.json()).error), /sesi[oó]n/i);
});

test('la activación de cobros exige el valor explícito true', () => {
  assert.equal(billingEnforcementEnabled(undefined), false);
  assert.equal(billingEnforcementEnabled('false'), false);
  assert.equal(billingEnforcementEnabled('TRUE'), false);
  assert.equal(billingEnforcementEnabled('true'), true);
});

test('el checkout no puede iniciar cobros durante la beta', async () => {
  const previous = process.env.BILLING_ENFORCEMENT_ENABLED;
  process.env.BILLING_ENFORCEMENT_ENABLED = 'false';
  try {
    const response = await checkoutPost();
    const body = await response.json();
    assert.equal(response.status, 409);
    assert.equal(body.status, 'billing_disabled');
    assert.equal(body.billing.accessMode, 'beta_full');
    assert.equal(body.billing.provider, 'google-pay-gateway');
    assert.deepEqual(body.billing.paymentMethods, ['google-pay']);
    assert.deepEqual(body.billing.wallets, ['google-pay']);
  } finally {
    if (previous === undefined) delete process.env.BILLING_ENFORCEMENT_ENABLED;
    else process.env.BILLING_ENFORCEMENT_ENABLED = previous;
  }
});
