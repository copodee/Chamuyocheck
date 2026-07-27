import { NextResponse } from 'next/server';
import { authenticatePrequalificationRequest } from '../../../src/modules/prequalification/infrastructure/supabase/auth';

export async function GET(request: Request) {
  const authentication = await authenticatePrequalificationRequest(request);
  if (authentication.ok === false) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }
  return NextResponse.json({
    authorized: true,
    role: authentication.role,
  });
}
