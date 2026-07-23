import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from '../supabase/config';

type AuthenticationResult =
  | { ok: true; accessToken: string; user: User; client: SupabaseClient }
  | { ok: false; status: number; error: string };

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export async function authenticateAnalysisRequest(request: Request): Promise<AuthenticationResult> {
  const config = getSupabasePublicConfig();
  const productName = process.env.NEXT_PUBLIC_SITE_MODE === 'leasing' ? 'LeasingScoring' : 'ChamuyoCheck';
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return { ok: false, status: 401, error: `Iniciá sesión para utilizar ${productName}.` };
  }

  if (!config) {
    return { ok: false, status: 503, error: 'El registro de usuarios todavía no está configurado en este entorno.' };
  }

  const client = createClient(config.url, config.publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return { ok: false, status: 401, error: 'La sesión venció o no es válida. Volvé a iniciar sesión.' };
  }

  return { ok: true, accessToken, user: data.user, client };
}

export async function recordSuccessfulAnalysis(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('record_analysis_usage');
  if (error) {
    console.warn('No se pudo actualizar el contador de uso registrado.', error.message);
  }
}
