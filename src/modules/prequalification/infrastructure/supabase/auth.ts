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
  const { data: memberships, error: membershipError } = await client
    .from('prequal_memberships')
    .select('organization_id, role')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .limit(1);
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
