export function clampScore(value: unknown, fallback = 50): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function riskLabel(score: number): 'Bajo' | 'Medio' | 'Alto' {
  if (score >= 75) return 'Alto';
  if (score >= 45) return 'Medio';
  return 'Bajo';
}
