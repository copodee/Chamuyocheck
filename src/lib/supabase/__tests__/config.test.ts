import assert from 'node:assert/strict';
import test from 'node:test';
import { getSupabasePublicConfig } from '../config';

test('ChamuyoCheck utiliza solamente sus credenciales generales', () => {
  const config = getSupabasePublicConfig({
    NEXT_PUBLIC_SITE_MODE: 'chamuyo',
    NEXT_PUBLIC_SUPABASE_URL: 'https://chamuyo.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'chamuyo-key',
    NEXT_PUBLIC_LEASING_SUPABASE_URL: 'https://leasing.supabase.co',
    NEXT_PUBLIC_LEASING_SUPABASE_ANON_KEY: 'leasing-key',
  });

  assert.deepEqual(config, {
    url: 'https://chamuyo.supabase.co',
    publicKey: 'chamuyo-key',
    productName: 'ChamuyoCheck',
  });
});

test('LeasingScoring utiliza solamente sus credenciales exclusivas', () => {
  const config = getSupabasePublicConfig({
    NEXT_PUBLIC_SITE_MODE: 'leasing',
    NEXT_PUBLIC_SUPABASE_URL: 'https://chamuyo.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'chamuyo-key',
    NEXT_PUBLIC_LEASING_SUPABASE_URL: 'https://leasing.supabase.co',
    NEXT_PUBLIC_LEASING_SUPABASE_ANON_KEY: 'leasing-key',
  });

  assert.deepEqual(config, {
    url: 'https://leasing.supabase.co',
    publicKey: 'leasing-key',
    productName: 'LeasingScoring',
  });
});

test('LeasingScoring no acepta credenciales de ChamuyoCheck como respaldo', () => {
  const config = getSupabasePublicConfig({
    NEXT_PUBLIC_SITE_MODE: 'leasing',
    NEXT_PUBLIC_SUPABASE_URL: 'https://chamuyo.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'chamuyo-key',
  });

  assert.equal(config, null);
});
