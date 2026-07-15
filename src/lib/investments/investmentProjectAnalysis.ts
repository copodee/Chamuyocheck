export type InvestmentSector =
  | 'real-estate'
  | 'agriculture'
  | 'livestock'
  | 'food-wine'
  | 'exports'
  | 'automotive'
  | 'manufacturing'
  | 'retail-commerce'
  | 'transport-logistics'
  | 'services'
  | 'general-investment';

export type InvestmentSourceRequirement = {
  sourceType: string;
  institutions: string[];
  purpose: string;
  officialRequired: boolean;
};

export type InvestmentProjectAnalysis = {
  applicable: boolean;
  sector: InvestmentSector | null;
  sectorLabel: string;
  secondarySectors: InvestmentSector[];
  confidence: number;
  location: string | null;
  product: string | null;
  currency: 'ARS' | 'USD';
  inputs: {
    initialInvestment: number | null;
    purchasePrice: number | null;
    squareMeters: number | null;
    monthlyRent: number | null;
    monthlyRevenue: number | null;
    monthlyOperatingCosts: number | null;
    vacancyPercent: number | null;
    hectares: number | null;
    yieldTonsPerHectare: number | null;
    unitPrice: number | null;
    operatingCostPerHectare: number | null;
    projectedAnnualRevenue: number | null;
    projectedAnnualCosts: number | null;
    workingCapital: number | null;
  };
  metrics: {
    pricePerSquareMeter: number | null;
    annualGrossIncome: number | null;
    annualNetIncome: number | null;
    grossAnnualYieldPercent: number | null;
    netAnnualYieldPercent: number | null;
    simplePaybackYears: number | null;
    projectedProductionTons: number | null;
    projectedOperatingMargin: number | null;
    projectedOperatingMarginPercent: number | null;
    projectedReturnOnInvestmentPercent: number | null;
  };
  assumptions: string[];
  missingInputs: string[];
  riskFlags: string[];
  sourceRequirements: InvestmentSourceRequirement[];
  conclusion: string;
};

const numberToken = String.raw`(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)`;

function parseNumber(value?: string): number | null {
  if (!value) return null;
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(value) ? value.replace(/\./g, '') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function amountAfter(text: string, labels: string[]): number | null {
  const label = labels.join('|');
  const match = text.match(new RegExp(`(?:${label})\\s*(?:de|es|:|=|por)?\\s*(?:us\\$|usd|u\\$s|ars|\\$)?\\s*(${numberToken})`, 'i'));
  return parseNumber(match?.[1]);
}

function detectLocation(text: string): string | null {
  const match = text.match(/\b(?:en|ubicad[oa]\s+en|localidad\s+de|zona\s+de)\s+([A-ZÁÉÍÓÚÑ][\p{L} .'-]{2,50})(?=[,.;\n]|\s+(?:por|con|a\s+un|y\s+un|para)\b)/iu);
  return match?.[1]?.trim() || null;
}

function detectProduct(text: string): string | null {
  const products: Array<[string, RegExp]> = [
    ['yerba mate', /\byerba(?:\s+mate)?\b/i],
    ['aceitunas y aceite de oliva', /aceitun|aceite\s+de\s+oliva|oliv[ií]col/i],
    ['uva y vino', /\buva\b|vino|vitivin[ií]col|bodega/i],
    ['soja', /\bsoja\b/i], ['maíz', /\bma[ií]z\b/i], ['trigo', /\btrigo\b/i],
    ['frutas', /frut|manzana|pera|lim[oó]n|naranja|ar[aá]ndano|cereza/i],
    ['carne bovina', /carne\s+bovina|novillo|bovin|hacienda|feedlot/i],
    ['leche', /\bleche\b|tambo|lecher/i],
  ];
  return products.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function normalizedYield(text: string): number | null {
  const match = text.match(new RegExp(`(${numberToken})\\s*(t|toneladas?|kg|kilogramos?)\\s*(?:por|/)\\s*(?:ha|hect[aá]rea)`, 'i'));
  const value = parseNumber(match?.[1]);
  if (value === null) return null;
  return /^(?:kg|kilogramos?)$/i.test(match?.[2] || '') ? value / 1000 : value;
}

const sectorRules: Array<{ sector: InvestmentSector; label: string; patterns: RegExp[] }> = [
  { sector: 'real-estate', label: 'Inversión inmobiliaria y alquileres', patterns: [/inmobiliari|departamento|propiedad|vivienda|alquiler|renta\s+locativa|metro(?:s)?\s+cuadrad|\bm2\b|lote|terreno/i] },
  { sector: 'agriculture', label: 'Agricultura y campos', patterns: [/\bcampo\b|agropecuari|agricultur|soja|ma[ií]z|trigo|oliv|aceituna|uva|frut|cosecha|hect[aá]rea|rinde|cultivo/i] },
  { sector: 'livestock', label: 'Ganadería', patterns: [/ganader|hacienda|bovin|vacun|feedlot|novillo|ternero|carne|tambo|lecher/i] },
  { sector: 'food-wine', label: 'Alimentos, vino y economías regionales', patterns: [/vino|bodega|vitivin[ií]col|yerba\s+mate|alimentos?|bebidas?|mosto/i] },
  { sector: 'exports', label: 'Exportaciones y demanda internacional', patterns: [/export|comercio\s+exterior|mercado\s+internacional|demanda\s+mundial|venta\s+al\s+exterior|aduana|destino\s+externo/i] },
  { sector: 'automotive', label: 'Industria automotriz', patterns: [/automotriz|automotor|veh[ií]cul|autopart|concesionari/i] },
  { sector: 'manufacturing', label: 'Producción e industria', patterns: [/industria|f[aá]brica|manufactur|planta\s+productiva|capacidad\s+instalada|producci[oó]n/i] },
  { sector: 'retail-commerce', label: 'Comercio', patterns: [/comercio|local\s+comercial|ventas\s+minoristas|retail|tienda|supermercado/i] },
  { sector: 'transport-logistics', label: 'Transporte y logística', patterns: [/transporte|log[ií]stica|flete|camiones?|dep[oó]sito|distribuci[oó]n|[uú]ltima\s+milla/i] },
  { sector: 'services', label: 'Servicios', patterns: [/servicios?|consultor[ií]a|software|turismo|hotel|gastronom/i] },
];

const commonSources: InvestmentSourceRequirement[] = [
  { sourceType: 'official-statistics', institutions: ['INDEC'], purpose: 'Actividad, precios, empleo y contexto macroeconómico observados.', officialRequired: true },
  { sourceType: 'central-bank-data', institutions: ['BCRA'], purpose: 'Tasas, crédito, tipo de cambio y expectativas del REM cuando correspondan.', officialRequired: true },
];

const sectorSources: Record<InvestmentSector, InvestmentSourceRequirement[]> = {
  'real-estate': [
    { sourceType: 'official-real-estate-data', institutions: ['INDEC', 'registros de la propiedad', 'catastros y municipios provinciales'], purpose: 'Ubicación, características, permisos, población y datos oficiales disponibles.', officialRequired: true },
    { sourceType: 'property-market-comparables', institutions: ['colegios de escribanos', 'colegios inmobiliarios', 'portales con avisos fechados'], purpose: 'Comparables de venta y alquiler de la misma tipología, zona y fecha.', officialRequired: false },
  ],
  agriculture: [
    { sourceType: 'official-agricultural-statistics', institutions: ['Secretaría de Agricultura', 'INTA'], purpose: 'Producción, área, rindes, costos y estimaciones por cultivo y región.', officialRequired: true },
    { sourceType: 'commodity-market-data', institutions: ['SIO-Granos', 'Bolsa de Cereales', 'mercados institucionales'], purpose: 'Precios, volumen y referencias comerciales del producto.', officialRequired: true },
  ],
  livestock: [
    { sourceType: 'official-livestock-data', institutions: ['Secretaría de Agricultura', 'SENASA', 'SIO-Carnes'], purpose: 'Existencias, faena, sanidad, precios y movimientos ganaderos.', officialRequired: true },
  ],
  'food-wine': [
    { sourceType: 'official-regional-economy-data', institutions: ['INV', 'INYM', 'Secretaría de Agricultura', 'INTA'], purpose: 'Producción, existencias, ventas y exportaciones de vino, yerba, frutas y economías regionales.', officialRequired: true },
  ],
  exports: [
    { sourceType: 'official-trade-statistics', institutions: ['INDEC Intercambio Comercial Argentino', 'ARCA-Aduana'], purpose: 'Exportaciones argentinas por producto, destino, valor y volumen.', officialRequired: true },
    { sourceType: 'international-trade-data', institutions: ['UN Comtrade', 'ITC Trade Map', 'Banco Mundial'], purpose: 'Demanda mundial, crecimiento, concentración de compradores y competidores.', officialRequired: true },
  ],
  automotive: [{ sourceType: 'official-sector-statistics', institutions: ['INDEC', 'Secretaría de Industria', 'ADEFA'], purpose: 'Producción, ventas, exportaciones y capacidad del sector.', officialRequired: true }],
  manufacturing: [{ sourceType: 'official-sector-statistics', institutions: ['INDEC', 'Secretaría de Industria'], purpose: 'Producción industrial, capacidad instalada, empleo y comercio exterior.', officialRequired: true }],
  'retail-commerce': [{ sourceType: 'official-sector-statistics', institutions: ['INDEC', 'CAME', 'municipios'], purpose: 'Ventas, consumo, actividad local y habilitaciones.', officialRequired: true }],
  'transport-logistics': [{ sourceType: 'official-transport-statistics', institutions: ['Secretaría de Transporte', 'CNRT', 'INDEC'], purpose: 'Demanda, costos, permisos, cargas y actividad logística.', officialRequired: true }],
  services: [{ sourceType: 'official-sector-statistics', institutions: ['INDEC', 'organismos sectoriales y provinciales'], purpose: 'Demanda, empleo, precios y actividad del servicio.', officialRequired: true }],
  'general-investment': [],
};

export function analyzeInvestmentProject(documentText: string, userInstruction = ''): InvestmentProjectAnalysis {
  const text = `${userInstruction}\n${documentText}`.trim();
  const ranked = sectorRules
    .map((rule) => ({
      ...rule,
      score: rule.patterns.reduce((total, pattern) => {
        const flags = [...new Set(`${pattern.flags}g`.split(''))].join('');
        return total + (text.match(new RegExp(pattern.source, flags))?.length || 0);
      }, 0),
    }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score);
  const genericInvestment = /inversi[oó]n|invertir|proyecto|rentabilidad|retorno|tasa\s+interna|tir\b|van\b|recupero|flujo\s+de\s+fondos/i.test(text);
  const applicable = genericInvestment || ranked.length > 0;
  const sector = ranked[0]?.sector || (genericInvestment ? 'general-investment' : null);
  const currency: 'ARS' | 'USD' = /(?:us\$|u\$s|usd|d[oó]lares?)/i.test(text) ? 'USD' : 'ARS';
  const purchasePrice = amountAfter(text, ['precio de compra', 'precio del inmueble', 'valor de compra', 'valor del inmueble', 'precio de venta']);
  const initialInvestment = amountAfter(text, ['inversi[oó]n inicial', 'capital inicial', 'monto a invertir', 'invertir(?:[ií]a|é|e)?']) ?? purchasePrice;
  const squareMeters = parseNumber(text.match(new RegExp(`(${numberToken})\\s*(?:m2|m²|metros?\\s+cuadrados?)`, 'i'))?.[1]);
  const monthlyRent = amountAfter(text, ['alquiler mensual', 'renta mensual', 'alquiler esperado', 'alquiler']);
  const monthlyRevenue = amountAfter(text, ['ingresos? mensuales?', 'ventas mensuales?', 'facturaci[oó]n mensual', 'cobro mensual']) ?? monthlyRent;
  const monthlyOperatingCosts = amountAfter(text, ['costos? mensuales?', 'gastos? mensuales?', 'expensas', 'costo operativo mensual']);
  const vacancyPercent = parseNumber(text.match(/(?:vacancia|desocupaci[oó]n)\s*(?:de|:|=)?\s*(\d+(?:[.,]\d+)?)\s*%/i)?.[1]);
  const hectares = parseNumber(text.match(new RegExp(`(${numberToken})\\s*(?:ha|hect[aá]reas?)`, 'i'))?.[1]);
  const yieldTonsPerHectare = normalizedYield(text);
  const unitPrice = amountAfter(text, ['precio por tonelada', 'precio por tn', 'valor por tonelada', 'precio unitario']);
  const operatingCostPerHectare = amountAfter(text, ['costo por hect[aá]rea', 'costo por ha', 'gasto por hect[aá]rea']);
  const explicitAnnualRevenue = amountAfter(text, ['ingresos? anuales?', 'ventas anuales?', 'facturaci[oó]n anual', 'exportaciones? anuales?']);
  const explicitAnnualCosts = amountAfter(text, ['costos? anuales?', 'gastos? anuales?', 'costo operativo anual']);
  const workingCapital = amountAfter(text, ['capital de trabajo', 'capital operativo']);
  const projectedProductionTons = hectares !== null && yieldTonsPerHectare !== null ? hectares * yieldTonsPerHectare : null;
  const projectedAnnualRevenue = explicitAnnualRevenue ?? (projectedProductionTons !== null && unitPrice !== null ? projectedProductionTons * unitPrice : null);
  const projectedAnnualCosts = explicitAnnualCosts ?? (hectares !== null && operatingCostPerHectare !== null ? hectares * operatingCostPerHectare : null);
  const projectedOperatingMargin = projectedAnnualRevenue !== null && projectedAnnualCosts !== null ? projectedAnnualRevenue - projectedAnnualCosts : null;
  const projectedOperatingMarginPercent = projectedOperatingMargin !== null && projectedAnnualRevenue && projectedAnnualRevenue > 0 ? projectedOperatingMargin / projectedAnnualRevenue * 100 : null;
  const capital = initialInvestment ?? purchasePrice;
  const annualGrossIncome = monthlyRevenue !== null ? monthlyRevenue * 12 : null;
  const annualNetIncome = monthlyRevenue !== null
    ? (monthlyRevenue * (1 - (vacancyPercent || 0) / 100) - (monthlyOperatingCosts || 0)) * 12
    : null;
  const grossAnnualYieldPercent = capital && annualGrossIncome !== null ? annualGrossIncome / capital * 100 : null;
  const netAnnualYieldPercent = capital && annualNetIncome !== null ? annualNetIncome / capital * 100 : null;
  const simplePaybackYears = capital && annualNetIncome && annualNetIncome > 0 ? capital / annualNetIncome : null;
  const pricePerSquareMeter = purchasePrice && squareMeters ? purchasePrice / squareMeters : null;
  const projectedReturnOnInvestmentPercent = capital && projectedOperatingMargin !== null ? projectedOperatingMargin / capital * 100 : null;
  const assumptions: string[] = [];
  if (monthlyRevenue !== null && vacancyPercent === null) assumptions.push('No se informó vacancia; el rendimiento neto preliminar supone ocupación completa.');
  if (monthlyRevenue !== null && monthlyOperatingCosts === null) assumptions.push('No se informaron gastos operativos, impuestos, mantenimiento ni comisiones; el neto preliminar los toma como cero.');
  if (sector === 'real-estate') assumptions.push('La facilidad de alquiler no se infiere del precio: requiere demanda, oferta, días publicados y vacancia de la localidad y tipología.');
  if (['agriculture', 'livestock', 'food-wine'].includes(sector || '') && projectedOperatingMargin !== null) assumptions.push('El margen es un escenario aritmético con los datos aportados: debe ajustarse por campaña, región, clima, pérdidas, sanidad, logística, impuestos y capital de trabajo.');
  const monthlyBusinessSector = ['real-estate', 'retail-commerce', 'transport-logistics', 'services'].includes(sector || '');
  const missingInputs = [
    capital === null ? 'inversión inicial o precio de compra' : '',
    monthlyBusinessSector && monthlyRevenue === null ? 'ingreso o alquiler esperado y su periodicidad' : '',
    monthlyBusinessSector && monthlyOperatingCosts === null ? 'gastos operativos, impuestos, mantenimiento y comisiones' : '',
    sector === 'real-estate' && squareMeters === null ? 'superficie cubierta y total' : '',
    sector === 'real-estate' && !detectLocation(text) ? 'localidad, barrio o zona exacta' : '',
    sector === 'real-estate' && vacancyPercent === null ? 'vacancia u ocupación esperada' : '',
    ['agriculture', 'livestock', 'food-wine'].includes(sector || '') && hectares === null ? 'superficie productiva en hectáreas' : '',
    sector === 'agriculture' && yieldTonsPerHectare === null ? 'rinde esperado por hectárea y campaña' : '',
    ['agriculture', 'livestock', 'food-wine'].includes(sector || '') && projectedAnnualRevenue === null ? 'volumen y precio de venta, o ingresos anuales proyectados' : '',
    ['agriculture', 'livestock', 'food-wine'].includes(sector || '') && projectedAnnualCosts === null ? 'costos operativos anuales completos' : '',
    sector === 'exports' && !/(destino\s+(?:de|es|:)|pa[ií]s\s+(?:de|destino|objetivo|comprador)|comprador\s+(?:de|objetivo|identificado)|cliente\s+(?:en|del?\s+exterior|internacional))/i.test(text) ? 'mercado de destino y comprador objetivo' : '',
  ].filter(Boolean);
  const riskFlags: string[] = [];
  if (/rentabilidad|retorno|ganancia|resultado/.test(text.toLowerCase()) && /garantizad|asegurad|sin\s+riesgo/i.test(text)) riskFlags.push('Se promete rentabilidad garantizada o sin riesgo; una inversión real debe declarar escenarios adversos.');
  if ((netAnnualYieldPercent || grossAnnualYieldPercent || 0) > 100) riskFlags.push('El rendimiento anual implícito supera el capital invertido y exige evidencia extraordinaria del precio, volumen, costos y continuidad de la demanda.');
  if (/proyecci[oó]n|proyectad[oa]s?|crecer[aá]|aumentar[aá]|demanda/i.test(text) && !/(fuente|indec|bcra|inta|senasa|metodolog|serie|escenario)/i.test(text)) riskFlags.push('La proyección de demanda o crecimiento no identifica fuente, serie, fecha ni metodología.');
  if (projectedAnnualRevenue !== null && projectedAnnualCosts === null) riskFlags.push('Se proyectan ingresos sin un costo anual completo; el retorno no puede considerarse neto.');
  if ((projectedOperatingMarginPercent || 0) > 70) riskFlags.push('El margen operativo supera el 70% y exige revisar costos omitidos, mermas, impuestos, logística y capital de trabajo.');
  const sourceRequirements = sector ? [...commonSources, ...(sectorSources[sector] || [])] : [];
  const conclusion = !applicable
    ? 'No se detectó un proyecto de inversión.'
    : riskFlags.length > 0
      ? 'La propuesta presenta señales que requieren verificación reforzada; no debe tratarse como una inversión recomendable con la evidencia actual.'
      : missingInputs.length > 0
        ? 'La propuesta puede analizarse, pero todavía faltan datos esenciales y comparables externos para estimar su viabilidad.'
        : 'Los datos permiten un cálculo preliminar. La viabilidad sólo puede sostenerse después de contrastar precios, demanda, costos y escenarios con fuentes externas del sector y la localidad.';

  return {
    applicable,
    sector,
    sectorLabel: ranked[0]?.label || (genericInvestment ? 'Proyecto de inversión' : 'Sin sector de inversión'),
    secondarySectors: ranked.slice(1).map((item) => item.sector),
    confidence: !applicable ? 0 : Math.min(0.98, 0.68 + (ranked[0]?.score || 1) * 0.1),
    location: detectLocation(text),
    product: detectProduct(text),
    currency,
    inputs: { initialInvestment, purchasePrice, squareMeters, monthlyRent, monthlyRevenue, monthlyOperatingCosts, vacancyPercent, hectares, yieldTonsPerHectare, unitPrice, operatingCostPerHectare, projectedAnnualRevenue, projectedAnnualCosts, workingCapital },
    metrics: { pricePerSquareMeter, annualGrossIncome, annualNetIncome, grossAnnualYieldPercent, netAnnualYieldPercent, simplePaybackYears, projectedProductionTons, projectedOperatingMargin, projectedOperatingMarginPercent, projectedReturnOnInvestmentPercent },
    assumptions,
    missingInputs,
    riskFlags,
    sourceRequirements,
    conclusion,
  };
}
