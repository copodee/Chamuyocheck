# Alcance especializado de ChamuyoCheck

ChamuyoCheck analiza únicamente tres áreas:

1. **Finanzas y créditos**: préstamos, cuotas, tasas, CFT, costos, inversiones y rentabilidad.
2. **Posibles estafas**: ofertas engañosas, Ponzi, pirámides, suplantación, pagos anticipados y ganancias garantizadas.
3. **Derecho argentino y documentos legales**: contratos, cláusulas, obligaciones, delitos, penas, divorcios y asuntos de familia.

## Regla de entrada

Toda consulta pasa primero por `productScopeClassifier`. El clasificador exige señales contextuales de una especialidad y no acepta como señal financiera una palabra aislada como “economía”, un cargo público o la mera carga de un PDF.

Si la consulta está fuera del alcance:

- no se ejecuta el pipeline de claims;
- no se ejecuta verificación externa;
- no se calcula ni se muestra ChamuyoScore;
- se informa el motivo y las tres áreas disponibles.

## Integridad académica y uso de IA

La detección concluyente de autoría por IA no forma parte de las especialidades activas. Un texto, por sí solo, no permite probar quién lo escribió. Esta exclusión evita acusaciones académicas sin evidencia suficiente.

## Documentos

La carga de documentos está disponible cuando su contenido corresponde a alguna especialidad activa. “Análisis documental” no significa cobertura universal: un documento médico, deportivo o periodístico continúa fuera de alcance aunque se presente como PDF.

## Verificación y seguridad

Estar dentro del alcance habilita el análisis, pero no garantiza que exista evidencia suficiente. El sistema debe distinguir entre verificación completada, contradicción, corroboración parcial e inconclusión, y nunca inventar fuentes o búsquedas.
