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
  const match = text.match(new RegExp(`${label.source}[^\\n\\r$]{0,80}\\$?\\s*([\\d.]+(?:,\\d+)?)`, label.flags));
  return parseArgentineNumber(match?.[1]);
}

export function extractLeasingQuoteData(rawText: string): LeasingQuoteData | null {
  const text = rawText.replace(/\u00a0/g, ' ');
  const assetValueNet = amountAfter(text, /Valor del bien[^\n\r]{0,40}\(sin IVA\)/i);
  const regularCanons = text.match(/C[aá]nones a pagar[^\n\r]{0,40}?(\d+)\s*(?:c[aá]nones?)?[^\n\r$]{0,80}\$\s*([\d.]+(?:,\d+)?)/i);
  const guarantee = text.match(/C[aá]nones en garant[ií]a[^\n\r]{0,50}?(\d+)\s*(?:c[aá]nones?)?[^\n\r$]{0,80}\$\s*([\d.]+(?:,\d+)?)/i);
  const description = text.match(/Bien a dar en leasing\s*:\s*([^\n\r]+)/i)?.[1]?.trim();
  const insuranceText = text.match(/Seguro del bien\s*:\s*([^\n\r]+)/i)?.[1]?.trim();
  const result: LeasingQuoteData = {
    assetDescription: description,
    assetValueNet,
    vatAmount: amountAfter(text, /IVA del bien/i),
    assetValueVatIncluded: amountAfter(text, /Valor del bien[^\n\r]{0,40}\(IVA incluido\)/i),
    months: parseArgentineNumber(text.match(/Plazo del leasing\s*:\s*(\d+)\s*mes/i)?.[1]),
    regularCanonCount: parseArgentineNumber(regularCanons?.[1]),
    regularCanonAmount: parseArgentineNumber(regularCanons?.[2]),
    optionAmount: amountAfter(text, /Opci[oó]n de compra/i),
    maxiCanonAmount: amountAfter(text, /Maxicanon\s*\/\s*Adelanto/i),
    guaranteeCanons: parseArgentineNumber(guarantee?.[1]),
    guaranteeAmount: parseArgentineNumber(guarantee?.[2]),
    structuringFeePercent: parseArgentineNumber(text.match(/Comisi[oó]n de estructuraci[oó]n\s*:\s*([\d.,]+)\s*%/i)?.[1]),
    insuranceText,
  };
  const meaningfulValues = Object.values(result).filter((value) => value !== undefined && value !== '').length;
  return assetValueNet !== undefined || meaningfulValues >= 3 ? result : null;
}
