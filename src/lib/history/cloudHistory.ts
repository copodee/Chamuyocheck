import { getSupabaseClient } from '../supabase/client';

export async function saveCloudHistory(result: any) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, mode: 'local', message: 'Supabase no configurado.' };

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, mode: 'guest', message: 'Usuario no autenticado.' };

  const { error } = await supabase.from('analyses').insert({
    user_id: user.id,
    title: result.documentType || 'Análisis',
    document_type: result.documentType,
    input_type: result.detectedInput,
    score: result.score,
    summary: result.summary,
    result
  });

  return { ok: !error, error };
}

export async function readCloudHistory() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];

  const { data } = await supabase
    .from('analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  return data || [];
}
