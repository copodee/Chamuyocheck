# V21C — External Verification Decision Engine

## Objetivo

Separar la decisión de verificar de la ejecución de una búsqueda. V21C debe indicar cuándo una afirmación necesita fuentes externas y qué clases de fuentes corresponden, sin afirmar que esas fuentes fueron consultadas.

## Fases

1. **Decisión segura y observable (implementada)**
   - Motor puro basado en naturaleza V21A, dominio V21B, actualidad y especificidad.
   - Plan por afirmación con `externalVerificationRequired`, `externalVerificationPerformed`, motivo, tipos de fuente, cantidad mínima, vigencia y requisito de fuente oficial.
   - `externalVerificationPerformed` queda siempre en `false`: esta fase no tiene conectores ni acceso a fuentes.
   - Integración sólo como metadato del claim. No participa del scoring, de los gates, de la selección de especialistas ni de la UI.

2. **Consolidación de planes (implementada)**
   - Agrupar planes repetidos a nivel documento.
   - Resolver jurisdicción y fecha de corte explícitas.
   - Mantener el estado `performed` en falso mientras no exista una ejecución real.
   - Deduplicar tipos de fuente y ordenar grupos de verificación por prioridad.
   - Integración sólo como metadato documental; no participa de UI ni scoring.

3. **Ejecución real con trazabilidad (fundación segura implementada; conectores pendientes)**
   - Contrato y validador auditable para evidencia entregada por futuros conectores.
   - Primer conector implementado: leyes nacionales argentinas mediante URL explícita de la vista oficial InfoLEG en `argentina.gob.ar/normativa` y validación adicional del número de ley.
   - La búsqueda automática por número queda pendiente porque el buscador público usa CAPTCHA y la ruta corta por sí sola representa un ID interno, no el número de ley.
   - El conector directo sólo obtiene metadata oficial auditable; no interpreta por sí mismo si una ley prueba o refuta el claim.
   - Búsqueda general y otros conectores por tipo de fuente continúan pendientes.
   - Conector BCRA implementado para cotizaciones oficiales por moneda y fecha mediante su API pública.
   - Conector Boletín Oficial implementado para URLs explícitas de avisos de primera sección.
   - Adaptador periodístico implementado para URLs explícitas de Clarín, La Nación, Infobae y Ámbito, exigiendo título y fecha auditables.
   - Los registros periodísticos son no oficiales y requieren la corroboración independiente definida por el plan documental.
   - Registro internacional inicial implementado: OMS GHO y PubMed para biología/salud y ciencia; Banco Mundial para indicadores económicos por país.
   - Los conectores internacionales exigen identificadores estructurados (PMID, código OMS o código de indicador económico) y no realizan inferencias semánticas por sí solos.
   - Orquestador explícito implementado para ejecutar solicitudes concretas, aislar fallos, deduplicar registros y entregar el conjunto al registro auditable.
   - El pipeline normal no dispara consultas externas automáticamente.
   - Planificador seguro implementado: convierte únicamente URLs e identificadores explícitos en solicitudes; cuando faltan parámetros registra el claim como pendiente y no adivina valores.
   - Todos los conectores bloquean redirecciones automáticas, aplican timeout y rechazan respuestas sobredimensionadas.
   - El orquestador deduplica solicitudes antes de acceder a red y rechaza ejecuciones con más de 12 solicitudes únicas.
   - Workflow backend end-to-end implementado: planificación local por defecto y ejecución sólo con `execute: true`.
   - Endpoint `POST /api/verify` implementado; la red permanece bloqueada salvo `EXTERNAL_VERIFICATION_EXECUTION_ENABLED=true`.
   - El workflow proyecta por claim `externalVerificationRequired`, `externalVerificationPerformed`, estado, evidencia asociada y motivos pendientes, siempre derivados de cobertura auditable validada.
   - Registro de consultas, URLs, fecha, fragmentos y resultado por claim.
   - `externalVerificationPerformed` sólo puede cambiar a `true` si existe evidencia auditable asociada.
   - Una verificación completa exige cobertura por claim, fuentes independientes suficientes, URL válida, fecha y fuente oficial cuando corresponda.

4. **Consumo en reporte/UI (no implementada)**
   - Mostrar requerido, realizado, fuentes consultadas y límites.
   - Requiere revisión separada; no implica por sí sola cambios de scoring.

## Invariantes de las fases 1, 2 y fundación de fase 3

- Nunca se inventan búsquedas, fuentes ni citas.
- `externalVerificationPerformed === false` para todos los resultados.
- La decisión no modifica el score global ni scores por claim.
- Opiniones puramente subjetivas y predicciones futuras no se presentan como verificables ahora.
- Derecho, tratamiento médico, estadísticas, actualidad y eventos públicos requieren fuentes adecuadas al dominio.
- Matemática y conocimiento científico fundacional pueden resolverse localmente.
