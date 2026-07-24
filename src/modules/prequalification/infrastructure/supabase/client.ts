'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPrequalificationSupabaseConfig } from './config';

let client: SupabaseClient | null = null;
export const PREQUALIFICATION_AUTH_STORAGE_KEY = 'leasingscoring-prequalification-auth';

export function getPrequalificationSupabaseClient(): SupabaseClient | null {
  const config = getPrequalificationSupabaseConfig();
  if (!config) return null;
  if (!client) {
    client = createClient(config.url, config.publicKey, {
      auth: {
        storageKey: PREQUALIFICATION_AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
