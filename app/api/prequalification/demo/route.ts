import { NextResponse } from 'next/server';
import { authenticatePrequalificationRequest } from '../../../../src/modules/prequalification/infrastructure/supabase/auth';
import { prequalRest } from '../../../../src/modules/prequalification/infrastructure/supabase/rest';
import type { PrequalificationResult } from '../../../../src/modules/prequalification/domain/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await authenticatePrequalificationRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role !== 'administrator') return NextResponse.json({ error: 'Sólo un administrador puede crear casos de demostración.' }, { status: 403 });
  const now = new Date().toISOString();
  const result: PrequalificationResult = {
    status: 'prequalified', score: 86, confidence: 'alta', riskLevel: 'bajo',
    totalDebt: 8_450_000, creditorCount: 2, maximumSituation: 1, currentSituation: 1, rejectedChecks: 0,
    currentPositions: [
      { entity: 'ENTIDAD DEMO A', period: '2026-06', situation: 1, debtAmount: 5_250_000, daysPastDue: 0, refinancedOrObserved: false },
      { entity: 'ENTIDAD DEMO B', period: '2026-06', situation: 1, debtAmount: 3_200_000, daysPastDue: 0, refinancedOrObserved: false },
    ],
    paymentCapacity: {
      status: 'not-estimable',
      explanation: 'Caso de demostración: la capacidad se calculará con los datos de la Precalificación 2.',
      requestedExposure: 30_000_000, advanceRatio: 0.25,
    },
    conditions: ['Completar datos económicos y declaraciones de las etapas 2 y 3.'],
    reasons: ['Historial de demostración en situación 1, sin cheques rechazados.'],
    history: [{ period: '2026-06', maximumSituation: 1, totalDebt: 8_450_000 }],
    provider: 'demo-local', evaluatedAt: now, modelVersion: 'demo-v1',
  };
  const [saved] = await prequalRest<Array<{ id: string; case_number: string }>>(auth.token, 'prequal_cases?select=id,case_number', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: auth.organizationId, created_by: auth.user.id,
      subject_hash: `DEMO-${crypto.randomUUID()}`, client_type: 'persona-juridica',
      asset_type: 'automotor-0km', asset_value: 40_000_000, advance: 10_000_000,
      term_months: 36, status: result.status, score: result.score,
      model_version: result.modelVersion, provider: result.provider, result,
    }),
  });
  return NextResponse.json({
    caseId: saved.id, caseNumber: `DEMO-${saved.case_number}`,
    subject: { denomination: 'EMPRESA DEMOSTRACIÓN LEASINGSCORING SA', cuitMasked: '**-DEMO-***' },
    result,
    disclaimer: 'EXPEDIENTE DE DEMOSTRACIÓN. No contiene una consulta real al BCRA.',
  });
}
