import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST() {
  try {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const price = Number(process.env.PRO_PRICE_ARS || '6900');
    if (!token) return NextResponse.json({ error: 'Falta configurar MERCADOPAGO_ACCESS_TOKEN.' }, { status: 500 });
    const client = new MercadoPagoConfig({ accessToken: token });
    const preference = new Preference(client);
    const result = await preference.create({ body: {
      items: [{ id: 'chamuyocheck-pro', title: 'ChamuyoCheck Pro - Mensual', quantity: 1, unit_price: price, currency_id: 'ARS' }],
      back_urls: { success: `${appUrl}/exito`, failure: `${appUrl}/error`, pending: `${appUrl}/pendiente` },
      auto_return: 'approved',
      notification_url: `${appUrl}/api/webhook`,
      statement_descriptor: 'CHAMUYOCHECK'
    }});
    return NextResponse.json({ init_point: result.init_point });
  } catch (e:any) {
    return NextResponse.json({ error: 'No se pudo crear el pago con Mercado Pago.' }, { status: 500 });
  }
}
