export type LeasingQuoteData = {
  quoteDateText?: string;
  customerName?: string;
  customerTaxId?: string;
  assetDescription?: string;
  assetValueNet?: number;
  vatAmount?: number;
  freightAmount?: number;
  freightVatAmount?: number;
  assetValueVatIncluded?: number;
  currency?: string;
  exchangeRate?: number;
  months?: number;
  regularCanonCount?: number;
  regularCanonAmount?: number;
  optionAmount?: number;
  maxiCanonAmount?: number;
  guaranteeCanons?: number;
  guaranteeAmount?: number;
  structuringFeePercent?: number;
  assetRegistrationCost?: number;
  contractRegistrationCost?: number;
  advanceDisbursementCost?: number;
  cancellationAdministrativeFee?: number;
  insuranceText?: string;
  quotedIncomeTaxSavingsLeasing?: number;
  quotedVatInitialLeasing?: number;
  claimedStampPatentExempt?: boolean;
  claimedStampContractExempt?: boolean;
  quoteValidityDays?: number;
  ambiguousMaxiCanonSymbol?: boolean;
};

function parseArgentineNumber(raw?: string): number | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/\s/g, '');
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact.replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function amountAfter(text: string, label: RegExp): number | undefined {
  const labelMatch = label.exec(text);
  if (!labelMatch || labelMatch.index === undefined) return undefined;
  const remainder = text.slice(labelMatch.index + labelMatch[0].length).split(/[\n\r]/, 1)[0] || '';
  const amountMatch = remainder.match(/[^\d$]{0,80}\$?\s*([\d.]+(?:,\d+)?)/);
  return parseArgentineNumber(amountMatch?.[1]);
}

function lineValue(text: string, label: RegExp): string | undefined {
  const match = text.match(label);
  return match?.[1]?.trim() || undefined;
}

function amountsInLine(text: string, label: RegExp): number[] {
  const line = text.match(label)?.[1] || '';
  return [...line.matchAll(/\$\s*([\d.]+(?:,\d+)?)/g)]
    .map((match) => parseArgentineNumber(match[1]))
    .filter((value): value is number => value !== undefined);
}

export function extractLeasingQuoteData(rawText: string): LeasingQuoteData | null {
  const text = rawText
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join('\n');
  const searchable = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const naturalAssetValue = parseArgentineNumber(searchable.match(
    /(?:auto|automovil|vehiculo|camioneta|pickup|utilitario|bien)(?:\s+\w+){0,6}?\s+(?:vale|cuesta|por|de|valor(?:ado)?\s+en)\s*\$?\s*([\d.]+(?:,\d+)?)/i,
  )?.[1]);
  const structuredAssetValue = amountAfter(searchable, /Valor del bien[^\n\r]{0,90}\(sin IVA\)/i);
  const assetValueNet = structuredAssetValue ?? naturalAssetValue;
  const regularCanons = searchable.match(/C.nones a pagar[^\n\r]{0,60}?(\d+)\s*(?:c.nones?)?[^\n\r$]{0,100}\$\s*([\d.]+(?:,\d+)?)/i)
    || searchable.match(/(\d{1,3})\s*cuotas?\s+(?:mensuales?\s+)?de\s*\$?\s*([\d.]+(?:,\d+)?)/i);
  const guarantee = searchable.match(/C.nones en garant.a[^\n\r]{0,80}?(\d+)\s*(?:c.nones?)?[^\n\r$]{0,100}\$\s*([\d.]+(?:,\d+)?)/i);
  const description = text.match(/Bien a dar en leasing\s*:\s*([^\n\r]+)/i)?.[1]?.trim();
  const insuranceText = text.match(/Seguro del bien\s*:\s*([^\n\r]+)/i)?.[1]?.trim();
  const incomeTaxSavings = amountsInLine(searchable, /^Ganancias\s*:\s*([^\n\r]+)/im);
  const initialVatAmounts = amountsInLine(searchable, /^IVA\s*\(inmovilizacion por credito al inicio\)\s*:\s*([^\n\r]+)/im);
  const patentStampLine = lineValue(searchable, /^Patentamiento\s*:\s*([^\n\r]+)/im);
  const contractStampLine = lineValue(searchable, /^Contrato\s*:\s*([^\n\r]+)/im);
  const naturalMaxiCanon = searchable.match(/([\d.,]+)\s*([%$])?\s+de\s+maxi\s*canon|maxi\s*canon(?:\s+\w+){0,3}?\s*(?:de|del)?\s*([\d.,]+)\s*([%$])/i);
  const naturalMaxiPercent = parseArgentineNumber(naturalMaxiCanon?.[1] || naturalMaxiCanon?.[3]);
  const naturalMaxiSymbol = naturalMaxiCanon?.[2] || naturalMaxiCanon?.[4];
  const naturalOptionPercent = parseArgentineNumber(searchable.match(
    /opci.n\s+de\s+compra(?:\s+\w+){0,5}?\s*([\d.,]+)\s*%/i,
  )?.[1]);
  const naturalMonths = parseArgentineNumber(searchable.match(/(\d{1,3})\s*cuotas?/i)?.[1]);
  const structuredMonths = parseArgentineNumber(searchable.match(/Plazo del leasing\s*:\s*(\d+)\s*mes/i)?.[1]);
  const naturalMaxiAmount = assetValueNet !== undefined && naturalMaxiPercent !== undefined && naturalMaxiPercent <= 100
    ? assetValueNet * naturalMaxiPercent / 100
    : undefined;
  const naturalOptionAmount = assetValueNet !== undefined && naturalOptionPercent !== undefined
    ? assetValueNet * naturalOptionPercent / 100
    : undefined;
  const result: LeasingQuoteData = {
    quoteDateText: lineValue(text, /COTIZACIÓN DE OPERACIÓN DE LEASING FINANCIERO EN PESOS\s+(?:Beccar,\s*)?([^\n\r]+)/i),
    customerName: lineValue(text, /^Tomador del leasing\s*:\s*([^\n\r]+)/im),
    customerTaxId: lineValue(text, /^CUIT\s*:\s*([^\n\r]+)/im),
    assetDescription: description,
    assetValueNet,
    vatAmount: amountAfter(searchable, /IVA del bien/i),
    freightAmount: amountAfter(searchable, /^Fletes, formularios, etc\./im),
    freightVatAmount: amountAfter(searchable, /^IVA fletes, formularios, etc\./im),
    assetValueVatIncluded: amountAfter(searchable, /Valor del bien[^\n\r]{0,60}\(IVA incluido\)/i),
    currency: lineValue(text, /^Moneda del leasing\s*:\s*([^\n\r]+)/im),
    exchangeRate: amountAfter(searchable, /Tipo de cambio/i),
    months: structuredMonths ?? naturalMonths,
    regularCanonCount: parseArgentineNumber(regularCanons?.[1]),
    regularCanonAmount: parseArgentineNumber(regularCanons?.[2]),
    optionAmount: naturalOptionAmount ?? amountAfter(searchable, /Opci.n de compra/i),
    maxiCanonAmount: amountAfter(searchable, /Maxicanon\s*\/\s*Adelanto/i) ?? naturalMaxiAmount,
    guaranteeCanons: parseArgentineNumber(guarantee?.[1]),
    guaranteeAmount: parseArgentineNumber(guarantee?.[2]),
    structuringFeePercent: parseArgentineNumber(searchable.match(/Comisi.n de estructuraci.n\s*:\s*([\d.,]+)\s*%/i)?.[1]),
    assetRegistrationCost: amountAfter(searchable, /Inscripci.n registral del bien(?:\s*\([^\n\r)]*\))?(?:\s*-\s*Patentamiento)?/i),
    contractRegistrationCost: amountAfter(searchable, /Inscripci.n registral del contrato/i),
    advanceDisbursementCost: amountAfter(searchable, /Costo financiero diario por desembolso anticipado/i),
    cancellationAdministrativeFee: amountAfter(searchable, /cargo administrativo/i),
    insuranceText,
    quotedIncomeTaxSavingsLeasing: incomeTaxSavings[2],
    quotedVatInitialLeasing: initialVatAmounts[2],
    claimedStampPatentExempt: patentStampLine ? /\bExento\b/i.test(patentStampLine) : undefined,
    claimedStampContractExempt: contractStampLine ? /\bExento\b/i.test(contractStampLine) : undefined,
    quoteValidityDays: parseArgentineNumber(searchable.match(/validez de\s+(\d+)\s+dias corridos/i)?.[1]),
    ...(naturalMaxiSymbol === '$' && naturalMaxiPercent !== undefined && naturalMaxiPercent <= 100
      ? { ambiguousMaxiCanonSymbol: true }
      : {}),
  };
  const meaningfulValues = Object.values(result).filter((value) => value !== undefined && value !== '').length;
  const completeNaturalFlow = naturalAssetValue !== undefined
    && result.regularCanonCount !== undefined
    && result.regularCanonAmount !== undefined;
  return structuredAssetValue !== undefined || completeNaturalFlow || (naturalAssetValue === undefined && meaningfulValues >= 3) ? result : null;
}
