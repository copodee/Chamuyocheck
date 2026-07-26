export type CorporateSector =
  | 'agriculture-livestock'
  | 'manufacturing'
  | 'construction'
  | 'commerce'
  | 'transport-logistics'
  | 'professional-services'
  | 'technology'
  | 'fintech-financial-services'
  | 'real-estate'
  | 'health-education'
  | 'hospitality'
  | 'other';

const normalized = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function classifyCorporateSector(activity: string): CorporateSector {
  const value = normalized(activity);
  if (/(ganader|agric|agro|cultivo|cria|tambo|forest|pesca)/.test(value)) return 'agriculture-livestock';
  if (/(industr|fabric|manufact|elaboracion|produccion de)/.test(value)) return 'manufacturing';
  if (/(constru|obra|contratista)/.test(value)) return 'construction';
  if (/(comerc|venta|distribu|mayorista|minorista|retail)/.test(value)) return 'commerce';
  if (/(transport|logistic|flete|deposito|almacenamiento|movimiento de (?:materias|cargas))/.test(value)) return 'transport-logistics';
  if (/(fintech|billetera virtual|servicios financieros digitales|pagos digitales|plataforma de pagos|mercado pago)/.test(value)) return 'fintech-financial-services';
  if (/(software|tecnolog|informat|plataforma digital|sistemas)/.test(value)) return 'technology';
  if (/(inmobili|alquiler|propiedad|real estate|desarrollador|desarrollo urbano)/.test(value)) return 'real-estate';
  if (/(salud|medic|clinica|sanatorio|educa|ensenanza|colegio)/.test(value)) return 'health-education';
  if (/(hotel|gastronom|restaurant|turis)/.test(value)) return 'hospitality';
  if (/(energia|petrole|gas|mineria|minera)/.test(value)) return 'manufacturing';
  if (/(servicio|consult|profesional|asesor|estudio)/.test(value)) return 'professional-services';
  return 'other';
}

export const sectorLabel = (sector: CorporateSector) => ({
  'agriculture-livestock': 'Agropecuario y ganadero',
  manufacturing: 'Industria manufacturera',
  construction: 'Construcción',
  commerce: 'Comercio y distribución',
  'transport-logistics': 'Transporte y logística',
  'professional-services': 'Servicios profesionales',
  technology: 'Tecnología y software',
  'fintech-financial-services': 'Fintech y servicios financieros digitales',
  'real-estate': 'Actividad inmobiliaria',
  'health-education': 'Salud o educación',
  hospitality: 'Hotelería, gastronomía o turismo',
  other: 'Actividad no clasificada',
})[sector];

export function sectorObservations(sector: CorporateSector): string[] {
  switch (sector) {
    case 'agriculture-livestock':
      return ['En actividades agropecuarias, existencias y activos biológicos pueden concentrar la liquidez; deben analizarse ciclo productivo, estacionalidad y realizabilidad, no sólo la prueba ácida.'];
    case 'manufacturing':
      return ['En industria deben revisarse inventarios, utilización de capacidad, reposición de bienes de uso y dependencia de insumos además de los márgenes.'];
    case 'construction':
      return ['En construcción deben separarse obras en curso, anticipos, certificados por cobrar y descalces entre cobros y avance de obra.'];
    case 'commerce':
      return ['En comercio son centrales la rotación de inventarios, el margen bruto, la cobranza y la concentración de proveedores y clientes.'];
    case 'transport-logistics':
      return ['En transporte y logística deben contemplarse utilización de flota, combustible, mantenimiento, seguros y renovación de unidades.'];
    case 'professional-services':
    case 'technology':
      return ['En servicios, la ausencia de inventarios no es una debilidad; pesan recurrencia de contratos, concentración de clientes, capital humano y cobranza.'];
    case 'fintech-financial-services':
      return ['En fintech deben analizarse volumen procesado, ingresos netos, fraude y contracargos, fondeo, liquidez, concentración, regulación aplicable y calidad de cartera, sin confundir fondos de terceros con recursos propios.'];
    case 'real-estate':
      return ['En actividades inmobiliarias deben distinguirse activos de renta, desarrollos, vacancia, contratos y flujo efectivo de alquileres.'];
    case 'health-education':
      return ['En salud y educación deben analizarse matrícula o prestaciones, plazos de cobro, regulación y costos laborales recurrentes.'];
    case 'hospitality':
      return ['En hotelería, gastronomía y turismo deben contemplarse estacionalidad, ocupación, ticket promedio y estructura de costos fijos.'];
    default:
      return ['La actividad no pudo clasificarse con suficiente precisión; el administrador debe confirmar el sector antes de una decisión definitiva.'];
  }
}

export function quickRatioThresholds(sector: CorporateSector) {
  if (sector === 'agriculture-livestock') return { good: 0.5, warning: 0.25 };
  if (sector === 'construction') return { good: 0.7, warning: 0.4 };
  if (sector === 'manufacturing' || sector === 'commerce') return { good: 0.8, warning: 0.5 };
  return { good: 1, warning: 0.7 };
}
