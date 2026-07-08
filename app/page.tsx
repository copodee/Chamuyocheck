
'use client';
import {useEffect,useRef,useState} from 'react';
type Cat={name:string;score:number;explanation:string};
type Analysis={score:number;risk:string;confidence:string;detectedTheme:string;detectedInput:string;centralQuestion:string;summary:string;prudentConclusion:string;verdict:string;categoryScores:Cat[];modules:Cat[];flaggedPhrases:{phrase:string;problem:string;severity:string}[];issues:string[];questions:string[];missingInformation:string[];worstCase:string;improved:string;legalSafeguard:string};
const FREE_LIMIT=3; const FREE_CHARS=250;
function Bar({score}:{score:number}){return <div className="bar"><div className="fill" style={{['--w' as any]:`${Math.max(0,Math.min(100,score||0))}%`}}/></div>}
function Card({c}:{c:Cat}){return <div className="card"><div className="cardTop"><h3>{c.name}</h3><b>{Math.round(c.score)}/100</b></div><Bar score={c.score}/><p>{c.explanation}</p></div>}
function Ring({label,score}:{label:string;score:number}){return <div className="ring"><div className="circle" style={{['--p' as any]:score}}><span>{score}</span></div><b>{label}</b></div>}
function fmt(bytes:number){if(!bytes)return ''; if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`; return `${(bytes/1024/1024).toFixed(1)} MB`}
function detectUrlType(s:string){if(/youtu\.be|youtube\.com/i.test(s))return 'YouTube'; if(/^https?:\/\//i.test(s))return 'Web'; return 'Texto'}
export default function Page(){
 const [plan,setPlan]=useState<'starter'|'pro'>('starter');
 const [used,setUsed]=useState(0);
 const [inputType,setInputType]=useState('Automático');
 const [text,setText]=useState('Garantizamos que con nuestro curso online te harás millonario en 1 semana sin esfuerzo.');
 const [url,setUrl]=useState('');
 const [file,setFile]=useState<{name:string,type:string,size:number}|null>(null);
 const [drag,setDrag]=useState(false); const [loading,setLoading]=useState(false); const [steps,setSteps]=useState<string[]>([]); const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const fileRef=useRef<HTMLInputElement|null>(null); const textRef=useRef<HTMLTextAreaElement|null>(null);
 useEffect(()=>{const u=Number(localStorage.getItem('cc_used')||'0');setUsed(Number.isFinite(u)?u:0);},[]);
 function setUsage(n:number){setUsed(n);localStorage.setItem('cc_used',String(n))}
 const isPro=plan==='pro'; const locked=!isPro && used>=FREE_LIMIT; const detected= file ? (file.type.includes('pdf')||file.name.toLowerCase().endsWith('.pdf')?'PDF':file.type.startsWith('image/')?'Imagen':'Archivo') : url ? detectUrlType(url) : 'Texto';
 const textTooLong=!isPro && text.length>FREE_CHARS; const proInput=!isPro && detected!=='Texto';
 const percent=Math.min(100,(used/FREE_LIMIT)*100);
 function onFile(f:File|undefined|null){if(!f)return; setFile({name:f.name,type:f.type||'archivo',size:f.size}); setInputType(f.type.includes('pdf')||f.name.toLowerCase().endsWith('.pdf')?'PDF':f.type.startsWith('image/')?'Imagen':'Archivo')}
 function onDrop(e:React.DragEvent){e.preventDefault();setDrag(false);onFile(e.dataTransfer.files?.[0])}
 function onPaste(e:React.ClipboardEvent<HTMLTextAreaElement>){const pasted=e.clipboardData.getData('text'); if(/^https?:\/\//i.test(pasted.trim())){setUrl(pasted.trim());setInputType(detectUrlType(pasted.trim()))}}
 async function analyze(){
  if(locked||textTooLong||proInput)return;
  setLoading(true);setAnalysis(null);setSteps([]);
  const seq=['Recibiendo contenido','Detectando tipo automáticamente','Identificando temática','Activando especialistas','Calculando indicadores','Generando informe premium'];
  for(const s of seq){setSteps(p=>[...p,'✓ '+s]); await new Promise(r=>setTimeout(r,150))}
  try{
   const payloadText = [
    text ? `Texto ingresado:\n${text}` : '',
    url ? `URL detectada:\n${url}` : '',
    file ? `Archivo cargado: ${file.name} (${file.type}, ${fmt(file.size)})` : ''
   ].filter(Boolean).join('\n\n');
   const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:payloadText,inputType:detected,fileName:file?.name,url})});
   const data=await res.json(); if(!res.ok) throw new Error(data.error||'Error');
   setAnalysis(data); if(!isPro)setUsage(used+1);
   setTimeout(()=>document.getElementById('resultado')?.scrollIntoView({behavior:'smooth',block:'start'}),120);
  }catch(e:any){alert(e.message||'No se pudo analizar')}finally{setLoading(false)}
 }
 function paywallText(){
  if(locked)return 'Ya usaste tus 3 análisis Starter. Pasá a Pro para seguir analizando sin límites.';
  if(textTooLong)return `Starter permite hasta ${FREE_CHARS} caracteres. Tu texto tiene ${text.length}.`;
  if(proInput)return `${detected} está disponible en ChamuyoCheck Pro. Starter solo permite texto.`;
  return '';
 }
 return <main className="wrap">
  <nav className="top"><div className="logo">Chamuyo<span>Check</span></div><div className="topBtns"><button className="pill" onClick={()=>{localStorage.removeItem('cc_used');setUsed(0)}}>Reset demo</button><button className="ghost" onClick={()=>setPlan('pro')}>Ver Pro</button></div></nav>
  <input ref={fileRef} type="file" accept=".pdf,image/*,.txt,.doc,.docx" hidden onChange={e=>onFile(e.target.files?.[0])}/>
  <section className="hero">
   <div><div className="badge">Sistema inteligente de auditoría de credibilidad</div><h1>¿Qué querés <span className="grad">verificar hoy?</span></h1><p className="lead">Pegá texto, una URL, un link de YouTube o arrastrá un PDF/imagen. ChamuyoCheck detecta automáticamente el formato y la temática, sin que tengas que elegir módulos.</p><div className="features"><span className="chip">📝 Texto</span><span className="chip">📄 PDF</span><span className="chip">📷 Imagen</span><span className="chip">🌐 Web</span><span className="chip">▶ YouTube</span><span className="chip">🧠 Tema automático</span></div></div>
   <div className="console">
    <div className="planBox"><div className="usage"><strong>{isPro?'ChamuyoCheck Pro':'ChamuyoCheck Starter'}</strong><span>{isPro?'Sin límites':`${used} de ${FREE_LIMIT} análisis usados`}</span></div>{!isPro&&<div className="usageBar"><div className="usageFill" style={{['--w' as any]:`${percent}%`}}/></div>}</div>
    <div className="ask">Arrastrá, pegá o escribí</div>
    <div className={`smartDrop ${drag?'drag':''}`} onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}>
      <div className="smartHead"><div className="smartIcon">{detected==='PDF'?'📄':detected==='Imagen'?'🖼️':detected==='YouTube'?'▶':detected==='Web'?'🌐':'✨'}</div><div><h2>{detected==='Texto'?'Pegá cualquier texto':detected==='PDF'?'PDF listo para cargar':detected==='Imagen'?'Imagen o captura lista':detected==='YouTube'?'Video de YouTube detectado':detected==='Web'?'Página web detectada':'Contenido detectado'}</h2><p>{isPro?'El sistema decide automáticamente si es finanzas, salud, educación, plagio, contrato, publicidad o inversión.':'Starter solo analiza texto de hasta 250 caracteres. Los otros formatos quedan para Pro.'}</p></div></div>
      <div className="quick"><button type="button" className={detected==='Texto'?'active':''} onClick={(e)=>{e.stopPropagation();setInputType('Texto');setFile(null);setUrl('');setTimeout(()=>textRef.current?.focus(),50)}}>Texto</button><button type="button" className={detected==='PDF'?'active':''} onClick={(e)=>{e.stopPropagation();fileRef.current?.click()}}>PDF / Imagen</button><button type="button" className={detected==='Web'||detected==='YouTube'?'active':''} onClick={(e)=>{e.stopPropagation();setInputType('Web');setUrl(url||'https://');}}>URL / YouTube</button></div>
      {file&&<div className="preview"><div><b>{file.name}</b><small>{file.type || 'archivo'} · {fmt(file.size)}</small></div><button className="remove" onClick={(e)=>{e.stopPropagation();setFile(null);setInputType('Automático')}}>Quitar</button></div>}
    </div>
    <div className="inputBox">
     <input className="urlInput" value={url} onChange={e=>{setUrl(e.target.value);setInputType(detectUrlType(e.target.value))}} placeholder="Opcional: pegá URL de web o YouTube"/>
     <textarea ref={textRef} value={text} onPaste={onPaste} onChange={e=>{setText(e.target.value); if(/^https?:\/\//i.test(e.target.value.trim())){setUrl(e.target.value.trim());setInputType(detectUrlType(e.target.value.trim()))}}} placeholder="Pegá texto, transcripción, fragmento de PDF, captura escrita o cualquier contenido visible."/>
    </div>
    {!isPro&&<div className={`counter ${textTooLong?'bad':''}`}>{text.length}/{FREE_CHARS} caracteres Starter</div>}
    <div className="ctaRow"><button className="primary" onClick={analyze} disabled={loading||locked||textTooLong||proInput}>{loading?'Analizando':'Analizar'}</button><span className="hint">Formato detectado: {detected}</span></div>
    {(locked||textTooLong||proInput)&&<div className="paywall"><h3>Desbloqueá ChamuyoCheck Pro</h3><p>{paywallText()}</p><div className="proGrid"><div className="proItem">Texto ilimitado</div><div className="proItem">PDF e imágenes</div><div className="proItem">Web y YouTube</div><div className="proItem">Comparador</div><div className="proItem">Historial</div><div className="proItem">Informes PDF</div></div><button className="primary" onClick={()=>setPlan('pro')}>Desbloquear Pro demo</button></div>}
    {loading&&<div className="loadingBox">{steps.map((s,i)=><p key={i}>{s}</p>)}</div>}
   </div>
  </section>
  {analysis&&<section id="resultado" className="result"><div className="scoreCard"><p className="hint">Tema detectado</p><h2>{analysis.detectedTheme}</h2><div className="score">{analysis.score}/100</div><Bar score={analysis.score}/><div className="kpis"><div className="kpi"><small>Riesgo</small><b>{analysis.risk}</b></div><div className="kpi"><small>Confianza</small><b>{analysis.confidence}</b></div><div className="kpi"><small>Entrada</small><b>{analysis.detectedInput}</b></div></div><div className="rings"><Ring label="Evidencia" score={analysis.categoryScores?.[0]?.score||0}/><Ring label="Faltante" score={analysis.categoryScores?.[1]?.score||0}/><Ring label="Claridad" score={analysis.categoryScores?.[2]?.score||0}/></div><p>{analysis.summary}</p><div className="notice"><b>Conclusión prudente:</b> {analysis.prudentConclusion}</div></div><div className="report"><div className="section wide"><h2>Pregunta central</h2><p>{analysis.centralQuestion}</p><p>{analysis.verdict}</p></div><div className="section wide"><h2>Módulos activados automáticamente</h2><div className="cards">{analysis.modules.map((c,i)=><Card c={c} key={i}/>)}</div></div><div className="section wide"><h2>Índices de auditoría</h2><div className="cards">{analysis.categoryScores.map((c,i)=><Card c={c} key={i}/>)}</div></div><div className="section"><h2>Alertas</h2><ul>{analysis.issues.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Información faltante</h2><ul>{analysis.missingInformation.map((x,i)=><li key={i}>{x}</li>)}</ul></div><div className="section"><h2>Preguntas para decidir mejor</h2><ul>{analysis.questions.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Peor escenario razonable</h2><p>{analysis.worstCase}</p></div><div className="section wide"><h2>Resguardo legal</h2><div className="notice"><p>{analysis.legalSafeguard}</p></div></div></div></section>}
  <footer className="footer">ChamuyoCheck V8 · Experiencia automática premium.</footer>
 </main>
}
