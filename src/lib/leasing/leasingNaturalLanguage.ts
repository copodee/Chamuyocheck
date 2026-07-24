export type LeasingNaturalLanguageData = {
  assetValue?: number;
  maxiCanonPercent?: number;
  financedPercent?: number;
  months?: number;
  annualNominalRatePercent?: number;
  optionPercent?: number;
  optionAmount?: number;
  mentionsOptionWithoutValue: boolean;
};

function number(raw?: string): number | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/\s/g, '');
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact.replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export function extractLeasingNaturalLanguage(rawText: string): LeasingNaturalLanguageData {
  const text = rawText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const assetValue = number(text.match(
    /(?:auto|automovil|vehiculo|camioneta|pickup|utilitario|bien|valor(?:\s+del)?\s+bien)(?:\s+\w+){0,4}?\s+(?:de|por|vale|valor(?:ado)?\s+en|precio\s+de)?\s*\$?\s*([\d.]+(?:,\d+)?)/i,
  )?.[1]);
  const maxiCanonPercent = number(text.match(/maxi\s*canon(?:\s+\w+){0,3}?\s*(?:de|del)?\s*([\d.,]+)\s*%/i)?.[1]);
  const months = number(text.match(/(\d{1,3})\s*(?:cuotas?|canones?|meses?)/i)?.[1]);
  const annualNominalRatePercent = number((
    text.match(/([\d.,]+)\s*%\s*(?:de\s+)?tna\b/i)
    || text.match(/\btna(?:\s+\w+){0,3}?\s*([\d.,]+)\s*%?/i)
  )?.[1]);
  const optionPercent = number((
    text.match(/opcion\s+de\s+compra(?:\s+\w+){0,4}?\s*([\d.,]+)\s*%/i)
    || text.match(/([\d.,]+)\s*%\s*(?:de\s+)?opcion\s+de\s+compra/i)
  )?.[1]);
  const optionAmount = optionPercent === undefined
    ? number(text.match(/opcion\s+de\s+compra(?:\s+\w+){0,4}?\s*\$\s*([\d.]+(?:,\d+)?)/i)?.[1])
    : undefined;
  const mentionsOption = /opcion\s+de\s+compra/i.test(text);
  const financedPercent = maxiCanonPercent !== undefined && /(?:por\s+el\s+resto|saldo|restante)/i.test(text)
    ? Math.max(0, 100 - maxiCanonPercent)
    : undefined;

  return {
    assetValue,
    maxiCanonPercent,
    financedPercent,
    months,
    annualNominalRatePercent,
    optionPercent,
    optionAmount,
    mentionsOptionWithoutValue: mentionsOption && optionPercent === undefined && optionAmount === undefined,
  };
}
