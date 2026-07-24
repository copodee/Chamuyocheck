import { NextResponse } from 'next/server';
import { authenticatePrequalificationRequest } from '../../../../src/modules/prequalification/infrastructure/supabase/auth';
import { buildDossierPdf } from '../../../../src/modules/prequalification/reports/dossierPdf';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await authenticatePrequalificationRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (!body?.caseNumber || !body?.stage1) return NextResponse.json({ error: 'Expediente incompleto.' }, { status: 400 });
  const pdf = await buildDossierPdf(body);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${String(body.caseNumber).replace(/[^A-Z0-9-]/gi, '')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
