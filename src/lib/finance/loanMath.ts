export type LoanNumbers = {
  amount?: number | null;
  installment?: number | null;
  months?: number | null;
  totalPaid?: number | null;
  hiddenCost?: number | null;
  hiddenCostPercent?: number | null;
};

export function extractLoanNumbers(text: string): LoanNumbers {
  const numbers = (text.match(/\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]+)/g) || [])
    .map((x) => Number(x.replace(/[^\d]/g, '')))
    .filter(Boolean);

  const monthsMatch = text.toLowerCase().match(/(\d{1,3})\s*(cuotas|meses|pagos)/);
  const months = monthsMatch ? Number(monthsMatch[1]) : null;
  const amount = numbers.length ? Math.max(...numbers) : null;
  const installment = numbers.length > 1 ? Math.min(...numbers.filter((n) => n !== amount)) : null;
  const totalPaid = installment && months ? installment * months : null;
  const hiddenCost = amount && totalPaid ? totalPaid - amount : null;
  const hiddenCostPercent = amount && hiddenCost ? (hiddenCost / amount) * 100 : null;

  return { amount, installment, months, totalPaid, hiddenCost, hiddenCostPercent };
}
