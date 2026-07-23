type PublicEnvironment = Record<string, string | undefined>;

// Next.js only exposes NEXT_PUBLIC_* variables to browser bundles when each
// variable is referenced statically. Passing process.env and then reading it
// dynamically leaves these values undefined in production.
const bundledPublicEnvironment: PublicEnvironment = {
  NEXT_PUBLIC_SITE_MODE: process.env.NEXT_PUBLIC_SITE_MODE,
  NEXT_PUBLIC_LEASING_SUPABASE_URL:
    process.env.NEXT_PUBLIC_LEASING_SUPABASE_URL,
  NEXT_PUBLIC_LEASING_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_LEASING_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_LEASING_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_LEASING_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export type SupabasePublicConfig = {
  url: string;
  publicKey: string;
  productName: 'ChamuyoCheck' | 'LeasingScoring';
};

export function getSupabasePublicConfig(
  environment: PublicEnvironment = bundledPublicEnvironment,
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
