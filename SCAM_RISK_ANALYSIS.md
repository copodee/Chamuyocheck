# Análisis preventivo de posibles estafas

ChamuyoCheck identifica patrones observables en textos, páginas públicas, enlaces y capturas leídas mediante OCR. La evaluación separa la evidencia visible de la conclusión jurídica.

## Señales cubiertas

- ganancias o rendimientos garantizados;
- pagos anticipados para liberar premios, créditos o fondos;
- ingresos condicionados a referidos;
- presión para pagar o decidir;
- solicitud de claves, códigos o acceso remoto;
- pagos por canales difíciles de revertir o a terceros;
- identidad o canal no verificable;
- retornos extraordinarios en plazos cortos;
- enlaces sin HTTPS, con credenciales incrustadas, direcciones IP o puertos inusuales;
- acortadores, cadenas excesivas de subdominios, Punycode y extensiones que requieren cautela;
- rutas que intentan inducir acceso, verificación, soporte, billetera o actualización de cuenta.

Cada señal conserva una explicación breve y saneada. Los parámetros publicitarios, identificadores extensos y consultas completas de una URL no se reproducen en el informe. El puntaje expresa acumulación de señales preventivas, no probabilidad de delito.

## Verificación externa gratuita

Cuando la consulta corresponde a una oferta o inversión sospechosa, el sistema intenta contrastar el dominio exacto mediante fuentes públicas:

- datos RDAP de registro y antigüedad del dominio;
- alertas y registros públicos de la CNV cuando la propuesta es financiera;
- ficha pública de reputación del dominio exacto en ScamAdviser, si está disponible;
- investigaciones de seguridad relevantes, como antecedentes documentados de malvertising, cuando el enlace contiene indicadores de esa red publicitaria.

Una fuente contextual no se usa como prueba contra un sitio concreto. Por ejemplo, un antecedente de malvertising distribuido mediante una red publicitaria no convierte automáticamente en fraudulento a todo anuncio de esa red.

## Enfoque inspirado en verificadores de enlaces

Se replican controles transparentes que también recomiendan herramientas como ESET Link Checker: revisar la escritura y estructura del dominio, el cifrado, las redirecciones o destinos ocultos y la coherencia entre la identidad declarada y el sitio real. No se copia ni se simula la base propietaria de amenazas de ESET; sin una API o licencia, ChamuyoCheck no afirma haber obtenido un veredicto de esa empresa.

## Resultado prudente

El sistema no afirma que exista estafa, fraude o responsabilidad penal únicamente por estas señales. Explica el nivel de riesgo, qué evidencia externa obtuvo y qué debe comprobarse: identidad legal, CUIT, dominio oficial, contrato, custodia de fondos y autorización o advertencias en organismos como BCRA, CNV y defensa del consumidor.

## Identidad del enlace y redirecciones

- La URL pegada y el destino final se registran por separado.
- Las redirecciones se siguen manualmente, con un máximo de cinco saltos, y cada destino se valida antes de conectarse.
- Se bloquean destinos locales, privados o no públicos incluso cuando aparecen después de una redirección, para evitar accesos internos inducidos por una página externa.
- Un cambio de dominio durante la redirección se informa como señal observable que requiere revisar quién opera realmente el servicio.
- Campos publicitarios como `site_domain`, el medio donde apareció el anuncio y otros parámetros de campaña se tratan solo como contexto de distribución. Nunca prueban la identidad del operador ni sustituyen al dominio final.
- Los informes muestran dominios y rutas breves. No reproducen consultas publicitarias, identificadores de seguimiento ni fragmentos extensos de la URL.
