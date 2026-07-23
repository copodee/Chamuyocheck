export type LeasingTaxpayerProfile = 'company' | 'human-general-regime' | 'monotributista' | 'consumer';
export type ProvincialStampStatus = 'verified-current' | 'verification-required';

export type ProvincialStampProfile = {
  jurisdiction: string;
  fiscalYear?: number;
  status: ProvincialStampStatus;
  treatment: string;
  exemptions: string[];
  stampRatePercent?: number;
  stampRateCondition?: string;
  contractStampBaseKind?: 'canons-only' | 'visible-contract-total';
  grossIncomeRatePercent?: number;
  sourceUrl?: string;
  sourceUrls?: string[];
  verifiedAt?: string;
};

export const LEASING_TAXPAYER_PROFILES: Record<LeasingTaxpayerProfile, string> = {
  company: 'Una persona jurídica inscripta en Ganancias e IVA puede aprovechar deducciones y crédito fiscal sólo si el contrato encuadra, el bien está afectado a actividad gravada, existe documentación válida y tiene impuesto contra el cual computarlos. No corresponde prometer una deducción del 100% ni ahorro automático.',
  'human-general-regime': 'Una persona humana autónoma en régimen general puede tener un tratamiento empresarial comparable sólo en la proporción afectada a su actividad gravada y con los mismos límites y requisitos. La forma humana o societaria, por sí sola, no crea ni elimina el beneficio.',
  monotributista: 'El monotributo sustituye IVA y Ganancias por la actividad incluida: el tomador no computa separadamente crédito fiscal de IVA ni deduce el canon en una liquidación general de Ganancias por esa actividad. Por eso el beneficio comercialmente anunciado suele ser mucho menor o inexistente.',
  consumer: 'Una persona humana que usa el bien para consumo personal normalmente soporta el IVA y los tributos locales como costo y no puede deducir el canon ni computar crédito fiscal por ese uso. Sin embargo, mientras sólo tenga la tenencia y la titularidad continúe en el dador, el bien subyacente normalmente no integra el patrimonio del tomador en Bienes Personales. Si ejerce la opción y se transfiere el dominio, debe analizar su incorporación desde ese período. Esta ventaja patrimonial no elimina patente, seguro, tasas ni otros gastos que el contrato ponga a cargo del tomador.',
};

const researchedPending = (
  jurisdiction: string,
  treatment: string,
  sourceUrl: string,
  exemptions: string[] = [],
  sourceUrls: string[] = [sourceUrl],
): ProvincialStampProfile => ({
  jurisdiction,
  fiscalYear: 2026,
  status: 'verification-required',
  treatment,
  exemptions,
  sourceUrl,
  sourceUrls,
  verifiedAt: '2026-07-23',
});

// A jurisdiction is promoted to verified-current only after checking its current
// official fiscal code and annual tariff law.
export const PROVINCIAL_LEASING_STAMP_MATRIX: ProvincialStampProfile[] = [
  {
    jurisdiction: 'Ciudad Autónoma de Buenos Aires', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 0.5,
    treatment: 'AGIP informa una alícuota de Sellos del 0,50% para contratos de leasing. El Valor Locativo de Referencia de alquileres comerciales no se aplica a leasing.',
    exemptions: [
      'No se encontró una exención general por el solo hecho de ser leasing; deben revisarse las exenciones del acto, bien y sujeto concretos.',
      'Código Fiscal CABA 2026, art. 319(a): un acto instrumentado en CABA no tributa Sellos allí cuando los bienes objeto de la transacción están radicados o situados fuera de CABA. Esto debe cruzarse con la territorialidad de la provincia donde el contrato produce efectos.',
      'Ley CABA 6.926, art. 1 inciso 37: desde 2026 el art. 422 considera radicado fiscalmente en CABA al vehículo en leasing cuando el tomador está domiciliado allí o cuando el vehículo tiene guarda habitual, uso o explotación en CABA. El domicilio del dador fue eliminado de esta regla. El Digesto DNRPA permite acreditar la guarda con documentos extendidos a nombre del tomador.',
    ],
    sourceUrl: 'https://imagenes.agip.gob.ar/impuestos/sellos',
    sourceUrls: ['https://imagenes.agip.gob.ar/impuestos/sellos', 'https://documentosboletinoficial.buenosaires.gob.ar/publico/ck_PL-LEY-LCABA-LCBA-6926-25-7269.pdf', 'https://www.dnrpa.gov.ar/concursos_publicos/Digesto12-06-2023/Titulo1.pdf'], verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Buenos Aires', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 1.05,
    stampRateCondition: 'Alícuota especial para leasing registrado en entidades autorizadas; otros encuadres requieren determinar la tasa aplicable.',
    treatment: 'La base especial es el total de cánones. Si se ejerce la opción, la transferencia toma el mayor entre el valor total asignado (cánones más opción) y la valuación fiscal, con crédito por Sellos pagado sobre los cánones. La Ley Impositiva fija 10,5‰ para leasing registrado en entidades autorizadas; otros encuadres requieren determinar la alícuota aplicable.',
    exemptions: [
      'ARBA informa que PBA alcanza los instrumentos celebrados en la Provincia y/o que causen efectos en ella. Un contrato firmado en CABA para un bien usado o radicado en PBA requiere liquidar la territorialidad bonaerense y no asumir que el pago en CABA lo sustituye.',
      'Tasa 0% para la venta de determinados vehículos nuevos destinados a leasing, sujeta a las categorías y condiciones de la Ley Impositiva 2026.',
      'Tasa 0% para el ejercicio de la opción de compra de inmuebles ubicados en un Agrupamiento Industrial reconocido, bajo sus condiciones.',
      'La antigua bonificación automotor del 20% por leasing no debe presentarse como beneficio vigente general en 2026.',
    ],
    sourceUrl: 'https://www.arba.gov.ar/archivos/Publicaciones/leyimpositiva2026.pdf',
    sourceUrls: ['https://www.arba.gov.ar/archivos/Publicaciones/leyimpositiva2026.pdf', 'https://web.arba.gov.ar/preguntas-frecuentes/que-grava-el-impuesto-de-sellos'], verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Córdoba', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 0,
    stampRateCondition: 'Sólo si el contrato y el destino económico cumplen el Decreto 484/2022.',
    treatment: 'El Decreto provincial 484/2022, que el portal oficial de Rentas identifica como vigente, exime del Impuesto de Sellos a los contratos de leasing comprendidos en las modalidades de los incisos a), b), c) y e) del artículo 1231 del Código Civil y Comercial, cuando el tomador destina el bien al desarrollo de sus actividades económicas.',
    exemptions: ['La exención exige modalidad contractual comprendida y destino económico del bien; no es una exención general para consumo personal ni para cualquier contrato denominado leasing.'],
    sourceUrl: 'https://cms.rentascordoba.gob.ar/wp-content/uploads/2022/05/decreto_n%C2%B0_484-2022_-_eximicion_impuesto_de_sellos._contratos_de_leasing.pdf', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Entre Ríos', status: 'verified-current',
    treatment: 'El Código Fiscal provincial establece como base imponible los cánones por los años de duración del leasing y permite tomar el Sellos pagado durante el contrato como pago a cuenta del impuesto correspondiente a la transferencia del dominio. La alícuota debe completarse con la Ley Impositiva anual vigente antes de calcular.',
    exemptions: ['No se verificó una exención general vigente por el solo hecho de ser leasing.'],
    sourceUrl: 'https://www.ater.gov.ar/ater2/archivos/ATER-C%C3%B3digo%20Fiscal-digital-2022.pdf', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Santa Fe', fiscalYear: 2026, status: 'verified-current',
    treatment: 'La Ley 14.426 mantiene el tratamiento de Ingresos Brutos para operaciones de entidades financieras que tengan por objeto constituir leasing. Para 2026 permite a los sujetos alcanzados deducir, con un tope del 25% de la base imponible atribuida a Santa Fe, ciertos ingresos financieros comprendidos en programas productivos o asistencia pública, incluidos los ingresos computables por leasing para municipios.',
    exemptions: [
      'El beneficio identificado corresponde a Ingresos Brutos del dador o entidad financiera, está sujeto a encuadre y reglamentación y no equivale a una exención general de Sellos ni a un beneficio automático del tomador.',
      'La Ley Impositiva 2026 revisada no incorporó una exención general de Sellos para todo contrato de leasing; la alícuota del instrumento y la adquisición u opción deben verificarse en el nomenclador vigente según el bien y el acto.',
    ],
    sourceUrl: 'https://www.santafe.gov.ar/boletinoficial/verPdf.php?seccion=2025%2F2025-12-23ley14426.html', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Neuquén', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 1.4,
    treatment: 'La Ley Impositiva 3541 fija Sellos del 14‰ para contratos de leasing sobre el monto de los cánones durante su duración hasta ejercer la opción. Al ejercerse la compra se liquida la alícuota prevista para el tipo de bien transferido. La actividad 649100, arrendamiento financiero/leasing, tributa Ingresos Brutos al 9%.',
    exemptions: [
      'No se identificó una exención general de Sellos por leasing en la Ley Impositiva 2026.',
      'En inmuebles, la inscripción que implique transmisión, modificación o constitución de derechos —incluido leasing— tiene además una tasa registral del 6‰ sobre la valuación fiscal o el contrato, el mayor, con mínimo legal; esta tasa no es Impuesto de Sellos.',
    ],
    sourceUrl: 'https://www.legislaturaneuquen.gob.ar/svrfiles/Neuleg/normaslegales/pdf/LEY3541FD.pdf', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Mendoza', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 1,
    stampRateCondition: 'Alícuota general 2026; el acto o bien puede tener una tasa específica.',
    treatment: 'El Código Fiscal 2026 calcula Sellos del leasing sobre los cánones hasta ejercer la opción. Si se transfiere un inmueble o bien mueble registrable, la base es el mayor entre el valor total adjudicado —cánones más residual— y el valor de referencia, computando como pago a cuenta el impuesto abonado durante el contrato. La Ley 9680 fija para 2026 una alícuota general de Sellos del 1%, con tasas específicas según el acto o bien.',
    exemptions: [
      'La Ley 9680 establece una reducción plurianual de la alícuota general: 1% en 2026, 0,75% en 2027, 0,50% en 2028, 0,25% en 2029 y 0% en 2030; el cronograma puede prorrogarse si se verifica la situación recesiva definida por la ley.',
      'Para 2026 existen tasas específicas que pueden incidir al inscribir o ejercer la opción: 2% para actos sobre inmuebles, 1,5% para inscripción de vehículos 0 km y 0,25% para inscripción inicial o transferencia onerosa de maquinaria agrícola, vial e industrial. Debe elegirse la tasa del acto concreto, no sumar todas.',
      'En leasing automotor el contribuyente del Impuesto Automotor es el dador, aunque la radicación provincial puede determinarse por domicilio del tomador, guarda o explotación en Mendoza.',
    ],
    sourceUrl: 'https://atm.mendoza.gov.ar/wp-content/uploads/2025/12/Ley-Impositiva-2026.pdf', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Jujuy', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 1,
    treatment: 'La Ley Impositiva 6492 fija una alícuota específica de Sellos del 1% para los contratos de leasing. La actividad 649100, arrendamiento financiero/leasing, tributa Ingresos Brutos al 8%.',
    exemptions: [
      'No se identificó en la Ley Impositiva 2026 una exención general de Sellos para leasing.',
      'La constitución o transferencia de derechos sobre inmuebles y otros bienes puede tener una alícuota propia; debe distinguirse el contrato inicial del ejercicio e inscripción de la opción de compra.',
    ],
    sourceUrl: 'https://boletinoficial.jujuy.gob.ar/?p=324226', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Salta', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 0,
    stampRateCondition: 'Tope general vigente desde 2022; no comprende transferencias de inmuebles, automotores ni actividades hidrocarburíferas.',
    grossIncomeRatePercent: 8,
    treatment: 'La Ley Impositiva 6.611, texto oficial actualizado por la Ley 8.496/2025, mantiene en su artículo 25 bis un tope de Sellos del 0‰ desde 2022 para los actos, contratos e instrumentos generales, con excepción de transferencias de inmuebles y automotores y de actividades hidrocarburíferas. La intermediación y los servicios financieros tributan Actividades Económicas al 80‰ (8%).',
    exemptions: [
      'El contrato de leasing debe separarse del ejercicio de la opción: la transferencia de un automotor o inmueble no queda comprendida en el tope general del 0‰ y conserva la tasa específica del acto.',
      'La tasa del 8% corresponde a la actividad financiera del dador alcanzado; no es un impuesto provincial adicional del 8% que el tomador deba sumar automáticamente al canon.',
      'La alternativa provincial sólo es válida si el contrato y el bien tienen una conexión real con Salta; la alícuota 0% no habilita una instrumentación o radicación aparente.',
    ],
    sourceUrl: 'https://boletinoficialsalta.gob.ar/Texto_Actualizado.php?cXdlcnR5dGFibGE9THw2NjExJmNhYmU9PGg2PiBQdWJsaWNhZG8gZW4gZWwgQm9sZXTDg8KtbiBPZmljaWFsIE7DgsKwIDAsIGVsIGTDg8KtYSAgZGUgIGRlIDwvaDY+PEJSPnF3ZXJ0eQ=%3D',
    verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Chaco', fiscalYear: 2026, status: 'verified-current',
    grossIncomeRatePercent: 2.9,
    treatment: 'El Nomenclador NAECh 2026 de la Administración Tributaria Provincial asigna al código 649100 “Arrendamiento financiero, leasing” una alícuota de Ingresos Brutos del 2,90%. La alícuota de Sellos del contrato no se completa por analogía y debe determinarse con la Ley Tarifaria 299-F vigente y el instrumento concreto.',
    exemptions: [
      'El 2,90% corresponde a la actividad del dador alcanzado por Ingresos Brutos; no debe presentarse como un porcentaje adicional que el tomador paga directamente por el contrato.',
      'No se verificó todavía una exención general de Sellos para leasing ni una tasa específica vigente; el comparador debe mostrar “Sellos pendiente de verificación” y no asignar 0%.',
    ],
    sourceUrl: 'https://atp.chaco.gob.ar/documentos/legislativos/nomenclador-naech-res-2026-2-20-1-desde-01-01-2026.pdf',
    sourceUrls: [
      'https://atp.chaco.gob.ar/documentos/legislativos/nomenclador-naech-res-2026-2-20-1-desde-01-01-2026.pdf',
      'https://atp.chaco.gob.ar/legislacion-tributaria',
    ],
    verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Río Negro', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 1,
    grossIncomeRatePercent: 9,
    treatment: 'La Ley Impositiva 5.837 incluye expresamente al leasing entre los contratos de locación y ejecución sucesiva alcanzados por Sellos al 10‰ (1%). La misma ley asigna a la actividad 649100, arrendamiento financiero/leasing, una alícuota de Ingresos Brutos del 9%.',
    exemptions: [
      'La opción de compra no debe confundirse con el contrato: la transferencia de automotores tributa, como regla, 20‰, con supuestos de 0‰ para determinados vehículos productivos y actividades bajo las condiciones del artículo 14.',
      'La Ley I 2407 alcanza instrumentos otorgados fuera de Río Negro cuando se negocian, ejecutan o producen efectos allí; para bienes registrables también debe revisarse su lugar de radicación.',
      'El 9% es Ingresos Brutos del dador alcanzado y no un recargo que deba sumarse automáticamente al canon del tomador.',
    ],
    sourceUrl: 'https://web.legisrn.gov.ar/legislativa/legislacion/documento?id=11108',
    sourceUrls: ['https://web.legisrn.gov.ar/legislativa/legislacion/documento?id=11108', 'https://www.legisrn.gov.ar/L/L02407.html'],
    verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Tierra del Fuego', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 1,
    stampRateCondition: 'Alícuota de contratos y operaciones en general; la opción y los actos registrales se analizan separadamente.',
    treatment: 'AREF informa una alícuota de Sellos del 1% para contratos y operaciones en general. El Código Fiscal contiene una base específica para leasing y permite computar el impuesto abonado sobre los cánones al ejercerse la opción, bajo sus condiciones.',
    exemptions: [
      'Un instrumento celebrado fuera de la provincia puede quedar alcanzado si el bien está radicado allí, si el contrato produce efectos locales o si el bien se usa o aprovecha económicamente en Tierra del Fuego.',
      'No se verificó una exención general por leasing; la transferencia, registración y opción deben liquidarse según el bien y el acto concreto.',
    ],
    sourceUrl: 'https://www.aref.gob.ar/impuesto-de-sellos-2/',
    sourceUrls: ['https://www.aref.gob.ar/impuesto-de-sellos-2/', 'https://www.aref.gob.ar/wp-content/uploads/2022/10/DP-2408-22-Codigo-Fiscal-texto-ordenado.pdf'],
    verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Catamarca', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 0,
    stampRateCondition: 'Contrato civil o comercial de leasing, sin incluir el acto posterior que transfiera el dominio del bien.',
    treatment: 'La Ley Impositiva 2026 fija 0% para contratos civiles y comerciales, locación de bienes muebles, mutuos, garantías y prendas. La transferencia de un automotor se analiza separadamente: la ley fija 1% para usados y 1% para actos que transmiten automotores 0 km, sobre la base legal aplicable. Para la tenencia anual, los automóviles, 4x4 y camionetas de la categoría general tributan 2% sobre la valuación fiscal; los vehículos productivos de la categoría B y los de motorización alternativa tributan 1,5%.',
    exemptions: [
      'El 0% del contrato no se traslada a la transferencia de dominio producida por el ejercicio de la opción.',
      'La patente es periódica y distinta de Sellos: debe presupuestarse según categoría, radicación, valuación y descuentos por cumplimiento.',
      'La exención MiPyME de Sellos tiene requisitos y excepciones, entre ellas operaciones financieras y transferencias de automotores; no debe prometerse por la sola condición de empresa.',
    ],
    sourceUrl: 'https://digesto.catamarca.gob.ar/ley/ley_detail/4586',
    sourceUrls: [
      'https://digesto.catamarca.gob.ar/ley/ley_detail/4586',
      'https://digesto.catamarca.gob.ar/digesto/crearpdf/ley/4586',
    ],
    verifiedAt: '2026-07-23',
  },
  {
    jurisdiction: 'Chubut', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 0.6,
    stampRateCondition: 'Contrato de leasing; la base imponible del contrato es la sumatoria de cánones.',
    contractStampBaseKind: 'canons-only',
    treatment: 'La Ley XXIV N.º 119 para 2026 grava el contrato de leasing al 0,6%. El Código Fiscal vigente establece como base imponible la sumatoria de las cuotas de canon, sin incorporar automáticamente el valor residual al sellado inicial. Si se ejerce la opción, la transferencia se liquida según el bien: para inmuebles se compara el valor total adjudicado —cánones más residual— con el valor inmobiliario de referencia y la valuación fiscal, computando el impuesto previo cuando corresponde; para automotores se compara el precio con la valuación registral.',
    exemptions: [
      'El 0,6% corresponde al contrato inicial y no cancela por anticipado el impuesto de la transferencia por opción.',
      'En 2026 las transferencias e inscripciones automotor tienen alícuota general del 2%, reducida al 0,5% para híbridos y al 0,2% para eléctricos; debe verificarse que la operación concreta encuadre en esa categoría.',
      'El impuesto es solidario según la normativa provincial; que el contrato lo traslade al tomador define la carga económica entre partes, no altera el sujeto legal frente al fisco.',
    ],
    sourceUrl: 'https://www.arech.gob.ar/pdfs/1769781883382-ley-pcial-xxiv-119-2025.pdf',
    sourceUrls: [
      'https://www.arech.gob.ar/pdfs/1769781883382-ley-pcial-xxiv-119-2025.pdf',
      'https://www.arech.gob.ar/pdfs/1769776041585-ley-pcial-xxiv-102-2023.pdf',
      'https://www.arech.gob.ar/pdfs/1769777447671-ley-pcial-xxiv-105-2023.pdf',
    ],
    verifiedAt: '2026-07-23',
  },
  researchedPending(
    'Corrientes',
    'La jurisdicción instrumental, los efectos locales y la tasa aplicable al leasing deben confirmarse en el Código Fiscal y la Ley Tarifaria 2026. Hasta contar con el texto oficial anual completo, no se asigna la tasa general por analogía ni se presume que el contrato, la garantía y la transferencia por opción constituyan un único hecho imponible.',
    'https://www.atp.corrientes.gob.ar/',
    ['Debe identificarse lugar de instrumentación, domicilio y radicación o ubicación del bien antes de concluir que Corrientes puede gravar el instrumento.'],
  ),
  {
    jurisdiction: 'Formosa', fiscalYear: 2026, status: 'verified-current',
    treatment: 'El Código Fiscal provincial, art. 168, fija como base de Sellos los cánones del plazo contractual. Si se ejerce la opción sobre un inmueble o mueble registrable, la base es el mayor entre el valor total adjudicado —cánones más residual— y la valuación fiscal, computando como pago a cuenta el impuesto abonado durante el contrato. La Ley Impositiva vigente grava al 5,50% las operaciones de leasing de entidades financieras y al 7,50% el arrendamiento financiero de prestadores no comprendidos en la Ley de Entidades Financieras.',
    exemptions: [
      'Las tasas de 5,50% y 7,50% corresponden a Ingresos Brutos del dador según su clase; no son un recargo automático del tomador.',
      'La prórroga vuelve a tributar Sellos sobre los cánones del nuevo período; si es indeterminada se aplica la regla especial del Código Fiscal.',
      'La alícuota concreta de Sellos depende de la clase del instrumento en la Ley Impositiva; no se asigna por analogía una tasa única de leasing.',
    ],
    sourceUrl: 'https://archivos.formosa.gob.ar/media/uploads/guia_tramites/normas/norma_1718366928.pdf',
    sourceUrls: [
      'https://archivos.formosa.gob.ar/media/uploads/guia_tramites/normas/norma_1718366928.pdf',
      'https://archivos.formosa.gob.ar/media/uploads/guia_tramites/normas/norma_1718366375.pdf',
    ],
    verifiedAt: '2026-07-23',
  },
  researchedPending(
    'La Pampa',
    'El Código Fiscal grava instrumentos otorgados en la Provincia y también los celebrados fuera cuando los bienes están radicados o producen efectos locales bajo sus condiciones. El convenio registral oficial para leasing automotor toma como base del contrato los cánones mensuales por todo el plazo y trata la opción separadamente; la transferencia permite computar el Sellado abonado por el boleto u opción. Falta revalidar la alícuota y el importe fijo contra el Anexo G de la Ley Impositiva 2026.',
    'https://dgr.lapampa.gob.ar/images/Archivos/Normativa/Convenios/Anexo3.pdf',
    [
      'No se reutiliza automáticamente el 10‰ de anexos de ejercicios anteriores hasta confirmar el Anexo G 2026.',
      'Para bienes registrables importa la radicación; para otros instrumentos deben verificarse otorgamiento y efectos locales.',
    ],
    [
      'https://dgr.lapampa.gob.ar/images/Archivos/Normativa/Convenios/Anexo3.pdf',
      'https://dgr.lapampa.gob.ar/images/Archivos/Normativa/Decretos/Anexo_I_Dec_3817_23.pdf',
    ],
  ),
  {
    jurisdiction: 'La Rioja', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 0,
    stampRateCondition: 'Para el contrato de leasing que no instrumente una transferencia inmobiliaria alcanzada.',
    treatment: 'La Ley 6.183 derogó Sellos para los hechos imponibles generales y mantuvo alcanzadas las escrituras públicas y otros contratos que transfieren el dominio de inmuebles. Por eso el contrato de leasing, por sí solo, no recibe una alícuota general; el ejercicio de una opción que transfiera un inmueble debe liquidarse separadamente con la Ley Impositiva vigente.',
    exemptions: [
      'El 0% no se extiende a la escritura u otro acto que transfiera el dominio de un inmueble.',
      'Las transferencias de automotores se verifican según su régimen específico y la guía fiscal vigente; no deben confundirse con el contrato inicial.',
      'La conexión territorial y la instrumentación siguen siendo necesarias para definir la competencia provincial.',
    ],
    sourceUrl: 'https://www.dgiplarioja.gob.ar/archivos/Legislacion/Codigo%20Tributario/CodigoTributario2026.pdf',
    sourceUrls: [
      'https://www.dgiplarioja.gob.ar/archivos/Legislacion/Codigo%20Tributario/CodigoTributario2026.pdf',
      'https://www.dgiplarioja.gob.ar/archivos/Instructivos-Guias/GUIA_DE_TRAMITES_2026.pdf',
    ],
    verifiedAt: '2026-07-23',
  },
  researchedPending(
    'Misiones',
    'ATM identifica al contrato de leasing con el código de liquidación 2235060 y a su prórroga con el 2235061, con intervención del arrendador y arrendatario. La transferencia automotor, la transferencia inmobiliaria y las garantías tienen códigos separados, por lo que no deben fusionarse con el contrato inicial. La alícuota y la base 2026 todavía deben confirmarse en la Ley XXII N.º 35 y la ley de alícuotas antes de comparar costos.',
    'https://atmisiones.gob.ar/wp-content/uploads/2024/09/Codigo-de-Actos_2.pdf',
    [
      'Las exenciones objetivas y subjetivas requieren encuadre en el artículo 205; el código de trámite no prueba por sí solo una exención.',
      'La venta posterior de un bien de uso tiene tratamiento propio en Ingresos Brutos y no determina automáticamente el costo del contrato de leasing.',
    ],
    [
      'https://atmisiones.gob.ar/wp-content/uploads/2024/09/Codigo-de-Actos_2.pdf',
      'https://www.dgr.misiones.gov.ar/preguntas-frecuentes/',
    ],
  ),
  researchedPending(
    'San Juan',
    'La normativa provincial divide el leasing en dos etapas. Para bienes no registrables, la primera toma los cánones de todo el plazo y la segunda el valor de la opción. Para registrables, la primera también usa los cánones y la transferencia posterior compara cánones más residual con el valor fiscal asignado por Rentas. La Ley Impositiva 2024 aplicaba 0,44% a locación, mutuo y este tratamiento de leasing, pero no se reutiliza ese porcentaje hasta validar la Ley Impositiva 2026.',
    'https://www.argentina.gob.ar/normativa/provincial/ley-2645-123456789-0abc-defg-546-2090jvorpyel/actualizacion',
    [
      'El impuesto anual automotor nace por la radicación y debe presupuestarse aparte del contrato y de la transferencia.',
      'La inscripción inicial y la transferencia automotor tienen reglas registrales propias; las referencias históricas no sustituyen la ley anual vigente.',
    ],
    [
      'https://www.argentina.gob.ar/normativa/provincial/ley-2645-123456789-0abc-defg-546-2090jvorpyel/actualizacion',
      'https://www.argentina.gob.ar/normativa/provincial/ley-2731-123456789-0abc-defg-137-2090jvorpyel/actualizacion',
      'https://www.dnrpa.gov.ar/include/publicaciones/rentas/sellos-sanjuan.pdf',
    ],
  ),
  {
    jurisdiction: 'San Luis', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 1.2,
    stampRateCondition: 'Alícuota residual para actos, contratos u operaciones onerosas del artículo 216 que no tengan una tasa específica.',
    grossIncomeRatePercent: 6.5,
    treatment: 'La Ley Impositiva 2026 establece Sellos del 12‰ para los actos, contratos u operaciones onerosas no previstos específicamente. El nomenclador provincial identifica “Arrendamiento financiero, leasing” —código 649100— con alícuota de Ingresos Brutos del 6,50% y sin el descuento general del 20%. Deben liquidarse aparte la transferencia por opción, los actos sobre inmuebles o registrables y los gastos de registración que tengan tratamiento específico.',
    exemptions: [
      'El 6,50% es Ingresos Brutos de quien desarrolla la actividad; sólo integra el costo del tomador si el contrato permite y efectivamente realiza su traslado económico.',
      'El 12‰ es una regla residual: no reemplaza una alícuota especial aplicable por la naturaleza del bien, la transferencia o una garantía instrumentada por separado.',
      'Para inmuebles, la DPIP determina un valor económico que no puede ser inferior a la valuación fiscal y que debe revisarse al ejercer una opción de compra.',
    ],
    sourceUrl: 'https://dpip.sanluis.gov.ar/rentas_sanluis/Normativas/Leyes/2025/LEY%20IMPOSITIVA%20N%C2%BA%20VIII-0254-2025.pdf',
    sourceUrls: [
      'https://dpip.sanluis.gov.ar/rentas_sanluis/Normativas/Leyes/2025/LEY%20IMPOSITIVA%20N%C2%BA%20VIII-0254-2025.pdf',
      'https://dpip.sanluis.gov.ar/rentas_sanluis/Normativas/Resoluciones/2026/RG%20N%C2%B0002-DPIP-2026-VALOR%20ECONOMICO.pdf',
    ],
    verifiedAt: '2026-07-23',
  },
  researchedPending(
    'Santa Cruz',
    'ASIP confirma que Sellos alcanza instrumentos formalizados en Santa Cruz y los otorgados fuera que produzcan efectos allí. El artículo 225 bis toma como base del contrato los cánones hasta la opción; al transferirse el dominio compara cánones más residual con la valuación fiscal aplicable y permite computar como pago a cuenta el impuesto abonado durante el leasing. La tasa específica debe obtenerse de la Ley Impositiva vigente antes de cuantificar.',
    'https://www.asip.gob.ar/sellos-2/',
    [
      'Las líneas de financiamiento otorgadas por organismos provinciales, municipales o el CFI pueden tener exención sujeta a encuadre y trámite.',
      'Contrato y transferencia son etapas distintas aun cuando exista pago a cuenta del impuesto anterior.',
    ],
    [
      'https://www.asip.gob.ar/sellos-2/',
      'https://boletinoficial.santacruz.gob.ar/boletin/21/Noviembre21/B.O.%205615%2025-11-21.pdf',
    ],
  ),
  researchedPending(
    'Santiago del Estero',
    'El Código Fiscal distingue en Ingresos Brutos los cánones —devengados durante cada período— del valor residual, que se devenga al ejercerse la opción, salvo el régimen aplicable a entidades financieras o sociedades cuyo objeto sea celebrar leasing. Para Sellos, los actos onerosos no previstos siguen alcanzados y las prórrogas expresas se consideran nuevas operaciones, pero no se muestra una alícuota hasta verificar la Ley Impositiva 2026.',
    'https://www.dgrsantiago.gov.ar/wp-content/uploads/2023/10/CODIGO-FISCAL-MODIF-05-10-2023.pdf',
    [
      'La tasa de Ingresos Brutos del dador y el Sellado del instrumento son tributos distintos.',
      'La prórroga expresa puede generar un nuevo hecho de Sellos y no debe agregarse silenciosamente al contrato original.',
    ],
    [
      'https://www.dgrsantiago.gov.ar/wp-content/uploads/2023/10/CODIGO-FISCAL-MODIF-05-10-2023.pdf',
      'https://www.dgrsantiago.gov.ar/?page_id=811',
    ],
  ),
  {
    jurisdiction: 'Tucumán', fiscalYear: 2026, status: 'verified-current',
    stampRatePercent: 2,
    contractStampBaseKind: 'canons-only',
    treatment: 'La Ley Impositiva vigente fija Sellos del 2% para contratos de leasing sobre bienes muebles y para leasing inmobiliario. El Código Tributario, art. 252, establece como base el total de cánones del plazo. Al ejercer la opción, el instrumento de transferencia tributa separadamente sobre el valor residual con la alícuota correspondiente al tipo de bien.',
    exemptions: [
      'La alícuota del 2% del contrato no cubre automáticamente la transferencia por opción; esa segunda etapa se liquida sobre el residual según el bien.',
      'Para automotores, la Provincia alcanza al vehículo cuya tenencia se transfirió por leasing cuando el tomador tiene domicilio en Tucumán, bajo las condiciones del Código Tributario.',
      'El Código provincial impide que municipios y comunas creen otro tributo que afecte directamente a los automotores; éstos coparticipan del impuesto provincial.',
    ],
    sourceUrl: 'https://www.rentastucuman.gob.ar/nomina/rentastuc2/nwx1ut2pa3lo/leyimpositiva.pdf',
    sourceUrls: [
      'https://www.rentastucuman.gob.ar/nomina/rentastuc2/nwx1ut2pa3lo/leyimpositiva.pdf',
      'https://www.rentastucuman.gob.ar/nomina/rentastuc2/nwx1ut2pa3lo/ctp.pdf',
    ],
    verifiedAt: '2026-07-23',
  },
];

export function verifiedProvincialStampProfiles() {
  return PROVINCIAL_LEASING_STAMP_MATRIX.filter((item) => item.status === 'verified-current');
}

export function estimateProvincialContractStamp(
  profile: ProvincialStampProfile,
  cashflow: {
    canonsTotal: number;
    guaranteeDeposit?: number;
    maxiCanonAmount?: number;
    optionAmount?: number;
  },
) {
  if (profile.stampRatePercent === undefined) return null;
  const base = profile.contractStampBaseKind === 'canons-only'
    ? cashflow.canonsTotal
    : cashflow.canonsTotal
      + (cashflow.guaranteeDeposit || 0)
      + (cashflow.maxiCanonAmount || 0)
      + (cashflow.optionAmount || 0);
  return {
    base,
    amount: base * profile.stampRatePercent / 100,
  };
}
