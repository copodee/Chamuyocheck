export type LeasingEconomicType =
  | 'financial'
  | 'operating'
  | 'lease-back'
  | 'sale-financed'
  | 'international'
  | 'public-sector';

export type LeasingAssetClass =
  | 'immovable'
  | 'installations'
  | 'furniture'
  | 'machinery'
  | 'tools'
  | 'rail'
  | 'vehicles'
  | 'ships'
  | 'recreational-vessels'
  | 'aircraft'
  | 'containers'
  | 'technical-equipment'
  | 'precision-equipment'
  | 'computers'
  | 'agricultural';

export type UsefulLifeProfile = {
  assetClass: Exclude<LeasingAssetClass, 'agricultural'>;
  label: string;
  usefulLifeYears: number;
};

export const DECREE_1038_USEFUL_LIVES: UsefulLifeProfile[] = [
  { assetClass: 'immovable', label: 'Edificios', usefulLifeYears: 50 },
  { assetClass: 'installations', label: 'Instalaciones', usefulLifeYears: 10 },
  { assetClass: 'furniture', label: 'Muebles y útiles', usefulLifeYears: 10 },
  { assetClass: 'machinery', label: 'Maquinarias y equipos', usefulLifeYears: 10 },
  { assetClass: 'tools', label: 'Herramientas', usefulLifeYears: 3 },
  { assetClass: 'rail', label: 'Ferrocarriles', usefulLifeYears: 10 },
  { assetClass: 'vehicles', label: 'Rodados, incluidos automóviles, camiones y maquinaria vial', usefulLifeYears: 5 },
  { assetClass: 'ships', label: 'Barcos', usefulLifeYears: 15 },
  { assetClass: 'recreational-vessels', label: 'Embarcaciones de recreo', usefulLifeYears: 8 },
  { assetClass: 'aircraft', label: 'Aerodinos', usefulLifeYears: 5 },
  { assetClass: 'containers', label: 'Contenedores de transporte', usefulLifeYears: 10 },
  { assetClass: 'technical-equipment', label: 'Equipamiento técnico y profesional', usefulLifeYears: 8 },
  { assetClass: 'precision-equipment', label: 'Equipamiento de precisión', usefulLifeYears: 5 },
  { assetClass: 'computers', label: 'Computación y accesorios', usefulLifeYears: 3 },
];

export const AGRICULTURAL_USEFUL_LIVES = [
  ['Galpones', 20], ['Silos', 20], ['Molinos', 20], ['Alambradas y tranqueras', 30],
  ['Aguadas y bebederos', 20], ['Contenedores agropecuarios', 8], ['Tarros tambo', 5],
  ['Hacienda reproductora', 5], ['Tractores', 8], ['Cosechadoras', 8],
  ['Rotoenfardadoras', 6], ['Pulverizadoras motopropulsadas', 8],
  ['Equipos y maquinarias de arrastre', 8],
] as const;

export function minimumFinancialLeaseMonths(assetClass: LeasingAssetClass, usefulLifeYears?: number) {
  const tableYears = assetClass === 'agricultural'
    ? usefulLifeYears
    : DECREE_1038_USEFUL_LIVES.find((item) => item.assetClass === assetClass)?.usefulLifeYears;
  if (!tableYears || tableYears <= 0) return null;
  const minimumPercent = assetClass === 'immovable' ? 10 : 50;
  return Math.ceil(tableYears * 12 * minimumPercent / 100);
}

export const NATIONAL_LEASING_RULES = [
  {
    topic: 'Contrato y bienes',
    rule: 'El leasing transfiere tenencia para uso y goce contra canon y confiere opción de compra. Puede recaer sobre muebles, inmuebles, marcas, patentes, modelos industriales y software.',
    source: 'Ley 25.248, arts. 1 a 4',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/ley-25248-63283/texto',
  },
  {
    topic: 'Uso y costos del bien',
    rule: 'El tomador debe usar el bien según su destino y, salvo pacto contrario, soporta conservación, seguros, impuestos, tasas y sanciones derivadas de su uso; no puede venderlo ni gravarlo.',
    source: 'Ley 25.248, art. 12',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/ley-25248-63283/texto',
  },
  {
    topic: 'Registración',
    rule: 'La oponibilidad exige inscripción en el registro correspondiente. Inmuebles, buques y aeronaves requieren escritura pública; para efectos desde la entrega, la solicitud debe presentarse dentro de cinco días hábiles.',
    source: 'Ley 25.248, arts. 8 y 9',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/ley-25248-63283/texto',
  },
  {
    topic: 'Ganancias - operación financiera',
    rule: 'Para dadores habilitados, opción cierta y determinada y plazo mínimo, el contrato se asimila a operación financiera. El umbral es 50% de la vida útil para muebles y 10% para inmuebles.',
    source: 'Decreto 1038/2000, art. 2, texto según Decreto 152/2022',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/decreto-1038-2000-64908/actualizacion',
  },
  {
    topic: 'Ganancias - locación',
    rule: 'Si no encuadra como operación financiera, el dador amortiza el costo según la naturaleza del bien. El tomador afectado a ganancias gravadas deduce los cánones imputables, sujeto a límites y requisitos.',
    source: 'Decreto 1038/2000, arts. 4 a 6',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/decreto-1038-2000-64908/actualizacion',
  },
  {
    topic: 'Venta financiada',
    rule: 'Si en un contrato tratado como locación la opción es inferior al costo computable al ejercicio, la operación se trata fiscalmente como venta financiada y debe constar en el contrato.',
    source: 'Decreto 1038/2000, art. 7',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/decreto-1038-2000-64908/actualizacion',
  },
  {
    topic: 'IVA',
    rule: 'En bienes muebles, el IVA se perfecciona con el devengamiento o percepción de cada canon y de la opción, lo que ocurra antes. Los automóviles conservan límites específicos de crédito fiscal.',
    source: 'Ley 25.248, arts. 22 y 24; Decreto 1038/2000, arts. 9 y 15',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/ley-25248-63283/texto',
  },
  {
    topic: 'Lease-back',
    rule: 'La venta del bien por el tomador al dador y su leasing posterior tiene tratamiento fiscal específico de operación financiera, cualquiera sea la duración, bajo las condiciones del régimen.',
    source: 'Decreto 1038/2000, art. 26',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/decreto-1038-2000-64908/actualizacion',
  },
] as const;

export const LEASING_TYPE_GUIDE: Record<LeasingEconomicType, string> = {
  financial: 'Financia la disponibilidad del bien y normalmente busca recuperar capital, rendimiento y valor residual; su encuadre fiscal exige revisar dador, plazo y opción.',
  operating: 'Prioriza el uso y servicios asociados, suele conservar mayor riesgo residual en el dador y no recibe automáticamente el tratamiento fiscal del leasing financiero.',
  'lease-back': 'El futuro tomador vende un bien propio al dador y lo recibe en leasing para obtener liquidez sin interrumpir su utilización.',
  'sale-financed': 'Calificación fiscal posible cuando la opción es inferior al costo computable; no depende de la etiqueta comercial elegida por las partes.',
  international: 'Exige separar propiedad, importador, aduana, pagos al exterior, moneda, impuestos, registro y reglas cambiarias vigentes.',
  'public-sector': 'Requiere competencia, autorización presupuestaria y de endeudamiento, procedimiento de contratación, límites del BCRA y garantías válidas.',
};

export type LocalTaxRequest = {
  province?: string;
  municipality?: string;
  fiscalYear?: number;
  assetType?: string;
  assetUse?: string;
  lessorDomicile?: string;
  lesseeDomicile?: string;
  registrationPlace?: string;
  habitualUsePlace?: string;
};

export function missingLocalTaxInputs(input: LocalTaxRequest) {
  const required: Array<[keyof LocalTaxRequest, string]> = [
    ['province', 'provincia'],
    ['fiscalYear', 'año fiscal'],
    ['assetType', 'tipo de bien'],
    ['assetUse', 'uso o afectación del bien'],
    ['registrationPlace', 'lugar de radicación o registro'],
    ['habitualUsePlace', 'lugar de guarda, uso o explotación habitual'],
  ];
  const missing = required.filter(([key]) => !input[key]).map(([, label]) => label);
  if (!input.municipality) missing.push('municipio cuando existan patente, tasa o contribución local');
  return missing;
}

export const MUNICIPAL_TAX_GUARDRAIL =
  'Una tasa municipal sólo se cuantifica con municipio, período fiscal, ordenanza tarifaria vigente, hecho imponible, base, sujeto y conexión territorial. La ausencia de datos se muestra como pendiente; nunca como exención ni alícuota cero.';
