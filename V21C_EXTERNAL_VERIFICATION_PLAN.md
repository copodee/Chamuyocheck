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
   - Conectores autorizados por tipo de fuente (no implementados).
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
