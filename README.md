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


# RC2 Dashboard Premium

Actualización visual inspirada en dashboard profesional:
- Sidebar izquierda.
- ChamuyoScore circular.
- Semáforo de decisiones.
- Tabs de informe: Resumen, Evidencias, Riesgos, IA, Finanzas, Recomendaciones, Fuentes.
- Aviso legal reducido a barra inferior fija y desplegable.
- El resguardo legal grande del informe queda eliminado visualmente.


# RC3 Free Plan + Historial local

Incluye:
- Historial local visible en sidebar.
- Guarda últimos 8 análisis en localStorage.
- Plan Starter: 3 usos gratis de texto hasta 250 caracteres.
- Bloqueo visual de funciones Pro cuando no corresponde.
- Botón de prueba para alternar Starter / Pro hasta conectar login y billing real.


# V11 Producto Comercial

Incluye:
- Dashboard premium RC2.
- Historial local RC3.
- Plan Starter / Pro visual.
- Modal de suscripción Pro.
- Botón Conectar Google visual.
- Exportación de informe vía impresión/PDF del navegador.
- Placeholders técnicos para Google Auth, Google Play Billing y exportación de informes.
- Preparado para conectar backend real en la próxima versión.

## Próximo paso
V12 debería conectar servicios reales:
- Auth con Google.
- Base de datos para historial.
- Mercado Pago web / Google Play Billing Android.
- PDF export real con branding.


# V12 Informe PDF + Comparador

Incluye:
- Botón "Descargar informe PDF" usando impresión limpia del navegador.
- Estilos especiales para exportar informe sin sidebar ni controles.
- Comparador preliminar: permite pegar una segunda fuente, versión o documento.
- Sección de comparación documental dentro del informe.
- Base técnica para exportación PDF profesional posterior.


# V13 Beta - Motor inteligente

Incluye:
- Router de dominio inicial: académico, financiero, contrato, salud, noticia, política, ciencia, redes, inversión, publicidad o general.
- Especialistas activados según temática detectada.
- Motor de señales de evidencia: URLs, montos, porcentajes, fechas y afirmaciones fuertes.
- Vista previa de temática en la interfaz antes de analizar.
- Etiqueta BETA visible en la marca.
- Base real para reemplazar análisis genérico por motores especializados.

## Nota técnica
Esta beta introduce motores internos en `src/analysis/engines`.
Próxima evolución: conectar OCR real, scraping seguro de URLs, transcripción de YouTube y base de datos.


# V14 Alpha - OCR, Web y YouTube

Incluye:
- Extractor web inicial: intenta leer texto de URLs públicas.
- Identificador de YouTube: detecta ID del video y deja preparado el flujo de transcripción.
- OCR preparado: recibe imágenes/capturas y devuelve estado claro para futura integración OCR real.
- Mantiene lectura de PDF con texto mediante pdf-parse.
- Mantiene motor inteligente por dominio de V13 Beta.
- UI con etiqueta ALPHA y panel de capacidades.

## Limitaciones conocidas
- Algunos sitios bloquean extracción web o requieren JavaScript.
- YouTube aún no descarga subtítulos automáticamente.
- OCR real requiere servicio adicional o backend especializado.


# V15 Beta - Usuarios e Historial

Incluye:
- Preparación real para Supabase Auth.
- Cliente Supabase en `src/lib/supabase/client.ts`.
- SQL schema para perfiles y análisis en `src/lib/supabase/schema.sql`.
- Historial cloud-ready en `src/lib/history/cloudHistory.ts`.
- Modal de login visual: Google / email.
- Dashboard con métricas: análisis guardados, plan, modo historial y usos gratis.
- Historial indica modo Local o Nube.
- Mantiene Starter / Pro.

## Para activar Supabase real
1. Crear proyecto en Supabase.
2. Ejecutar `src/lib/supabase/schema.sql`.
3. Configurar:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
4. Conectar llamadas reales desde la UI.


# V15.1 Build Fix

Corrige el error de compilación en Vercel:
- Elimina imports relativos frágiles desde `app/api/analyze/route.ts`.
- Incrusta helpers seguros dentro del endpoint.
- Corrige el prompt que contenía variables no definidas.
- Mantiene las carpetas `src/` como arquitectura futura.
