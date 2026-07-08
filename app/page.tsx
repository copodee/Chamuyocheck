
'use client';
import {useRef,useState} from 'react';

type Cat={name:string;score:number;explanation:string};
type Analysis={score:number;risk:string;confidence:string;detectedTheme:string;detectedInput:string;centralQuestion:string;summary:string;prudentConclusion:string;verdict:string;categoryScores:Cat[];modules:Cat[];flaggedPhrases:{phrase:string;problem:string;severity:string}[];issues:string[];questions:string[];missingInformation:string[];worstCase:string;improved:string;legalSafeguard:string};

function Bar({score}:{score:number}){return <div className="bar"><div className="fill" style={{['--w' as any]:`${Math.max(0,Math.min(100,score||0))}%`}}/></div>}
function Card({c}:{c:Cat}){return <div className="card"><div className="cardTop"><h3>{c.name}</h3><b>{Math.round(c.score)}/100</b></div><Bar score={c.score}/><p>{c.explanation}</p></div>}

export default function Page(){
 const [inputType,setInputType]=useState('Texto');
 const [text,setText]=useState('Garantizamos que con nuestro curso online te harás millonario en 1 semana sin esfuerzo.');
 const [url,setUrl]=useState('');
 const [files,setFiles]=useState<{name:string,type:string,size:number}[]>([]);
 const [drag,setDrag]=useState(false);
 const [loading,setLoading]=useState(false);
 const [steps,setSteps]=useState<string[]>([]);
 const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const fileRef=useRef<HTMLInputElement|null>(null);
 const inputTypes=['Texto','PDF','Imagen','Web','YouTube'];

 function onFiles(list:FileList|null){if(!list)return;setFiles(prev=>[...prev,...Array.from(list).map(f=>({name:f.name,type:f.type||'archivo',size:f.size}))].slice(0,8))}
 async function analyze(){
  setLoading(true);setAnalysis(null);setSteps([]);
  const seq=['Detectando formato','Identificando temática','Seleccionando módulos','Evaluando evidencia','Calculando riesgos','Generando informe prudente'];
  for(const s of seq){setSteps(p=>[...p,'✓ '+s]); await new Promise(r=>setTimeout(r,170))}
  try{
   const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,url,files,inputType})});
   const data=await res.json(); if(!res.ok) throw new Error(data.error||'Error');
   setAnalysis(data);
   setTimeout(()=>document.getElementById('resultado')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
  }catch(e:any){alert(e.message||'No se pudo analizar')}finally{setLoading(false)}
 }
 return <main className="wrap">
  <nav className="top">
   <div className="logo">Chamuyo<span>Check</span></div>
   <div className="topBtns"><a className="pill" href="#resultado">Ver análisis</a><button className="ghost">Pasarme a Pro</button></div>
  </nav>

  <section className="hero">
   <div>
    <div className="badge">Auditor inteligente de credibilidad</div>
    <h1>Detecta el chamuyo <span className="grad">sin acusar.</span></h1>
    <p className="lead">Pegá cualquier contenido. ChamuyoCheck identifica automáticamente de qué se trata y aplica el análisis adecuado: evidencia, manipulación, costos ocultos, plagio, IA académica, salud, finanzas, inversiones, contratos y más.</p>
    <div className="features">
     <span className="chip">📄 PDF</span><span className="chip">📷 Capturas</span><span className="chip">🌐 Web</span><span className="chip">▶ YouTube</span><span className="chip">🤖 IA académica</span><span className="chip">📊 Riesgo</span><span className="chip">⚖️ Resguardo legal</span>
    </div>
   </div>

   <div className="panel">
    <div className="modeRow">{inputTypes.map(x=><button key={x} onClick={()=>setInputType(x)} className={`mode ${inputType===x?'active':''}`}>{x}</button>)}</div>

    {(inputType==='Web'||inputType==='YouTube')&&<input className="urlInput" value={url} onChange={e=>setUrl(e.target.value)} placeholder={inputType==='YouTube'?'Pegá el link de YouTube y, si podés, la transcripción':'Pegá el enlace de la página y, si podés, el texto visible'}/>}

    <div className={`drop ${drag?'drag':''}`} onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);onFiles(e.dataTransfer.files)}}>
     <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt,.doc,.docx" style={{display:'none'}} onChange={e=>onFiles(e.target.files)}/>
     <b>Pegá o arrastrá cualquier contenido</b>
     <p>Texto · PDF · imágenes · capturas · páginas web · videos de YouTube. La temática se detecta automáticamente.</p>
     {!!files.length&&<div className="files">{files.map((f,i)=><span className="file" key={i}>{f.name}</span>)}</div>}
    </div>

    <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Pegá acá el contenido a analizar. No hace falta elegir si es salud, finanzas, educación, inversión o contrato: ChamuyoCheck lo detecta solo."/>
    <div className="ctaRow"><button className="primary" onClick={analyze} disabled={loading}>{loading?'Analizando':'Analizar'}</button><span className="hint">Un solo botón. La IA decide qué módulos aplicar.</span></div>
    {loading&&<div className="loadingBox">{steps.map((s,i)=><p key={i}>{s}</p>)}</div>}
   </div>
  </section>

  {analysis&&<section id="resultado" className="result">
   <div className="scoreCard">
    <p className="hint">Tema detectado</p>
    <h2>{analysis.detectedTheme}</h2>
    <div className="score">{analysis.score}/100</div>
    <Bar score={analysis.score}/>
    <div className="kpis"><div className="kpi"><small>Riesgo</small><b>{analysis.risk}</b></div><div className="kpi"><small>Confianza</small><b>{analysis.confidence}</b></div><div className="kpi"><small>Entrada</small><b>{analysis.detectedInput}</b></div></div>
    <p>{analysis.summary}</p>
    <div className="notice"><b>Conclusión prudente:</b> {analysis.prudentConclusion}</div>
   </div>
   <div className="report">
    <div className="section wide"><h2>Pregunta central</h2><p>{analysis.centralQuestion}</p><p>{analysis.verdict}</p></div>
    <div className="section wide"><h2>Módulos activados automáticamente</h2><div className="cards">{analysis.modules.map((c,i)=><Card c={c} key={i}/>)}</div></div>
    <div className="section wide"><h2>Índices de auditoría</h2><div className="cards">{analysis.categoryScores.map((c,i)=><Card c={c} key={i}/>)}</div></div>
    <div className="section"><h2>Alertas</h2><ul>{analysis.issues.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Información faltante</h2><ul>{analysis.missingInformation.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
    <div className="section"><h2>Preguntas para decidir mejor</h2><ul>{analysis.questions.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Peor escenario razonable</h2><p>{analysis.worstCase}</p></div>
    <div className="section wide"><h2>Frases bajo sospecha</h2>{analysis.flaggedPhrases?.length?analysis.flaggedPhrases.map((f,i)=><div className="card" key={i}><span className="chip">{f.severity}</span><h3>“{f.phrase}”</h3><p>{f.problem}</p></div>):<p>No se detectaron frases críticas específicas.</p>}</div>
    <div className="section wide"><h2>Versión más transparente</h2><p>{analysis.improved}</p></div>
    <div className="section wide"><h2>Resguardo legal</h2><div className="notice"><p>{analysis.legalSafeguard}</p><p>El sistema debe evitar afirmaciones categóricas como “es estafa”, “miente”, “es fraude”, “es plagio” o “fue hecho con IA” salvo prueba suficiente.</p></div></div>
   </div>
  </section>}
  <footer className="footer">ChamuyoCheck V7 · Diseñado como base para app móvil y futura suscripción.</footer>
 </main>
}
