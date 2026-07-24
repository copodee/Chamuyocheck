import { NextResponse } from 'next/server';
import { isValidCuit, normalizeCuit } from '../../../src/modules/prequalification/domain/cuit';
import type { PrequalificationRequest } from '../../../src/modules/prequalification/domain/types';
import { authenticatePrequalificationRequest } from '../../../src/modules/prequalification/infrastructure/supabase/auth';
import { BcraCreditProvider } from '../../../src/modules/prequalification/providers/bcraProvider';
import { CreditProviderError } from '../../../src/modules/prequalification/providers/creditProvider';
import { evaluatePrequalification } from '../../../src/modules/prequalification/scoring/riskEngine';

export const runtime = 'nodejs';

const clientTypes = new Set(['persona-humana', 'persona-juridica']);
const assetTypes = new Set(['automotor-0km', 'automotor-usado', 'maquinaria', 'equipo', 'inmueble', 'otro']);

export async function POST(request: Request) {
  const authentication = await authenticatePrequalificationRequest(request);
  if (authentication.ok === false) {
    return NextResponse.json({ error: authentication.error }, { status: authentication.status });
  }

  let body: PrequalificationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'La solicitud no contiene datos válidos.' }, { status: 400 });
  }

  const cuit = normalizeCuit(body.cuit || '');
  const assetValue = Number(body.assetValue);
  const advance = Number(body.advance || 0);
  const termMonths = Number(body.termMonths);
  if (!isValidCuit(cuit)) return NextResponse.json({ error: 'Ingresá un CUIT/CUIL válido.' }, { status: 400 });
  if (!clientTypes.has(body.clientType)) return NextResponse.json({ error: 'Elegí el tipo de cliente.' }, { status: 400 });
  if (!assetTypes.has(body.assetType)) return NextResponse.json({ error: 'Elegí el tipo de bien.' }, { status: 400 });
  if (!Number.isFinite(assetValue) || assetValue <= 0) return NextResponse.json({ error: 'El valor del bien debe ser mayor que cero.' }, { status: 400 });
  if (!Number.isFinite(advance) || advance < 0 || advance > assetValue) return NextResponse.json({ error: 'El anticipo debe estar entre cero y el valor del bien.' }, { status: 400 });
  if (!Number.isInteger(termMonths) || termMonths < 12 || termMonths > 84) return NextResponse.json({ error: 'El plazo debe estar entre 12 y 84 meses.' }, { status: 400 });

  try {
    const report = await new BcraCreditProvider().getCreditReport(cuit);
    const result = evaluatePrequalification({ ...body, cuit, assetValue, advance, termMonths }, report);
    return NextResponse.json({
      subject: { denomination: report.denomination, cuitMasked: `**-${cuit.slice(2, 9)}-*` },
      result,
      disclaimer: 'Precalificación preliminar. No constituye aprobación, oferta ni compromiso de otorgamiento.',
    });
  } catch (error) {
    if (error instanceof CreditProviderError) {
      const status = error.code === 'not-found' ? 404 : error.code === 'invalid-id' ? 400 : 502;
      return NextResponse.json({ error: error.message, retryable: error.retryable }, { status });
    }
    console.error('Prequalification failed', error);
    return NextResponse.json({ error: 'No se pudo completar la precalificación.' }, { status: 500 });
  }
}
