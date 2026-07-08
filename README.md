# ChamuyoCheck V5

Versión 5 del MVP: **Comité de auditoría prudente**.

## Qué agrega

- Rediseño visual: el resultado ya no queda encerrado en la columna derecha; se muestra como tablero completo y equilibrado.
- Upload de PDF: extrae texto de archivos PDF y lo analiza.
- Detector prudente de posible redacción con IA para trabajos escolares/universitarios.
- Resguardo legal reforzado: no acusa, no afirma delitos, no prueba autoría.
- Módulo financiero con costo total visible, tasa implícita, CFT faltante y cargos omitidos.
- Radar piramidal/Ponzi/referidos.
- Comité de análisis con evidencia, psicología, promesas, finanzas, pirámide e IA académica.

## Regla central

ChamuyoCheck **no afirma que alguien miente, estafa o usó IA**. Evalúa señales de riesgo, respaldo visible, información faltante y preguntas que conviene hacer antes de decidir.

## PDFs

La versión V5 usa `pdf-parse` para extraer texto de PDFs. Si un PDF es una imagen escaneada, puede no extraer texto. En esa etapa futura se podrá sumar OCR.

## Variables

```env
OPENAI_API_KEY=...
MERCADOPAGO_ACCESS_TOKEN=...
NEXT_PUBLIC_PRO_PRICE=6900
NEXT_PUBLIC_SITE_URL=https://chamuyocheck.vercel.app
```

## Deploy

Copiar el contenido de esta carpeta al repositorio local, hacer commit y push desde GitHub Desktop. Vercel redeploya automáticamente.
