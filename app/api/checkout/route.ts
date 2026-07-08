import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    ok: false,
    status: 'pending_integration',
    message: 'Checkout pendiente de integración real. Primero se debe completar autenticación, planes y variables de entorno de pago.',
    nextStep: 'Configurar proveedor de pagos cuando el plan Pro esté listo.',
  }, { status: 200 });
}
