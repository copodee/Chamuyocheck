
'use client';
import {useEffect,useRef,useState} from 'react';
type Cat={name:string;score:number;explanation:string};
type Analysis={score:number;risk:string;confidence:string;detectedTheme:string;detectedInput:string;centralQuestion:string;summary:string;prudentConclusion:string;verdict:string;categoryScores:Cat[];modules:Cat[];flaggedPhrases:{phrase:string;problem:string;severity:string}[];issues:string[];questions:string[];missingInformation:string[];worstCase:string;improved:string;legalSafeguard:string};
const FREE_LIMIT=3; const FREE_CHARS=250;
function Bar({score}:{score:number}){return <div className="bar"><div className="fill" style={{['--w' as any]:`${Math.max(0,Math.min(100,score||0))}%`}}/></div>}
function Card({c}:{c:Cat}){return <div className="card"><div className="cardTop"><h3>{c.name}</h3><b>{Math.round(c.score)}/100</b></div><Bar score={c.score}/><p>{c.explanation}</p></div>}
function fmt(bytes:number){if(!bytes)return ''; if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`; return `${(bytes/1024/1024).toFixed(1)} MB`}
export default function Page(){
 const [plan,setPlan]=useState<'starter'|'pro'>('starter');
 const [used,setUsed]=useState(0);
 const [inputType,setInputType]=useState('Texto');
 const [text,setText]=useState('Garantizamos que con nuestro curso online te harás millonario en 1 semana sin esfuerzo.');
 const [url,setUrl]=useState('');
 const [file,setFile]=useState<{name:string,type:string,size:number}|null>(null);
 const [drag,setDrag]=useState(false); const [loading,setLoading]=useState(false); const [steps,setSteps]=useState<string[]>([]); const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const textRef=useRef<HTMLTextAreaElement|null>(null); const pdfRef=useRef<HTMLInputElement|null>(null); const imageRef=useRef<HTMLInputElement|null>(null); const anyRef=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{const u=Number(localStorage.getItem('cc_used')||'0');setUsed(Number.isFinite(u)?u:0);},[]);
 function setUsage(n:number){setUsed(n);localStorage.setItem('cc_used',String(n))}
 const isPro=plan==='pro'; const locked=!isPro && used>=FREE_LIMIT; const textTooLong=!isPro && text.length>FREE_CHARS; const proInput=!isPro && inputType!=='Texto';
 const percent=Math.min(100,(used/FREE_LIMIT)*100);
 function choose(type:string){
  setInputType(type); setAnalysis(null);
  if(type==='Texto') setTimeout(()=>textRef.current?.focus(),60);
  if(type==='PDF') { setTimeout(()=>pdfRef.current?.click(),80); }
  if(type==='Imagen') { setTimeout(()=>imageRef.current?.click(),80); }
 }
 function onFile(f:File|undefined|null,type?:string){if(!f)return; setFile({name:f.name,type:f.type||type||'archivo',size:f.size}); if(type)setInputType(type)}
 function onDrop(e:React.DragEvent){e.preventDefault();setDrag(false);const f=e.dataTransfer.files?.[0]; if(!f)return; if(f.type.includes('pdf')||f.name.toLowerCase().endsWith('.pdf'))onFile(f,'PDF'); else if(f.type.startsWith('image/'))onFile(f,'Imagen'); else onFile(f,inputType)}
 async function analyze(){
  if(locked||textTooLong||proInput)return;
  setLoading(true);setAnalysis(null);setSteps([]);
  const seq=['Detectando formato','Verificando entrada','Identificando temática','Seleccionando módulos','Evaluando evidencia','Generando informe prudente'];
  for(const s of seq){setSteps(p=>[...p,'✓ '+s]); await new Promise(r=>setTimeout(r,150))}
  try{
   const payloadText = inputType==='Texto' ? text : inputType==='Web' ? `Analizar página web indicada. ${url ? 'URL: '+url : ''}\n\nTexto pegado por el usuario:\n${text}` : inputType==='YouTube' ? `Analizar video de YouTube indicado. ${url ? 'URL: '+url : ''}\n\nTranscripción o descripción pegada por el usuario:\n${text}` : `Analizar archivo cargado (${inputType}). Nombre: ${file?.name || 'sin archivo'}.\n\nTexto visible o notas pegadas por el usuario:\n${text}`;
   const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:payloadText,inputType,fileName:file?.name,url})});
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
 const showUrl = inputType==='Web' || inputType==='YouTube';
 return <main className="wrap">
  <nav className="top"><div className="logo">Chamuyo<span>Check</span></div><div className="topBtns"><button className="pill" onClick={()=>{localStorage.removeItem('cc_used');setUsed(0)}}>Reset demo</button><button className="ghost" onClick={()=>setPlan('pro')}>Ver Pro</button></div></nav>
  <input ref={pdfRef} type="file" accept=".pdf,application/pdf" hidden onChange={e=>onFile(e.target.files?.[0],'PDF')}/>
  <input ref={imageRef} type="file" accept="image/*" hidden onChange={e=>onFile(e.target.files?.[0],'Imagen')}/>
  <input ref={anyRef} type="file" accept=".pdf,image/*,.txt,.doc,.docx" hidden onChange={e=>onFile(e.target.files?.[0],inputType)}/>
  <section className="hero">
   <div><div className="badge">Auditor inteligente de credibilidad</div><h1>Detecta el chamuyo <span className="grad">sin acusar.</span></h1><p className="lead">V7.2 convierte cada botón en una entrada real: texto, PDF, imagen, web o YouTube. Starter permite 3 textos cortos; Pro desbloquea todos los formatos.</p><div className="features"><span className="chip">Starter: 3 textos cortos</span><span className="chip">Pro: formatos completos</span><span className="chip">📄 PDF</span><span className="chip">📷 Imagen</span><span className="chip">🌐 Web</span><span className="chip">▶ YouTube</span></div></div>
   <div className="panel">
    <div className="planBox"><div className="usage"><strong>{isPro?'ChamuyoCheck Pro':'ChamuyoCheck Starter'}</strong><span>{isPro?'Sin límites':`${used} de ${FREE_LIMIT} análisis usados`}</span></div>{!isPro&&<div className="usageBar"><div className="usageFill" style={{['--w' as any]:`${percent}%`}}/></div>}</div>
    <div className="modeRow">
     {['Texto','PDF','Imagen','Web','YouTube'].map(x=><button key={x} onClick={()=>choose(x)} className={`mode ${inputType===x?'active':''} ${!isPro&&x!=='Texto'?'locked':''}`}>{!isPro&&x!=='Texto'?'🔒 ':''}{x}</button>)}
    </div>
    {showUrl&&<input className="urlInput" value={url} onChange={e=>setUrl(e.target.value)} placeholder={inputType==='YouTube'?'Pegá el link de YouTube. Si tenés transcripción, pegala abajo.':'Pegá la URL de la página web. Si podés, pegá también el texto visible abajo.'}/>}
    <div className={`drop ${drag?'drag':''}`} onClick={()=> inputType==='PDF'?pdfRef.current?.click():inputType==='Imagen'?imageRef.current?.click():anyRef.current?.click()} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}>
     <b>{inputType==='Texto'?'Pegá texto para analizar':inputType==='PDF'?'Seleccioná o arrastrá un PDF':inputType==='Imagen'?'Seleccioná o arrastrá una imagen/captura':inputType==='Web'?'Pegá una web o arrastrá una captura':inputType==='YouTube'?'Pegá un link de YouTube':'Pegá o arrastrá contenido'}</b>
     <p>{inputType==='Texto'?'La temática se detecta automáticamente.':inputType==='PDF'?'En V7.2 se carga el archivo y se analiza con el texto o notas visibles. La lectura completa del PDF queda para V7.3.':inputType==='Imagen'?'En V7.2 se carga la imagen y se analiza con notas visibles. OCR real queda para V7.3.':inputType==='Web'?'El campo URL ya queda operativo. Extracción automática completa queda para V7.3.':'El campo YouTube ya queda operativo. Lectura de subtítulos automática queda para V7.3.'}</p>
    </div>
    {file&&<div className="preview"><div><b>Archivo cargado: {file.name}</b><small>{file.type || 'archivo'} · {fmt(file.size)}</small></div><button className="remove" onClick={()=>setFile(null)}>Quitar</button></div>}
    <textarea ref={textRef} value={text} onChange={e=>setText(e.target.value)} placeholder={inputType==='Texto'?'Pegá acá el texto.':inputType==='PDF'?'Opcional: pegá fragmentos visibles del PDF o indicaciones sobre qué revisar.':inputType==='Imagen'?'Opcional: describí la captura o pegá el texto visible.':inputType==='Web'?'Opcional: pegá el texto visible de la página para mayor precisión.':'Opcional: pegá descripción, título o transcripción del video.'}/>
    {!isPro&&<div className={`counter ${textTooLong?'bad':''}`}>{text.length}/{FREE_CHARS} caracteres Starter</div>}
    <div className="ctaRow"><button className="primary" onClick={analyze} disabled={loading||locked||textTooLong||proInput}>{loading?'Analizando':'Analizar'}</button><span className="hint">Un solo análisis: la IA decide la temática.</span></div>
    {(locked||textTooLong||proInput)&&<div className="paywall"><h3>Desbloqueá ChamuyoCheck Pro</h3><p>{paywallText()}</p><div className="proGrid"><div className="proItem">Texto ilimitado</div><div className="proItem">PDF e imágenes</div><div className="proItem">Web y YouTube</div><div className="proItem">Comparador</div><div className="proItem">Historial</div><div className="proItem">Informes PDF</div></div><button className="primary" onClick={()=>setPlan('pro')}>Desbloquear Pro demo</button></div>}
    {loading&&<div className="loadingBox">{steps.map((s,i)=><p key={i}>{s}</p>)}</div>}
   </div>
  </section>
  {analysis&&<section id="resultado" className="result"><div className="scoreCard"><p className="hint">Tema detectado</p><h2>{analysis.detectedTheme}</h2><div className="score">{analysis.score}/100</div><Bar score={analysis.score}/><div className="kpis"><div className="kpi"><small>Riesgo</small><b>{analysis.risk}</b></div><div className="kpi"><small>Confianza</small><b>{analysis.confidence}</b></div><div className="kpi"><small>Entrada</small><b>{analysis.detectedInput}</b></div></div><p>{analysis.summary}</p><div className="notice"><b>Conclusión prudente:</b> {analysis.prudentConclusion}</div></div><div className="report"><div className="section wide"><h2>Pregunta central</h2><p>{analysis.centralQuestion}</p><p>{analysis.verdict}</p></div><div className="section wide"><h2>Módulos activados automáticamente</h2><div className="cards">{analysis.modules.map((c,i)=><Card c={c} key={i}/>)}</div></div><div className="section wide"><h2>Índices de auditoría</h2><div className="cards">{analysis.categoryScores.map((c,i)=><Card c={c} key={i}/>)}</div></div><div className="section"><h2>Alertas</h2><ul>{analysis.issues.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Información faltante</h2><ul>{analysis.missingInformation.map((x,i)=><li key={i}>{x}</li>)}</ul></div><div className="section"><h2>Preguntas para decidir mejor</h2><ul>{analysis.questions.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Peor escenario razonable</h2><p>{analysis.worstCase}</p></div><div className="section wide"><h2>Resguardo legal</h2><div className="notice"><p>{analysis.legalSafeguard}</p></div></div></div></section>}
  <footer className="footer">ChamuyoCheck V7.2 · Entradas funcionales para texto, PDF, imagen, web y YouTube.</footer>
 </main>
}
