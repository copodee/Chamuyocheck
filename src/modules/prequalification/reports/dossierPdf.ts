import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

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
};

const violet = rgb(0.43, 0.16, 0.86);
const ink = rgb(0.05, 0.12, 0.16);
const muted = rgb(0.35, 0.42, 0.46);

export async function buildDossierPdf(data: PdfData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 735;

  const header = (target: PDFPage) => {
    target.drawRectangle({ x: 42, y: 775, width: 30, height: 30, color: violet });
    target.drawText('LS', { x: 48, y: 785, size: 10, font: bold, color: rgb(1, 1, 1) });
    target.drawText('LeasingScoring', { x: 82, y: 785, size: 18, font: bold, color: ink });
    target.drawText(`EXPEDIENTE ${data.caseNumber}`, { x: 355, y: 788, size: 9, font: bold, color: violet });
    target.drawLine({ start: { x: 42, y: 765 }, end: { x: 553, y: 765 }, thickness: 1, color: rgb(.82, .82, .87) });
  };
  const footer = (target: PDFPage, n: number) => {
    target.drawLine({ start: { x: 42, y: 45 }, end: { x: 553, y: 45 }, thickness: .5, color: rgb(.8, .8, .84) });
    target.drawText('Evaluación preliminar. No constituye aprobación ni oferta de financiación.', { x: 42, y: 28, size: 8, font: regular, color: muted });
    target.drawText(`${n}`, { x: 540, y: 28, size: 8, font: regular, color: muted });
  };
  const newPage = () => { footer(page, pdf.getPageCount()); page = pdf.addPage([595, 842]); header(page); y = 735; };
  const text = (value: string, size = 10, font: PDFFont = regular, color = ink) => {
    const words = String(value || '-').replace(/[^\x20-\x7EÀ-ÿ]/g, '').split(/\s+/);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > 490) {
        page.drawText(line, { x: 50, y, size, font, color }); y -= size + 5; line = word;
      } else line = next;
    }
    if (line) { page.drawText(line, { x: 50, y, size, font, color }); y -= size + 7; }
    if (y < 80) newPage();
  };
  const section = (title: string) => { y -= 7; text(title.toUpperCase(), 11, bold, violet); };
  const row = (label: string, value: unknown) => text(`${label}: ${value ?? '-'}`, 10);
  const money = (value: unknown) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));

  header(page);
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
    row('Relación compromisos / ingreso', data.economic?.installmentToIncomeRatio == null ? 'No estimable' : `${(data.economic.installmentToIncomeRatio * 100).toFixed(1)}%`);
    if (data.economic?.regulatoryExposure?.applicable) {
      section('Encuadre patrimonial y regulatorio');
      row('Resultado', data.economic.regulatoryExposure.label);
      row('Exposición total', money(data.economic.regulatoryExposure.totalExposure));
      row('Patrimonio computable', money(data.economic.regulatoryExposure.computableNetWorth));
      row('Exposición / patrimonio', data.economic.regulatoryExposure.exposureToNetWorthRatio == null ? 'No evaluable' : `${(data.economic.regulatoryExposure.exposureToNetWorthRatio * 100).toFixed(1)}%`);
      row('Financiamiento disponible dentro del margen básico', money(data.economic.regulatoryExposure.basicMarginAvailable));
    }
    if (data.economic?.confidence === 'declarativa') {
      text('ADVERTENCIA: los ingresos son declarativos y deben solicitarse comprobantes antes de una decisión definitiva.', 9, bold, violet);
    }
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
  footer(page, pdf.getPageCount());
  return pdf.save();
}
