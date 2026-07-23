type PublicEnvironment = Record<string, string | undefined>;

export type SupabasePublicConfig = {
  url: string;
  publicKey: string;
  productName: 'ChamuyoCheck' | 'LeasingScoring';
};

export function getSupabasePublicConfig(
  environment: PublicEnvironment = process.env,
): SupabasePublicConfig | null {
  const leasingSite = environment.NEXT_PUBLIC_SITE_MODE === 'leasing';
  const url = leasingSite
    ? environment.NEXT_PUBLIC_LEASING_SUPABASE_URL
    : environment.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = leasingSite
    ? environment.NEXT_PUBLIC_LEASING_SUPABASE_PUBLISHABLE_KEY ||
      environment.NEXT_PUBLIC_LEASING_SUPABASE_ANON_KEY
    : environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publicKey) return null;

  return {
    url,
    publicKey,
    productName: leasingSite ? 'LeasingScoring' : 'ChamuyoCheck',
  };
}
