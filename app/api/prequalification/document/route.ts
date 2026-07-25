import { NextResponse } from 'next/server';
import { authenticatePrequalificationRequest } from '../../../../src/modules/prequalification/infrastructure/supabase/auth';
import { getPrequalificationSupabaseConfig } from '../../../../src/modules/prequalification/infrastructure/supabase/config';

export const runtime = 'nodejs';
const allowed = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export async function POST(request: Request) {
  const auth = await authenticatePrequalificationRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const data = await request.formData();
  const file = data.get('file');
  const caseId = String(data.get('caseId') || '');
  const stage = String(data.get('stage') || '');
  if (!(file instanceof File) || !caseId || !['2', '3'].includes(stage)) return NextResponse.json({ error: 'Documento incompleto.' }, { status: 400 });
  const supportedExtension = /\.(pdf|jpe?g|png|doc|docx|xls|xlsx)$/i.test(file.name);
  if ((!allowed.has(file.type) && !supportedExtension) || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Sólo PDF, JPG, PNG, Word o Excel de hasta 20 MB.' }, { status: 400 });
  const config = getPrequalificationSupabaseConfig();
  if (!config) return NextResponse.json({ error: 'Almacenamiento no configurado.' }, { status: 503 });
  const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '-').slice(-100);
  const storagePath = `${auth.organizationId}/${caseId}/stage-${stage}/${crypto.randomUUID()}-${safeName}`;
  const response = await fetch(`${config.url}/storage/v1/object/prequalification-documents/${storagePath}`, {
    method: 'POST',
    headers: { apikey: config.publicKey, Authorization: `Bearer ${auth.token}`, 'Content-Type': file.type, 'x-upsert': 'false' },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!response.ok) {
    console.error('Document upload failed', await response.text());
    return NextResponse.json({ error: 'No se pudo guardar el documento en el expediente privado.' }, { status: 502 });
  }
  return NextResponse.json({ storagePath });
}
