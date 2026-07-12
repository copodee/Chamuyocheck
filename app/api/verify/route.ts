import { NextResponse } from 'next/server';
import { runExternalVerificationWorkflow } from '../../../src/analysis/engines/externalVerificationWorkflow';

const MAX_TEXT_LENGTH = 20_000;

export function externalVerificationExecutionEnabled(value = process.env.EXTERNAL_VERIFICATION_EXECUTION_ENABLED): boolean {
  return value === 'true';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo debe ser JSON válido.' }, { status: 400 });
  }

  const text = typeof (body as any)?.text === 'string' ? (body as any).text.trim() : '';
  const execute = (body as any)?.execute === true;
  if (text.length < 9) return NextResponse.json({ error: 'El texto es demasiado corto para analizar.' }, { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: 'El texto supera el límite permitido.' }, { status: 413 });
  if (execute && !externalVerificationExecutionEnabled()) {
    return NextResponse.json({ error: 'La ejecución externa está deshabilitada.' }, { status: 403 });
  }

  try {
    const result = await runExternalVerificationWorkflow(text, execute);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'No se pudo procesar la verificación externa.' }, { status: 500 });
  }
}
