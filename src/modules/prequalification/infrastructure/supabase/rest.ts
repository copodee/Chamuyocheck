import { getPrequalificationSupabaseConfig } from './config';

export async function prequalRest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getPrequalificationSupabaseConfig();
  if (!config) throw new Error('Supabase de Precalificación no configurado.');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.publicKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
