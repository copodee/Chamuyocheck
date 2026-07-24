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
    profile: defaultProfile, activity: '', activitySeniorityMonths: 0, declaredMonthlyDebtService: 0,
    proposedMonthlyCanon: 0, employeeNetIncome: 0, monthlySales: [0, 0, 0, 0, 0, 0], declaredOperatingMargin: 0,
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
  const readFiles = async (files: FileList | null) => {
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
          if (economic.profile === 'legal-entity') balanceText += `\n${extractedText}`;
        }
        const documentStage = stage === 3 ? 3 : 2;
        const upload = new FormData();
        upload.append('file', file); upload.append('caseId', props.caseId || ''); upload.append('stage', String(documentStage));
        const uploadResponse = await fetch('/api/prequalification/document', { method: 'POST', headers: { Authorization: `Bearer ${props.session.access_token}` }, body: upload });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.error || 'No se pudo guardar el documento.');
        added.push({ id: crypto.randomUUID(), stage: documentStage, kind: economic.profile, name: file.name, size: file.size, extractedText, storagePath: uploadData.storagePath, status: extractedText ? 'read' : 'uploaded' });
      }
      setDocuments((current) => [...current, ...added]);
      if (balanceText) setBalance(extractBalanceData(balanceText));
      setMessage(`${added.length} documento(s) incorporado(s).`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo leer el archivo.'); }
    setBusy(false);
  };
  const saveStage2 = async () => {
    if (!props.caseId) return setMessage('No se generó el expediente. Repetí la consulta BCRA.');
    setBusy(true); setMessage('');
    try {
      const data = await api({ action: 'stage2', contact, economicInputs: economic, documents, balance });
      setAssessment(data.assessment); setStage(3); setResponseEmail(contact.email);
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
    <h2>Expediente {props.caseNumber || 'pendiente'}</h2>
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
        <label>Antigüedad (meses)<input type="number" value={economic.activitySeniorityMonths} onChange={e => setEconomic({ ...economic, activitySeniorityMonths: Number(e.target.value) })} /></label>
        <label>Servicio mensual de deudas declarado<input type="number" value={economic.declaredMonthlyDebtService} onChange={e => setEconomic({ ...economic, declaredMonthlyDebtService: Number(e.target.value) })} /></label>
        <label>Canon mensual propuesto<input type="number" value={economic.proposedMonthlyCanon} onChange={e => setEconomic({ ...economic, proposedMonthlyCanon: Number(e.target.value) })} /></label>
        {economic.profile === 'employee'
          ? <label>Ingreso neto mensual<input type="number" value={economic.employeeNetIncome} onChange={e => setEconomic({ ...economic, employeeNetIncome: Number(e.target.value) })} /></label>
          : <><label>Promedio ventas/facturación últimos 6 meses<input type="number" onChange={e => setEconomic({ ...economic, monthlySales: Array(6).fill(Number(e.target.value)) })} /></label><label>Margen operativo estimado (%)<input type="number" value={economic.declaredOperatingMargin} onChange={e => setEconomic({ ...economic, declaredOperatingMargin: Number(e.target.value) })} /></label></>}
      </div>
      <label>Documentos útiles
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e => readFiles(e.target.files)} />
        <small>{economic.profile === 'employee' ? 'Últimos 6 recibos de sueldo.' : economic.profile === 'legal-entity' ? 'Últimos 2 balances y detalle de ventas posteriores/deuda. Los balances PDF se leen automáticamente.' : 'Constancia fiscal, facturación de 6 meses y DDJJ ya disponibles. Sin certificaciones nuevas.'}</small>
      </label>
      {!!documents.length && <p>{documents.length} archivo(s): {documents.map(d => d.name).join(', ')}</p>}
      <label><input type="checkbox" checked={contact.dataConsent} onChange={e => setContact({ ...contact, dataConsent: e.target.checked })} /> Autorizo el tratamiento de datos para esta evaluación.</label>
      <label><input type="checkbox" checked={contact.contactConsent} onChange={e => setContact({ ...contact, contactConsent: e.target.checked })} /> Autorizo el contacto sobre este expediente.</label>
      <label><input type="checkbox" checked={contact.accuracyDeclaration} onChange={e => setContact({ ...contact, accuracyDeclaration: e.target.checked })} /> Declaro que los datos son completos y veraces.</label>
      <button className="prequalPrimary" disabled={busy} onClick={saveStage2}>Calcular Precalificación 2</button>
    </div>}
    {stage === 3 && <div className="prequalForm">
      <h3>Precalificación 3 · Validación y cumplimiento UIF</h3>
      {assessment && <div className="prequalCapacity"><b>Resultado económico: {assessment.status} · {assessment.score}/100</b><p>Relación cuota/ingreso: {assessment.installmentToIncomeRatio == null ? 'no estimable' : `${(assessment.installmentToIncomeRatio * 100).toFixed(1)}%`} (política de referencia: 30%).</p></div>}
      <p>Estas declaraciones son preliminares. El administrador podrá pedir formularios firmados, certificaciones, identidad, estatuto, autoridades, poderes o garantías antes de enviar a una entidad.</p>
      <label>Condición PEP<select value={compliance.pepStatus} onChange={e => setCompliance({ ...compliance, pepStatus: e.target.value as ComplianceDeclarations['pepStatus'] })}><option value="no">No soy PEP</option><option value="yes">Soy PEP</option><option value="related">Soy familiar/allegado de PEP</option></select></label>
      {compliance.pepStatus !== 'no' && <label>Detalle PEP<textarea value={compliance.pepDetail || ''} onChange={e => setCompliance({ ...compliance, pepDetail: e.target.value })} /></label>}
      <label><input type="checkbox" checked={compliance.obligedSubject} onChange={e => setCompliance({ ...compliance, obligedSubject: e.target.checked })} /> Soy sujeto obligado ante la UIF.</label>
      <label><input type="checkbox" checked={compliance.fundsLawfulOrigin} onChange={e => setCompliance({ ...compliance, fundsLawfulOrigin: e.target.checked })} /> Declaro origen lícito de fondos.</label>
      <label><input type="checkbox" checked={compliance.ownAccount} onChange={e => setCompliance({ ...compliance, ownAccount: e.target.checked })} /> Actúo por cuenta propia; si no, informaré al beneficiario final.</label>
      <label><input type="checkbox" checked={compliance.taxResidenceArgentina} onChange={e => setCompliance({ ...compliance, taxResidenceArgentina: e.target.checked })} /> Residencia fiscal exclusivamente argentina.</label>
      <label><input type="checkbox" checked={compliance.administratorMayRequestEvidence} onChange={e => setCompliance({ ...compliance, administratorMayRequestEvidence: e.target.checked })} /> Acepto que el administrador solicite respaldo si lo considera necesario.</label>
      <label>Documentos de validación opcionales en esta instancia<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e => readFiles(e.target.files)} /></label>
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
