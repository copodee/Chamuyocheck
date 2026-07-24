export type BuenosAiresPatentEstimate = {
  valuation: number;
  taxableBase: number;
  annualTax: number;
  isNew: boolean;
};

export type CabaPatentEstimate = {
  valuation: number;
  taxBeforeSubwayFund: number;
  annualTax: number;
  effectiveRatePercent: number;
};

// Ley Impositiva bonaerense 2026, escala de automóviles modelo-año 2016 a 2026.
const BUENOS_AIRES_2026_SCALE = [
  { over: 0, fixed: 0, rate: 1 },
  { over: 14_100_000, fixed: 141_000, rate: 2 },
  { over: 18_700_000, fixed: 233_000, rate: 3 },
  { over: 26_100_000, fixed: 455_000, rate: 4 },
  { over: 53_900_000, fixed: 1_567_000, rate: 4.5 },
] as const;

export function estimateBuenosAiresVehiclePatent2026(
  valuation: number,
  { isNew = false }: { isNew?: boolean } = {},
): BuenosAiresPatentEstimate | null {
  if (!Number.isFinite(valuation) || valuation <= 0) return null;
  const taxableBase = valuation * (isNew ? 1 : 0.95);
  const bracket = [...BUENOS_AIRES_2026_SCALE].reverse().find((item) => taxableBase > item.over)
    || BUENOS_AIRES_2026_SCALE[0];
  return {
    valuation,
    taxableBase,
    annualTax: bracket.fixed + (taxableBase - bracket.over) * bracket.rate / 100,
    isNew,
  };
}

const CABA_2026_SCALE = [
  { over: 0, fixed: 0, rate: 1.6 },
  { over: 7_460_000, fixed: 119_350, rate: 4 },
  { over: 17_155_000, fixed: 507_150, rate: 4.5 },
  { over: 26_850_000, fixed: 943_500, rate: 5.5 },
  { over: 36_550_000, fixed: 1_477_000, rate: 6.5 },
  { over: 50_350_000, fixed: 2_374_000, rate: 7 },
  { over: 73_100_000, fixed: 3_965_000, rate: 8 },
] as const;

export function estimateCabaVehiclePatent2026(valuation: number): CabaPatentEstimate | null {
  if (!Number.isFinite(valuation) || valuation <= 0) return null;
  const bracket = [...CABA_2026_SCALE].reverse().find((item) => valuation > item.over)
    || CABA_2026_SCALE[0];
  const taxBeforeSubwayFund = bracket.fixed + (valuation - bracket.over) * bracket.rate / 100;
  const withSubwayFund = taxBeforeSubwayFund * 1.10;
  const annualTax = Math.max(13_300, Math.min(withSubwayFund, valuation * 0.06));
  return {
    valuation,
    taxBeforeSubwayFund,
    annualTax,
    effectiveRatePercent: Math.round(annualTax / valuation * 100 * 1_000_000) / 1_000_000,
  };
}
