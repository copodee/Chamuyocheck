'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getPrequalificationSupabaseClient } from '../../src/modules/prequalification/infrastructure/supabase/client';
import type { PrequalificationResult } from '../../src/modules/prequalification/domain/types';
import { PrequalificationStages } from '../../src/modules/prequalification/ui/PrequalificationStages';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const statusLabels = {
  prequalified: '🟢 Precalificado',
  conditional: '🟡 Precalificado con condiciones',
  'manual-review': '🟠 Revisión manual',
  'not-prequalified': '🔴 No precalificado',
};

type ApiResponse = {
  caseId?: string;
  caseNumber?: string;
  subject: { denomination: string | null; cuitMasked: string };
  result: PrequalificationResult;
  disclaimer: string;
};

export default function PrequalificationPage() {
  const supabase = getPrequalificationSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [form, setForm] = useState({
    cuit: '',
    clientType: 'persona-juridica',
    assetValue: '',
    advance: '',
    termMonths: '36',
    assetType: 'automotor-0km',
  });
  const updateForm = (values: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...values }));
    setResult(null);
    setError('');
  };

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (loginError) setError('Usuario o clave incorrectos, o acceso todavía no autorizado.');
  };

  const prequalify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/prequalification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          ...form,
          assetValue: Number(form.assetValue),
          advance: Number(form.advance || 0),
          termMonths: Number(form.termMonths),
        }),
        signal: AbortSignal.timeout(30000),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'No se pudo completar la consulta.');
        return;
      }
      setResult(payload);
    } catch {
      setError('La consulta demoró demasiado o se interrumpió. Podés volver a intentar.');
    } finally {
      setBusy(false);
    }
  };

  if (loadingSession) return <main className="prequalPage"><div className="prequalCard">Verificando acceso…</div></main>;

  if (!supabase) {
    return <main className="prequalPage"><section className="prequalCard prequalAccess">
      <div className="prequalBrand">✓ LeasingScoring</div>
      <div className="prequalEyebrow">PRECALIFICACIÓN CREDITICIA · ACCESO RESTRINGIDO</div>
      <h1>Módulo en preparación</h1>
      <p>La aplicación ya está separada del acceso general. Falta conectar las credenciales del Supabase exclusivo para habilitar los usuarios autorizados por el administrador.</p>
      <a className="prequalSecondary" href="/">Volver a LeasingScoring</a>
    </section></main>;
  }

  if (!session) {
    return <main className="prequalPage"><section className="prequalCard prequalAccess">
      <div className="prequalBrand">✓ LeasingScoring</div>
      <div className="prequalEyebrow">PRECALIFICACIÓN CREDITICIA · ACCESO RESTRINGIDO</div>
      <h1>Ingresá con tu usuario autorizado</h1>
      <p>No existe registro público. Cada acceso es creado o invitado exclusivamente por un administrador.</p>
      <form onSubmit={login} className="prequalForm">
        <label>Usuario (correo)<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label>Clave<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <div className="prequalError" role="alert">{error}</div>}
        <button className="prequalPrimary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
      <a className="prequalSecondary" href="/">Volver a LeasingScoring</a>
    </section></main>;
  }

  return <main className="prequalPage"><div className="prequalWorkspace">
    <header className="prequalHeader">
      <div><div className="prequalBrand">✓ LeasingScoring</div><span>Precalificación Crediticia</span></div>
      <div className="prequalUser"><span>{session.user.email}</span><button onClick={() => supabase.auth.signOut()}>Salir</button></div>
    </header>
    <section className="prequalIntro">
      <div className="prequalEyebrow">EVALUACIÓN PRELIMINAR</div>
      <h1>¿Conviene avanzar con esta operación?</h1>
      <p>Consultá la Central de Deudores y cheques rechazados del BCRA sin pedir documentación en esta etapa.</p>
      <div className="prequalNotice">No es una aprobación crediticia ni una oferta de financiación.</div>
    </section>
    <form onSubmit={prequalify} className="prequalCard prequalForm">
      <div className="prequalGrid">
        <label>CUIT/CUIL<input required inputMode="numeric" placeholder="30-12345678-9" value={form.cuit} onChange={(e) => updateForm({ cuit: e.target.value })} /></label>
        <label>Tipo de cliente<select value={form.clientType} onChange={(e) => updateForm({ clientType: e.target.value })}><option value="persona-juridica">Persona Jurídica</option><option value="persona-humana">Persona Humana</option></select></label>
        <label>Valor del bien<input required min="1" type="number" inputMode="numeric" placeholder="35000000" value={form.assetValue} onChange={(e) => updateForm({ assetValue: e.target.value })} /></label>
        <label>Anticipo disponible (opcional)<input min="0" type="number" inputMode="numeric" placeholder="0" value={form.advance} onChange={(e) => updateForm({ advance: e.target.value })} /></label>
        <label>Plazo deseado<select value={form.termMonths} onChange={(e) => updateForm({ termMonths: e.target.value })}>{[12, 18, 24, 36, 48, 60, 72, 84].map((value) => <option key={value} value={value}>{value} meses</option>)}</select></label>
        <label>Tipo de bien<select value={form.assetType} onChange={(e) => updateForm({ assetType: e.target.value })}><option value="automotor-0km">Automotor 0 km</option><option value="automotor-usado">Automotor usado / rodado</option><option value="maquinaria">Maquinaria</option><option value="equipo">Equipo</option><option value="inmueble">Inmueble</option><option value="otro">Otro</option></select></label>
      </div>
      {error && <div className="prequalError" role="alert">{error}</div>}
      <button className="prequalPrimary" disabled={busy}>{busy ? 'Consultando BCRA…' : 'Precalificar'}</button>
    </form>
    {result && <section className="prequalCard prequalResult">
      <div className={`prequalStatus status-${result.result.status}`}>{statusLabels[result.result.status]}</div>
      <div><h2>{result.subject.denomination || 'Titular consultado'}</h2><span>{result.subject.cuitMasked}</span></div>
      <div className="prequalMetrics">
        <div><span>Score LeasingScoring</span><b>{result.result.score}/100</b></div>
        <div><span>Situación BCRA actual</span><b>{result.result.currentSituation ?? 'Sin datos'}</b></div>
        <div><span>Máxima situación histórica</span><b>{result.result.maximumSituation ?? 'Sin datos'}</b></div>
        <div><span>Deuda total informada</span><b>{money.format(result.result.totalDebt)}</b></div>
        <div><span>Entidades acreedoras</span><b>{result.result.creditorCount}</b></div>
        <div><span>Riesgo estimado</span><b>{result.result.riskLevel}</b></div>
        <div><span>Nivel de confianza</span><b>{result.result.confidence}</b></div>
        <div><span>Cheques rechazados</span><b>{result.result.rejectedChecks}</b></div>
      </div>
      <div className="prequalCapacity"><h3>Capacidad de pago</h3><p>{result.result.paymentCapacity.explanation}</p><b>Exposición solicitada: {money.format(result.result.paymentCapacity.requestedExposure)}</b></div>
      <div className="prequalEntityDetail">
        <h3>Detalle vigente informado por el BCRA</h3>
        {result.result.currentPositions.length
          ? <div className="prequalTableWrap"><table><thead><tr><th>Entidad</th><th>Período</th><th>Situación</th><th>Deuda informada</th><th>Días de atraso</th><th>Observaciones</th></tr></thead><tbody>
            {result.result.currentPositions.map((position, index) => <tr key={`${position.entity}-${position.period}-${index}`}><td>{position.entity}</td><td>{position.period}</td><td>{position.situation}</td><td>{money.format(position.debtAmount)}</td><td>{position.daysPastDue}</td><td>{position.refinancedOrObserved ? 'Requiere revisión' : 'Sin observaciones críticas informadas'}</td></tr>)}
          </tbody><tfoot><tr><th colSpan={3}>Total</th><th>{money.format(result.result.totalDebt)}</th><th colSpan={2}>{result.result.creditorCount} entidad(es)</th></tr></tfoot></table></div>
          : <p>No se recibieron posiciones vigentes. El historial puede contener deudas de meses anteriores ya canceladas o no informadas en el último período.</p>}
      </div>
      <div className="prequalColumns"><div><h3>Fundamentos</h3><ul>{result.result.reasons.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Condiciones y próximos pasos</h3><ul>{result.result.conditions.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
      <small>{result.disclaimer} · Modelo {result.result.modelVersion}</small>
    </section>}
    {result && <PrequalificationStages
      key={result.caseId || `${form.cuit}-${result.subject.cuitMasked}`}
      session={session}
      caseId={result.caseId}
      caseNumber={result.caseNumber}
      subject={result.subject}
      stage1={result.result}
      clientType={form.clientType}
      requestData={{
        cuit: form.cuit,
        clientType: form.clientType,
        assetValue: Number(form.assetValue),
        advance: Number(form.advance || 0),
        termMonths: Number(form.termMonths),
        assetType: form.assetType,
      }}
    />}
  </div></main>;
}
