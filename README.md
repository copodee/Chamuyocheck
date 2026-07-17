# Estado actual: registro obligatorio y beta completa

ChamuyoCheck exige una cuenta real para analizar contenido. El usuario puede registrarse con correo electrónico y clave o ingresar con Google mediante Supabase Auth. La API valida la sesión en el servidor antes de iniciar cada análisis.

Durante la beta, todas las cuentas registradas tienen acceso completo a texto, enlaces, imágenes, PDFs y demás funciones disponibles, sin cupos ni cobros. El modo de facturación permanece desactivado y los endpoints de pago rechazan operaciones para impedir cargos accidentales.

La arquitectura futura de suscripciones web está reservada para Google Pay mediante un procesador o gateway compatible. Google Workspace y el ingreso con Google identifican al usuario, pero no procesan ni liquidan cobros. Google Play Billing se reservaría para una futura aplicación Android distribuida por Play. La activación comercial requerirá crear el perfil de pagos, obtener el Merchant ID, contratar un procesador compatible, verificar el dominio y recién entonces habilitar explícitamente `BILLING_ENFORCEMENT_ENABLED`.

## Activación de cuentas

1. Ejecutar `src/lib/supabase/schema.sql` en el proyecto de Supabase.
2. Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el entorno local y de producción.
3. Habilitar correo electrónico y, si se desea, el proveedor Google en Supabase Auth.
4. Registrar la URL pública y las URLs de redirección autorizadas en Supabase y Google.

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

## Estado actual de usuarios y acceso
- Registro e ingreso real por email y contraseña.
- Acceso con Google mediante Supabase Auth.
- Sesión validada en el servidor antes de analizar.
- Uso completo para todas las cuentas registradas mientras dure la beta.
- Cobros y restricciones desactivados hasta una activación comercial expresa.


# RC2 Dashboard Premium

Actualización visual inspirada en dashboard profesional:
- Sidebar izquierda.
- ChamuyoScore circular.
- Semáforo de decisiones.
- Tabs de informe: Resumen, Evidencias, Riesgos, IA, Finanzas, Recomendaciones, Fuentes.
- Aviso legal reducido a barra inferior fija y desplegable.
- El resguardo legal grande del informe queda eliminado visualmente.


# RC3 Free Plan + Historial local (histórico, reemplazado)

Esta etapa experimental fue retirada. Sus límites locales y controles simulados no forman parte del producto actual.


# V11 Producto Comercial (histórico)

Esta versión introdujo el dashboard y la exportación visual. Las simulaciones de planes y facturación de esa etapa fueron eliminadas; el estado vigente es acceso beta completo con cuenta obligatoria.

## Próximo paso
V12 debería conectar servicios reales:
- Auth con Google.
- Base de datos para historial.
- Facturación web futura mediante Google Pay y un procesador compatible.
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
- Supabase Auth real.
- Cliente Supabase en `src/lib/supabase/client.ts`.
- SQL schema para perfiles y análisis en `src/lib/supabase/schema.sql`.
- Historial cloud-ready en `src/lib/history/cloudHistory.ts`.
- Registro e ingreso por email y contraseña, más acceso con Google.
- Validación del token de sesión en el endpoint de análisis.
- Perfil automático con acceso `beta_full` y registro de usos exitosos.
- Sin planes pagos, límites ni cobros activos durante la beta.

## Para activar Supabase real
1. Usar el proyecto de Supabase del producto.
2. Ejecutar `src/lib/supabase/schema.sql`.
3. Configurar:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Habilitar Email y Google en los proveedores de autenticación de Supabase.
5. Registrar en Google y Supabase las URLs autorizadas del dominio de producción.


# V15.1 Build Fix

Corrige el error de compilación en Vercel:
- Elimina imports relativos frágiles desde `app/api/analyze/route.ts`.
- Incrusta helpers seguros dentro del endpoint.
- Corrige el prompt que contenía variables no definidas.
- Mantiene las carpetas `src/` como arquitectura futura.


# V15.2 Integración de pago retirada (histórico)

La integración de cobro experimental de esta etapa fue retirada y no forma parte del diseño vigente.


# V15.3 Checkout seguro desactivado

- El checkout rechaza cualquier intento de cobro mientras `BILLING_ENFORCEMENT_ENABLED` no sea exactamente `true`.
- La futura pasarela queda reservada para Google Pay web mediante un procesador compatible.
- No se aceptan pagos ni eventos hasta que exista una cuenta comercial, un Merchant ID, un dominio verificado y validación criptográfica del procesador.


# V15.4 Regex Build Fix

Corrige el error de TypeScript:

`This regular expression flag is only available when targeting 'es2018' or later.`

Cambio:
- Reemplaza el flag regex `s` por una expresión compatible `[\s\S]*?`.


# V15.6 PDF Parse Fix

Corrige el error de build:

`Property 'default' does not exist on type 'typeof import("pdf-parse")'`

Cambios:
- Ajusta la importación dinámica de `pdf-parse`.
- Mantiene `target` en `ES2018`.


# V15.7 Evidence Signals Fix

Corrige el error de build:
`Cannot find name 'evidenceSignals'`

Cambio:
- Reemplaza la variable inexistente `evidenceSignals`.
- Usa el resultado real del helper local `extractEvidenceSignalsLocal(text)`.


# V15.8 Evidence Variable Fix

Corrige el error de build:

`Cannot find name 'evidence'`

Cambio:
- Declara `const evidence = extractEvidenceSignalsLocal(text)` antes de usarlo.
- Convierte las señales en texto seguro dentro del prompt.


# V15.9 Prompt Variable Fix

Corrige el error de build:

`Cannot find name 'evidence'`

Cambios:
- Declara `evidence` y `evidenceSignals` antes del prompt.
- Reemplaza referencias inseguras del prompt por `evidenceSignals.join('; ')`.


# V15.10 Clean Build Fix

Reemplaza completamente `app/api/analyze/route.ts` por una versión limpia y autocontenida.

Corrige:
- Variables `evidence` / `evidenceSignals` mal ubicadas.
- Problemas de imports frágiles.
- Import dinámico de `pdf-parse`.
- Regex incompatible.
- Mantiene target ES2018.

Objetivo:
- Cortar la cadena de parches y dejar el endpoint compilable.


# V15.11 Remove Hardcoded User

Corrección urgente:
- Elimina el nombre personal hardcodeado de la interfaz pública.
- Reemplaza `Nicolás Scioli` por `Usuario invitado`.
- Reemplaza `Plan Pro` por `Plan gratuito` hasta que exista autenticación real.
- Evita que terceros vean datos personales de prueba.
