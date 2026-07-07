# ChamuyoCheck 1.0

MVP funcional para Vercel: landing, analizador con OpenAI y checkout con Mercado Pago Argentina.

## Variables de entorno en Vercel

En Project Settings > Environment Variables cargar:

- `OPENAI_API_KEY`: clave de OpenAI. Si falta, el sitio funciona en modo demo.
- `MERCADOPAGO_ACCESS_TOKEN`: token productivo de Mercado Pago Developers.
- `NEXT_PUBLIC_APP_URL`: URL pública de Vercel. Ej: `https://chamuyocheck.vercel.app`
- `PRO_PRICE_ARS`: precio. Ej: `6900`

## Deploy en Vercel

1. Descomprimir esta carpeta.
2. Subirla a un repositorio de GitHub o arrastrar el ZIP en Vercel si la cuenta lo permite.
3. En Vercel, elegir framework Next.js.
4. Cargar variables de entorno.
5. Deploy.

## Importante

La primera versión cobra con Mercado Pago y recibe el webhook, pero no guarda usuarios Pro todavía porque falta una base de datos. La versión 1.1 debe sumar Supabase para usuarios, historial y permisos Pro.
