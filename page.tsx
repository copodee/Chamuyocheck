import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(){
  try{
    const token=process.env.MERCADOPAGO_ACCESS_TOKEN;
    if(!token) return NextResponse.json({error:'Falta MERCADOPAGO_ACCESS_TOKEN en Vercel.'},{status:500});
    const appUrl=process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const price=Number(process.env.PRO_PRICE_ARS || 6900);
    const client=new MercadoPagoConfig({accessToken:token});
    const preference=new Preference(client);
    const result=await preference.create({body:{items:[{id:'chamuyocheck-pro',title:'ChamuyoCheck Pro mensual',quantity:1,unit_price:price,currency_id:'ARS'}],back_urls:{success:`${appUrl}/?pago=ok`,failure:`${appUrl}/?pago=error`,pending:`${appUrl}/?pago=pendiente`},notification_url:`${appUrl}/api/webhook/mercadopago`,auto_return:'approved'}} as any);
    return NextResponse.json({url:result.init_point});
  }catch(e:any){return NextResponse.json({error:'No se pudo crear el checkout de Mercado Pago.'},{status:500})}
}
