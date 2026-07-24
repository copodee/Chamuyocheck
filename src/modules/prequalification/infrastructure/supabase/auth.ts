import { createClient, type User } from '@supabase/supabase-js';
import { getPrequalificationSupabaseConfig } from './config';

type Result =
  | { ok: true; user: User; token: string; organizationId: string; role: string }
  | { ok: false; status: number; error: string };

export async function authenticatePrequalificationRequest(request: Request): Promise<Result> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return { ok: false, status: 401, error: 'Ingresá con tu acceso autorizado de Precalificación.' };
  const config = getPrequalificationSupabaseConfig();
  if (!config) return { ok: false, status: 503, error: 'El Supabase exclusivo de Precalificación todavía no está conectado.' };
  const client = createClient(config.url, config.publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: 'La sesión venció o no es válida.' };
  let memberships: Array<{ organization_id: string; role: string }> = [];
  let membershipError = false;
  try {
    const membershipResponse = await fetch(`${config.url}/rest/v1/rpc/get_prequal_access`, {
      method: 'POST',
      headers: {
        apikey: config.publicKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(8_000),
    });
    membershipError = !membershipResponse.ok;
    if (membershipResponse.ok) memberships = await membershipResponse.json();
  } catch {
    membershipError = true;
  }
  const membership = memberships?.[0];
  if (membershipError || !membership) {
    return { ok: false, status: 403, error: 'Tu cuenta existe, pero no está autorizada para Precalificación.' };
  }
  return {
    ok: true,
    user: data.user,
    token,
    organizationId: membership.organization_id,
    role: membership.role,
  };
}
