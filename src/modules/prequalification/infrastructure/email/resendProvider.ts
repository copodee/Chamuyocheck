const DEFAULT_EMAIL = 'contacto@leasingscoring.com';

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string }>;
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
      attachments: message.attachments,
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
  documents: Array<{ name: string; kind: string }>;
  downloadLinks: Array<{ name: string; url: string }>;
}) {
  return `<div style="font-family:Arial,sans-serif;color:#10212b;max-width:620px">
    <div style="font-size:22px;font-weight:700;color:#6d28d9">LeasingScoring</div>
    <h1 style="font-size:24px">Nueva Precalificación 3</h1>
    <p><b>Expediente:</b> ${escapeHtml(input.caseNumber)}</p>
    <p><b>Solicitante:</b> ${escapeHtml(input.subject)}</p>
    <p><b>Decisión preliminar:</b> ${escapeHtml(input.decision)}</p>
    <p><b>Correo de respuesta:</b> ${escapeHtml(input.responseEmail)}</p>
    <h2 style="font-size:18px">Documentación del expediente (${input.documents.length})</h2>
    <ul>${input.documents.map(document => `<li>${escapeHtml(document.name)} · ${escapeHtml(document.kind)}</li>`).join('') || '<li>Sin documentos adjuntos.</li>'}</ul>
    ${downloadLinksHtml(input.downloadLinks)}
    <p>Ingresá al módulo privado para revisar la información y decidir si corresponde avanzar con Nosis u otro proveedor.</p>
    <p style="font-size:12px;color:#64748b">Los enlaces privados vencen a los 7 días. Si no aparecen enlaces, los documentos viajan adjuntos al correo.</p>
  </div>`;
}

export function stage2NotificationHtml(input: {
  caseNumber: string;
  subject: string;
  responseEmail: string;
  economicStatus: string;
  economicScore: number;
  confidence: string;
  normalizedMonthlyIncome: number | null;
  proposedMonthlyCanon: number;
  declaredMonthlyDebtService: number;
  maximumPrudentCanon: number | null;
  installmentToIncomeRatio: number | null;
  reasons: string[];
  conditions: string[];
  regulatoryExposure: {
    applicable: boolean; label: string; totalExposure: number;
    computableNetWorth: number | null; exposureToNetWorthRatio: number | null;
    basicMarginAvailable: number | null;
  };
  corporateFinancials?: {
    score: number | null;
    workingCapital: number | null;
    currentRatio: number | null;
    liabilitiesToEquity: number | null;
    debtToEquity: number | null;
    operatingMargin: number | null;
    netMargin: number | null;
    returnOnAssets: number | null;
    returnOnEquity: number | null;
  };
  corporateEvolution?: {
    trend: string;
    salesChange: number | null;
    equityChange: number | null;
    netProfitChange: number | null;
    currentRatioChange: number | null;
    liabilitiesToEquityChange: number | null;
  };
  documents: Array<{ name: string; kind: string }>;
  downloadLinks: Array<{ name: string; url: string }>;
}) {
  const money = (value: number | null) => value == null
    ? 'No estimable'
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  const statusLabel = input.economicStatus === 'compatible'
    ? 'CALIFICADO PARA CONTINUAR'
    : input.economicStatus === 'conditional'
      ? 'DEBE REDUCIR LA CUOTA'
      : input.economicStatus === 'not-compatible'
        ? 'NO CALIFICA CON LA CUOTA PROPUESTA'
        : 'REVISIÓN MANUAL';
  return `<div style="font-family:Arial,sans-serif;color:#10212b;max-width:620px">
    <div style="font-size:22px;font-weight:700;color:#6d28d9">LeasingScoring</div>
    <h1 style="font-size:24px">Precalificación 2 completada</h1>
    <p><b>Expediente:</b> ${escapeHtml(input.caseNumber)}</p>
    <p><b>Solicitante:</b> ${escapeHtml(input.subject)}</p>
    <div style="padding:14px;border-radius:10px;background:#ede9fe"><b>${statusLabel}</b> · ${input.economicScore}/100</div>
    <p><b>Respaldo de ingresos:</b> ${escapeHtml(input.confidence)}</p>
    <p><b>Ingreso mensual computable:</b> ${money(input.normalizedMonthlyIncome)}</p>
    <p><b>Canon mensual propuesto:</b> ${money(input.proposedMonthlyCanon)}</p>
    <p><b>Cuotas mensuales de financiaciones vigentes:</b> ${money(input.declaredMonthlyDebtService)}</p>
    <p><b>Relación compromisos/ingreso:</b> ${input.installmentToIncomeRatio == null ? 'No estimable' : `${(input.installmentToIncomeRatio * 100).toFixed(1)}%`} · política máxima 30%</p>
    <p><b>Canon máximo estimado:</b> ${money(input.maximumPrudentCanon)}</p>
    ${input.regulatoryExposure.applicable ? `<h2 style="font-size:18px">Encuadre patrimonial y regulatorio</h2>
    <p><b>Resultado:</b> ${escapeHtml(input.regulatoryExposure.label)}</p>
    <p><b>Exposición total:</b> ${money(input.regulatoryExposure.totalExposure)}</p>
    <p><b>Patrimonio computable:</b> ${money(input.regulatoryExposure.computableNetWorth)}</p>
    <p><b>Exposición / patrimonio:</b> ${input.regulatoryExposure.exposureToNetWorthRatio == null ? 'No evaluable' : `${(input.regulatoryExposure.exposureToNetWorthRatio * 100).toFixed(1)}%`}</p>
    <p><b>Nuevo financiamiento máximo dentro del margen básico:</b> ${money(input.regulatoryExposure.basicMarginAvailable)}</p>` : ''}
    ${input.corporateFinancials ? `<h2 style="font-size:18px">Indicadores del último balance</h2>
    <p><b>Calificación financiera:</b> ${input.corporateFinancials.score == null ? 'Datos insuficientes' : `${input.corporateFinancials.score}/100`}</p>
    <p><b>Liquidez corriente:</b> ${input.corporateFinancials.currentRatio?.toFixed(2) ?? 'No calculable'} · <b>Capital de trabajo:</b> ${money(input.corporateFinancials.workingCapital)}</p>
    <p><b>Pasivo / patrimonio:</b> ${input.corporateFinancials.liabilitiesToEquity == null ? 'No calculable' : `${(input.corporateFinancials.liabilitiesToEquity * 100).toFixed(1)}%`} · <b>Deuda financiera / patrimonio:</b> ${input.corporateFinancials.debtToEquity == null ? 'No calculable' : `${(input.corporateFinancials.debtToEquity * 100).toFixed(1)}%`}</p>
    <p><b>Margen operativo:</b> ${input.corporateFinancials.operatingMargin == null ? 'No calculable' : `${(input.corporateFinancials.operatingMargin * 100).toFixed(1)}%`} · <b>Margen neto:</b> ${input.corporateFinancials.netMargin == null ? 'No calculable' : `${(input.corporateFinancials.netMargin * 100).toFixed(1)}%`}</p>
    <p><b>ROA:</b> ${input.corporateFinancials.returnOnAssets == null ? 'No calculable' : `${(input.corporateFinancials.returnOnAssets * 100).toFixed(1)}%`} · <b>ROE:</b> ${input.corporateFinancials.returnOnEquity == null ? 'No calculable' : `${(input.corporateFinancials.returnOnEquity * 100).toFixed(1)}%`}</p>` : ''}
    ${input.corporateEvolution ? `<h2 style="font-size:18px">Evolución entre balances</h2>
    <p><b>Tendencia:</b> ${input.corporateEvolution.trend === 'improving' ? 'Favorable' : input.corporateEvolution.trend === 'stable' ? 'Estable' : input.corporateEvolution.trend === 'deteriorating' ? 'Desfavorable' : 'Datos insuficientes'}</p>
    <p><b>Ventas:</b> ${percentChange(input.corporateEvolution.salesChange)} · <b>Patrimonio:</b> ${percentChange(input.corporateEvolution.equityChange)} · <b>Resultado neto:</b> ${percentChange(input.corporateEvolution.netProfitChange)}</p>
    <p><b>Liquidez:</b> ${percentChange(input.corporateEvolution.currentRatioChange)} · <b>Pasivo/patrimonio:</b> ${percentChange(input.corporateEvolution.liabilitiesToEquityChange)}</p>` : ''}
    <p><b>Correo del solicitante:</b> ${escapeHtml(input.responseEmail)}</p>
    <h2 style="font-size:18px">Fundamentos</h2>
    <ul>${input.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
    <h2 style="font-size:18px">Condiciones y observaciones</h2>
    <ul>${input.conditions.map(condition => `<li>${escapeHtml(condition)}</li>`).join('') || '<li>Sin condiciones económicas adicionales.</li>'}</ul>
    <h2 style="font-size:18px">Documentación adjunta (${input.documents.length})</h2>
    <ul>${input.documents.map(document => `<li>${escapeHtml(document.name)} · ${escapeHtml(document.kind)}</li>`).join('') || '<li>Evaluación basada exclusivamente en datos declarativos.</li>'}</ul>
    ${downloadLinksHtml(input.downloadLinks)}
    <p>La operación calificó por relación cuota/ingreso y puede continuar a Precalificación 3.</p>
    <p style="font-size:12px;color:#64748b">Evaluación preliminar. No constituye aprobación crediticia ni oferta de financiación.</p>
  </div>`;
}

function downloadLinksHtml(links: Array<{ name: string; url: string }>) {
  if (!links.length) return '';
  return `<div style="padding:14px;border-radius:10px;background:#f5f3ff">
    <h2 style="font-size:18px;margin-top:0">Descarga privada de documentos</h2>
    <p>El conjunto supera el tamaño seguro admitido por el correo. Descargalo desde estos enlaces privados, vigentes durante 7 días:</p>
    <ul>${links.map(link => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.name)}</a></li>`).join('')}</ul>
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

function percentChange(value: number | null) {
  return value == null ? 'No calculable' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}
