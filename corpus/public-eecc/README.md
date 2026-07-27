# Corpus público de estados contables argentinos

Este directorio contiene el manifiesto reproducible usado para validar el
extractor de estados contables de LeasingScoring. No es entrenamiento de un
modelo fundacional: es un conjunto de regresión para medir clasificación,
extracción, normalización y cálculo de ratios.

## Principios

- Sólo se registran documentos públicos obtenidos de CNV o de relaciones con
  inversores de emisoras.
- Los PDF no se versionan. `npm run corpus:download` los descarga en
  `corpus/public-eecc/downloads/`, directorio ignorado por Git.
- Cada caso identifica sector, período, alcance, moneda, escala y procedencia.
- Los estados de entidades financieras se marcan con un perfil separado porque
  no comparten la estructura ni los ratios de una empresa comercial.
- Un documento nuevo debe conservar su URL de origen y una fecha de consulta.

## Uso

```bash
npm run corpus:validate
npm run corpus:download
npm run corpus:analyze
```

Para descargar un subconjunto:

```bash
npm run corpus:download -- --id central-costanera-2025
npm run corpus:download -- --sector energia
```

La descarga comprueba que la respuesta sea un PDF real, limita el tamaño y
genera `downloads/index.json` con tamaño y SHA-256. Los resultados extraídos y
los valores contables revisados se incorporarán progresivamente como fixtures
de regresión, sin inventar cifras que no hayan sido verificadas.

## Línea de base inicial

La primera ejecución comprende cuatro estados contables oficiales y 255
páginas. El análisis compara automáticamente el cierre, tipo de período,
alcance y escala detectados contra el manifiesto. Las divergencias quedan en
`downloads/analysis.json`; no se ocultan ni se corrigen con valores inventados.

Esta línea de base ya detectó casos concretos para mejorar:

- estados anuales donde faltan rubros centrales por extraer;
- estados intermedios que requieren reconocer correctamente su duración;
- estados separados confundidos con consolidados;
- fechas comparativas tomadas erróneamente como fecha de cierre.

El criterio de avance es que una corrección mejore estos casos sin degradar los
anteriores ni los expedientes privados usados en las pruebas existentes.
