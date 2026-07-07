# ChamuyoCheck 1.0

**La IA que detecta el chamuyo.**

Aplicación Next.js lista para Vercel con:
- Landing profesional.
- Analizador con OpenAI.
- Modo demo si falta API key.
- Checkout con Mercado Pago Argentina.
- Webhook básico de Mercado Pago.

## Variables de entorno en Vercel

En Project Settings > Environment Variables cargar:

- `OPENAI_API_KEY`: clave de OpenAI.
- `MERCADOPAGO_ACCESS_TOKEN`: token productivo de Mercado Pago Developers.
- `NEXT_PUBLIC_APP_URL`: URL pública de Vercel, ejemplo `https://chamuyocheck.vercel.app`
- `PRO_PRICE_ARS`: ejemplo `6900`

## Deploy

1. Subir estos archivos al repositorio GitHub.
2. Importar el repositorio en Vercel.
3. Elegir preset Next.js.
4. Cargar variables de entorno.
5. Deploy.

## Próxima versión

ChamuyoCheck 1.1 debería sumar Supabase para usuarios, login con Google, historial de análisis, permisos Pro y panel administrador.
