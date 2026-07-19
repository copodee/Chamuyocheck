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
  grossIncomeRatePercent?: number;
  sourceUrl?: string;
  sourceUrls?: string[];
  verifiedAt?: string;
};

export const LEASING_TAXPAYER_PROFILES: Record<LeasingTaxpayerProfile, string> = {
  company: 'Una persona jurídica inscripta en Ganancias e IVA puede aprovechar deducciones y crédito fiscal sólo si el contrato encuadra, el bien está afectado a actividad gravada, existe documentación válida y tiene impuesto contra el cual computarlos. No corresponde prometer una deducción del 100% ni ahorro automático.',
  'human-general-regime': 'Una persona humana autónoma en régimen general puede tener un tratamiento empresarial comparable sólo en la proporción afectada a su actividad gravada y con los mismos límites y requisitos. La forma humana o societaria, por sí sola, no crea ni elimina el beneficio.',
  monotributista: 'El monotributo sustituye IVA y Ganancias por la actividad incluida: el tomador no computa separadamente crédito fiscal de IVA ni deduce el canon en una liquidación general de Ganancias por esa actividad. Por eso el beneficio comercialmente anunciado suele ser mucho menor o inexistente.',
  consumer: 'Una persona humana que usa el bien para consumo personal normalmente soporta el IVA y los tributos locales como costo y no puede deducir el canon ni computar crédito fiscal por ese uso.',
};

const researchedPending = (
  jurisdiction: string,
  treatment: string,
  sourceUrl: string,
  exemptions: string[] = [],
): ProvincialStampProfile => ({
  jurisdiction,
  fiscalYear: 2026,
  status: 'verification-required',
  treatment,
  exemptions,
  sourceUrl,
  verifiedAt: '2026-07-18',
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
  researchedPending(
    'Catamarca',
    'La guía oficial registral informa 1% para leasing automotor, pero debe revalidarse contra la Ley Impositiva 2026 antes de usarlo en una comparación contractual general.',
    'https://www.dnrpa.gov.ar/include/publicaciones/rentas/sellos-catamarca.pdf',
    ['La referencia disponible es registral y no autoriza a extender el 1% a inmuebles, aeronaves, embarcaciones ni a la opción de compra.'],
  ),
  researchedPending('Chubut', 'La base del leasing y el crédito del impuesto pagado sobre cánones están contemplados en la normativa provincial; falta confirmar la alícuota 2026 del contrato y de la opción en la ley tarifaria vigente.', 'https://www.dgrchubut.gov.ar/'),
  researchedPending('Corrientes', 'La jurisdicción instrumental, los efectos locales y la tasa aplicable al leasing deben confirmarse en el Código Fiscal y la Ley Tarifaria 2026; no se asigna una tasa general por analogía.', 'https://www.atp.corrientes.gob.ar/'),
  researchedPending('Formosa', 'La Ley Impositiva oficial vigente publica tasas de Sellos por clases de actos, pero no se verificó todavía una alícuota autónoma para leasing; contrato y opción deben clasificarse separadamente.', 'https://archivos.formosa.gob.ar/media/uploads/guia_tramites/normas/norma_1718366375.pdf'),
  researchedPending('La Pampa', 'Debe completarse la lectura conjunta del Código Fiscal y la Ley Impositiva 2026 para determinar base, territorialidad y tasa del leasing, sin presumir que locación, financiación y opción tienen el mismo tratamiento.', 'https://dgr.lapampa.gob.ar/'),
  researchedPending('La Rioja', 'La tasa del contrato de leasing y la de su opción permanecen pendientes de confirmación en la normativa tributaria 2026 publicada por la Dirección General de Ingresos Provinciales.', 'https://dgiplarioja.gob.ar/'),
  researchedPending('Misiones', 'ATM identifica un trámite específico para contratos de leasing o sus prórrogas, pero la alícuota y la base 2026 deben confirmarse en la Ley XXII Nº 35 y su ley tarifaria antes de comparar.', 'https://www.dgr.misiones.gov.ar/preguntas-frecuentes/'),
  researchedPending('San Juan', 'La normativa provincial distingue la primera etapa del leasing, los cánones, la opción y los bienes registrables; falta validar la alícuota anual 2026 antes de mostrar un porcentaje.', 'https://rentas.dgrsj.gob.ar/'),
  researchedPending('San Luis', 'No se encontró todavía una publicación oficial 2026 que permita sostener una tasa específica de leasing; deben verificarse contrato, efectos, radicación y opción en forma separada.', 'https://dpip.sanluis.gov.ar/'),
  researchedPending('Santa Cruz', 'ASIP confirma que Sellos alcanza instrumentos formalizados en Santa Cruz y también los otorgados fuera que produzcan efectos allí; la tasa específica del leasing debe obtenerse de la Ley Impositiva vigente.', 'https://www.asip.gob.ar/sellos-2/'),
  researchedPending('Santiago del Estero', 'La liquidación requiere identificar el tratamiento específico del leasing en el Código Fiscal y la Ley Impositiva 2026; no se usa la tasa general hasta verificar base y opción.', 'https://www.dgrsantiago.gov.ar/'),
  researchedPending('Tucumán', 'La Dirección General de Rentas publica el Código Tributario y la Ley Impositiva; queda pendiente confirmar el renglón 2026 aplicable al contrato de leasing y a la transferencia por opción.', 'https://www.rentastucuman.gob.ar/'),
];

export function verifiedProvincialStampProfiles() {
  return PROVINCIAL_LEASING_STAMP_MATRIX.filter((item) => item.status === 'verified-current');
}
