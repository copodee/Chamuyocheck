import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type PdfData = {
  caseNumber: string;
  subject: string;
  cuitMasked: string;
  stage1: Record<string, any>;
  contact?: Record<string, any>;
  economic?: Record<string, any>;
  compliance?: Record<string, any>;
  decision?: string;
  responseEmail?: string;
  documents?: Array<{ name: string; kind: string; status?: string }>;
};

const violet = rgb(0.43, 0.16, 0.86);
const ink = rgb(0.05, 0.12, 0.16);
const muted = rgb(0.35, 0.42, 0.46);

export async function buildDossierPdf(data: PdfData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await readFile(join(process.cwd(), 'public', 'brand', 'leasing-scoring-report-logo.png'));
  const logo = await pdf.embedPng(logoBytes);
  let page = pdf.addPage([595, 842]);
  let y = 735;

  const header = (target: PDFPage) => {
    const scaled = logo.scaleToFit(205, 43);
    target.drawImage(logo, { x: 42, y: 772, width: scaled.width, height: scaled.height });
    target.drawText(`EXPEDIENTE ${data.caseNumber}`, { x: 355, y: 788, size: 9, font: bold, color: violet });
    target.drawLine({ start: { x: 42, y: 765 }, end: { x: 553, y: 765 }, thickness: 1, color: rgb(.82, .82, .87) });
  };
  const footer = (target: PDFPage, n: number) => {
    const website = 'www.leasingscoring.com';
    const email = 'contacto@leasingscoring.com';
    const websiteWidth = bold.widthOfTextAtSize(website, 8);
    const emailWidth = regular.widthOfTextAtSize(email, 8);
    target.drawText('Evaluación preliminar. No constituye aprobación ni oferta de financiación.', { x: 42, y: 57, size: 8, font: regular, color: muted });
    target.drawLine({ start: { x: 42, y: 49 }, end: { x: 553, y: 49 }, thickness: .5, color: rgb(.8, .8, .84) });
    target.drawText(website, { x: (595 - websiteWidth) / 2, y: 32, size: 8, font: bold, color: violet });
    target.drawText(email, { x: (595 - emailWidth) / 2, y: 18, size: 8, font: regular, color: muted });
    target.drawText(`${n}`, { x: 540, y: 25, size: 8, font: regular, color: muted });
  };
  const newPage = () => { page = pdf.addPage([595, 842]); y = 735; };
  // Helvetica es la fuente PDF estándar métricamente compatible con Arial.
  // Se usa 11 pt para el cuerpo del informe y tamaños mayores sólo en títulos.
  const text = (value: string, size = 11, font: PDFFont = regular, color = ink) => {
    const words = String(value || '-').replace(/[^\x20-\x7EÀ-ÿ]/g, '').split(/\s+/);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > 490) {
        page.drawText(line, { x: 50, y, size, font, color }); y -= size + 5; line = word;
      } else line = next;
    }
    if (line) { page.drawText(line, { x: 50, y, size, font, color }); y -= size + 7; }
    if (y < 95) newPage();
  };
  const section = (title: string) => { y -= 7; text(title.toUpperCase(), 11, bold, violet); };
  const row = (label: string, value: unknown) => text(`${label}: ${value ?? '-'}`, 11);
  const money = (value: unknown) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));

  text('RESUMEN DE PRECALIFICACIÓN CREDITICIA', 20, bold);
  text(data.subject || 'Titular consultado', 15, bold);
  row('CUIT/CUIL', data.cuitMasked);
  section('Precalificación 1 · BCRA');
  row('Estado', ({ prequalified: 'Precalificado', conditional: 'Precalificado con condiciones', 'manual-review': 'Revisión manual', 'not-prequalified': 'No precalificado' } as Record<string, string>)[data.stage1.status] || data.stage1.status);
  row('Score LeasingScoring', `${data.stage1.score}/100`);
  row('Situación actual', data.stage1.currentSituation ?? 'Sin datos');
  row('Máxima situación histórica', data.stage1.maximumSituation ?? 'Sin datos');
  row('Deuda total informada', money(data.stage1.totalDebt));
  row('Entidades acreedoras', data.stage1.creditorCount);
  row('Cheques rechazados', data.stage1.rejectedChecks);
  if (data.contact) {
    section('Precalificación 2 · Contacto y capacidad');
    row('Nombre / razón social', data.contact.fullName);
    row('Correo', data.contact.email);
    row('Celular', data.contact.mobile);
    row('Domicilio declarado', `${data.contact.address}, ${data.contact.city}, ${data.contact.province}`);
    row('Capacidad', ({ compatible: 'Compatible', conditional: 'Condicional', 'manual-review': 'Revisión manual', 'not-compatible': 'No compatible' } as Record<string, string>)[data.economic?.status] || data.economic?.status);
    row('Score económico', data.economic?.score);
    row('Respaldo de ingresos', data.economic?.confidence);
    row('Ingreso mensual normalizado', money(data.economic?.normalizedMonthlyIncome));
    if (data.economic?.declaredMonthlyIncome != null || data.economic?.documentedMonthlyIncome != null) {
      row('Ingreso mensual declarado', money(data.economic?.declaredMonthlyIncome));
      row('Promedio mensual documentado', money(data.economic?.documentedMonthlyIncome));
      row('Diferencia declarado / documentado', data.economic?.declaredDocumentedDifference == null
        ? 'Sin comparación'
        : `${money(data.economic.declaredDocumentedDifference)}${data.economic.declaredDocumentedDifferenceRatio == null ? '' : ` (${(data.economic.declaredDocumentedDifferenceRatio * 100).toFixed(1)}%)`}`);
    }
    row('Cuotas mensuales de financiaciones vigentes', money(data.economic?.declaredMonthlyDebtService));
    row('Canon mensual propuesto', money(data.economic?.proposedMonthlyCanon));
    row('Canon máximo prudente', money(data.economic?.maximumPrudentCanon));
    row('Relación compromisos / ingreso', data.economic?.installmentToIncomeRatio == null ? 'No estimable' : `${(data.economic.installmentToIncomeRatio * 100).toFixed(1)}%`);
    section('Síntesis del director de riesgos');
    row('Decisión económica preliminar', ({ compatible: 'Compatible', conditional: 'Compatible con condiciones', 'manual-review': 'Revisión manual', 'not-compatible': 'No compatible' } as Record<string, string>)[data.economic?.status] || data.economic?.status);
    row('Comportamiento BCRA', data.stage1.currentSituation == null ? 'Sin datos actuales' : `Situación ${data.stage1.currentSituation}; máxima histórica ${data.stage1.maximumSituation ?? 'sin datos'}`);
    row('Holgura de canon', data.economic?.maximumPrudentCanon == null || data.economic?.proposedMonthlyCanon == null
      ? 'No calculable'
      : money(data.economic.maximumPrudentCanon - data.economic.proposedMonthlyCanon));
    row('Cobertura total de compromisos', data.economic?.totalCommitmentCoverage == null ? 'No calculable' : `${data.economic.totalCommitmentCoverage.toFixed(2)} veces`);
    row('Calidad del respaldo', data.economic?.confidence || 'No informada');
    row('Solvencia contable', data.economic?.corporateFinancials?.status
      ? ({ strong: 'Sólida', adequate: 'Adecuada', review: 'Requiere revisión', weak: 'Débil', 'insufficient-data': 'Datos insuficientes' } as Record<string, string>)[data.economic.corporateFinancials.status]
      : 'No aplicable o no evaluada');
    row('Encuadre regulatorio', data.economic?.regulatoryExposure?.label || 'No aplicable o no evaluado');
    if (data.economic?.regulatoryExposure?.applicable) {
      section('Encuadre patrimonial y regulatorio');
      row('Resultado', data.economic.regulatoryExposure.label);
      row('Exposición total', money(data.economic.regulatoryExposure.totalExposure));
      row('Patrimonio computable', money(data.economic.regulatoryExposure.computableNetWorth));
      row('Exposición / patrimonio', data.economic.regulatoryExposure.exposureToNetWorthRatio == null ? 'No evaluable' : `${(data.economic.regulatoryExposure.exposureToNetWorthRatio * 100).toFixed(1)}%`);
      row('Financiamiento disponible dentro del margen básico', money(data.economic.regulatoryExposure.basicMarginAvailable));
    }
    if (data.economic?.corporateFinancials) {
      const corporate = data.economic.corporateFinancials;
      section('Indicadores del último balance');
      row('Confianza de lectura', data.economic.balance ? `${Math.round(data.economic.balance.extractionConfidence)}%` : 'Sin balance');
      row('Rubros centrales pendientes', data.economic.balance?.missingFields.length ? data.economic.balance.missingFields.join(', ') : 'Ninguno');
      row('Período contable', data.economic.balance?.statementKind === 'interim'
        ? `Intermedio de ${data.economic.balance.periodMonths || '?'} meses`
        : data.economic.balance?.statementKind === 'annual' ? 'Anual' : 'Sin determinar');
      row('Base y aseguramiento', [
        data.economic.balance?.currencyBasis === 'homogeneous' ? 'Moneda homogénea' : null,
        data.economic.balance?.amountScale === 1000 ? 'Publicado en miles' : data.economic.balance?.amountScale === 1000000 ? 'Publicado en millones' : null,
        data.economic.balance?.statementScope === 'consolidated' ? 'Consolidado'
          : data.economic.balance?.statementScope === 'separate' ? 'Separado'
            : data.economic.balance?.statementScope === 'individual' ? 'Individual' : null,
        data.economic.balance?.assuranceLevel === 'limited-review' ? 'Revisión limitada'
          : data.economic.balance?.assuranceLevel === 'audit' ? 'Auditado' : null,
      ].filter(Boolean).join(' · ') || 'No identificado');
      row('Calificación financiera', corporate.score == null ? 'Datos insuficientes' : `${corporate.score}/100`);
      row('Cobertura de compromisos', data.economic.totalCommitmentCoverage == null ? 'No calculable' : `${data.economic.totalCommitmentCoverage.toFixed(2)} veces`);
      row('Monto solicitado / ventas', data.economic.requestedFinancingToSales == null ? 'No calculable' : `${(data.economic.requestedFinancingToSales * 100).toFixed(1)}%`);
      row('Monto solicitado / activo', data.economic.requestedFinancingToAssets == null ? 'No calculable' : `${(data.economic.requestedFinancingToAssets * 100).toFixed(1)}%`);
      row('Liquidez corriente', corporate.currentRatio == null ? 'No calculable' : corporate.currentRatio.toFixed(2));
      row('Liquidez ácida', corporate.quickRatio == null ? 'No calculable' : corporate.quickRatio.toFixed(2));
      row('Capital de trabajo', corporate.workingCapital == null ? 'No calculable' : money(corporate.workingCapital));
      row('Pasivo / patrimonio', corporate.liabilitiesToEquity == null ? 'No calculable' : `${(corporate.liabilitiesToEquity * 100).toFixed(1)}%`);
      row('Deuda financiera / patrimonio', corporate.debtToEquity == null ? 'No calculable' : `${(corporate.debtToEquity * 100).toFixed(1)}%`);
      row('Margen bruto', corporate.grossMargin == null ? 'No calculable' : `${(corporate.grossMargin * 100).toFixed(1)}%`);
      row('Margen operativo', corporate.operatingMargin == null ? 'No calculable' : `${(corporate.operatingMargin * 100).toFixed(1)}%`);
      row('Margen neto', corporate.netMargin == null ? 'No calculable' : `${(corporate.netMargin * 100).toFixed(1)}%`);
      row('ROA', corporate.returnOnAssets == null ? 'No calculable' : `${(corporate.returnOnAssets * 100).toFixed(1)}%`);
      row('ROE', corporate.returnOnEquity == null ? 'No calculable' : `${(corporate.returnOnEquity * 100).toFixed(1)}%`);
      row('Rotación de activos', corporate.assetTurnover == null ? 'No calculable' : corporate.assetTurnover.toFixed(2));
      row('Rotación de inventarios', corporate.inventoryTurnover == null ? 'No calculable' : corporate.inventoryTurnover.toFixed(2));
      row('Rotación de créditos por ventas', corporate.receivablesTurnover == null ? 'No calculable' : corporate.receivablesTurnover.toFixed(2));
      row('Cobertura de intereses', corporate.interestCoverage == null ? 'No calculable' : corporate.interestCoverage.toFixed(2));
    }
    if (data.economic?.corporateEvolution) {
      const evolution = data.economic.corporateEvolution;
      const change = (value: number | null) => value == null ? 'No calculable' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
      section('Evolución entre balances');
      row('Tendencia', evolution.trend === 'improving' ? 'Favorable' : evolution.trend === 'stable' ? 'Estable' : evolution.trend === 'deteriorating' ? 'Desfavorable' : 'Datos insuficientes');
      row('Ventas', change(evolution.salesChange));
      row('Patrimonio neto', change(evolution.equityChange));
      row('Resultado neto', change(evolution.netProfitChange));
      row('Liquidez corriente', change(evolution.currentRatioChange));
      row('Pasivo / patrimonio', change(evolution.liabilitiesToEquityChange));
    }
    if (data.economic?.confidence === 'declarativa') {
      text('ADVERTENCIA: los ingresos son declarativos y deben solicitarse comprobantes antes de una decisión definitiva.', 9, bold, violet);
    }
    if (data.economic?.reasons?.length) {
      section('Fundamentos del análisis');
      for (const reason of data.economic.reasons) text(`- ${reason}`, 9);
    }
    if (data.economic?.conditions?.length) {
      section('Condiciones y observaciones');
      for (const condition of data.economic.conditions) text(`- ${condition}`, 9);
    }
  }
  if (data.documents?.length) {
    section('Documentación analizada');
    for (const document of data.documents) row(document.name, `${document.kind}${document.status ? ` · ${document.status}` : ''}`);
  }
  if (data.compliance) {
    section('Precalificación 3 · Declaraciones y decisión');
    row('Decisión del analista', ({ ready: 'Lista para enviar a análisis', conditional: 'Avanzar con condiciones', 'additional-guarantees': 'Solicitar garantías adicionales', 'more-information': 'Solicitar más información', 'not-compatible': 'No compatible' } as Record<string, string>)[data.decision || ''] || data.decision);
    row('Correo de respuesta', data.responseEmail);
    row('Condición PEP', ({ no: 'No PEP', yes: 'PEP', related: 'Familiar o allegado de PEP' } as Record<string, string>)[data.compliance.pepStatus] || data.compliance.pepStatus);
    if (data.compliance.pepDetail) row('Detalle PEP', data.compliance.pepDetail);
    row('Origen lícito de fondos declarado', data.compliance.fundsLawfulOrigin ? 'Sí' : 'No');
    row('Actúa por cuenta propia', data.compliance.ownAccount ? 'Sí' : 'No');
    row('Sujeto obligado UIF', data.compliance.obligedSubject ? 'Sí' : 'No');
    text('Las declaraciones son preliminares. El administrador puede solicitar respaldo documental antes de remitir la operación a una entidad.', 9, regular, muted);
  }
  section('Trazabilidad');
  row('Generado', new Date().toLocaleString('es-AR'));
  row('Modelo', data.stage1.modelVersion);
  pdf.getPages().forEach((target, index) => {
    header(target);
    footer(target, index + 1);
  });
  return pdf.save();
}
