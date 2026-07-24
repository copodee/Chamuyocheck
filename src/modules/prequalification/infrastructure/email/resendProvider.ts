const DEFAULT_EMAIL = 'contacto@leasingscoring.com';

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  replyTo?: string;
};

export function getPrequalificationEmailConfig() {
  return {
    provider: 'resend' as const,
    administratorEmail: process.env.PREQUALIFICATION_ADMIN_EMAIL || DEFAULT_EMAIL,
    from: process.env.PREQUALIFICATION_FROM_EMAIL || `LeasingScoring <${DEFAULT_EMAIL}>`,
    apiKey: process.env.RESEND_API_KEY || '',
  };
}

export async function sendPrequalificationEmail(message: EmailMessage) {
  const config = getPrequalificationEmailConfig();
  if (!config.apiKey) return { sent: false as const, reason: 'missing-api-key' as const };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': message.idempotencyKey,
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      reply_to: message.replyTo,
      subject: message.subject,
      html: message.html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend rechazó el envío (${response.status}).`);
  return { sent: true as const, id: String(payload.id || '') };
}

export function adminNotificationHtml(input: {
  caseNumber: string;
  subject: string;
  decision: string;
  responseEmail: string;
}) {
  return `<div style="font-family:Arial,sans-serif;color:#10212b;max-width:620px">
    <div style="font-size:22px;font-weight:700;color:#6d28d9">LeasingScoring</div>
    <h1 style="font-size:24px">Nueva Precalificación 3</h1>
    <p><b>Expediente:</b> ${escapeHtml(input.caseNumber)}</p>
    <p><b>Solicitante:</b> ${escapeHtml(input.subject)}</p>
    <p><b>Decisión preliminar:</b> ${escapeHtml(input.decision)}</p>
    <p><b>Correo de respuesta:</b> ${escapeHtml(input.responseEmail)}</p>
    <p>Ingresá al módulo privado para revisar la información y decidir si corresponde avanzar con Nosis u otro proveedor.</p>
    <p style="font-size:12px;color:#64748b">No se adjuntan documentos sensibles al correo.</p>
  </div>`;
}

export function stage2NotificationHtml(input: {
  caseNumber: string;
  subject: string;
  responseEmail: string;
  economicStatus: string;
  economicScore: number;
  confidence: string;
}) {
  return `<div style="font-family:Arial,sans-serif;color:#10212b;max-width:620px">
    <div style="font-size:22px;font-weight:700;color:#6d28d9">LeasingScoring</div>
    <h1 style="font-size:24px">Precalificación 2 completada</h1>
    <p><b>Expediente:</b> ${escapeHtml(input.caseNumber)}</p>
    <p><b>Solicitante:</b> ${escapeHtml(input.subject)}</p>
    <p><b>Resultado económico:</b> ${escapeHtml(input.economicStatus)} · ${input.economicScore}/100</p>
    <p><b>Respaldo de ingresos:</b> ${escapeHtml(input.confidence)}</p>
    <p><b>Correo del solicitante:</b> ${escapeHtml(input.responseEmail)}</p>
    <p>El expediente quedó generado y puede continuar a Precalificación 3.</p>
    <p style="font-size:12px;color:#64748b">No se adjuntan documentos sensibles al correo.</p>
  </div>`;
}

export function applicantResponseHtml(input: { caseNumber: string; decision: string; message?: string }) {
  return `<div style="font-family:Arial,sans-serif;color:#10212b;max-width:620px">
    <div style="font-size:22px;font-weight:700;color:#6d28d9">LeasingScoring</div>
    <h1 style="font-size:24px">Resultado de precalificación</h1>
    <p><b>Expediente:</b> ${escapeHtml(input.caseNumber)}</p>
    <p><b>Resultado:</b> ${escapeHtml(input.decision)}</p>
    ${input.message ? `<p>${escapeHtml(input.message)}</p>` : ''}
    <p>Esta evaluación es preliminar y no constituye aprobación crediticia ni oferta de financiación.</p>
  </div>`;
}

function escapeHtml(value: string) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character] || character));
}
