import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrequalificationSupabaseConfig } from '../infrastructure/supabase/config';

test('Precalificación puede compartir infraestructura con LeasingScoring sin aceptar ChamuyoCheck', () => {
  const config = getPrequalificationSupabaseConfig({
    NEXT_PUBLIC_LEASING_SUPABASE_URL: 'https://leasing.supabase.co',
    NEXT_PUBLIC_LEASING_SUPABASE_ANON_KEY: 'leasing-key',
    NEXT_PUBLIC_SUPABASE_URL: 'https://chamuyo.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'chamuyo-key',
  });
  assert.deepEqual(config, {
    url: 'https://leasing.supabase.co',
    publicKey: 'leasing-key',
  });
});

test('credenciales específicas de Precalificación prevalecen cuando existen', () => {
  const config = getPrequalificationSupabaseConfig({
    NEXT_PUBLIC_PREQUALIFICATION_SUPABASE_URL: 'https://prequal.supabase.co',
    NEXT_PUBLIC_PREQUALIFICATION_SUPABASE_PUBLISHABLE_KEY: 'prequal-key',
    NEXT_PUBLIC_LEASING_SUPABASE_URL: 'https://leasing.supabase.co',
    NEXT_PUBLIC_LEASING_SUPABASE_ANON_KEY: 'leasing-key',
  });
  assert.deepEqual(config, {
    url: 'https://prequal.supabase.co',
    publicKey: 'prequal-key',
  });
});
