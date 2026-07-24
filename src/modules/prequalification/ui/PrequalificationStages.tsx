'use client';

import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { extractPdfTextInBrowser } from '../../../lib/extractors/browserPdfOcr';
import { extractBalanceData } from '../scoring/balanceExtractor';
import type { ComplianceDeclarations, ContactData, DossierDocument, EconomicAssessment, EconomicInputs, EconomicProfile, ExtractedBalance } from '../domain/dossier';
import type { PrequalificationResult } from '../domain/types';

type Props = {
  session: Session;
  caseId?: string;
  caseNumber?: string;
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

const stage2Requirements: Record<EconomicProfile, Array<[string, string, boolean]>> = {
  employee: [
    ['salary-slip-1', 'Recibo de sueldo 1', false], ['salary-slip-2', 'Recibo de sueldo 2', false],
    ['salary-slip-3', 'Recibo de sueldo 3', false], ['salary-slip-4', 'Recibo de sueldo 4', false],
    ['salary-slip-5', 'Recibo de sueldo 5', false], ['salary-slip-6', 'Recibo de sueldo 6', false],
    ['income-tax', 'Última DDJJ de Ganancias disponible', false], ['personal-assets', 'Manifestación de bienes o DDJJ de Bienes Personales disponible', false],
  ],
  monotributista: [
    ['monotributo-proof', 'Constancia de monotributo', true],
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
    ['signer-power', 'Poder del firmante', false], ['partners-assets', 'Bienes Personales o manifestación de socios, si se solicita', false],
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

export function PrequalificationStages(props: Props) {
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState<DossierDocument[]>([]);
  const [balance, setBalance] = useState<ExtractedBalance>();
  const [assessment, setAssessment] = useState<EconomicAssessment>();
  const [contact, setContact] = useState<ContactData>({
    fullName: props.subject.denomination || '', address: '', city: '', province: '', email: '', mobile: '',
    preferredChannel: 'email', dataConsent: false, contactConsent: false, accuracyDeclaration: false,
  });
  const defaultProfile: EconomicProfile = props.clientType === 'persona-juridica' ? 'legal-entity' : 'employee';
  const [economic, setEconomic] = useState<EconomicInputs>({
    profile: defaultProfile, activity: '', activityCategory: 'other', activitySeniorityMonths: 0, declaredMonthlyDebtService: 0,
    proposedMonthlyCanon: 0, employeeNetIncome: 0, hasEmploymentIncome: false,
    additionalEmploymentNetIncome: 0, monthlySales: [0, 0, 0, 0, 0, 0], declaredOperatingMargin: 0,
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

  const api = async (payload: object) => {
    const response = await fetch('/api/prequalification/case', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${props.session.access_token}` },
      body: JSON.stringify({ caseId: props.caseId, ...payload }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el expediente.');
    return data;
  };
  const readFiles = async (files: FileList | null, documentKind: string) => {
    if (!files) return;
    setBusy(true); setMessage('Leyendo documentos…');
    const added: DossierDocument[] = [];
    let balanceText = '';
    try {
      for (const file of Array.from(files)) {
        let extractedText = '';
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const extraction = await extractPdfTextInBrowser(file, (progress) => setMessage(`Leyendo página ${progress.page} de ${progress.totalPages}…`));
          extractedText = extraction.text;
          if (economic.profile === 'legal-entity' && documentKind.startsWith('balance-')) balanceText += `\n${extractedText}`;
        }
        const documentStage = stage === 3 ? 3 : 2;
        const upload = new FormData();
        upload.append('file', file); upload.append('caseId', props.caseId || ''); upload.append('stage', String(documentStage));
        const uploadResponse = await fetch('/api/prequalification/document', { method: 'POST', headers: { Authorization: `Bearer ${props.session.access_token}` }, body: upload });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.error || 'No se pudo guardar el documento.');
        added.push({ id: crypto.randomUUID(), stage: documentStage, kind: documentKind, name: file.name, size: file.size, extractedText, storagePath: uploadData.storagePath, status: extractedText ? 'read' : 'uploaded' });
      }
      setDocuments((current) => {
        const allowsSeveral = documentKind.startsWith('monotributo-invoices-');
        return [
          ...current.filter(document => allowsSeveral || !added.some(next => next.stage === document.stage && next.kind === document.kind)),
          ...added,
        ];
      });
      if (balanceText) setBalance(extractBalanceData(balanceText));
      setMessage(`${added.length} documento(s) incorporado(s).`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo leer el archivo.'); }
    setBusy(false);
  };
  const saveStage2 = async () => {
    if (!props.caseId) return setMessage('No se generó el expediente. Repetí la consulta BCRA.');
    const applicableRequirements = [
      ...stage2Requirements[economic.profile],
      ...(economic.profile !== 'employee' && economic.hasEmploymentIncome ? employmentSlipRequirements : []),
    ];
    const missingDocuments = applicableRequirements
      .filter(([, , required]) => required)
      .filter(([kind]) => !documents.some(document => document.stage === 2 && document.kind === kind))
      .map(([, label]) => label);
    if (missingDocuments.length && !props.caseNumber?.startsWith('DEMO-')) {
      return setMessage(`Falta agregar: ${missingDocuments.join(', ')}.`);
    }
    setBusy(true); setMessage('');
    try {
      const data = await api({
        action: 'stage2', contact, economicInputs: economic, documents, balance,
        caseNumber: props.caseNumber, subject: props.subject.denomination,
      });
      setAssessment(data.assessment); setStage(3); setResponseEmail(contact.email);
      setMessage(data.notification?.sent
        ? `Expediente ${props.caseNumber} generado y enviado a contacto@leasingscoring.com.`
        : `Expediente ${props.caseNumber} generado. No se pudo enviar la notificación.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Error'); }
    setBusy(false);
  };
  const saveStage3 = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await api({ action: 'stage3', compliance, decision, responseEmail, documents, caseNumber: props.caseNumber, subject: props.subject.denomination });
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
      body: JSON.stringify({ caseNumber: props.caseNumber, subject: props.subject.denomination, cuitMasked: props.subject.cuitMasked, stage1: props.stage1, contact, economic: assessment, compliance, decision, responseEmail }),
    });
    if (response.ok) {
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${props.caseNumber}.pdf`; anchor.click(); URL.revokeObjectURL(url);
    } else setMessage('No se pudo generar el PDF.');
    setBusy(false);
  };

  return <section className="prequalCard prequalResult">
    <h2>{stage === 1 || stage === 2 ? 'Evaluación preliminar' : `Expediente ${props.caseNumber || 'pendiente'}`}</h2>
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
        <label>Antigüedad (meses)<input type="text" inputMode="numeric" value={economic.activitySeniorityMonths || ''} onChange={e => setEconomic({ ...economic, activitySeniorityMonths: Number(e.target.value.replace(/\D/g, '')) })} /></label>
        <label>Servicio mensual de deudas declarado<input type="number" value={economic.declaredMonthlyDebtService} onChange={e => setEconomic({ ...economic, declaredMonthlyDebtService: Number(e.target.value) })} /></label>
        <label>Canon mensual propuesto<input type="text" inputMode="numeric" value={economic.proposedMonthlyCanon || ''} onChange={e => setEconomic({ ...economic, proposedMonthlyCanon: Number(e.target.value.replace(/\D/g, '')) })} /></label>
        {economic.profile === 'employee'
          ? <label>Ingreso neto mensual declarado<input type="number" value={economic.employeeNetIncome} onChange={e => setEconomic({ ...economic, employeeNetIncome: Number(e.target.value) })} /><small>Podés informarlo ahora y adjuntar recibos voluntariamente.</small></label>
          : <><label>Facturación promedio mensual declarada<input type="number" onChange={e => setEconomic({ ...economic, monthlySales: Array(6).fill(Number(e.target.value)) })} /><small>Podés ingresar un promedio o adjuntar las facturas de cada mes, o ambas cosas.</small></label>
            {economic.profile === 'monotributista'
              ? <label>Tipo de actividad<select value={economic.activityCategory} onChange={e => setEconomic({ ...economic, activityCategory: e.target.value as EconomicInputs['activityCategory'] })}>
                <option value="professional-services">Servicios profesionales</option>
                <option value="other-services">Otros servicios</option>
                <option value="commerce">Comercio</option>
                <option value="production">Producción / elaboración</option>
                <option value="transport">Transporte</option>
                <option value="other">Otra actividad</option>
              </select><small>LeasingScoring aplicará automáticamente un coeficiente prudencial; no necesitás conocer tu margen.</small></label>
              : <label>Margen operativo estimado (%)<input type="number" value={economic.declaredOperatingMargin} onChange={e => setEconomic({ ...economic, declaredOperatingMargin: Number(e.target.value) })} /></label>}
          </>}
        {economic.profile !== 'employee' && <label>
          <input type="checkbox" checked={!!economic.hasEmploymentIncome} onChange={e => setEconomic({ ...economic, hasEmploymentIncome: e.target.checked, additionalEmploymentNetIncome: e.target.checked ? economic.additionalEmploymentNetIncome : 0 })} />
          También trabaja en relación de dependencia
        </label>}
        {economic.profile !== 'employee' && economic.hasEmploymentIncome && <label>Ingreso neto mensual por relación de dependencia
          <input type="text" inputMode="numeric" value={economic.additionalEmploymentNetIncome || ''} onChange={e => setEconomic({ ...economic, additionalEmploymentNetIncome: Number(e.target.value.replace(/\D/g, '')) })} />
        </label>}
      </div>
      <div className="prequalEntityDetail">
        <h3>Documentación económica</h3>
        <p>Los comprobantes de ingresos son voluntarios en esta etapa. Sin ellos, el resultado se identificará como declarativo y recomendará pedir respaldo antes de avanzar.</p>
        {[
          ...stage2Requirements[economic.profile],
          ...(economic.profile !== 'employee' && economic.hasEmploymentIncome ? employmentSlipRequirements : []),
        ].map(([kind, label, required]) => {
          const uploaded = documents.filter(document => document.stage === 2 && document.kind === kind);
          const allowsSeveral = kind.startsWith('monotributo-invoices-');
          return <label key={kind}>{label} {required ? <b>· requerido</b> : <small>· opcional</small>}
            <input type="file" multiple={allowsSeveral} accept=".pdf,.jpg,.jpeg,.png" onChange={e => readFiles(e.target.files, kind)} />
            {!!uploaded.length && <small>✓ {uploaded.length} archivo(s): {uploaded.map(document => document.name).join(', ')}</small>}
          </label>;
        })}
      </div>
      <label><input type="checkbox" checked={contact.dataConsent} onChange={e => setContact({ ...contact, dataConsent: e.target.checked })} /> Autorizo el tratamiento de datos para esta evaluación.</label>
      <label><input type="checkbox" checked={contact.contactConsent} onChange={e => setContact({ ...contact, contactConsent: e.target.checked })} /> Autorizo el contacto sobre este expediente.</label>
      <label><input type="checkbox" checked={contact.accuracyDeclaration} onChange={e => setContact({ ...contact, accuracyDeclaration: e.target.checked })} /> Declaro que los datos son completos y veraces.</label>
      <button className="prequalPrimary" disabled={busy} onClick={saveStage2}>Finalizar Precalificación 2 y generar expediente</button>
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
          return <label key={kind}>{label}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => readFiles(e.target.files, kind)} />
            {uploaded && <small>✓ Agregado: {uploaded.name}</small>}
          </label>;
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
      <button className="prequalPrimary" onClick={async () => { try { await api({ action: 'send-result', responseEmail, decision, message: responseMessage, caseNumber: props.caseNumber }); setMessage(`Resultado enviado a ${responseEmail}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Error'); } }}>Enviar resultado</button>
    </div>}
    {message && <div className="prequalNotice">{message}</div>}
  </section>;
}
