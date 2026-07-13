# Análisis financiero especializado

## Enlaces bancarios argentinos

Una URL pegada en el cuadro de texto se detecta automáticamente como entrada web. La clasificación reconoce préstamos, créditos, leasing y microcréditos por la ruta y por dominios bancarios argentinos. La identidad de la URL solo sirve para enrutar el análisis: `externalVerificationPerformed` permanece en `false` si la página no pudo leerse realmente.

La cobertura incluye bancos nacionales, provinciales, privados y digitales. La nómina oficial de entidades debe contrastarse con el BCRA; la lista local de dominios mejora el enrutamiento, pero no reemplaza esa fuente oficial ni certifica una oferta.

## Entradas admitidas

- texto copiado de una oferta;
- página web pública de un banco o entidad financiera;
- PDF con texto extraíble;
- captura PNG, JPG o WebP de hasta 10 MB mediante OCR local en español.

El OCR utiliza Tesseract.js y datos de idioma incluidos en la aplicación. No envía la captura a una API de OCR paga.

## Datos reconocidos

- precio de contado;
- monto financiado o capital;
- anticipo;
- importe y cantidad de cuotas;
- TNA, TEA y CFT/CFTEA;
- total declarado, cuando está expresamente rotulado.

La extracción se hace por etiquetas y contexto. No se elige automáticamente el número más grande o más pequeño de una página.

## Cálculos

Cuando existen monto financiado, cuota y plazo, se informa:

- suma nominal de cuotas;
- total conocido, incluyendo anticipo cuando fue identificado;
- diferencia entre cuotas y capital financiado;
- porcentaje nominal de esa diferencia;
- tasa mensual y TEA implícitas aproximadas para cuotas constantes.

Cada operación se presenta de forma reproducible. Los importes calculados no se describen como costo integral si faltan seguros, IVA, gastos administrativos, sellados, prenda, cuota final o cualquier otro cargo.

## Páginas bancarias

El extractor lee HTML público, texto visible, metadatos y JSON-LD. No inicia sesión ni ejecuta simuladores JavaScript. Si una página muestra las condiciones solamente después de completar un simulador, el sistema informa que faltan datos y el usuario puede aportar una captura de la cotización final.

## Límites deliberados

- Una primera cuota no se presume constante para todo el plazo.
- Una tasa publicitada no reemplaza el CFT.
- El contenido publicado por el banco es la fuente de las condiciones declaradas, pero no constituye por sí mismo corroboración independiente.
- Una lectura OCR de baja calidad debe revisarse contra la imagen original.
