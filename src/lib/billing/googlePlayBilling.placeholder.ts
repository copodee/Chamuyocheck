export type BillingPlan = {
  id: string;
  name: string;
  priceARS: number;
  features: string[];
};

export const plans: BillingPlan[] = [
  { id: 'starter', name: 'Starter', priceARS: 0, features: ['3 análisis de texto', '250 caracteres'] },
  { id: 'pro_monthly', name: 'Pro mensual', priceARS: 6900, features: ['PDF', 'Imagen', 'Web', 'YouTube', 'Historial', 'Informes'] },
];

export async function startGooglePlayPurchasePlaceholder(planId: string) {
  return { ok: true, planId, message: 'Pendiente de integración real con Google Play Billing.' };
}
