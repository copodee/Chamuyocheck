import { NextResponse } from 'next/server';
import { authenticatePrequalificationRequest } from '../../../../src/modules/prequalification/infrastructure/supabase/auth';
import { prequalRest } from '../../../../src/modules/prequalification/infrastructure/supabase/rest';
import { evaluateEconomicCapacity, hasAffordableMonthlyPayment } from '../../../../src/modules/prequalification/scoring/economicEngine';
import type { ComplianceDeclarations, ContactData, DossierDocument, EconomicInputs, ExtractedBalance } from '../../../../src/modules/prequalification/domain/dossier';
import { adminNotificationHtml, applicantResponseHtml, getPrequalificationEmailConfig, sendPrequalificationEmail, stage2NotificationHtml } from '../../../../src/modules/prequalification/infrastructure/email/resendProvider';
import { isValidCuit, normalizeCuit } from '../../../../src/modules/prequalification/domain/cuit';
import { getPrequalificationSupabaseConfig } from '../../../../src/modules/prequalification/infrastructure/supabase/config';
import { buildDossierPdf } from '../../../../src/modules/prequalification/reports/dossierPdf';
import {
  isBalanceAccountingControl,
  sanitizeBalanceDerivedEconomicInputs,
  sanitizeExtractedBalanceWithControl,
  type BalanceAccountingControl,
} from '../../../../src/modules/prequalification/balanceStructuredAdapter';

export const runtime = 'nodejs';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function update(token: string, id: string, values: Record<string, unknown>) {
  await prequalRest(token, `prequal_cases?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(values) });
}
// Reserva margen para que el informe PDF siempre viaje adjunto al correo.
const RESEND_SAFE_ENCODED_LIMIT = 33 * 1024 * 1024;
const DOWNLOAD_LINK_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

async function createDownloadLink(token: string, storagePath: string) {
  const config = getPrequalificationSupabaseConfig();
  if (!config) throw new Error('Almacenamiento no configurado.');
  const response = await fetch(`${config.url}/storage/v1/object/sign/prequalification-documents/${storagePath}`, {
    method: 'POST',
    headers: { apikey: config.publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: DOWNLOAD_LINK_EXPIRY_SECONDS }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.signedURL) throw new Error('No se pudo generar un enlace privado de descarga.');
  return payload.signedURL.startsWith('http') ? payload.signedURL : `${config.url}/storage/v1${payload.signedURL}`;
}

async function prepareDocumentDelivery(token: string, documents: DossierDocument[]) {
  const config = getPrequalificationSupabaseConfig();
  if (!config) throw new Error('Almacenamiento no configurado.');
  const selected = documents.filter(item => item.storagePath);
  const files: Array<{ document: DossierDocument; buffer: Buffer }> = [];
  let encodedBytes = 0;
  for (const document of selected) {
    const response = await fetch(`${config.url}/storage/v1/object/prequalification-documents/${document.storagePath}`, {
      headers: { apikey: config.publicKey, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`No se pudo recuperar ${document.name} para adjuntarlo.`);
    const buffer = Buffer.from(await response.arrayBuffer());
    encodedBytes += Math.ceil(buffer.length / 3) * 4;
    files.push({ document, buffer });
  }
  if (encodedBytes <= RESEND_SAFE_ENCODED_LIMIT) {
    return {
      mode: 'attachments' as const,
      attachments: files.map(({ document, buffer }) => ({ filename: document.name, content: buffer.toString('base64') })),
      downloadLinks: [] as Array<{ name: string; url: string }>,
    };
  }
  const downloadLinks = await Promise.all(selected.map(async document => ({
    name: document.name,
    url: await createDownloadLink(token, document.storagePath!),
  })));
  return { mode: 'links' as const, attachments: [], downloadLinks };
}

export async function POST(request: Request) {
  const auth = await authenticatePrequalificationRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (!body?.action || !['recover', 'stage2', 'stage3', 'configuration', 'send-result'].includes(body.action)) return NextResponse.json({ error: 'Solicitud incompleta.' }, { status: 400 });
  if (body.action !== 'recover' && !body.caseId) return NextResponse.json({ error: 'Falta el identificador del expediente.' }, { status: 400 });
  try {
    if (body.action === 'recover') {
      const requestData = body.requestData || {};
      const cuit = normalizeCuit(requestData.cuit || '');
      if (!isValidCuit(cuit) || !body.stage1) return NextResponse.json({ error: 'No se pudo recuperar la consulta inicial.' }, { status: 400 });
      const subjectHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cuit))).toString('hex');
      const [saved] = await prequalRest<Array<{ id: string; case_number: string }>>(auth.token, 'prequal_cases?select=id,case_number', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          organization_id: auth.organizationId,
          created_by: auth.user.id,
          subject_hash: subjectHash,
          client_type: requestData.clientType,
          asset_type: requestData.assetType,
          asset_value: Number(requestData.assetValue),
          advance: Number(requestData.advance || 0),
          term_months: Number(requestData.termMonths),
          status: body.stage1.status,
          score: body.stage1.score,
          model_version: body.stage1.modelVersion,
          provider: body.stage1.provider,
          result: body.stage1,
        }),
      });
      if (!saved?.id) throw new Error('Supabase no devolvió el expediente recuperado.');
      return NextResponse.json({ caseId: saved.id, caseNumber: saved.case_number });
    }
    if (body.action === 'stage2') {
      const contact = body.contact as ContactData;
      const receivedInputs = body.economicInputs as EconomicInputs;
      const receivedControl = body.balanceAccountingControl as {
        current?: BalanceAccountingControl;
        previous?: BalanceAccountingControl;
      } | undefined;
      const currentControl = isBalanceAccountingControl(receivedControl?.current)
        ? receivedControl.current : undefined;
      const previousControl = isBalanceAccountingControl(receivedControl?.previous)
        ? receivedControl.previous : undefined;
      const invalidStructuredControl = receivedControl?.current != null && !currentControl;
      const accountingBlocked = invalidStructuredControl
        || currentControl?.automaticPrequalificationBlocked === true
        || currentControl?.extractionStatus === 'manual_review_required';
      const hasIndependentDebtDocument = (body.documents || []).some(
        (document: DossierDocument) => document.kind === 'financial-debt',
      );
      const documents = (body.documents || []) as DossierDocument[];
      const documentReview = {
        missingDocuments: Array.isArray(body.documentReview?.missingDocuments) ? body.documentReview.missingDocuments.map(String) : [],
        unidentifiedDocuments: Array.isArray(body.documentReview?.unidentifiedDocuments) ? body.documentReview.unidentifiedDocuments.map(String) : [],
        excludedDocuments: Array.isArray(body.documentReview?.excludedDocuments) ? body.documentReview.excludedDocuments.map(String) : [],
        unreadableDocuments: Array.isArray(body.documentReview?.unreadableDocuments) ? body.documentReview.unreadableDocuments.map(String) : [],
      };
      if (!contact?.fullName || !contact.address || !contact.city || !contact.province || !emailPattern.test(contact.email || '') || !contact.mobile) return NextResponse.json({ error: 'Completá nombre, domicilio, localidad, provincia, correo y celular.' }, { status: 400 });
      if (!contact.dataConsent || !contact.contactConsent || !contact.accuracyDeclaration) return NextResponse.json({ error: 'Se necesitan las tres declaraciones de consentimiento.' }, { status: 400 });
      const incomeDocumentCount = documents.filter(document =>
        /salary-slip|monotributo-invoices|balance-|vat-|income-detail|post-balance-sales/.test(document.kind),
      ).length;
      const authoritativeBalance = invalidStructuredControl ? undefined
        : sanitizeExtractedBalanceWithControl(
          body.balance as ExtractedBalance | undefined,
          currentControl,
        );
      const authoritativePreviousBalance = sanitizeExtractedBalanceWithControl(
        body.previousBalance as ExtractedBalance | undefined,
        previousControl,
      );
      const inputs = invalidStructuredControl ? {
        ...receivedInputs,
        computableNetWorth: 0,
        existingComputableFinancing: hasIndependentDebtDocument
          ? receivedInputs.existingComputableFinancing : 0,
      } : sanitizeBalanceDerivedEconomicInputs(
        receivedInputs,
        authoritativeBalance,
        currentControl,
        hasIndependentDebtDocument,
      );
      const assessment = evaluateEconomicCapacity(
        inputs,
        incomeDocumentCount,
        authoritativeBalance,
        authoritativePreviousBalance,
      );
      const sendForManualReview = body.sendForManualReview === true;
      if ((accountingBlocked
        || !hasAffordableMonthlyPayment(assessment, inputs.proposedMonthlyCanon, inputs.profile))
        && !sendForManualReview) {
        return NextResponse.json({
          error: assessment.maximumPrudentCanon == null
            ? 'No hay ingresos suficientes para calificar la cuota propuesta.'
            : `La cuota propuesta no califica. El canon máximo estimado es $ ${Math.round(assessment.maximumPrudentCanon).toLocaleString('es-AR')}.`,
          assessment,
        }, { status: 422 });
      }
      const delivery = await prepareDocumentDelivery(auth.token, documents.filter(document => document.stage === 2));
      const reportPdf = await buildDossierPdf({
        caseNumber: body.caseNumber || body.caseId,
        subject: body.subject || contact.fullName,
        cuitMasked: body.cuitMasked || 'Reservado',
        stage1: body.stage1 || {},
        contact,
        economic: {
          ...assessment,
          declaredMonthlyDebtService: inputs.declaredMonthlyDebtService,
          proposedMonthlyCanon: inputs.proposedMonthlyCanon,
          proposedAdvancePercent: inputs.proposedAdvancePercent,
          proposedAdvanceAmount: inputs.proposedAdvanceAmount,
          requestedFinancing: inputs.requestedFinancing,
          profile: inputs.profile,
        },
        documents: documents.filter(document => document.stage === 2),
        documentReview,
        submittedForManualReview: sendForManualReview,
      });
      const reportAttachment = {
        filename: `${String(body.caseNumber || body.caseId).replace(/[^A-Z0-9-]/gi, '')}-informe.pdf`,
        content: Buffer.from(reportPdf).toString('base64'),
      };
      const emailConfig = getPrequalificationEmailConfig();
      const notification = await sendPrequalificationEmail({
        to: emailConfig.administratorEmail,
        subject: `Precalificación 2 · ${body.caseNumber || body.caseId}`,
        html: stage2NotificationHtml({
          caseNumber: body.caseNumber || body.caseId, subject: body.subject || contact.fullName,
          responseEmail: contact.email, economicStatus: assessment.status,
          economicProfile: inputs.profile,
          economicScore: assessment.score, confidence: assessment.confidence,
          normalizedMonthlyIncome: assessment.normalizedMonthlyIncome,
          declaredMonthlyIncome: assessment.declaredMonthlyIncome,
          documentedMonthlyIncome: assessment.documentedMonthlyIncome,
          declaredDocumentedDifference: assessment.declaredDocumentedDifference,
          declaredDocumentedDifferenceRatio: assessment.declaredDocumentedDifferenceRatio,
          proposedMonthlyCanon: inputs.proposedMonthlyCanon,
          proposedAdvancePercent: inputs.proposedAdvancePercent,
          proposedAdvanceAmount: inputs.proposedAdvanceAmount,
          requestedFinancing: inputs.requestedFinancing,
          declaredMonthlyDebtService: inputs.declaredMonthlyDebtService,
          maximumPrudentCanon: assessment.maximumPrudentCanon,
          installmentToIncomeRatio: assessment.installmentToIncomeRatio,
          totalCommitmentCoverage: assessment.totalCommitmentCoverage,
          reasons: assessment.reasons,
          conditions: assessment.conditions,
          regulatoryExposure: assessment.regulatoryExposure,
          corporateFinancials: assessment.corporateFinancials,
          corporateEvolution: assessment.corporateEvolution,
          documents: documents.filter(document => document.stage === 2).map(document => ({ name: document.name, kind: document.kind })),
          downloadLinks: delivery.downloadLinks,
          documentReview,
          submittedForManualReview: sendForManualReview,
        }),
        idempotencyKey: `prequal-stage2-v3-${body.caseId}-${assessment.score}-${Math.round(inputs.proposedMonthlyCanon)}-${sendForManualReview ? 'manual' : 'automatic'}`,
        attachments: [reportAttachment, ...delivery.attachments],
      }).catch((error) => ({
        sent: false as const,
        reason: error instanceof Error ? error.message : 'provider-error',
      }));
      if (!notification.sent) {
        return NextResponse.json({ error: `El expediente se generó, pero el correo no pudo enviarse: ${notification.reason}` }, { status: 502 });
      }
      await update(auth.token, body.caseId, {
        stage: 2, contact, economic_inputs: inputs, economic_assessment: {
          ...assessment,
          documentReview,
          submittedForManualReview: sendForManualReview,
          accountingControl: currentControl || previousControl
            ? { current: currentControl, previous: previousControl }
            : undefined,
        },
        documents: documents.map(({ extractedText: _text, ...document }) => document),
        administrator_email: emailConfig.administratorEmail, email_provider: 'resend',
        notification_status: notification.sent ? 'stage2-administrator-notified' : 'email-configuration-required',
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({ assessment, notification, submittedForManualReview: sendForManualReview });
    }
    if (body.action === 'stage3') {
      const compliance = body.compliance as ComplianceDeclarations;
      const contactEmail = String(body.contact?.email || '');
      if (!emailPattern.test(contactEmail)) return NextResponse.json({ error: 'Ingresá un correo de contacto válido para incorporarlo al expediente.' }, { status: 400 });
      if (!compliance?.fundsLawfulOrigin || !compliance.ownAccount || !compliance.administratorMayRequestEvidence) return NextResponse.json({ error: 'Completá las declaraciones UIF y aceptá que el administrador pueda pedir respaldo.' }, { status: 400 });
      if (compliance.pepStatus !== 'no' && !compliance.pepDetail?.trim()) return NextResponse.json({ error: 'Detallá la condición PEP declarada.' }, { status: 400 });
      const emailConfig = getPrequalificationEmailConfig();
      const documents = (body.documents || []) as DossierDocument[];
      const delivery = await prepareDocumentDelivery(auth.token, documents);
      const reportPdf = await buildDossierPdf({
        caseNumber: body.caseNumber || body.caseId,
        subject: body.subject || 'Titular consultado',
        cuitMasked: body.cuitMasked || 'Reservado',
        stage1: body.stage1 || {},
        contact: body.contact,
        economic: body.economic,
        compliance,
        decision: body.decision,
        responseEmail: contactEmail,
        documents,
      });
      const reportAttachment = {
        filename: `${String(body.caseNumber || body.caseId).replace(/[^A-Z0-9-]/gi, '')}-informe-final.pdf`,
        content: Buffer.from(reportPdf).toString('base64'),
      };
      const notification = await sendPrequalificationEmail({
        to: emailConfig.administratorEmail,
        subject: `Precalificación 3 · ${body.caseNumber || body.caseId}`,
        html: adminNotificationHtml({
          caseNumber: body.caseNumber || body.caseId, subject: body.subject || 'Titular consultado',
          decision: body.decision, responseEmail: contactEmail,
          documents: documents.map(document => ({ name: document.name, kind: document.kind })),
          downloadLinks: delivery.downloadLinks,
        }),
        idempotencyKey: `prequal-admin-${body.caseId}`,
        attachments: [reportAttachment, ...delivery.attachments],
      }).catch(() => ({ sent: false as const, reason: 'provider-error' as const }));
      await update(auth.token, body.caseId, {
        stage: 3, compliance, stage3_decision: body.decision, response_email: contactEmail,
        documents: documents.map(({ extractedText: _text, ...document }) => document),
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
    if (body.emailProvider !== 'resend') return NextResponse.json({ error: 'El proveedor configurado para esta versión es Resend.' }, { status: 400 });
    await update(auth.token, body.caseId, { administrator_email: getPrequalificationEmailConfig().administratorEmail, email_provider: 'resend', notification_status: getPrequalificationEmailConfig().apiKey ? 'provider-ready' : 'email-configuration-required', updated_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo actualizar el expediente.' }, { status: 500 });
  }
}
