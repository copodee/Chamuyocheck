export const BILLING_PROVIDER = 'google-pay-gateway' as const;
export const SUPPORTED_PAYMENT_METHODS = ['google-pay'] as const;
export const SUPPORTED_WALLETS = ['google-pay'] as const;

export function billingEnforcementEnabled(
  value = process.env.BILLING_ENFORCEMENT_ENABLED
): boolean {
  return value === 'true';
}

export function billingPublicState() {
  const enabled = billingEnforcementEnabled();
  return {
    enabled,
    accessMode: enabled ? 'subscription' : 'beta_full',
    provider: BILLING_PROVIDER,
    paymentMethods: SUPPORTED_PAYMENT_METHODS,
    wallets: SUPPORTED_WALLETS,
    message: enabled
      ? 'Los pagos web requieren Google Pay y un procesador comercial compatible.'
      : 'Beta con acceso completo. No se inicia ningún cobro.',
  };
}
