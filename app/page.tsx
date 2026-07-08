
'use client';
import {useEffect,useRef,useState} from 'react';
type Cat={name:string;score:number;explanation:string};
type Analysis={score:number;risk:string;confidence:string;detectedTheme:string;detectedInput:string;centralQuestion:string;summary:string;prudentConclusion:string;verdict:string;categoryScores:Cat[];modules:Cat[];flaggedPhrases:{phrase:string;problem:string;severity:string}[];issues:string[];questions:string[];missingInformation:string[];worstCase:string;improved:string;legalSafeguard:string};
const FREE_LIMIT=3; const FREE_CHARS=250;
function Bar({score}:{score:number}){return <div className="bar"><div className="fill" style={{['--w' as any]:`${Math.max(0,Math.min(100,score||0))}%`}}/></div>}
function Card({c}:{c:Cat}){return <div className="card"><div className="cardTop"><h3>{c.name}</h3><b>{Math.round(c.score)}/100</b></div><Bar score={c.score}/><p>{c.explanation}</p></div>}
export default function Page(){
 const [plan,setPlan]=useState<'starter'|'pro'>('starter');
 const [used,setUsed]=useState(0);
 const [inputType,setInputType]=useState('Texto');
 const [text,setText]=useState('Garantizamos que con nuestro curso online te harás millonario en 1 semana sin esfuerzo.');
 const [files,setFiles]=useState<{name:string,type:string,size:number}[]>([]);
 const [drag,setDrag]=useState(false); const [loading,setLoading]=useState(false); const [steps,setSteps]=useState<string[]>([]); const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const fileRef=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{const u=Number(localStorage.getItem('cc_used')||'0');setUsed(Number.isFinite(u)?u:0);},[]);
 function setUsage(n:number){setUsed(n);localStorage.setItem('cc_used',String(n))}
 const isPro=plan==='pro'; const locked=!isPro && used>=FREE_LIMIT; const textTooLong=!isPro && text.length>FREE_CHARS; const proInput=!isPro && inputType!=='Texto';
 const percent=Math.min(100,(used/FREE_LIMIT)*100);
 const types=['Texto','PDF','Imagen','Web','YouTube'];
 function onFiles(list:FileList|null){if(!list)return;if(!isPro){setInputType('PDF');return;}setFiles(prev=>[...prev,...Array.from(list).map(f=>({name:f.name,type:f.type||'archivo',size:f.size}))].slice(0,8))}
 async function analyze(){
  if(locked||textTooLong||proInput)return;
  setLoading(true);setAnalysis(null);setSteps([]);
  const seq=['Detectando formato','Identificando temática','Seleccionando módulos','Evaluando evidencia','Calculando riesgos','Generando informe prudente'];
  for(const s of seq){setSteps(p=>[...p,'✓ '+s]); await new Promise(r=>setTimeout(r,150))}
  try{
   const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,files,inputType})});
   const data=await res.json(); if(!res.ok) throw new Error(data.error||'Error');
   setAnalysis(data); if(!isPro)setUsage(used+1);
   setTimeout(()=>document.getElementById('resultado')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
  }catch(e:any){alert(e.message||'No se pudo analizar')}finally{setLoading(false)}
 }
 function paywallText(){
  if(locked)return 'Ya usaste tus 3 análisis Starter. Pasá a Pro para seguir analizando sin límites.';
  if(textTooLong)return `Starter permite hasta ${FREE_CHARS} caracteres. Tu texto tiene ${text.length}.`;
  if(proInput)return `${inputType} está disponible en ChamuyoCheck Pro. Starter solo permite texto.`;
  return '';
 }
 return <main className="wrap">
  <nav className="top"><div className="logo">Chamuyo<span>Check</span></div><div className="topBtns"><button className="pill" onClick={()=>{localStorage.removeItem('cc_used');setUsed(0)}}>Reset demo</button><button className="ghost" onClick={()=>setPlan('pro')}>Ver Pro</button></div></nav>
  <section className="hero">
   <div><div className="badge">Auditor inteligente de credibilidad</div><h1>Detecta el chamuyo <span className="grad">sin acusar.</span></h1><p className="lead">Starter te permite probar 3 análisis de texto de hasta 250 caracteres. ChamuyoCheck Pro desbloquea PDF, imágenes, web, YouTube, comparaciones, historial e informes.</p><div className="features"><span className="chip">Starter: 3 textos cortos</span><span className="chip">Pro: todo ilimitado</span><span className="chip">📄 PDF Pro</span><span className="chip">📷 Imagen Pro</span><span className="chip">🌐 Web Pro</span><span className="chip">▶ YouTube Pro</span></div></div>
   <div className="panel">
    <div className="planBox"><div className="usage"><strong>{isPro?'ChamuyoCheck Pro':'ChamuyoCheck Starter'}</strong><span>{isPro?'Sin límites':`${used} de ${FREE_LIMIT} análisis usados`}</span></div>{!isPro&&<div className="usageBar"><div className="usageFill" style={{['--w' as any]:`${percent}%`}}/></div>}</div>
    <div className="modeRow">{types.map(x=><button key={x} onClick={()=>setInputType(x)} className={`mode ${inputType===x?'active':''} ${!isPro&&x!=='Texto'?'locked':''}`}>{!isPro&&x!=='Texto'?'🔒 ':''}{x}</button>)}</div>
    <div className={`drop ${drag?'drag':''} ${!isPro?'locked':''}`} onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);onFiles(e.dataTransfer.files)}}><input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt,.doc,.docx" style={{display:'none'}} onChange={e=>onFiles(e.target.files)}/><b>{isPro?'Pegá o arrastrá cualquier contenido':'Starter: pegá texto corto'}</b><p>{isPro?'Texto · PDF · imágenes · capturas · páginas web · videos de YouTube. La temática se detecta automáticamente.':'Para probar: solo texto, hasta 250 caracteres, 3 análisis totales.'}</p>{!!files.length&&<div>{files.map((f,i)=><span className="chip" key={i}>{f.name}</span>)}</div>}</div>
    <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Pegá acá el contenido. La temática se detecta automáticamente."/>
    {!isPro&&<div className={`counter ${textTooLong?'bad':''}`}>{text.length}/{FREE_CHARS} caracteres Starter</div>}
    <div className="ctaRow"><button className="primary" onClick={analyze} disabled={loading||locked||textTooLong||proInput}>{loading?'Analizando':'Analizar'}</button><span className="hint">La IA decide qué módulos aplicar.</span></div>
    {(locked||textTooLong||proInput)&&<div className="paywall"><h3>Desbloqueá ChamuyoCheck Pro</h3><p>{paywallText()}</p><div className="proGrid"><div className="proItem">Texto ilimitado</div><div className="proItem">PDF e imágenes</div><div className="proItem">Web y YouTube</div><div className="proItem">Comparador</div><div className="proItem">Historial</div><div className="proItem">Informes PDF</div></div><button className="primary" onClick={()=>setPlan('pro')}>Desbloquear Pro</button></div>}
    {loading&&<div className="loadingBox">{steps.map((s,i)=><p key={i}>{s}</p>)}</div>}
   </div>
  </section>
  {analysis&&<section id="resultado" className="result"><div className="scoreCard"><p className="hint">Tema detectado</p><h2>{analysis.detectedTheme}</h2><div className="score">{analysis.score}/100</div><Bar score={analysis.score}/><div className="kpis"><div className="kpi"><small>Riesgo</small><b>{analysis.risk}</b></div><div className="kpi"><small>Confianza</small><b>{analysis.confidence}</b></div><div className="kpi"><small>Entrada</small><b>{analysis.detectedInput}</b></div></div><p>{analysis.summary}</p><div className="notice"><b>Conclusión prudente:</b> {analysis.prudentConclusion}</div></div><div className="report"><div className="section wide"><h2>Pregunta central</h2><p>{analysis.centralQuestion}</p><p>{analysis.verdict}</p></div><div className="section wide"><h2>Módulos activados automáticamente</h2><div className="cards">{analysis.modules.map((c,i)=><Card c={c} key={i}/>)}</div></div><div className="section wide"><h2>Índices de auditoría</h2><div className="cards">{analysis.categoryScores.map((c,i)=><Card c={c} key={i}/>)}</div></div><div className="section"><h2>Alertas</h2><ul>{analysis.issues.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Información faltante</h2><ul>{analysis.missingInformation.map((x,i)=><li key={i}>{x}</li>)}</ul></div><div className="section"><h2>Preguntas para decidir mejor</h2><ul>{analysis.questions.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Peor escenario razonable</h2><p>{analysis.worstCase}</p></div><div className="section wide"><h2>Resguardo legal</h2><div className="notice"><p>{analysis.legalSafeguard}</p></div></div></div></section>}
  <footer className="footer">ChamuyoCheck V7.1 · Starter limitado y base para Pro / Play Store.</footer>
 </main>
}
