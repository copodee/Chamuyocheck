export type BuenosAiresPatentEstimate = {
  valuation: number;
  taxableBase: number;
  annualTax: number;
  isNew: boolean;
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
