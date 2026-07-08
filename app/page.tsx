'use client';
import { useState } from 'react';

type Category = { name: string; score: number; explanation: string };
type FlaggedPhrase = { phrase: string; problem: string; severity: 'Baja' | 'Media' | 'Alta' };
type IntelligenceModule = { id:string; title:string; detected:boolean; risk:number; summary:string; signals:string[]; missingInformation:string[]; questions:string[] };
type FinancialMath = { detected:boolean; amount?:number|null; installment?:number|null; months?:number|null; totalPaid?:number|null; hiddenCost?:number|null; hiddenCostPercent?:number|null; monthlyImpliedRate?:number|null; annualImpliedRate?:number|null; missingFields:string[]; warnings:string[]; questions:string[]; plainEnglish:string };
type PyramidRisk = { detected:boolean; risk:number; level:string; signals:string[]; explanation:string; questions:string[] };
type LegalGuard = { disclaimer:string; prohibitedLanguagePolicy:string; confidence:'Baja'|'Media'|'Alta' };
type Analysis = {
  documentType:string;
  decisionQuestion:string;
  score:number;
  risk:string;
  confidence:string;
  summary:string;
  categoryScores?:Category[];
  modules?:IntelligenceModule[];
  flaggedPhrases?:FlaggedPhrase[];
  issues:string[];
  questions:string[];
  missingInformation?:string[];
  worstReasonableScenario?:string;
  improved:string;
  verdict?:string;
  financialMath?:FinancialMath;
  pyramidRisk?:PyramidRisk;
  legalGuard?:LegalGuard;
};
function ars(n?: number | null) { if (typeof n !== 'number' || !Number.isFinite(n)) return 'No informado'; return '$' + Math.round(n).toLocaleString('es-AR'); }
function severityClass(severity?: string) { if (severity === 'Alta') return 'sev alta'; if (severity === 'Baja') return 'sev baja'; return 'sev media'; }
function tone(score:number){ if(score>=80) return 'danger'; if(score>=60) return 'warn'; if(score>=35) return 'mid'; return 'safe'; }
export default function Home(){
  const [text,setText]=useState('');
  const [loading,setLoading]=useState(false);
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const [error,setError]=useState('');
  async function analyze(){
    setLoading(true); setError(''); setAnalysis(null);
    try{
      const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error||'No se pudo analizar');
      setAnalysis(j);
    } catch(e:any){ setError(e.message); }
    finally{ setLoading(false); }
  }
  async function pay(){
    const r=await fetch('/api/checkout',{method:'POST'});
    const j=await r.json();
    if(j.url) location.href=j.url; else alert(j.error||'No se pudo iniciar el pago');
  }
  return <main className="wrap">
    <nav className="nav"><div className="brand">Chamuyo<span className="gradient">Check</span></div><a className="pill" href="#analizar">Probar gratis</a></nav>
    <section className="hero">
      <div>
        <span className="badge">Sistema inteligente de auditoría de credibilidad</span>
        <h1 className="h1">La IA que detecta el chamuyo <span className="gradient">sin acusar: audita, calcula y pregunta.</span></h1>
        <p className="lead">V4 analiza textos comerciales, préstamos, inversiones, referidos, cursos, discursos y contratos. No dice “esto es mentira”: mide respaldo, transparencia, riesgo, costos ocultos e información faltante.</p>
        <div className="cta"><a className="btn" href="#analizar">Ayudame a decidir</a><button onClick={pay} className="btn secondary">Pasarme a Pro</button></div>
        <div className="trust"><span>✓ Resguardo legal</span><span>✓ Cálculo financiero</span><span>✓ Radar piramidal</span><span>✓ Peor escenario razonable</span></div>
      </div>
      <div id="analizar" className="card">
        <p className="small">Pegá el texto a revisar</p>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Ej: Préstamo de $1.000.000 en 24 cuotas de $95.000. Aprobación inmediata. Oportunidad con ingresos pasivos y bonos por referidos..." />
        <div className="cta"><button className="btn" onClick={analyze} disabled={loading||text.length<20}>{loading?'Analizando...':'Ayudame a decidir'}</button><span className="small">Mínimo 20 caracteres</span></div>
        {error && <p style={{color:'#ff4976'}}>{error}</p>}
        {analysis && <div className="result" style={{display:'block'}}>
          <div className="resultTop"><div><p className="small">Tipo detectado</p><h3>{analysis.documentType}</h3></div><div className={`score ${tone(analysis.score)}`}>{analysis.score}/100</div></div>
          <div className="bar"><span style={{width:`${analysis.score}%`}} /></div>
          <div className="metrics"><div><span>Riesgo</span><b>{analysis.risk}</b></div><div><span>Confianza</span><b>{analysis.confidence}</b></div><div><span>Pregunta central</span><b>{analysis.decisionQuestion}</b></div></div>
          <p>{analysis.summary}</p>
          {analysis.verdict && <p className="verdict"><b>Conclusión prudente:</b> {analysis.verdict}</p>}
          {analysis.financialMath?.detected ? <div className="financeBox"><h3>Inteligencia matemática financiera</h3><p>{analysis.financialMath.plainEnglish}</p><div className="financeGrid"><div><span>Monto publicado</span><b>{ars(analysis.financialMath.amount)}</b></div><div><span>Cuota</span><b>{ars(analysis.financialMath.installment)}</b></div><div><span>Plazo</span><b>{analysis.financialMath.months ? `${analysis.financialMath.months} meses` : 'No informado'}</b></div><div><span>Total a pagar</span><b>{ars(analysis.financialMath.totalPaid)}</b></div><div><span>Costo sobre capital</span><b>{ars(analysis.financialMath.hiddenCost)}</b></div><div><span>Tasa implícita estimada</span><b>{analysis.financialMath.monthlyImpliedRate ? `${analysis.financialMath.monthlyImpliedRate}% mensual` : 'No calculable'}</b></div></div>{analysis.financialMath.missingFields?.length ? <p className="small"><b>Datos que faltan:</b> {analysis.financialMath.missingFields.join(', ')}</p> : null}</div> : null}
          {analysis.pyramidRisk?.detected ? <div className="pyramidBox"><h3>Radar de esquemas piramidales / Ponzi / referidos</h3><div className="riskLine"><b>Riesgo estimado:</b><span>{analysis.pyramidRisk.level} · {analysis.pyramidRisk.risk}/100</span></div><p>{analysis.pyramidRisk.explanation}</p><ul>{analysis.pyramidRisk.signals.map((x,i)=><li key={i}>{x}</li>)}</ul></div> : null}
          {analysis.categoryScores?.length ? <><h3>Índices de auditoría</h3><div className="miniGrid">{analysis.categoryScores.map((c,i)=><div className="mini" key={i}><div className="miniTop"><b>{c.name}</b><span>{c.score}/100</span></div><div className="miniBar"><span style={{width:`${c.score}%`}} /></div><p className="small">{c.explanation}</p></div>)}</div></> : null}
          {analysis.modules?.length ? <><h3>Comité de análisis</h3><div className="moduleGrid">{analysis.modules.map((m,i)=><div className="module" key={i}><div className="miniTop"><b>{m.title}</b><span>{m.risk}/100</span></div><p>{m.summary}</p>{m.signals?.length ? <ul>{m.signals.slice(0,3).map((x,j)=><li key={j}>{x}</li>)}</ul> : null}</div>)}</div></> : null}
          {analysis.flaggedPhrases?.length ? <><h3>Frases bajo sospecha</h3><div className="phrases">{analysis.flaggedPhrases.map((f,i)=><div className="phrase" key={i}><span className={severityClass(f.severity)}>{f.severity}</span><p><b>“{f.phrase}”</b></p><p className="small">{f.problem}</p></div>)}</div></> : null}
          <h3>Alertas principales</h3><ul>{analysis.issues.map((x,i)=><li key={i}>{x}</li>)}</ul>
          {analysis.missingInformation?.length ? <><h3>Información faltante</h3><ul>{analysis.missingInformation.map((x,i)=><li key={i}>{x}</li>)}</ul></> : null}
          <h3>Preguntas para decidir mejor</h3><ul>{analysis.questions.map((x,i)=><li key={i}>{x}</li>)}</ul>
          {analysis.worstReasonableScenario && <><h3>Peor escenario razonable</h3><p>{analysis.worstReasonableScenario}</p></>}
          <h3>Versión más transparente</h3><p>{analysis.improved}</p>
          {analysis.legalGuard && <div className="legal"><h3>Resguardo legal del análisis</h3><p>{analysis.legalGuard.disclaimer}</p><p className="small">{analysis.legalGuard.prohibitedLanguagePolicy}</p></div>}
        </div>}
      </div>
    </section>
    <section className="grid"><div className="feature"><h3>Auditoría, no acusación</h3><p className="small">Evalúa respaldo e información faltante sin afirmar que alguien miente.</p></div><div className="feature"><h3>Chamuyo financiero</h3><p className="small">Calcula costo visible, tasa implícita y datos omitidos en préstamos y cuotas.</p></div><div className="feature"><h3>Radar piramidal</h3><p className="small">Detecta señales de referidos, ingresos pasivos y rentabilidad garantizada con lenguaje prudente.</p></div><div className="feature"><h3>Ayuda a decidir</h3><p className="small">Genera preguntas críticas y peor escenario razonable.</p></div></section>
    <section className="section pricing"><div className="card"><h2>Gratis</h2><p className="price">$0</p><p className="small">Para probar análisis básicos.</p></div><div className="card"><h2>Pro</h2><p className="price">${process.env.NEXT_PUBLIC_PRO_PRICE || '6.900'} ARS</p><p className="small">Análisis extendidos, reportes y más capacidad.</p><button onClick={pay} className="btn">Pagar con Mercado Pago</button></div></section>
  </main>
}
