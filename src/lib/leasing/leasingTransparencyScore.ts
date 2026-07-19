export type LeasingTransparencyScore = {
  score: number;
  label: string;
  color: string;
  present: string[];
  missing: string[];
};

export type LeasingTransparencyEvidence = {
  documentText?: string;
  userText?: string;
  manualFields?: Partial<Record<'assetType' | 'assetValue' | 'financedPercent' | 'months' | 'tna' | 'option' | 'structuringFee' | 'guaranteeCanons' | 'jurisdiction', string>>;
};

const dimensions: Array<{ label: string; weight: number; pattern: RegExp }> = [
  { label: 'Identificación del dador y del tomador', weight: 6, pattern: /(?:dador|finanlease|inverlease|banco).*(?:tomador|cliente)|(?:tomador|cliente).*(?:dador|banco)/i },
  { label: 'Bien y proveedor identificados', weight: 6, pattern: /(?:bien|veh[ií]culo|maquinaria|equipo|inmueble|aeronave|embarcaci[oó]n).*(?:proveedor|marca|modelo|leasing)/i },
  { label: 'Valor neto e IVA separados', weight: 8, pattern: /(?:sin iva|valor neto).*(?:iva)|(?:iva).*(?:sin iva|valor neto)/i },
  { label: 'Porcentaje financiado o maxi canon', weight: 6, pattern: /porcentaje (?:a )?financiad|maxicanon|adelanto|anticipo/i },
  { label: 'Plazo y periodicidad', weight: 6, pattern: /plazo.{0,30}(?:mes|año)|\d+\s*(?:meses|c[aá]nones)/i },
  { label: 'Cantidad e importe de cánones', weight: 9, pattern: /c[aá]nones?.{0,45}(?:\$|importe|fijo|variable|\d)/i },
  { label: 'TNA informada', weight: 7, pattern: /\bTNA\b|tasa nominal anual/i },
  { label: 'TEA informada', weight: 7, pattern: /\bTEA\b|tasa efectiva anual/i },
  { label: 'CFTEA o costo financiero total', weight: 10, pattern: /\bCFTEA\b|\bCFT\b|costo financiero total/i },
  { label: 'Opción de compra cuantificada', weight: 8, pattern: /opci[oó]n de compra.{0,50}(?:\$|%|importe|valor)/i },
  { label: 'Comisiones y gastos iniciales', weight: 6, pattern: /comisi[oó]n|estructuraci[oó]n|gasto administrativo/i },
  { label: 'Seguro y mantenimiento', weight: 5, pattern: /seguro.{0,80}mantenimiento|mantenimiento.{0,80}seguro/i },
  { label: 'Garantías y tratamiento al final', weight: 5, pattern: /c[aá]nones? en garant[ií]a|dep[oó]sito en garant[ií]a|garant[ií]a.{0,50}(?:aplica|devuelve|cancela)/i },
  { label: 'Impuestos discriminados', weight: 5, pattern: /(?:sellos|ingresos brutos|ganancias|patente).*(?:iva|impuesto)|iva.*(?:sellos|ganancias|patente)/i },
  { label: 'Registro, jurisdicción y gastos de transferencia', weight: 6, pattern: /registr|radicaci[oó]n|jurisdicci[oó]n|patentamiento|transferencia/i },
];

export function calculateLeasingTransparencyScore(text: string): LeasingTransparencyScore {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const present = dimensions.filter((item) => item.pattern.test(normalized));
  const missing = dimensions.filter((item) => !item.pattern.test(normalized));
  const score = present.reduce((sum, item) => sum + item.weight, 0);
  const label = score >= 85 ? 'Transparencia muy alta' : score >= 70 ? 'Transparencia alta' : score >= 50 ? 'Información parcial' : score >= 30 ? 'Faltan datos importantes' : 'Información insuficiente';
  const color = score >= 85 ? '#22e58b' : score >= 70 ? '#8bf53f' : score >= 50 ? '#f4ff00' : score >= 30 ? '#ffb020' : '#ff6b6b';
  return { score, label, color, present: present.map((item) => item.label), missing: missing.map((item) => item.label) };
}

export function buildLeasingTransparencyEvidence({ documentText = '', userText = '', manualFields = {} }: LeasingTransparencyEvidence): string {
  const fieldLabels: Record<keyof NonNullable<LeasingTransparencyEvidence['manualFields']>, string> = {
    assetType: 'Bien objeto del leasing',
    assetValue: 'Valor neto sin IVA e IVA a discriminar',
    financedPercent: 'Porcentaje financiado',
    months: 'Plazo en meses',
    tna: 'TNA informada',
    option: 'Opción de compra',
    structuringFee: 'Comisión de estructuración',
    guaranteeCanons: 'Cánones en garantía que se aplican al final',
    jurisdiction: 'Registración y jurisdicción',
  };
  const suppliedFields = Object.entries(manualFields)
    .filter(([, value]) => String(value || '').trim())
    .map(([key, value]) => `${fieldLabels[key as keyof typeof fieldLabels]} ${value}`);
  return [documentText, userText, ...suppliedFields].filter((value) => value.trim()).join(' ');
}
