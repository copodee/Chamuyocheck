'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getPrequalificationSupabaseClient } from '../../src/modules/prequalification/infrastructure/supabase/client';
import type { PrequalificationResult } from '../../src/modules/prequalification/domain/types';
import { allowedTermMonths } from '../../src/modules/prequalification/domain/assetPolicy';
import { PrequalificationStages } from '../../src/modules/prequalification/ui/PrequalificationStages';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const moneyDigits = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const statusLabels = {
  prequalified: '🟢 Precalificado',
  conditional: '🟡 Precalificado con condiciones',
  'manual-review': '🟠 Revisión manual',
  'not-prequalified': '🔴 No precalificado',
};

const documentationByCategory = {
  employee: { label: 'Persona en relación de dependencia', documents: ['Últimos seis recibos de sueldo.', 'Últimas dos declaraciones juradas de Ganancias, si corresponde.', 'Manifestación de bienes o última declaración de Bienes Personales disponible.'] },
  monotributista: { label: 'Monotributista', documents: ['Constancia de inscripción al monotributo.', 'Facturas emitidas durante los últimos seis meses.', 'Detalle de ingresos.', 'Manifestación de bienes disponible.'] },
  'responsable-inscripto': { label: 'Responsable inscripto', documents: ['Constancia de inscripción.', 'Declaraciones juradas de IVA de los últimos seis meses.', 'Última declaración jurada de Ganancias disponible.', 'Detalle actualizado de deudas bancarias y financieras.', 'Manifestación de bienes o Bienes Personales disponible.'] },
  'persona-juridica': { label: 'Persona jurídica', documents: ['Últimos dos balances completos.', 'Detalle mensual de ventas netas de IVA posteriores al último balance.', 'Detalle actualizado de deudas bancarias y financieras.', 'Estatuto o contrato social vigente.', 'Última acta de designación de autoridades.', 'Poder del firmante, si corresponde.', 'Manifestación de bienes o Bienes Personales de los socios, solamente si se requieren garantías adicionales.'] },
} as const;

type DocumentationCategory = keyof typeof documentationByCategory;

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
  const [documentationCategory, setDocumentationCategory] = useState<DocumentationCategory>('employee');
  const [form, setForm] = useState({
    cuit: '',
    clientType: 'persona-juridica',
    assetValue: '',
    advancePercent: '0',
    termMonths: '36',
    assetType: 'automotor-0km',
  });
  const updateForm = (values: Partial<typeof form>) => {
    setForm((current) => {
      const next = { ...current, ...values };
      const allowedTerms = allowedTermMonths(next.clientType, next.assetType);
      if (!allowedTerms.includes(Number(next.termMonths))) next.termMonths = '36';
      return next;
    });
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
    const assetValue = Number(form.assetValue);
    const advancePercent = Number(form.advancePercent || 0);
    const advance = Math.round(assetValue * advancePercent / 100);
    if (!(assetValue > 0)) {
      setError('Ingresá un valor del bien mayor a cero.');
      return;
    }
    if (advance < 0 || advance >= assetValue) {
      setError('El anticipo debe ser menor que el valor del bien.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/prequalification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          ...form,
          assetValue,
          advance,
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
      <a className="prequalBrandLogo" href="/"><img src="/icon.png" alt="" /><span>LEASING SCORING</span></a>
      <div className="prequalEyebrow">PRECALIFICACIÓN CREDITICIA · ACCESO RESTRINGIDO</div>
      <h1>Módulo en preparación</h1>
      <p>La aplicación ya está separada del acceso general. Falta conectar las credenciales del Supabase exclusivo para habilitar los usuarios autorizados por el administrador.</p>
      <a className="prequalSecondary" href="/">Volver a LeasingScoring</a>
    </section></main>;
  }

  if (!session) {
    return <main className="prequalPage"><section className="prequalCard prequalAccess">
      <a className="prequalBrandLogo" href="/"><img src="/icon.png" alt="" /><span>LEASING SCORING</span></a>
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
      <div><a className="prequalBrandLogo" href="/"><img src="/icon.png" alt="" /><span>LEASING SCORING</span></a><span>Precalificación Crediticia</span></div>
      <div className="prequalUser"><span>{session.user.email}</span><button onClick={() => supabase.auth.signOut()}>Salir</button></div>
    </header>
    <section className="prequalIntro">
      <div className="prequalEyebrow">EVALUACIÓN PRELIMINAR</div>
      <h1>¿Conviene avanzar con esta operación?</h1>
      <p>Consultá la Central de Deudores y cheques rechazados del BCRA sin pedir documentación en esta etapa.</p>
      <div className="prequalNotice">No es una aprobación crediticia ni una oferta de financiación.</div>
    </section>
    <section className="prequalCard prequalDocumentationGuide">
      <div>
        <div className="prequalEyebrow">GUÍA PARA EL LEGAJO</div>
        <h2>Documentación por categoría</h2>
        <p>Seleccioná el perfil para saber qué documentación solicitar antes de avanzar con la precalificación.</p>
      </div>
      <label>Categoría de análisis
        <select value={documentationCategory} onChange={(event) => setDocumentationCategory(event.target.value as DocumentationCategory)}>
          {Object.entries(documentationByCategory).map(([value, category]) => <option key={value} value={value}>{category.label}</option>)}
        </select>
      </label>
      <div className="prequalDocumentationList">
        <h3>{documentationByCategory[documentationCategory].label}</h3>
        <ul>{documentationByCategory[documentationCategory].documents.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </section>
    <form onSubmit={prequalify} className="prequalCard prequalForm">
      <div className="prequalGrid">
        <label>CUIT/CUIL<input required inputMode="numeric" placeholder="30-12345678-9" value={form.cuit} onChange={(e) => updateForm({ cuit: e.target.value })} /></label>
        <label>Tipo de cliente<select value={form.clientType} onChange={(e) => updateForm({ clientType: e.target.value })}><option value="persona-juridica">Persona Jurídica</option><option value="persona-humana">Persona Humana</option></select></label>
        <label>Valor del bien<input required type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={form.assetValue} onChange={(e) => updateForm({ assetValue: moneyDigits(e.target.value) })} /><small>{form.assetValue ? money.format(Number(form.assetValue)) : 'Ingresá el importe sin puntos ni comas.'}</small></label>
        <label>Anticipo inicial (opcional)
          <select value={form.advancePercent} onChange={(e) => updateForm({ advancePercent: e.target.value })}>
            <option value="0">Sin anticipo</option>
            {[10, 15, 20, 25, 30, 35, 40, 45, 50].map((value) => <option key={value} value={value}>{value}%</option>)}
          </select>
          <small>{Number(form.advancePercent) > 0 && Number(form.assetValue) > 0
            ? `${money.format(Math.round(Number(form.assetValue) * Number(form.advancePercent) / 100))} de anticipo · ${money.format(Math.round(Number(form.assetValue) * (100 - Number(form.advancePercent)) / 100))} por financiar`
            : 'Seleccioná un porcentaje entre 10% y 50%, o continuá sin anticipo. Podrás mantenerlo, modificarlo o quitarlo en Precalificación 2.'}</small>
        </label>
        <label>Plazo deseado<select value={form.termMonths} onChange={(e) => updateForm({ termMonths: e.target.value })}>{allowedTermMonths(form.clientType, form.assetType).map((value) => <option key={value} value={value}>{value} meses</option>)}</select></label>
        <label>Tipo de bien<select value={form.assetType} onChange={(e) => updateForm({ assetType: e.target.value })}><option value="automotor-0km">Automotor 0 km / rodados</option><option value="maquinaria">Maquinaria</option><option value="equipo">Equipo</option><option value="embarcacion">Embarcación</option><option value="inmueble">Inmueble</option><option value="otro">Otro</option></select></label>
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
        advance: Math.round(Number(form.assetValue) * Number(form.advancePercent || 0) / 100),
        termMonths: Number(form.termMonths),
        assetType: form.assetType,
      }}
    />}
  </div></main>;
}
