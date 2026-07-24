import assert from 'node:assert/strict';
import test from 'node:test';
import { PREQUALIFICATION_AUTH_STORAGE_KEY } from '../infrastructure/supabase/client';

test('Precalificación usa una sesión de navegador distinta de LeasingScoring general', () => {
  assert.equal(
    PREQUALIFICATION_AUTH_STORAGE_KEY,
    'leasingscoring-prequalification-auth',
  );
  assert.notEqual(PREQUALIFICATION_AUTH_STORAGE_KEY, 'sb-auth-token');
});
