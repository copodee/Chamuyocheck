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
  ...[
    'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy',
    'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
    'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
  ].map(pending),
];

export function verifiedProvincialStampProfiles() {
  return PROVINCIAL_LEASING_STAMP_MATRIX.filter((item) => item.status === 'verified-current');
}
