export type LeasingQuoteData = {
  assetDescription?: string;
  assetValueNet?: number;
  vatAmount?: number;
  assetValueVatIncluded?: number;
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

export function extractLeasingQuoteData(rawText: string): LeasingQuoteData | null {
  const text = rawText.replace(/\u00a0/g, ' ');
  const searchable = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const assetValueNet = amountAfter(searchable, /Valor del bien[^\n\r]{0,90}\(sin IVA\)/i);
  const regularCanons = searchable.match(/C.nones a pagar[^\n\r]{0,60}?(\d+)\s*(?:c.nones?)?[^\n\r$]{0,100}\$\s*([\d.]+(?:,\d+)?)/i);
  const guarantee = searchable.match(/C.nones en garant.a[^\n\r]{0,80}?(\d+)\s*(?:c.nones?)?[^\n\r$]{0,100}\$\s*([\d.]+(?:,\d+)?)/i);
  const description = text.match(/Bien a dar en leasing\s*:\s*([^\n\r]+)/i)?.[1]?.trim();
  const insuranceText = text.match(/Seguro del bien\s*:\s*([^\n\r]+)/i)?.[1]?.trim();
  const result: LeasingQuoteData = {
    assetDescription: description,
    assetValueNet,
    vatAmount: amountAfter(searchable, /IVA del bien/i),
    assetValueVatIncluded: amountAfter(searchable, /Valor del bien[^\n\r]{0,60}\(IVA incluido\)/i),
    months: parseArgentineNumber(searchable.match(/Plazo del leasing\s*:\s*(\d+)\s*mes/i)?.[1]),
    regularCanonCount: parseArgentineNumber(regularCanons?.[1]),
    regularCanonAmount: parseArgentineNumber(regularCanons?.[2]),
    optionAmount: amountAfter(searchable, /Opci.n de compra/i),
    maxiCanonAmount: amountAfter(searchable, /Maxicanon\s*\/\s*Adelanto/i),
    guaranteeCanons: parseArgentineNumber(guarantee?.[1]),
    guaranteeAmount: parseArgentineNumber(guarantee?.[2]),
    structuringFeePercent: parseArgentineNumber(searchable.match(/Comisi.n de estructuraci.n\s*:\s*([\d.,]+)\s*%/i)?.[1]),
    assetRegistrationCost: amountAfter(searchable, /Inscripci.n registral del bien(?:\s*\([^\n\r)]*\))?(?:\s*-\s*Patentamiento)?/i),
    contractRegistrationCost: amountAfter(searchable, /Inscripci.n registral del contrato/i),
    advanceDisbursementCost: amountAfter(searchable, /Costo financiero diario por desembolso anticipado/i),
    cancellationAdministrativeFee: amountAfter(searchable, /cargo administrativo/i),
    insuranceText,
  };
  const meaningfulValues = Object.values(result).filter((value) => value !== undefined && value !== '').length;
  return assetValueNet !== undefined || meaningfulValues >= 3 ? result : null;
}
