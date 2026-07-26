'use client';

import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { extractPdfTextInBrowser } from '../../../lib/extractors/browserPdfOcr';
import { extractImageTextInBrowser } from '../../../lib/extractors/browserOcr';
import { extractBalanceData } from '../scoring/balanceExtractor';
import { evaluateEconomicCapacity } from '../scoring/economicEngine';
import { classifyPrequalificationDocument } from '../scoring/documentClassifier';
import { latestSixMonthlySales } from '../scoring/fiscalDocumentExtractor';
import { extractFinancialDebt, type ExtractedFinancialDebt } from '../scoring/financialDebtExtractor';
import { extractInvoiceTotal, extractSalaryNetAmount } from '../scoring/incomeDocumentExtractor';
import type { ComplianceDeclarations, ContactData, DossierDocument, EconomicAssessment, EconomicInputs, EconomicProfile, ExtractedBalance } from '../domain/dossier';
import type { PrequalificationResult } from '../domain/types';

type Props = {
  session: Session;
  caseId?: string;
  caseNumber?: string;
  requestData: {
    cuit: string;
    clientType: string;
    assetValue: number;
    advance: number;
    termMonths: number;
    assetType: string;
  };
  subject: { denomination: string | null; cuitMasked: string };
  stage1: PrequalificationResult;
  clientType: string;
};

const profiles: Array<[EconomicProfile, string]> = [
  ['employee', 'Persona en relación de dependencia'],
  ['monotributista', 'Monotributista'],
  ['responsable-inscripto', 'Responsable inscripto'],
  ['legal-entity', 'Persona jurídica'],
];
const decisions = [
  ['ready', 'Lista para enviar a análisis'],
  ['conditional', 'Avanzar con condiciones'],
  ['additional-guarantees', 'Solicitar garantías adicionales'],
  ['more-information', 'Solicitar más información'],
  ['not-compatible', 'No compatible'],
];
const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const formatChange = (value: number | null) => value == null ? 'No calculable' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
const balanceDateValue = (value: string | null) => {
  const match = value?.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return 0;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return new Date(year, Number(match[2]) - 1, Number(match[1])).getTime();
};
const extractConstitutionAntiquity = (text: string) => {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const match = normalized.match(/(?:constitu(?:ida|ido|ye)|constitucion|contrato social)[\s\S]{0,180}?(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return null;
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  const now = new Date();
  if (Number.isNaN(date.getTime()) || date > now) return null;
  const months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth()
    - (now.getDate() < date.getDate() ? 1 : 0);
  return { date: `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${year}`, months: Math.max(0, months) };
};

const stage2Requirements: Record<EconomicProfile, Array<[string, string, boolean]>> = {
  employee: [
    ['salary-slip-1', 'Recibo de sueldo 1', false], ['salary-slip-2', 'Recibo de sueldo 2', false],
    ['salary-slip-3', 'Recibo de sueldo 3', false], ['salary-slip-4', 'Recibo de sueldo 4', false],
    ['salary-slip-5', 'Recibo de sueldo 5', false], ['salary-slip-6', 'Recibo de sueldo 6', false],
    ['income-tax', 'Última DDJJ de Ganancias disponible', false], ['personal-assets', 'Manifestación de bienes o DDJJ de Bienes Personales disponible', false],
  ],
  monotributista: [
    ['monotributo-proof', 'Constancia de monotributo', false],
    ['monotributo-invoices-1', 'Facturas del mes 1', false],
    ['monotributo-invoices-2', 'Facturas del mes 2', false],
    ['monotributo-invoices-3', 'Facturas del mes 3', false],
    ['monotributo-invoices-4', 'Facturas del mes 4', false],
    ['monotributo-invoices-5', 'Facturas del mes 5', false],
    ['monotributo-invoices-6', 'Facturas del mes 6', false],
    ['asset-statement', 'Manifestación de bienes disponible', false],
  ],
  'responsable-inscripto': [
    ['tax-proof', 'Constancia de inscripción', true],
    ['vat-1', 'IVA mes 1', true], ['vat-2', 'IVA mes 2', true], ['vat-3', 'IVA mes 3', true],
    ['vat-4', 'IVA mes 4', true], ['vat-5', 'IVA mes 5', true], ['vat-6', 'IVA mes 6', true],
    ['income-tax', 'Última DDJJ de Ganancias disponible', false],
  ],
  'legal-entity': [
    ['balance-1', 'Último balance', true], ['balance-2', 'Balance anterior', true],
    ['post-balance-sales', 'Ventas netas de IVA posteriores al último balance', true],
    ['financial-debt', 'Detalle de deuda bancaria y financiera', true],
  ],
};

const stage3Requirements: Record<EconomicProfile, Array<[string, string, boolean]>> = {
  employee: [
    ['identity-front', 'DNI frente', false], ['identity-back', 'DNI dorso', false],
    ['certified-income', 'Certificación de ingresos, si el administrador la solicita', false],
  ],
  monotributista: [
    ['identity-front', 'DNI frente', false], ['identity-back', 'DNI dorso', false],
    ['certified-income', 'Detalle de ingresos certificado, si se solicita', false],
  ],
  'responsable-inscripto': [
    ['identity-front', 'DNI frente', false], ['identity-back', 'DNI dorso', false],
    ['certified-income', 'Certificación contable, si se solicita', false],
  ],
  'legal-entity': [
    ['statute', 'Estatuto o contrato social', false], ['authorities-act', 'Acta vigente de autoridades', false],
    ['balance-approval-act', 'Acta de aprobación del último balance', false], ['signer-power', 'Poder del firmante', false],
    ['representative-identity-front', 'DNI frente del representante', false], ['representative-identity-back', 'DNI dorso del representante', false],
    ['partners-assets', 'Bienes Personales o manifestación de socios, si se solicita', false],
  ],
};

const employmentSlipRequirements: Array<[string, string, boolean]> = [
  ['additional-salary-slip-1', 'Recibo de sueldo adicional 1', false],
  ['additional-salary-slip-2', 'Recibo de sueldo adicional 2', false],
  ['additional-salary-slip-3', 'Recibo de sueldo adicional 3', false],
  ['additional-salary-slip-4', 'Recibo de sueldo adicional 4', false],
  ['additional-salary-slip-5', 'Recibo de sueldo adicional 5', false],
  ['additional-salary-slip-6', 'Recibo de sueldo adicional 6', false],
];
const monotributoSupplementRequirements: Array<[string, string, boolean]> = [
  ['additional-monotributo-proof', 'Constancia de monotributo adicional', false],
  ['additional-monotributo-invoices-1', 'Facturas de monotributo del mes 1', false],
  ['additional-monotributo-invoices-2', 'Facturas de monotributo del mes 2', false],
  ['additional-monotributo-invoices-3', 'Facturas de monotributo del mes 3', false],
  ['additional-monotributo-invoices-4', 'Facturas de monotributo del mes 4', false],
  ['additional-monotributo-invoices-5', 'Facturas de monotributo del mes 5', false],
  ['additional-monotributo-invoices-6', 'Facturas de monotributo del mes 6', false],
];

export function PrequalificationStages(props: Props) {
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState<DossierDocument[]>([]);
  const [excludedDocuments, setExcludedDocuments] = useState<Array<{ name: string; reason: string }>>([]);
  const [balance, setBalance] = useState<ExtractedBalance>();
  const [previousBalance, setPreviousBalance] = useState<ExtractedBalance>();
  const [debtExtraction, setDebtExtraction] = useState<ExtractedFinancialDebt>();
  const [constitutionDate, setConstitutionDate] = useState<string>();
  const [assessment, setAssessment] = useState<EconomicAssessment>();
  const [contact, setContact] = useState<ContactData>({
    fullName: props.subject.denomination || '', address: '', city: '', province: '', email: '', mobile: '',
    preferredChannel: 'email', dataConsent: false, contactConsent: false, accuracyDeclaration: false,
  });
  const defaultProfile: EconomicProfile = props.clientType === 'persona-juridica' ? 'legal-entity' : 'employee';
  const [economic, setEconomic] = useState<EconomicInputs>({
    profile: defaultProfile, activity: '', activityCategory: 'other', activitySeniorityMonths: 0, declaredMonthlyDebtService: 0,
    proposedMonthlyCanon: 0, employeeNetIncome: 0, declaredMonthlyNetIncome: 0, hasEmploymentIncome: false,
    hasMonotributoIncome: false, additionalMonotributoNetIncome: 0,
    additionalEmploymentNetIncome: 0, monthlySales: [0, 0, 0, 0, 0, 0], declaredOperatingMargin: 0,
    requestedFinancing: Math.max(0, props.requestData.assetValue - props.requestData.advance),
    computableNetWorth: 0, existingComputableFinancing: 0, qualifyingGuarantee: 'none',
  });
  const [compliance, setCompliance] = useState<ComplianceDeclarations>({
    pepStatus: 'no', obligedSubject: false, fundsLawfulOrigin: false, ownAccount: false,
    taxResidenceArgentina: true, administratorMayRequestEvidence: false,
  });
  const [decision, setDecision] = useState('ready');
  const [responseEmail, setResponseEmail] = useState('');
  const [administratorEmail, setAdministratorEmail] = useState('contacto@leasingscoring.com');
  const [emailProvider] = useState('resend');
  const [responseMessage, setResponseMessage] = useState('');
  const [effectiveCaseId, setEffectiveCaseId] = useState(props.caseId);
  const [effectiveCaseNumber, setEffectiveCaseNumber] = useState(props.caseNumber);
  const incomeDocumentCount = documents.filter(document =>
    /salary-slip|monotributo-invoices|balance-|vat-|income-detail|post-balance-sales/.test(document.kind),
  ).length;
  const previewAssessment = evaluateEconomicCapacity(economic, incomeDocumentCount, balance, previousBalance);
  const automaticBalanceMargin = balance?.sales && (balance.operatingProfit ?? balance.netProfit) != null
    ? Math.max(0, ((balance.operatingProfit ?? balance.netProfit) as number) / balance.sales) * 100
    : null;
  const currentStage2Requirements = [
    ...stage2Requirements[economic.profile],
    ...(economic.profile === 'monotributista' && economic.hasEmploymentIncome ? employmentSlipRequirements : []),
    ...(economic.profile === 'employee' && economic.hasMonotributoIncome ? monotributoSupplementRequirements : []),
  ];
  const missingStage2Documents = currentStage2Requirements
    .filter(([, , required]) => required)
    .filter(([kind]) => !documents.some(document => document.stage === 2 && document.kind === kind))
    .map(([, label]) => label);

  const api = async (payload: object, caseId = effectiveCaseId) => {
    const response = await fetch('/api/prequalification/case', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.session.access_token}` },
      body: JSON.stringify({ caseId, ...payload }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el expediente.');
    return data;
  };
  const readFiles = async (files: FileList | File[] | null, documentKind: string) => {
    if (!files) return;
    setBusy(true); setMessage('Leyendo documentos…');
    const added: DossierDocument[] = [];
    const usedKinds = new Set(documents.map(document => document.kind));
    let monthlySalesFromDocuments: number[] = [];
    let debtFromDocument: ExtractedFinancialDebt | undefined;
    let societaryAntiquity: ReturnType<typeof extractConstitutionAntiquity>;
    try {
      const recovered = await recoverCase();
      for (const file of Array.from(files)) {
        let extractedText = '';
        let extractionConfidence = 0;
        let extractedPages: number | undefined;
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const extraction = await extractPdfTextInBrowser(file, (progress) => setMessage(`Leyendo página ${progress.page} de ${progress.totalPages}…`));
          extractedText = extraction.text;
          extractionConfidence = extraction.confidence;
          extractedPages = extraction.pages;
        } else if (/\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          setMessage(`Leyendo ${file.name}…`);
          const mammoth = await import('mammoth');
          extractedText = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
          extractionConfidence = extractedText ? 100 : 0;
        } else if (/\.(xlsx?|xls)$/i.test(file.name) || /spreadsheet|excel/i.test(file.type)) {
          setMessage(`Leyendo planilla ${file.name}…`);
          const spreadsheet = await import('xlsx');
          const workbook = spreadsheet.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
          extractedText = workbook.SheetNames.map(name =>
            `HOJA: ${name}\n${spreadsheet.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false })}`,
          ).join('\n\n');
          extractionConfidence = extractedText ? 100 : 0;
        } else if (/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
          setMessage(`Leyendo ${file.name} mediante OCR…`);
          const extraction = await extractImageTextInBrowser(file);
          extractedText = extraction.text;
          extractionConfidence = extraction.confidence;
        }
        const admission = documentKind === 'auto'
          ? classifyPrequalificationDocument({ profile: economic.profile, fileName: file.name, extractedText, targetCuit: props.requestData.cuit, usedKinds })
          : { action: 'accept' as const, kind: documentKind, stage: stage === 3 ? 3 as const : 2 as const, confidence: 'high' as const, reason: 'Tipo seleccionado por el usuario.' };
        const resolvedKind = admission.kind;
        if (admission.action === 'discard' || admission.kind === 'different-subject') {
          setExcludedDocuments(current => [...current, { name: file.name, reason: admission.reason }]);
          continue;
        }
        usedKinds.add(resolvedKind);
        if (resolvedKind === 'post-balance-sales') {
          const extractedSales = latestSixMonthlySales(extractedText);
          if (extractedSales.length === 6) monthlySalesFromDocuments = extractedSales;
        }
        if (resolvedKind === 'financial-debt') debtFromDocument = extractFinancialDebt(extractedText);
        if (economic.profile === 'legal-entity' && resolvedKind === 'statute') {
          societaryAntiquity = extractConstitutionAntiquity(extractedText);
        }
        const documentStage = documentKind === 'auto' ? admission.stage : stage === 3 ? 3 : 2;
        const upload = new FormData();
        upload.append('file', file); upload.append('caseId', recovered.caseId); upload.append('stage', String(documentStage));
        const uploadResponse = await fetch('/api/prequalification/document', { method: 'POST', headers: { Authorization: `Bearer ${props.session.access_token}` }, body: upload });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.error || 'No se pudo guardar el documento.');
        added.push({
          id: crypto.randomUUID(), stage: documentStage, kind: resolvedKind, name: file.name, size: file.size,
          pages: extractedPages, extractionConfidence, extractedText, storagePath: uploadData.storagePath,
          status: admission.action === 'review' || (extractedText && extractionConfidence < 55)
            ? 'needs-review'
            : extractedText ? 'read' : 'uploaded',
        });
      }
      setDocuments((current) => {
        const updated = [...current];
        for (const next of added) {
          const allowsSeveral = next.kind.includes('invoices-') || ['balance-notes', 'post-balance-sales', 'corporate-income-tax', 'representative-identity-front', 'representative-identity-back', 'different-subject', 'unclassified'].includes(next.kind);
          if (!allowsSeveral) {
            const existing = updated.findIndex(document => document.stage === next.stage && document.kind === next.kind);
            if (existing >= 0) updated.splice(existing, 1);
          }
          updated.push(next);
        }
        return updated;
      });
      const combinedDocuments = [...documents];
      for (const next of added) {
        const allowsSeveral = next.kind.includes('invoices-') || ['balance-notes', 'post-balance-sales', 'corporate-income-tax', 'representative-identity-front', 'representative-identity-back', 'different-subject', 'unclassified'].includes(next.kind);
        if (!allowsSeveral) {
          const existing = combinedDocuments.findIndex(document => document.stage === next.stage && document.kind === next.kind);
          if (existing >= 0) combinedDocuments.splice(existing, 1);
        }
        combinedDocuments.push(next);
      }
      const averageExtracted = (values: Array<number | null>) => {
        const valid = values.filter((value): value is number => value != null && value > 0);
        return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
      };
      const primarySalary = averageExtracted(combinedDocuments.filter(document => /^salary-slip-\d+$/.test(document.kind)).map(document => extractSalaryNetAmount(document.extractedText || '')));
      const additionalSalary = averageExtracted(combinedDocuments.filter(document => /^additional-salary-slip-\d+$/.test(document.kind)).map(document => extractSalaryNetAmount(document.extractedText || '')));
      const invoiceMonths = (prefix: string) => Array.from({ length: 6 }, (_, index) =>
        combinedDocuments
          .filter(document => document.kind === `${prefix}-${index + 1}`)
          .map(document => extractInvoiceTotal(document.extractedText || ''))
          .filter((value): value is number => value != null)
          .reduce((sum, value) => sum + value, 0),
      );
      const primaryMonotributoSales = invoiceMonths('monotributo-invoices');
      const additionalMonotributoSales = invoiceMonths('additional-monotributo-invoices');
      setEconomic(current => ({
        ...current,
        employeeNetIncome: primarySalary || current.employeeNetIncome,
        additionalEmploymentNetIncome: additionalSalary || current.additionalEmploymentNetIncome,
        monthlySales: primaryMonotributoSales.some(Boolean) ? primaryMonotributoSales : current.monthlySales,
        additionalMonotributoNetIncome: additionalMonotributoSales.some(Boolean)
          ? averageExtracted(additionalMonotributoSales)
          : current.additionalMonotributoNetIncome,
      }));
      const balanceNotesText = combinedDocuments
        .filter(document => document.kind === 'balance-notes')
        .map(document => document.extractedText || '')
        .join('\n');
      const extractedBalances = combinedDocuments
        .filter(document => economic.profile === 'legal-entity'
          && (document.kind === 'balance-1' || document.kind === 'balance-2')
          && Boolean(document.extractedText))
        .map(document => {
          const extracted = extractBalanceData(`${document.extractedText || ''}\n${document.kind === 'balance-1' ? balanceNotesText : ''}`);
          extracted.extractionConfidence = Math.round(Math.min(extracted.extractionConfidence, document.extractionConfidence ?? 100));
          return extracted;
        })
        .sort((left, right) => balanceDateValue(right.closingDate) - balanceDateValue(left.closingDate));
      const latestBalance = extractedBalances[0];
      const priorBalance = extractedBalances[1];
      if (latestBalance) {
        const extractedBalance = latestBalance;
        setBalance(extractedBalance);
        setEconomic(current => ({
          ...current,
          activity: current.activity || extractedBalance.activity || '',
          computableNetWorth: current.computableNetWorth || extractedBalance.equity || 0,
          existingComputableFinancing: current.existingComputableFinancing || extractedBalance.financialDebt || 0,
        }));
      }
      if (priorBalance) setPreviousBalance(priorBalance);
      if (monthlySalesFromDocuments.length === 6) {
        setEconomic(current => ({ ...current, monthlySales: monthlySalesFromDocuments }));
      }
      if (debtFromDocument) {
        setDebtExtraction(debtFromDocument);
        setEconomic(current => ({
          ...current,
          existingComputableFinancing: debtFromDocument?.totalOutstanding ?? current.existingComputableFinancing,
          declaredMonthlyDebtService: debtFromDocument?.monthlyDebtService ?? current.declaredMonthlyDebtService,
        }));
      }
      if (societaryAntiquity) {
        setConstitutionDate(societaryAntiquity.date);
        setEconomic(current => ({ ...current, activitySeniorityMonths: societaryAntiquity?.months ?? current.activitySeniorityMonths }));
      }
      const reviewCount = added.filter(document => document.status === 'needs-review').length;
      setMessage(`${added.length} documento(s) incorporado(s).${reviewCount ? ` ${reviewCount} requieren identificar su tipo manualmente.` : ' Todos fueron identificados automáticamente.'}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo leer el archivo.'); }
    setBusy(false);
  };
  async function recoverCase() {
    if (effectiveCaseId) return { caseId: effectiveCaseId, caseNumber: effectiveCaseNumber };
    const recovered = await api({
      action: 'recover',
      requestData: props.requestData,
      stage1: props.stage1,
    }, undefined);
    setEffectiveCaseId(recovered.caseId);
    setEffectiveCaseNumber(recovered.caseNumber);
    return recovered as { caseId: string; caseNumber: string };
  }
  const saveStage2 = async () => {
    const applicableRequirements = [
      ...stage2Requirements[economic.profile],
      ...(economic.profile === 'monotributista' && economic.hasEmploymentIncome ? employmentSlipRequirements : []),
      ...(economic.profile === 'employee' && economic.hasMonotributoIncome ? monotributoSupplementRequirements : []),
    ];
    const missingDocuments = applicableRequirements
      .filter(([, , required]) => required)
      .filter(([kind]) => !documents.some(document => document.stage === 2 && document.kind === kind))
      .map(([, label]) => label);
    if (missingDocuments.length && !effectiveCaseNumber?.startsWith('DEMO-')) {
      return setMessage(`Falta agregar: ${missingDocuments.join(', ')}.`);
    }
    setAssessment(previewAssessment);
    if (previewAssessment.status !== 'compatible') {
      setMessage(previewAssessment.maximumPrudentCanon == null
        ? 'No se enviará el expediente: faltan ingresos computables para evaluar la cuota.'
        : `No se enviará el expediente con esta cuota. El canon máximo estimado es ${pesos.format(previewAssessment.maximumPrudentCanon)}.`);
      return;
    }
    setBusy(true); setMessage('');
    try {
      const recovered = await recoverCase();
      const data = await api({
        action: 'stage2', contact, economicInputs: economic, documents, balance, previousBalance,
        caseNumber: recovered.caseNumber, subject: props.subject.denomination,
      }, recovered.caseId);
      setAssessment(data.assessment); setStage(3); setResponseEmail(contact.email);
      setMessage(data.notification?.sent
        ? `Expediente ${recovered.caseNumber} generado y enviado a contacto@leasingscoring.com.`
        : `Expediente ${recovered.caseNumber} generado. No se pudo enviar la notificación.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Error'); }
    setBusy(false);
  };
  const saveStage3 = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await api({ action: 'stage3', compliance, decision, responseEmail, documents, caseNumber: effectiveCaseNumber, subject: props.subject.denomination });
      setMessage(data.notification?.sent ? 'El administrador fue notificado.' : 'Expediente guardado. Falta conectar la clave de Resend para enviar correos.');
      setStage(4);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Error'); }
    setBusy(false);
  };
  const downloadPdf = async () => {
    setBusy(true);
    const response = await fetch('/api/prequalification/pdf', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.session.access_token}` },
      body: JSON.stringify({ caseNumber: effectiveCaseNumber, subject: props.subject.denomination, cuitMasked: props.subject.cuitMasked, stage1: props.stage1, contact, economic: { ...assessment, declaredMonthlyDebtService: economic.declaredMonthlyDebtService }, compliance, decision, responseEmail }),
    });
    if (response.ok) {
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${effectiveCaseNumber}.pdf`; anchor.click(); URL.revokeObjectURL(url);
    } else setMessage('No se pudo generar el PDF.');
    setBusy(false);
  };

  return <section className="prequalCard prequalResult">
    <h2>{stage === 1 || stage === 2 ? 'Evaluación preliminar' : `Expediente ${effectiveCaseNumber || 'pendiente'}`}</h2>
    <div className="prequalNotice">Precalificación {stage > 3 ? 3 : stage} de 3 · El respaldo costoso sólo se solicita cuando el administrador lo considera necesario.</div>
    {stage === 1 && <div>
      <h3>Precalificación 1 completa</h3>
      <p>La consulta BCRA quedó incorporada. Para estimar capacidad de pago necesitamos datos de contacto, actividad e información económica directamente útil.</p>
      <button className="prequalPrimary" onClick={() => setStage(2)}>Continuar a Precalificación 2</button>
    </div>}
    {stage === 2 && <div className="prequalForm">
      <h3>Precalificación 2 · Contacto y capacidad económica</h3>
      <div className="prequalGrid">
        <label>Nombre completo / razón social<input value={contact.fullName} onChange={e => setContact({ ...contact, fullName: e.target.value })} /></label>
        <label>Perfil<select value={economic.profile} onChange={e => setEconomic({ ...economic, profile: e.target.value as EconomicProfile })}>{profiles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Domicilio declarado<input value={contact.address} onChange={e => setContact({ ...contact, address: e.target.value })} /></label>
        <label>Localidad<input value={contact.city} onChange={e => setContact({ ...contact, city: e.target.value })} /></label>
        <label>Provincia<input value={contact.province} onChange={e => setContact({ ...contact, province: e.target.value })} /></label>
        <label>Correo<input type="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} /></label>
        <label>Celular<input value={contact.mobile} onChange={e => setContact({ ...contact, mobile: e.target.value })} /></label>
        <label>Actividad<input value={economic.activity} onChange={e => setEconomic({ ...economic, activity: e.target.value })} /></label>
        <label>{economic.profile === 'legal-entity' ? 'Antigüedad societaria (meses)' : 'Antigüedad (meses)'}
          <input type="text" inputMode="numeric" value={economic.activitySeniorityMonths || ''} onChange={e => setEconomic({ ...economic, activitySeniorityMonths: Number(e.target.value.replace(/\D/g, '')) })} />
          {economic.profile === 'legal-entity' && <small>{constitutionDate ? `Calculada desde la fecha de constitución extraída del estatuto: ${constitutionDate}.` : 'Se calculará automáticamente si el estatuto o contrato social contiene una fecha de constitución legible.'}</small>}
        </label>
        <label>Cuotas mensuales de financiaciones vigentes
          <input type="text" inputMode="numeric" value={economic.declaredMonthlyDebtService || ''} onChange={e => setEconomic({ ...economic, declaredMonthlyDebtService: Number(e.target.value.replace(/\D/g, '')) })} />
          <small>Suma mensual que actualmente paga por préstamos, leasing, descubiertos y otras financiaciones. No es el saldo total adeudado.</small>
        </label>
        <label>Canon mensual propuesto<input type="text" inputMode="numeric" value={economic.proposedMonthlyCanon || ''} onChange={e => setEconomic({ ...economic, proposedMonthlyCanon: Number(e.target.value.replace(/\D/g, '')) })} /></label>
        {economic.profile === 'employee'
          ? <label>Ingreso neto mensual declarado<input type="text" inputMode="numeric" value={economic.employeeNetIncome || ''} onChange={e => setEconomic({ ...economic, employeeNetIncome: Number(e.target.value.replace(/\D/g, '')) })} /><small>Podés informarlo ahora y adjuntar recibos voluntariamente.</small></label>
          : economic.profile === 'monotributista'
            ? <><label>Ingreso mensual neto declarado<input type="text" inputMode="numeric" value={economic.declaredMonthlyNetIncome || ''} onChange={e => setEconomic({ ...economic, declaredMonthlyNetIncome: Number(e.target.value.replace(/\D/g, '')) })} /><small>Se computará íntegramente. Las facturas son respaldo opcional y no alteran esta precalificación.</small></label>
              <label>Tipo de actividad<select value={economic.activityCategory} onChange={e => setEconomic({ ...economic, activityCategory: e.target.value as EconomicInputs['activityCategory'] })}>
                <option value="professional-services">Servicios profesionales</option>
                <option value="other-services">Otros servicios</option>
                <option value="commerce">Comercio</option>
                <option value="production">Producción / elaboración</option>
                <option value="transport">Transporte</option>
                <option value="other">Otra actividad</option>
              </select><small>No se aplican quitas automáticas por actividad ni por falta de comprobantes.</small></label></>
          : <><label>Facturación promedio mensual declarada<input type="text" inputMode="numeric" value={Math.round((economic.monthlySales || []).reduce((sum, value) => sum + value, 0) / Math.max(1, (economic.monthlySales || []).length)) || ''} onChange={e => setEconomic({ ...economic, monthlySales: Array(6).fill(Number(e.target.value.replace(/\D/g, ''))) })} /><small>Podés ingresar un promedio o adjuntar las facturas de cada mes, o ambas cosas.</small></label>
            {economic.profile === 'responsable-inscripto' && <label>Margen operativo estimado (%)<input type="number" value={economic.declaredOperatingMargin} onChange={e => setEconomic({ ...economic, declaredOperatingMargin: Number(e.target.value) })} /></label>}
            {economic.profile === 'legal-entity' && <div className="prequalCalculatedField"><b>Margen calculado automáticamente</b><span>{automaticBalanceMargin == null ? 'Se calculará al cargar el último balance.' : `${automaticBalanceMargin.toFixed(1)}% según ventas y resultado del balance.`}</span></div>}
          </>}
        {economic.profile === 'legal-entity' && <>
          <label>Patrimonio neto al cierre del último balance
            <input type="text" inputMode="numeric" value={economic.computableNetWorth || ''} onChange={e => setEconomic({ ...economic, computableNetWorth: Number(e.target.value.replace(/\D/g, '')) })} />
            <small>{balance?.equity != null
              ? `Extraído automáticamente del balance${balance.closingDate ? ` cerrado el ${balance.closingDate}` : ''}, con confianza ${Math.round(balance.extractionConfidence)}%. Podés corregirlo si la lectura no coincide.`
              : 'Se completará automáticamente al cargar el último balance. También podés informarlo manualmente si el documento no permite una lectura confiable.'}</small>
            <small>Es la base preliminar para verificar el límite regulatorio; puede requerir ajustes si existen conceptos no computables.</small>
          </label>
          <label>Deuda bancaria y financiera vigente<input type="text" inputMode="numeric" value={economic.existingComputableFinancing || ''} onChange={e => setEconomic({ ...economic, existingComputableFinancing: Number(e.target.value.replace(/\D/g, '')) })} /><small>Saldo total actual de préstamos, descubiertos, leasing y otras financiaciones todavía pendientes.</small>{debtExtraction && <small>Extraído del documento con confianza {debtExtraction.confidence}%. {debtExtraction.creditorEntities.length ? `${debtExtraction.creditorEntities.length} entidad(es) identificada(s).` : ''} {debtExtraction.warnings.join(' ')}</small>}</label>
          <label>Monto neto solicitado<input type="text" inputMode="numeric" value={economic.requestedFinancing || ''} onChange={e => setEconomic({ ...economic, requestedFinancing: Number(e.target.value.replace(/\D/g, '')) })} /><small>Valor del bien menos anticipo; modificable si la estructura propuesta es distinta.</small></label>
          <label>Garantía regulatoria elegible<select value={economic.qualifyingGuarantee} onChange={e => setEconomic({ ...economic, qualifyingGuarantee: e.target.value as EconomicInputs['qualifyingGuarantee'] })}><option value="none">Sin SGR/fondo público informado</option><option value="sgr-public-fund">SGR o fondo público elegible</option></select></label>
        </>}
        {economic.profile === 'monotributista' && <label className="prequalCheckRow">
          <input type="checkbox" checked={!!economic.hasEmploymentIncome} onChange={e => setEconomic({ ...economic, hasEmploymentIncome: e.target.checked, additionalEmploymentNetIncome: e.target.checked ? economic.additionalEmploymentNetIncome : 0 })} />
          <span><b>También trabaja en relación de dependencia</b><small>Marcá esta opción para sumar el sueldo mensual a los ingresos de la actividad.</small></span>
        </label>}
        {economic.profile === 'monotributista' && economic.hasEmploymentIncome && <label>Ingreso neto mensual por relación de dependencia
          <input type="text" inputMode="numeric" value={economic.additionalEmploymentNetIncome || ''} onChange={e => setEconomic({ ...economic, additionalEmploymentNetIncome: Number(e.target.value.replace(/\D/g, '')) })} />
        </label>}
        {economic.profile === 'employee' && <label className="prequalCheckRow">
          <input type="checkbox" checked={!!economic.hasMonotributoIncome} onChange={e => setEconomic({ ...economic, hasMonotributoIncome: e.target.checked, additionalMonotributoNetIncome: e.target.checked ? economic.additionalMonotributoNetIncome : 0 })} />
          <span><b>También tiene actividad como monotributista</b><small>Marcá esta opción para sumar el ingreso mensual neto de esa actividad.</small></span>
        </label>}
        {economic.profile === 'employee' && economic.hasMonotributoIncome && <label>Ingreso mensual neto declarado como monotributista
          <input type="text" inputMode="numeric" value={economic.additionalMonotributoNetIncome || ''} onChange={e => setEconomic({ ...economic, additionalMonotributoNetIncome: Number(e.target.value.replace(/\D/g, '')) })} />
        </label>}
      </div>
      <div className="prequalEntityDetail">
        <h3>Documentación económica</h3>
        <p>Los comprobantes de ingresos son voluntarios en esta etapa. Sin ellos, el resultado se identificará como declarativo y recomendará pedir respaldo antes de avanzar.</p>
        <div
          className="prequalBulkUpload"
          onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); void readFiles(event.dataTransfer.files, 'auto'); }}
        >
          <div><b>Carga automática de varios documentos</b><span>Seleccioná o arrastrá juntos archivos PDF, imágenes o Word. LeasingScoring identificará sujeto, tipo y etapa antes de incorporarlos.</span></div>
          <label className="prequalUploadButton" htmlFor="stage-2-bulk-documents">Seleccionar varios archivos</label>
          <input id="stage-2-bulk-documents" className="prequalFileInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={event => readFiles(event.target.files, 'auto')} />
        </div>
        {!!excludedDocuments.length && <div className="prequalExcludedDocuments"><b>Archivos no incorporados al expediente</b>{excludedDocuments.map(document => <span key={`${document.name}-${document.reason}`}>{document.name}: {document.reason}</span>)}</div>}
        <div className={`prequalMissingDocuments ${missingStage2Documents.length ? 'hasMissing' : 'complete'}`}>
          <b>{missingStage2Documents.length ? 'Documentación que todavía falta' : 'Documentación económica mínima completa'}</b>
          {missingStage2Documents.length
            ? <ul>{missingStage2Documents.map(item => <li key={item}>{item}</li>)}</ul>
            : <span>El lote contiene todos los respaldos obligatorios para calcular esta etapa.</span>}
        </div>
        {documents.filter(document => document.status === 'needs-review').map(document => <div className="prequalClassificationReview" key={document.id}>
          <div><b>Revisar clasificación</b><span>{document.name}</span></div>
          <label>Tipo de documento
            <select value="" onChange={event => {
              const kind = event.target.value;
              if (!kind) return;
              setDocuments(current => current.map(item => item.id === document.id ? { ...item, kind, status: item.extractedText ? 'read' : 'uploaded' } : item));
            }}>
              <option value="">Seleccionar tipo…</option>
              {[
                ...currentStage2Requirements,
                ...stage3Requirements[economic.profile],
              ].map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select>
          </label>
        </div>)}
        {[
          ...stage2Requirements[economic.profile],
          ...(economic.profile === 'monotributista' && economic.hasEmploymentIncome ? employmentSlipRequirements : []),
          ...(economic.profile === 'employee' && economic.hasMonotributoIncome ? monotributoSupplementRequirements : []),
        ].map(([kind, label, required]) => {
          const uploaded = documents.filter(document => document.stage === 2 && document.kind === kind);
          const allowsSeveral = kind.includes('monotributo-invoices-');
          const inputId = `stage-2-${kind}`;
          return <div className="prequalUploadItem" key={kind}>
            <div className="prequalUploadRow">
              <div><b>{label}</b><small>{required ? 'Requerido' : 'Opcional'}</small></div>
              <label className="prequalUploadButton" htmlFor={inputId}>Agregar {allowsSeveral ? 'archivos' : 'archivo'}</label>
              <input id={inputId} className="prequalFileInput" type="file" multiple={allowsSeveral} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => readFiles(e.target.files, kind)} />
            </div>
            {!!uploaded.length && <div className="prequalUploadedFile">✓ {uploaded.length} archivo(s): {uploaded.map(document => document.name).join(', ')}</div>}
          </div>;
        })}
      </div>
      <div className={`prequalCapacity prequalEconomic-${previewAssessment.status}`}>
        <h3>Calificación económica antes del envío</h3>
        {previewAssessment.status === 'compatible'
          ? <p><b>La operación califica para continuar.</b> La relación total cuota/ingreso está dentro del máximo del 30%.</p>
          : previewAssessment.maximumPrudentCanon == null
            ? <p><b>Todavía no puede calificarse.</b> Ingresá un ingreso o facturación mensual computable.</p>
            : <p><b>La cuota propuesta no califica.</b> Para continuar, reducí el canon hasta un máximo estimado de <b>{pesos.format(previewAssessment.maximumPrudentCanon)}</b>.</p>}
        <p>Ingreso computable: <b>{previewAssessment.normalizedMonthlyIncome == null ? 'No estimable' : pesos.format(previewAssessment.normalizedMonthlyIncome)}</b> · Canon propuesto: <b>{pesos.format(economic.proposedMonthlyCanon)}</b></p>
        <p>Relación compromisos/ingreso: <b>{previewAssessment.installmentToIncomeRatio == null ? 'No estimable' : `${(previewAssessment.installmentToIncomeRatio * 100).toFixed(1)}%`}</b> · Score económico: <b>{previewAssessment.score}/100</b></p>
        {previewAssessment.regulatoryExposure.applicable && <div className="prequalRegulatory">
          <h3>Encuadre patrimonial y regulatorio</h3>
          <p><b>{previewAssessment.regulatoryExposure.label}</b></p>
          <p>Exposición total: <b>{pesos.format(previewAssessment.regulatoryExposure.totalExposure)}</b> · Patrimonio computable: <b>{previewAssessment.regulatoryExposure.computableNetWorth == null ? 'No informado' : pesos.format(previewAssessment.regulatoryExposure.computableNetWorth)}</b></p>
          <p>Exposición / patrimonio: <b>{previewAssessment.regulatoryExposure.exposureToNetWorthRatio == null ? 'No evaluable' : `${(previewAssessment.regulatoryExposure.exposureToNetWorthRatio * 100).toFixed(1)}%`}</b> · Nuevo financiamiento máximo dentro del margen básico: <b>{previewAssessment.regulatoryExposure.basicMarginAvailable == null ? 'No evaluable' : pesos.format(previewAssessment.regulatoryExposure.basicMarginAvailable)}</b></p>
          {previewAssessment.regulatoryExposure.conditions.map((condition) => <small key={condition}>{condition}</small>)}
        </div>}
        {previewAssessment.corporateFinancials && <div className="prequalRegulatory">
          <h3>Indicadores del último balance</h3>
          <p>Sector interpretado: <b>{previewAssessment.corporateFinancials.sectorLabel}</b></p>
          <p>Confianza de lectura del balance: <b>{balance ? `${Math.round(balance.extractionConfidence)}%` : 'Sin balance'}</b>{balance?.missingFields.length ? ` · Rubros centrales pendientes: ${balance.missingFields.join(', ')}` : ' · Rubros centrales completos'}</p>
          {balance && <p>Período identificado: <b>{balance.statementKind === 'interim' ? `intermedio de ${balance.periodMonths || '?'} meses` : balance.statementKind === 'annual' ? 'anual' : 'sin determinar'}</b>{balance.currencyBasis === 'homogeneous' ? ' · moneda homogénea' : ''}{balance.amountScale === 1000 ? ' · importes publicados en miles' : balance.amountScale === 1000000 ? ' · importes publicados en millones' : ''}{balance.statementScope && balance.statementScope !== 'unknown' ? ` · ${balance.statementScope === 'consolidated' ? 'consolidado' : balance.statementScope === 'separate' ? 'separado' : 'individual'}` : ''}{balance.assuranceLevel === 'limited-review' ? ' · revisión limitada' : balance.assuranceLevel === 'audit' ? ' · auditado' : ''}. Los saldos patrimoniales corresponden al cierre; sólo los flujos intermedios se anualizan para ratios comparables.</p>}
          <p>Calificación financiera: <b>{previewAssessment.corporateFinancials.score == null ? 'Datos insuficientes' : `${previewAssessment.corporateFinancials.score}/100`}</b></p>
          <p>Cobertura de compromisos mensuales: <b>{previewAssessment.totalCommitmentCoverage?.toFixed(2) ?? 'No calculable'} veces</b> · Monto solicitado / ventas anuales: <b>{previewAssessment.requestedFinancingToSales == null ? 'No calculable' : `${(previewAssessment.requestedFinancingToSales * 100).toFixed(1)}%`}</b> · Monto solicitado / activo: <b>{previewAssessment.requestedFinancingToAssets == null ? 'No calculable' : `${(previewAssessment.requestedFinancingToAssets * 100).toFixed(1)}%`}</b></p>
          <p>Liquidez corriente: <b>{previewAssessment.corporateFinancials.currentRatio?.toFixed(2) ?? 'No calculable'}</b> · Capital de trabajo: <b>{previewAssessment.corporateFinancials.workingCapital == null ? 'No calculable' : pesos.format(previewAssessment.corporateFinancials.workingCapital)}</b></p>
          <p>Liquidez ácida: <b>{previewAssessment.corporateFinancials.quickRatio?.toFixed(2) ?? 'No calculable'}</b> · Cobertura de intereses: <b>{previewAssessment.corporateFinancials.interestCoverage?.toFixed(2) ?? 'No calculable'}</b></p>
          <p>Pasivo / patrimonio: <b>{previewAssessment.corporateFinancials.liabilitiesToEquity == null ? 'No calculable' : `${(previewAssessment.corporateFinancials.liabilitiesToEquity * 100).toFixed(1)}%`}</b> · Deuda financiera / patrimonio: <b>{previewAssessment.corporateFinancials.debtToEquity == null ? 'No calculable' : `${(previewAssessment.corporateFinancials.debtToEquity * 100).toFixed(1)}%`}</b></p>
          <p>Margen bruto: <b>{previewAssessment.corporateFinancials.grossMargin == null ? 'No calculable' : `${(previewAssessment.corporateFinancials.grossMargin * 100).toFixed(1)}%`}</b> · Margen operativo: <b>{previewAssessment.corporateFinancials.operatingMargin == null ? 'No calculable' : `${(previewAssessment.corporateFinancials.operatingMargin * 100).toFixed(1)}%`}</b> · Margen neto: <b>{previewAssessment.corporateFinancials.netMargin == null ? 'No calculable' : `${(previewAssessment.corporateFinancials.netMargin * 100).toFixed(1)}%`}</b></p>
          <p>ROA: <b>{previewAssessment.corporateFinancials.returnOnAssets == null ? 'No calculable' : `${(previewAssessment.corporateFinancials.returnOnAssets * 100).toFixed(1)}%`}</b> · ROE: <b>{previewAssessment.corporateFinancials.returnOnEquity == null ? 'No calculable' : `${(previewAssessment.corporateFinancials.returnOnEquity * 100).toFixed(1)}%`}</b></p>
          <p>Rotación de activos: <b>{previewAssessment.corporateFinancials.assetTurnover?.toFixed(2) ?? 'No calculable'}</b> · Inventarios: <b>{previewAssessment.corporateFinancials.inventoryTurnover?.toFixed(2) ?? 'No calculable'}</b> · Créditos por ventas: <b>{previewAssessment.corporateFinancials.receivablesTurnover?.toFixed(2) ?? 'No calculable'}</b></p>
          {previewAssessment.corporateFinancials.observations.map(observation => <small key={observation}>{observation}</small>)}
          {previewAssessment.corporateFinancials.sectorObservations.map(observation => <small key={observation}>{observation}</small>)}
        </div>}
        {previewAssessment.corporateEvolution && <div className="prequalRegulatory">
          <h3>Evolución entre balances</h3>
          <p>Tendencia: <b>{({
            improving: 'Favorable', stable: 'Estable', deteriorating: 'Desfavorable',
            'insufficient-data': 'Datos insuficientes',
          } as const)[previewAssessment.corporateEvolution.trend]}</b></p>
          <p>Ventas: <b>{formatChange(previewAssessment.corporateEvolution.salesChange)}</b> · Patrimonio neto: <b>{formatChange(previewAssessment.corporateEvolution.equityChange)}</b> · Resultado neto: <b>{formatChange(previewAssessment.corporateEvolution.netProfitChange)}</b></p>
          <p>Liquidez corriente: <b>{formatChange(previewAssessment.corporateEvolution.currentRatioChange)}</b> · Pasivo/patrimonio: <b>{formatChange(previewAssessment.corporateEvolution.liabilitiesToEquityChange)}</b></p>
          {previewAssessment.corporateEvolution.observations.map(observation => <small key={observation}>{observation}</small>)}
        </div>}
        <small>{incomeDocumentCount ? `Respaldo: ${previewAssessment.confidence} (${incomeDocumentCount} documento(s) de ingresos).` : 'Ingresos declarativos: el informe recomendará solicitar comprobantes.'}</small>
      </div>
      <label><input type="checkbox" checked={contact.dataConsent} onChange={e => setContact({ ...contact, dataConsent: e.target.checked })} /> Autorizo el tratamiento de datos para esta evaluación.</label>
      <label><input type="checkbox" checked={contact.contactConsent} onChange={e => setContact({ ...contact, contactConsent: e.target.checked })} /> Autorizo el contacto sobre este expediente.</label>
      <label><input type="checkbox" checked={contact.accuracyDeclaration} onChange={e => setContact({ ...contact, accuracyDeclaration: e.target.checked })} /> Declaro que los datos son completos y veraces.</label>
      <button className="prequalPrimary" disabled={busy} onClick={saveStage2}>
        {previewAssessment.status === 'compatible' ? 'Calificar y enviar expediente' : 'Recalcular capacidad de pago'}
      </button>
    </div>}
    {stage === 3 && <div className="prequalForm">
      <h3>Precalificación 3 · Validación y cumplimiento UIF</h3>
      {assessment && <div className="prequalCapacity"><b>Resultado económico: {assessment.status} · {assessment.score}/100</b><p>Relación cuota/ingreso: {assessment.installmentToIncomeRatio == null ? 'no estimable' : `${(assessment.installmentToIncomeRatio * 100).toFixed(1)}%`} (política de referencia: 30%).</p><p>Respaldo de ingresos: <b>{assessment.confidence}</b>.</p>{assessment.confidence === 'declarativa' && <p>Los ingresos no tienen comprobantes adjuntos. Deben solicitarse antes de una decisión definitiva.</p>}</div>}
      <p>Estas declaraciones son preliminares. El administrador podrá pedir formularios firmados, certificaciones, identidad, estatuto, autoridades, poderes o garantías antes de enviar a una entidad.</p>
      <label>Condición PEP<select value={compliance.pepStatus} onChange={e => setCompliance({ ...compliance, pepStatus: e.target.value as ComplianceDeclarations['pepStatus'] })}><option value="no">No soy PEP</option><option value="yes">Soy PEP</option><option value="related">Soy familiar/allegado de PEP</option></select></label>
      {compliance.pepStatus !== 'no' && <label>Detalle PEP<textarea value={compliance.pepDetail || ''} onChange={e => setCompliance({ ...compliance, pepDetail: e.target.value })} /></label>}
      <label><input type="checkbox" checked={compliance.obligedSubject} onChange={e => setCompliance({ ...compliance, obligedSubject: e.target.checked })} /> Soy sujeto obligado ante la UIF.</label>
      <label><input type="checkbox" checked={compliance.fundsLawfulOrigin} onChange={e => setCompliance({ ...compliance, fundsLawfulOrigin: e.target.checked })} /> Declaro origen lícito de fondos.</label>
      <label><input type="checkbox" checked={compliance.ownAccount} onChange={e => setCompliance({ ...compliance, ownAccount: e.target.checked })} /> Actúo por cuenta propia; si no, informaré al beneficiario final.</label>
      <label><input type="checkbox" checked={compliance.taxResidenceArgentina} onChange={e => setCompliance({ ...compliance, taxResidenceArgentina: e.target.checked })} /> Residencia fiscal exclusivamente argentina.</label>
      <label><input type="checkbox" checked={compliance.administratorMayRequestEvidence} onChange={e => setCompliance({ ...compliance, administratorMayRequestEvidence: e.target.checked })} /> Acepto que el administrador solicite respaldo si lo considera necesario.</label>
      <div className="prequalEntityDetail">
        <h3>Documentos de validación</h3>
        <p>Son opcionales en esta instancia y el administrador puede solicitarlos cuando corresponda.</p>
        {stage3Requirements[economic.profile].map(([kind, label]) => {
          const uploaded = documents.find(document => document.stage === 3 && document.kind === kind);
          const inputId = `stage-3-${kind}`;
          return <div className="prequalUploadItem" key={kind}>
            <div className="prequalUploadRow">
              <div><b>{label}</b><small>Opcional en esta instancia</small></div>
              <label className="prequalUploadButton" htmlFor={inputId}>Agregar archivo</label>
              <input id={inputId} className="prequalFileInput" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => readFiles(e.target.files, kind)} />
            </div>
            {uploaded && <div className="prequalUploadedFile">✓ Agregado: {uploaded.name}</div>}
          </div>;
        })}
      </div>
      <label>Decisión<select value={decision} onChange={e => setDecision(e.target.value)}>{decisions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Correo donde desea recibir la calificación<input type="email" required value={responseEmail} onChange={e => setResponseEmail(e.target.value)} /></label>
      <button className="prequalPrimary" disabled={busy} onClick={saveStage3}>Cerrar Precalificación 3</button>
    </div>}
    {stage === 4 && <div className="prequalForm">
      <h3>Precalificación 3 completada</h3>
      <p>El expediente quedó listo para revisión administrativa. La respuesta se dirigirá a <b>{responseEmail}</b>.</p>
      <button className="prequalPrimary" disabled={busy} onClick={downloadPdf}>Descargar expediente PDF</button>
      <h3>Configuración del administrador</h3>
      <label>Correo que recibirá los expedientes<input type="email" value={administratorEmail} onChange={e => setAdministratorEmail(e.target.value)} /></label>
      <label>Proveedor de correo<select value={emailProvider} disabled><option value="resend">Resend</option></select></label>
      <button className="prequalSecondary" onClick={async () => { try { await api({ action: 'configuration', administratorEmail, emailProvider }); setMessage('Configuración guardada. Falta conectar las credenciales del proveedor para enviar.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Error'); } }}>Guardar selección</button>
      <h3>Responder al solicitante</h3>
      <label>Mensaje del administrador<textarea value={responseMessage} onChange={e => setResponseMessage(e.target.value)} placeholder="Condiciones o próximos pasos para avanzar." /></label>
      <button className="prequalPrimary" onClick={async () => { try { await api({ action: 'send-result', responseEmail, decision, message: responseMessage, caseNumber: effectiveCaseNumber }); setMessage(`Resultado enviado a ${responseEmail}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Error'); } }}>Enviar resultado</button>
    </div>}
    {message && <div className="prequalNotice">{message}</div>}
  </section>;
}
