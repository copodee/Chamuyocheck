export type DebtReconciliation = {
  balanceDebt: number;
  currentDebt: number;
  difference: number;
  differenceRatio: number | null;
  status: 'consistent' | 'changed' | 'material-change';
  label: string;
};

export function reconcileFinancialDebt(
  balanceDebt: number | null | undefined,
  currentDebt: number | null | undefined,
): DebtReconciliation | null {
  if (balanceDebt == null || currentDebt == null) return null;
  const balanceValue = Number(balanceDebt);
  const currentValue = Number(currentDebt);
  if (!Number.isFinite(balanceValue) || balanceValue < 0 || !Number.isFinite(currentValue) || currentValue < 0) return null;
  if (balanceValue === 0 && currentValue === 0) {
    return { balanceDebt: 0, currentDebt: 0, difference: 0, differenceRatio: 0, status: 'consistent', label: 'Sin deuda financiera informada en ambas fuentes.' };
  }
  const difference = currentValue - balanceValue;
  const differenceRatio = balanceValue > 0 ? difference / balanceValue : null;
  const absoluteRatio = differenceRatio == null ? Infinity : Math.abs(differenceRatio);
  const status = absoluteRatio <= 0.1 ? 'consistent' : absoluteRatio <= 0.3 ? 'changed' : 'material-change';
  const direction = difference > 0 ? 'aumentó' : difference < 0 ? 'disminuyó' : 'no cambió';
  const label = status === 'consistent'
    ? 'La deuda vigente es consistente con el saldo del último balance.'
    : status === 'changed'
      ? `La deuda vigente ${direction}; la variación debe explicarse por movimientos posteriores al cierre.`
      : `La deuda vigente ${direction} de manera material; revisar altas, cancelaciones y diferencias de moneda o fecha de corte.`;
  return { balanceDebt: balanceValue, currentDebt: currentValue, difference, differenceRatio, status, label };
}
