import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from './config';

let browserClient: SupabaseClient<any> | null = null;

export function getSupabaseClient(): SupabaseClient<any> | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(config.url, config.publicKey);
  }

  return browserClient;
}
