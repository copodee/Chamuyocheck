'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPrequalificationSupabaseConfig } from './config';

let client: SupabaseClient | null = null;

export function getPrequalificationSupabaseClient(): SupabaseClient | null {
  const config = getPrequalificationSupabaseConfig();
  if (!config) return null;
  if (!client) client = createClient(config.url, config.publicKey);
  return client;
}
