import { NextResponse } from 'next/server';
import { billingPublicState } from '../../../src/lib/billing/config';

export async function POST() {
  const billing = billingPublicState();
  if (!billing.enabled) {
    return NextResponse.json({
      ok: false,
      status: 'billing_disabled',
      billing,
      message: 'El acceso completo está habilitado durante la beta. No se inició ningún cobro.',
    }, { status: 409 });
  }

  return NextResponse.json({
    ok: false,
    status: 'merchant_configuration_required',
    billing,
    message: 'Google Workspace no procesa pagos. Para habilitar Google Pay web faltan el Merchant ID, un gateway o procesador compatible, la verificación del dominio y una activación explícita antes de cobrar.',
  }, { status: 503 });
}
