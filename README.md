# ChamuyoCheck V9.1 - Lee PDF real

Cambio clave:
- El backend recibe FormData.
- Si se sube un PDF, intenta extraer texto con pdf-parse.
- El análisis prioriza el texto extraído del PDF por encima de la pregunta del usuario.
- Muestra estado de lectura: caracteres extraídos, páginas si están disponibles y advertencia si requiere OCR.
- Mejora clasificación de notas, trabajos académicos, contratos, préstamos y documentos.

Importante:
- PDFs escaneados o solo imagen pueden requerir OCR. Eso queda para V9.5/V10.


## V9.2
- Resguardo legal visualmente más compacto.
- Tipografía menor.
- Se muestra como nota legal al pie del informe.
- Mantiene protección legal sin competir visualmente con el análisis principal.


## V9.3
- Agrega encabezado premium del resultado: primero "Documento identificado".
- Muestra cantidad de caracteres leídos del PDF.
- Agrega extracto del texto leído por ChamuyoCheck para que el usuario vea que analizó el documento y no solo la pregunta.
- Cambia "Módulos" por "Especialistas activados automáticamente".
- Mejora jerarquía visual del informe.


## V11 Intelligence Edition
- Agrega ChamuyoScore™ como índice principal.
- Agrega explicación del puntaje.
- Agrega evidencias encontradas.
- Agrega sección "Qué deberías verificar".
- Agrega sección "Cómo mejorar este documento".
- Agrega botones visuales "Refutar este documento" y "Mejorar documento".
- Reduce el aviso legal a aproximadamente 25% del tamaño anterior.
- Mantiene enfoque prudente: analiza, no acusa.


# Release Candidate 1

RC1 consolida ChamuyoCheck como base de producto:

## Incluye
- V11 Intelligence Edition.
- ChamuyoScore™.
- Explicación del puntaje.
- Evidencias encontradas.
- Qué deberías verificar.
- Cómo mejorar el documento.
- Lectura de PDF con `pdf-parse`.
- Resguardo legal ultracompacto.
- Estructura modular inicial en `src/`.

## Nueva arquitectura preparada
- `src/analysis/engines`
- `src/analysis/guards`
- `src/analysis/types`
- `src/analysis/utils`
- `src/lib/pdf`
- `src/lib/finance`
- `src/lib/history`
- `src/lib/billing`

## Próximo paso recomendado
RC2 debería conectar usuarios reales:
- Auth con Google.
- Base de datos.
- Historial persistente.
- Plan Starter / Pro en servidor.
- Preparación para Google Play Billing.
