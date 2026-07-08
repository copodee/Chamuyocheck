# ChamuyoCheck V9.1 - Lee PDF real

Cambio clave:
- El backend recibe FormData.
- Si se sube un PDF, intenta extraer texto con pdf-parse.
- El análisis prioriza el texto extraído del PDF por encima de la pregunta del usuario.
- Muestra estado de lectura: caracteres extraídos, páginas si están disponibles y advertencia si requiere OCR.
- Mejora clasificación de notas, trabajos académicos, contratos, préstamos y documentos.

Importante:
- PDFs escaneados o solo imagen pueden requerir OCR. Eso queda para V9.5/V10.
