'use client';
import { useState } from 'react';

type Category = { name: string; score: number; explanation: string };
type FlaggedPhrase = { phrase: string; problem: string; severity: 'Baja' | 'Media' | 'Alta' };
type FinancialMath = {
  detected:boolean;
  amount?:number|null;
  installment?:number|null;
  months?:number|null;
  totalPaid?:number|null;
  hiddenCost?:number|null;
  hiddenCostPercent?:number|null;
  monthlyImpliedRate?:number|null;
  annualImpliedRate?:number|null;
  missingFields:string[];
  warnings:string[];
  questions:string[];
  plainEnglish:string;
};
type Analysis = {
  score:number;
  risk:string;
  summary:string;
  categoryScores?:Category[];
  flaggedPhrases?:FlaggedPhrase[];
  issues:string[];
  questions:string[];
  improved:string;
  verdict?:string;
  financialMath?:FinancialMath;
};

function ars(n?: number | null) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'No informado';
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function severityClass(severity?: string) {
  if (severity === 'Alta') return 'sev alta';
  if (severity === 'Baja') return 'sev baja';
  return 'sev media';
}

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
    if(j.url) location.href=j.url;
    else alert(j.error||'No se pudo iniciar el pago');
  }

  return <main className="wrap">
    <nav className="nav">
      <div className="brand">Chamuyo<span className="gradient">Check</span></div>
      <a className="pill" href="#analizar">Probar gratis</a>
    </nav>

    <section className="hero">
      <div>
        <span className="badge">La IA que detecta el chamuyo</span>
        <h1 className="h1">Antes de creerlo, <span className="gradient">pasalo por el detector.</span></h1>
        <p className="lead">Pegá una propuesta, discurso, posteo, landing, email o promesa comercial. ChamuyoCheck marca humo, exageraciones, manipulación emocional y frases sin sustento.</p>
        <div className="cta"><a className="btn" href="#analizar">Analizar texto</a><button onClick={pay} className="btn secondary">Pasarme a Pro</button></div>
      </div>

      <div id="analizar" className="card">
        <p className="small">Pegá el texto a revisar</p>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Ej: Préstamo de $1.000.000 en 24 cuotas de $95.000. Sin vueltas, aprobación inmediata..." />
        <div className="cta"><button className="btn" onClick={analyze} disabled={loading||text.length<20}>{loading?'Analizando...':'Analizar chamuyo'}</button><span className="small">Mínimo 20 caracteres</span></div>
        {error && <p style={{color:'#ff4976'}}>{error}</p>}

        {analysis && <div className="result" style={{display:'block'}}>
          <div className="score">{analysis.score}/100</div>
          <div className="bar"><span style={{width:`${analysis.score}%`}} /></div>
          <p><b>Riesgo:</b> {analysis.risk}</p>
          <p>{analysis.summary}</p>
          {analysis.verdict && <p className="verdict"><b>Veredicto:</b> {analysis.verdict}</p>}

          {analysis.financialMath?.detected ? <div className="financeBox">
            <h3>Inteligencia matemática financiera</h3>
            <p>{analysis.financialMath.plainEnglish}</p>
            <div className="financeGrid">
              <div><span>Monto publicado</span><b>{ars(analysis.financialMath.amount)}</b></div>
              <div><span>Cuota</span><b>{ars(analysis.financialMath.installment)}</b></div>
              <div><span>Plazo</span><b>{analysis.financialMath.months ? `${analysis.financialMath.months} meses` : 'No informado'}</b></div>
              <div><span>Total a pagar</span><b>{ars(analysis.financialMath.totalPaid)}</b></div>
              <div><span>Costo sobre capital</span><b>{ars(analysis.financialMath.hiddenCost)}</b></div>
              <div><span>Tasa implícita estimada</span><b>{analysis.financialMath.monthlyImpliedRate ? `${analysis.financialMath.monthlyImpliedRate}% mensual` : 'No calculable'}</b></div>
            </div>
            {analysis.financialMath.missingFields?.length ? <p className="small"><b>Datos que faltan:</b> {analysis.financialMath.missingFields.join(', ')}</p> : null}
          </div> : null}

          {analysis.categoryScores?.length ? <>
            <h3>Mapa de chamuyo</h3>
            <div className="miniGrid">
              {analysis.categoryScores.map((c,i)=><div className="mini" key={i}>
                <div className="miniTop"><b>{c.name}</b><span>{c.score}/100</span></div>
                <div className="miniBar"><span style={{width:`${c.score}%`}} /></div>
                <p className="small">{c.explanation}</p>
              </div>)}
            </div>
          </> : null}

          {analysis.flaggedPhrases?.length ? <>
            <h3>Frases bajo sospecha</h3>
            <div className="phrases">
              {analysis.flaggedPhrases.map((f,i)=><div className="phrase" key={i}>
                <span className={severityClass(f.severity)}>{f.severity}</span>
                <p><b>“{f.phrase}”</b></p>
                <p className="small">{f.problem}</p>
              </div>)}
            </div>
          </> : null}

          <h3>Alertas principales</h3>
          <ul>{analysis.issues.map((x,i)=><li key={i}>{x}</li>)}</ul>
          <h3>Preguntas para desafiarlo</h3>
          <ul>{analysis.questions.map((x,i)=><li key={i}>{x}</li>)}</ul>
          <h3>Versión más honesta</h3>
          <p>{analysis.improved}</p>
        </div>}
      </div>
    </section>

    <section className="grid">
      <div className="feature"><h3>Promesas vacías</h3><p className="small">Detecta resultados garantizados, cifras sin fuente y claims exagerados.</p></div>
      <div className="feature"><h3>Manipulación emocional</h3><p className="small">Marca presión, urgencia artificial y miedo a quedarse afuera.</p></div>
      <div className="feature"><h3>Preguntas incómodas</h3><p className="small">Genera preguntas concretas para pedir evidencia antes de comprar.</p></div>
      <div className="feature"><h3>Chamuyo financiero</h3><p className="small">Detecta préstamos, cuotas, tasas omitidas, CFT ausente y calcula el costo real cuando hay datos.</p></div>
    </section>

    <section className="section pricing">
      <div className="card"><h2>Gratis</h2><p className="price">$0</p><p className="small">Para probar análisis básicos.</p></div>
      <div className="card"><h2>Pro</h2><p className="price">${process.env.NEXT_PUBLIC_PRO_PRICE || '6.900'} ARS</p><p className="small">Análisis extendidos, reportes y más capacidad.</p><button onClick={pay} className="btn">Pagar con Mercado Pago</button></div>
    </section>
  </main>
}
