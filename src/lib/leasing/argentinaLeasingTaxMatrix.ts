export type LeasingTaxpayerProfile = 'company' | 'human-general-regime' | 'monotributista' | 'consumer';
export type ProvincialStampStatus = 'verified-current' | 'verification-required';

export type ProvincialStampProfile = {
  jurisdiction: string;
  fiscalYear?: number;
  status: ProvincialStampStatus;
  treatment: string;
  exemptions: string[];
  sourceUrl?: string;
  verifiedAt?: string;
};

export const LEASING_TAXPAYER_PROFILES: Record<LeasingTaxpayerProfile, string> = {
  company: 'Una persona jurídica inscripta en Ganancias e IVA puede aprovechar deducciones y crédito fiscal sólo si el contrato encuadra, el bien está afectado a actividad gravada, existe documentación válida y tiene impuesto contra el cual computarlos. No corresponde prometer una deducción del 100% ni ahorro automático.',
  'human-general-regime': 'Una persona humana autónoma en régimen general puede tener un tratamiento empresarial comparable sólo en la proporción afectada a su actividad gravada y con los mismos límites y requisitos. La forma humana o societaria, por sí sola, no crea ni elimina el beneficio.',
  monotributista: 'El monotributo sustituye IVA y Ganancias por la actividad incluida: el tomador no computa separadamente crédito fiscal de IVA ni deduce el canon en una liquidación general de Ganancias por esa actividad. Por eso el beneficio comercialmente anunciado suele ser mucho menor o inexistente.',
  consumer: 'Una persona humana que usa el bien para consumo personal normalmente soporta el IVA y los tributos locales como costo y no puede deducir el canon ni computar crédito fiscal por ese uso.',
};

const pending = (jurisdiction: string): ProvincialStampProfile => ({
  jurisdiction,
  status: 'verification-required',
  treatment: 'Debe verificarse el Código Fiscal y la Ley Impositiva vigentes, la jurisdicción instrumental o de efectos, la base, el tipo de bien, la opción de compra y las exenciones subjetivas u objetivas. No se presume exención.',
  exemptions: [],
});

// A jurisdiction is promoted to verified-current only after checking its current
// official fiscal code and annual tariff law.
export const PROVINCIAL_LEASING_STAMP_MATRIX: ProvincialStampProfile[] = [
  {
    jurisdiction: 'Ciudad Autónoma de Buenos Aires', fiscalYear: 2026, status: 'verified-current',
    treatment: 'AGIP informa una alícuota de Sellos del 0,50% para contratos de leasing. El Valor Locativo de Referencia de alquileres comerciales no se aplica a leasing.',
    exemptions: ['No se encontró una exención general por el solo hecho de ser leasing; deben revisarse las exenciones del acto, bien y sujeto concretos.'],
    sourceUrl: 'https://imagenes.agip.gob.ar/impuestos/sellos', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Buenos Aires', fiscalYear: 2026, status: 'verified-current',
    treatment: 'La base especial es el total de cánones. Si se ejerce la opción, la transferencia toma el mayor entre el valor total asignado (cánones más opción) y la valuación fiscal, con crédito por Sellos pagado sobre los cánones. La Ley Impositiva fija 10,5‰ para leasing registrado en entidades autorizadas; otros encuadres requieren determinar la alícuota aplicable.',
    exemptions: [
      'Tasa 0% para la venta de determinados vehículos nuevos destinados a leasing, sujeta a las categorías y condiciones de la Ley Impositiva 2026.',
      'Tasa 0% para el ejercicio de la opción de compra de inmuebles ubicados en un Agrupamiento Industrial reconocido, bajo sus condiciones.',
      'La antigua bonificación automotor del 20% por leasing no debe presentarse como beneficio vigente general en 2026.',
    ],
    sourceUrl: 'https://www.arba.gov.ar/archivos/Publicaciones/leyimpositiva2026.pdf', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Córdoba', fiscalYear: 2026, status: 'verified-current',
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
    treatment: 'La Ley Impositiva 3541 fija Sellos del 14‰ para contratos de leasing sobre el monto de los cánones durante su duración hasta ejercer la opción. Al ejercerse la compra se liquida la alícuota prevista para el tipo de bien transferido. La actividad 649100, arrendamiento financiero/leasing, tributa Ingresos Brutos al 9%.',
    exemptions: [
      'No se identificó una exención general de Sellos por leasing en la Ley Impositiva 2026.',
      'En inmuebles, la inscripción que implique transmisión, modificación o constitución de derechos —incluido leasing— tiene además una tasa registral del 6‰ sobre la valuación fiscal o el contrato, el mayor, con mínimo legal; esta tasa no es Impuesto de Sellos.',
    ],
    sourceUrl: 'https://www.legislaturaneuquen.gob.ar/svrfiles/Neuleg/normaslegales/pdf/LEY3541FD.pdf', verifiedAt: '2026-07-18',
  },
  {
    jurisdiction: 'Mendoza', fiscalYear: 2026, status: 'verified-current',
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
    treatment: 'La Ley Impositiva 6492 fija una alícuota específica de Sellos del 1% para los contratos de leasing. La actividad 649100, arrendamiento financiero/leasing, tributa Ingresos Brutos al 8%.',
    exemptions: [
      'No se identificó en la Ley Impositiva 2026 una exención general de Sellos para leasing.',
      'La constitución o transferencia de derechos sobre inmuebles y otros bienes puede tener una alícuota propia; debe distinguirse el contrato inicial del ejercicio e inscripción de la opción de compra.',
    ],
    sourceUrl: 'https://boletinoficial.jujuy.gob.ar/?p=324226', verifiedAt: '2026-07-18',
  },
  ...[
    'Catamarca', 'Chaco', 'Chubut', 'Corrientes', 'Formosa',
    'La Pampa', 'La Rioja', 'Misiones', 'Río Negro', 'Salta', 'San Juan',
    'San Luis', 'Santa Cruz', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
  ].map(pending),
];

export function verifiedProvincialStampProfiles() {
  return PROVINCIAL_LEASING_STAMP_MATRIX.filter((item) => item.status === 'verified-current');
}
