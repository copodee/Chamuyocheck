import { NextResponse } from 'next/server';
import { authenticatePrequalificationRequest } from '../../../../src/modules/prequalification/infrastructure/supabase/auth';
import { prequalRest } from '../../../../src/modules/prequalification/infrastructure/supabase/rest';
import { evaluateEconomicCapacity } from '../../../../src/modules/prequalification/scoring/economicEngine';
import type { ComplianceDeclarations, ContactData, DossierDocument, EconomicInputs, ExtractedBalance } from '../../../../src/modules/prequalification/domain/dossier';
import { adminNotificationHtml, applicantResponseHtml, getPrequalificationEmailConfig, sendPrequalificationEmail } from '../../../../src/modules/prequalification/infrastructure/email/resendProvider';

export const runtime = 'nodejs';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function update(token: string, id: string, values: Record<string, unknown>) {
  await prequalRest(token, `prequal_cases?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(values) });
}

export async function POST(request: Request) {
  const auth = await authenticatePrequalificationRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (!body?.caseId || !['stage2', 'stage3', 'configuration', 'send-result'].includes(body.action)) return NextResponse.json({ error: 'Solicitud incompleta.' }, { status: 400 });
  try {
    if (body.action === 'stage2') {
      const contact = body.contact as ContactData;
      const inputs = body.economicInputs as EconomicInputs;
      const documents = (body.documents || []) as DossierDocument[];
      if (!contact?.fullName || !contact.address || !contact.city || !contact.province || !emailPattern.test(contact.email || '') || !contact.mobile) return NextResponse.json({ error: 'Completá nombre, domicilio, localidad, provincia, correo y celular.' }, { status: 400 });
      if (!contact.dataConsent || !contact.contactConsent || !contact.accuracyDeclaration) return NextResponse.json({ error: 'Se necesitan las tres declaraciones de consentimiento.' }, { status: 400 });
      const assessment = evaluateEconomicCapacity(inputs, documents.length, body.balance as ExtractedBalance | undefined);
      await update(auth.token, body.caseId, { stage: 2, contact, economic_inputs: inputs, economic_assessment: assessment, documents: documents.map(({ extractedText: _text, ...document }) => document), updated_at: new Date().toISOString() });
      return NextResponse.json({ assessment });
    }
    if (body.action === 'stage3') {
      const compliance = body.compliance as ComplianceDeclarations;
      if (!emailPattern.test(body.responseEmail || '')) return NextResponse.json({ error: 'Ingresá el correo donde se recibirá la respuesta.' }, { status: 400 });
      if (!compliance?.fundsLawfulOrigin || !compliance.ownAccount || !compliance.administratorMayRequestEvidence) return NextResponse.json({ error: 'Completá las declaraciones UIF y aceptá que el administrador pueda pedir respaldo.' }, { status: 400 });
      if (compliance.pepStatus !== 'no' && !compliance.pepDetail?.trim()) return NextResponse.json({ error: 'Detallá la condición PEP declarada.' }, { status: 400 });
      const emailConfig = getPrequalificationEmailConfig();
      const notification = await sendPrequalificationEmail({
        to: emailConfig.administratorEmail,
        replyTo: body.responseEmail,
        subject: `Precalificación 3 · ${body.caseNumber || body.caseId}`,
        html: adminNotificationHtml({
          caseNumber: body.caseNumber || body.caseId, subject: body.subject || 'Titular consultado',
          decision: body.decision, responseEmail: body.responseEmail,
        }),
        idempotencyKey: `prequal-admin-${body.caseId}`,
      }).catch(() => ({ sent: false as const, reason: 'provider-error' as const }));
      await update(auth.token, body.caseId, {
        stage: 3, compliance, stage3_decision: body.decision, response_email: body.responseEmail,
        documents: ((body.documents || []) as DossierDocument[]).map(({ extractedText: _text, ...document }) => document),
        administrator_email: emailConfig.administratorEmail, email_provider: 'resend',
        notification_status: notification.sent ? 'administrator-notified' : 'email-configuration-required',
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, notification });
    }
    if (body.action === 'send-result') {
      if (auth.role !== 'administrator') return NextResponse.json({ error: 'Sólo un administrador puede enviar el resultado.' }, { status: 403 });
      if (!emailPattern.test(body.responseEmail || '')) return NextResponse.json({ error: 'Correo de respuesta inválido.' }, { status: 400 });
      const delivery = await sendPrequalificationEmail({
        to: body.responseEmail, replyTo: getPrequalificationEmailConfig().administratorEmail,
        subject: `Resultado LeasingScoring · ${body.caseNumber || body.caseId}`,
        html: applicantResponseHtml({ caseNumber: body.caseNumber || body.caseId, decision: body.decision, message: body.message }),
        idempotencyKey: `prequal-result-${body.caseId}-${body.decision}`,
      });
      if (!delivery.sent) return NextResponse.json({ error: 'Falta configurar la clave de Resend.' }, { status: 503 });
      await update(auth.token, body.caseId, { notification_status: 'result-sent', updated_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, deliveryId: delivery.id });
    }
    if (auth.role !== 'administrator') return NextResponse.json({ error: 'Sólo un administrador puede configurar el envío.' }, { status: 403 });
    if (!emailPattern.test(body.administratorEmail || '')) return NextResponse.json({ error: 'Ingresá un correo de administrador válido.' }, { status: 400 });
    if (body.emailProvider !== 'resend') return NextResponse.json({ error: 'El proveedor configurado para esta versión es Resend.' }, { status: 400 });
    await update(auth.token, body.caseId, { administrator_email: body.administratorEmail, email_provider: 'resend', notification_status: getPrequalificationEmailConfig().apiKey ? 'provider-ready' : 'email-configuration-required', updated_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo actualizar el expediente.' }, { status: 500 });
  }
}
