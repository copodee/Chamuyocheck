import { NextResponse } from 'next/server';
import { isValidCuit, normalizeCuit } from '../../../src/modules/prequalification/domain/cuit';
import type { PrequalificationRequest } from '../../../src/modules/prequalification/domain/types';
import { authenticatePrequalificationRequest } from '../../../src/modules/prequalification/infrastructure/supabase/auth';
import { prequalRest } from '../../../src/modules/prequalification/infrastructure/supabase/rest';
import { BcraCreditProvider } from '../../../src/modules/prequalification/providers/bcraProvider';
import { CreditProviderError } from '../../../src/modules/prequalification/providers/creditProvider';
import { evaluatePrequalification } from '../../../src/modules/prequalification/scoring/riskEngine';
import { isAllowedTerm } from '../../../src/modules/prequalification/domain/assetPolicy';

export const runtime = 'nodejs';
const clientTypes = new Set(['persona-humana', 'persona-juridica']);
const assetTypes = new Set(['automotor-0km', 'automotor-usado', 'maquinaria', 'equipo', 'embarcacion', 'inmueble', 'otro']);

export async function POST(request: Request) {
  const auth = await authenticatePrequalificationRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null) as PrequalificationRequest | null;
  if (!body) return NextResponse.json({ error: 'La solicitud no contiene datos válidos.' }, { status: 400 });
  const cuit = normalizeCuit(body.cuit || '');
  const assetValue = Number(body.assetValue);
  const advance = Number(body.advance || 0);
  const termMonths = Number(body.termMonths);
  if (!isValidCuit(cuit)) return NextResponse.json({ error: 'Ingresá un CUIT/CUIL válido.' }, { status: 400 });
  if (!clientTypes.has(body.clientType)) return NextResponse.json({ error: 'Elegí el tipo de cliente.' }, { status: 400 });
  if (!assetTypes.has(body.assetType)) return NextResponse.json({ error: 'Elegí el tipo de bien.' }, { status: 400 });
  if (!(assetValue > 0)) return NextResponse.json({ error: 'El valor del bien debe ser mayor que cero.' }, { status: 400 });
  if (advance < 0 || advance > assetValue) return NextResponse.json({ error: 'El anticipo debe estar entre cero y el valor del bien.' }, { status: 400 });
  if (!Number.isInteger(termMonths) || termMonths < 12 || termMonths > 84) return NextResponse.json({ error: 'El plazo debe estar entre 12 y 84 meses.' }, { status: 400 });
  if (!isAllowedTerm(body.clientType, body.assetType, termMonths)) {
    const error = body.assetType === 'embarcacion' && body.clientType === 'persona-juridica'
      ? 'Para embarcaciones de empresas, el plazo disponible es de 36 meses.'
      : 'Para embarcaciones de personas humanas y monotributistas, elegí 12, 18, 24 o 36 meses.';
    return NextResponse.json({ error }, { status: 400 });
  }
  try {
    const report = await new BcraCreditProvider().getCreditReport(cuit);
    const result = evaluatePrequalification({ ...body, cuit, assetValue, advance, termMonths }, report);
    let savedCase: { id: string; case_number: string } | undefined;
    try {
      const subjectHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cuit))).toString('hex');
      [savedCase] = await prequalRest<Array<{ id: string; case_number: string }>>(auth.token, 'prequal_cases?select=id,case_number', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          organization_id: auth.organizationId, created_by: auth.user.id, subject_hash: subjectHash,
          client_type: body.clientType, asset_type: body.assetType, asset_value: assetValue, advance,
          term_months: termMonths, status: result.status, score: result.score,
          model_version: result.modelVersion, provider: result.provider, result,
        }),
      });
    } catch (error) {
      console.warn('No se pudo guardar la precalificación.', error);
    }
    return NextResponse.json({
      caseId: savedCase?.id, caseNumber: savedCase?.case_number,
      subject: { denomination: report.denomination, cuitMasked: `**-${cuit.slice(2, 9)}-*` },
      result, disclaimer: 'Precalificación preliminar. No constituye aprobación, oferta ni compromiso de otorgamiento.',
    });
  } catch (error) {
    if (error instanceof CreditProviderError) {
      const status = error.code === 'not-found' ? 404 : error.code === 'invalid-id' ? 400 : 502;
      return NextResponse.json({ error: error.message, retryable: error.retryable }, { status });
    }
    return NextResponse.json({ error: 'No se pudo completar la precalificación.' }, { status: 500 });
  }
}
