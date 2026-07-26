import { NextResponse } from 'next/server';
import { authenticatePrequalificationRequest } from '../../../../src/modules/prequalification/infrastructure/supabase/auth';
import { getPrequalificationSupabaseConfig } from '../../../../src/modules/prequalification/infrastructure/supabase/config';

export const runtime = 'nodejs';
const allowed = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export async function POST(request: Request) {
  const auth = await authenticatePrequalificationRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const config = getPrequalificationSupabaseConfig();
  if (!config) return NextResponse.json({ error: 'Almacenamiento no configurado.' }, { status: 503 });
  if ((request.headers.get('content-type') || '').includes('application/json')) {
    const input = await request.json() as { caseId?: string; stage?: string | number; fileName?: string; fileType?: string; fileSize?: number };
    const caseId = String(input.caseId || '');
    const stage = String(input.stage || '');
    const fileName = String(input.fileName || '');
    const fileType = String(input.fileType || 'application/octet-stream');
    const fileSize = Number(input.fileSize || 0);
    const supportedExtension = /\.(pdf|jpe?g|png|webp|doc|docx|xls|xlsx)$/i.test(fileName);
    if (!caseId || !['2', '3'].includes(stage) || !fileName) return NextResponse.json({ error: 'Documento incompleto.' }, { status: 400 });
    if ((!allowed.has(fileType) && !supportedExtension) || fileSize > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Sólo PDF, JPG, PNG, WEBP, Word o Excel de hasta 20 MB.' }, { status: 400 });
    }
    const safeName = fileName.normalize('NFKD').replace(/[^\w.-]+/g, '-').slice(-100);
    const storagePath = `${auth.organizationId}/${caseId}/stage-${stage}/${crypto.randomUUID()}-${safeName}`;
    return NextResponse.json({
      storagePath,
      uploadUrl: `${config.url}/storage/v1/object/prequalification-documents/${storagePath}`,
      publicKey: config.publicKey,
    });
  }
  const data = await request.formData();
  const file = data.get('file');
  const caseId = String(data.get('caseId') || '');
  const stage = String(data.get('stage') || '');
  if (!(file instanceof File) || !caseId || !['2', '3'].includes(stage)) return NextResponse.json({ error: 'Documento incompleto.' }, { status: 400 });
  const supportedExtension = /\.(pdf|jpe?g|png|webp|doc|docx|xls|xlsx)$/i.test(file.name);
  if ((!allowed.has(file.type) && !supportedExtension) || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Sólo PDF, JPG, PNG, WEBP, Word o Excel de hasta 20 MB.' }, { status: 400 });
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
