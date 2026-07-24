export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCuit(value: string): boolean {
  const cuit = normalizeCuit(value);
  if (!/^\d{11}$/.test(cuit) || /^(\d)\1{10}$/.test(cuit)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(cuit[index]) * weight, 0);
  return 11 - (sum % 11) === 11
    ? Number(cuit[10]) === 0
    : 11 - (sum % 11) === 10
      ? Number(cuit[10]) === 9
      : Number(cuit[10]) === 11 - (sum % 11);
}
