
'use client';
import {useEffect,useRef,useState} from 'react';
type Cat={name:string;score:number;explanation:string};
type Analysis={documentIcon:string;documentType:string;documentFocus:string;extractionStatus:string;extractedChars:number;extractedPreview?:string;score:number;risk:string;confidence:string;detectedTheme:string;detectedInput:string;centralQuestion:string;summary:string;prudentConclusion:string;verdict:string;categoryScores:Cat[];modules:Cat[];flaggedPhrases:{phrase:string;problem:string;severity:string}[];issues:string[];questions:string[];missingInformation:string[];worstCase:string;improved:string;legalSafeguard:string};
const FREE_LIMIT=3; const FREE_CHARS=250;
function Bar({score}:{score:number}){return <div className="bar"><div className="fill" style={{['--w' as any]:`${Math.max(0,Math.min(100,score||0))}%`}}/></div>}
function Card({c}:{c:Cat}){return <div className="card"><div className="cardTop"><h3>{c.name}</h3><b>{Math.round(c.score)}/100</b></div><Bar score={c.score}/><p>{c.explanation}</p></div>}
function Ring({label,score}:{label:string;score:number}){return <div className="ring"><div className="circle" style={{['--p' as any]:score}}><span>{score}</span></div><b>{label}</b></div>}
function fmt(bytes:number){if(!bytes)return ''; if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`; return `${(bytes/1024/1024).toFixed(1)} MB`}
function detectUrlType(s:string){if(/youtu\.be|youtube\.com/i.test(s))return 'YouTube'; if(/^https?:\/\//i.test(s))return 'Web'; return 'Texto'}
function inferLocalDoc(text:string,file:any,url:string){
 const source=(text+' '+(file?.name||'')+' '+url).toLowerCase();
 if(file?.type?.includes('pdf')||file?.name?.toLowerCase().endsWith('.pdf')) return {icon:'📄', label:'PDF recibido', focus:'Se leerá el contenido real del PDF antes de responder'};
 if(file?.type?.startsWith('image/')) return {icon:'🖼️', label:'Imagen/captura recibida', focus:'Preparada para análisis visual'};
 if(/youtu\.be|youtube\.com/.test(source)) return {icon:'▶️', label:'Video de YouTube detectado', focus:'Analizando enlace y texto disponible'};
 if(/^https?:\/\//.test(url)) return {icon:'🌐', label:'Página web detectada', focus:'Analizando enlace y texto disponible'};
 if(/facultad|colegio|alumno|tesis|monograf|trabajo|bibliograf|hecha con ia|hecho con ia/.test(source)) return {icon:'🎓', label:'Trabajo académico posible', focus:'IA/plagio solo como estimación'};
 if(/nota|period|articulo|artículo/.test(source)) return {icon:'📰', label:'Nota o artículo posible', focus:'Veracidad, fuentes y posible IA'};
 if(/pr[eé]stamo|cuota|cft|tea|tna|\$/.test(source)) return {icon:'💳', label:'Oferta financiera posible', focus:'Costos ocultos y CFT'};
 return {icon:'📝', label:'Texto recibido', focus:'Clasificación automática'};
}
export default function Page(){
 const [plan,setPlan]=useState<'starter'|'pro'>('pro');
 const [used,setUsed]=useState(0);
 const [text,setText]=useState('');
 const [url,setUrl]=useState('');
 const [file,setFile]=useState<File|null>(null);
 const [drag,setDrag]=useState(false); const [loading,setLoading]=useState(false); const [steps,setSteps]=useState<string[]>([]); const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const fileRef=useRef<HTMLInputElement|null>(null); const textRef=useRef<HTMLTextAreaElement|null>(null);
 useEffect(()=>{const u=Number(localStorage.getItem('cc_used')||'0');setUsed(Number.isFinite(u)?u:0);},[]);
 function setUsage(n:number){setUsed(n);localStorage.setItem('cc_used',String(n))}
 const localDoc=inferLocalDoc(text,file,url);
 const detected= file ? (file.type.includes('pdf')||file.name.toLowerCase().endsWith('.pdf')?'PDF':file.type.startsWith('image/')?'Imagen':'Archivo') : url ? detectUrlType(url) : 'Texto';
 const isPro=plan==='pro'; const locked=!isPro && used>=FREE_LIMIT; const textTooLong=!isPro && text.length>FREE_CHARS; const proInput=!isPro && detected!=='Texto';
 const percent=Math.min(100,(used/FREE_LIMIT)*100);
 function onFile(f:File|undefined|null){if(!f)return; setFile(f); setAnalysis(null)}
 function onDrop(e:React.DragEvent){e.preventDefault();setDrag(false);onFile(e.dataTransfer.files?.[0])}
 function onPaste(e:React.ClipboardEvent<HTMLTextAreaElement>){const pasted=e.clipboardData.getData('text'); if(/^https?:\/\//i.test(pasted.trim())) setUrl(pasted.trim())}
 async function analyze(){
  if(locked||textTooLong||proInput)return;
  setLoading(true);setAnalysis(null);setSteps([]);
  const seq=file?['Documento recibido','Extrayendo texto real del PDF','Identificando tipo documental','Separando pregunta del usuario del contenido','Activando módulos adecuados','Generando informe prudente']:['Contenido recibido','Detectando tipo automáticamente','Identificando temática','Activando especialistas','Generando informe prudente'];
  for(const s of seq){setSteps(p=>[...p,'✓ '+s]); await new Promise(r=>setTimeout(r,210))}
  try{
   const form=new FormData();
   form.append('text',text);
   form.append('url',url);
   form.append('inputType',detected);
   if(file) form.append('file',file);
   const res=await fetch('/api/analyze',{method:'POST',body:form});
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
 const heroDoc=analysis?{icon:analysis.documentIcon,label:analysis.documentType,focus:analysis.documentFocus}:localDoc;
 return <main className="wrap">
  <nav className="top"><div className="logo">Chamuyo<span>Check</span></div><div className="topBtns"><button className="pill" onClick={()=>{localStorage.removeItem('cc_used');setUsed(0)}}>Reset demo</button><button className="ghost" onClick={()=>setPlan(plan==='pro'?'starter':'pro')}>{isPro?'Modo Starter':'Ver Pro'}</button></div></nav>
  <input ref={fileRef} type="file" accept=".pdf,image/*,.txt,.doc,.docx" hidden onChange={e=>onFile(e.target.files?.[0])}/>
  <section className="hero">
   <div><div className="badge">Auditor documental con lectura de PDF</div><h1>{heroDoc.icon} {heroDoc.label}</h1><p className="lead">{heroDoc.focus}. En V9.1 el sistema prioriza el contenido extraído del PDF por encima de la pregunta escrita por el usuario.</p><div className="documentHero"><small>Estado del documento</small><b>{analysis?analysis.extractionStatus:'Esperando archivo o contenido'}</b></div><div className="features"><span className="chip on">Lectura PDF real</span><span className="chip">Identificación previa</span><span className="chip">IA prudente</span><span className="chip">Finanzas</span><span className="chip">Notas</span><span className="chip">Contratos</span></div></div>
   <div className="console">
    <div className="planBox"><div className="usage"><strong>{isPro?'ChamuyoCheck Pro':'ChamuyoCheck Starter'}</strong><span>{isPro?'Sin límites demo':`${used} de ${FREE_LIMIT} análisis usados`}</span></div>{!isPro&&<div className="usageBar"><div className="usageFill" style={{['--w' as any]:`${percent}%`}}/></div>}</div>
    <div className="ask">Subí el documento</div>
    <div className={`smartDrop ${drag?'drag':''}`} onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}>
      <div className="smartHead"><div className="smartIcon">{localDoc.icon}</div><div><h2>{localDoc.label}</h2><p>{file?'El archivo fue recibido. Ahora ChamuyoCheck leerá el contenido del PDF antes de clasificarlo.':'Arrastrá PDF/imagen o hacé clic para seleccionar. También podés pegar texto, URL o YouTube abajo.'}</p></div></div>
      <div className="smartActions"><button type="button" onClick={(e)=>{e.stopPropagation();fileRef.current?.click()}}>Seleccionar archivo</button><button type="button" onClick={(e)=>{e.stopPropagation();setFile(null);setUrl('');setText('');setAnalysis(null);setTimeout(()=>textRef.current?.focus(),50)}}>Limpiar</button></div>
      {file&&<div className="preview"><div><b>{file.name}</b><small>{file.type || 'archivo'} · {fmt(file.size)}</small></div><button className="remove" onClick={(e)=>{e.stopPropagation();setFile(null)}}>Quitar</button></div>}
    </div>
    {file&&<div className="extracted"><h3>📌 Análisis sobre contenido real</h3><p>La pregunta de abajo solo orienta. El motor usará primero el texto extraído del archivo.</p></div>}
    <div className="inputBox">
     <input className="urlInput" value={url} onChange={e=>setUrl(e.target.value)} placeholder="Opcional: pegá URL de web o YouTube"/>
     <textarea ref={textRef} value={text} onPaste={onPaste} onChange={e=>setText(e.target.value)} placeholder="Opcional: pregunta o contexto. Ej.: ¿esta nota es real o parece hecha con IA?"/>
    </div>
    {!isPro&&<div className={`counter ${textTooLong?'bad':''}`}>{text.length}/{FREE_CHARS} caracteres Starter</div>}
    <div className="ctaRow"><button className="primary" onClick={analyze} disabled={loading||locked||textTooLong||proInput}>{loading?'Leyendo documento':'Analizar documento'}</button><span className="hint">Entrada detectada: {detected}</span></div>
    {(locked||textTooLong||proInput)&&<div className="paywall"><h3>Desbloqueá ChamuyoCheck Pro</h3><p>{paywallText()}</p><div className="proGrid"><div className="proItem">Texto ilimitado</div><div className="proItem">Lectura de PDF</div><div className="proItem">Web y YouTube</div><div className="proItem">Comparador</div><div className="proItem">Historial</div><div className="proItem">Informes PDF</div></div><button className="primary" onClick={()=>setPlan('pro')}>Desbloquear Pro demo</button></div>}
    {loading&&<div className="loadingBox">{steps.map((s,i)=><p key={i}>{s}</p>)}</div>}
   </div>
  </section>
  {analysis&&<section id="resultado" className="result">
  <div className="resultHeader">
    <div className="resultIcon">{analysis.documentIcon}</div>
    <div>
      <small>Documento identificado antes del análisis</small>
      <h2>{analysis.documentType}</h2>
      <p>{analysis.documentFocus}</p>
    </div>
    <div className="resultBadge">{analysis.extractedChars?`${analysis.extractedChars} caracteres leídos`:'lectura preliminar'}</div>
  </div>
  <div className="scoreCard"><div className="docId"><small>📄 Lectura del documento</small><h2>{analysis.documentIcon} {analysis.documentType}</h2><p>{analysis.documentFocus}</p><p><b>Lectura:</b> {analysis.extractionStatus} {analysis.extractedChars?`(${analysis.extractedChars} caracteres)`:''}</p>{analysis.extractedPreview&&<div className="excerptBox"><h3>Extracto leído por ChamuyoCheck</h3><pre>{analysis.extractedPreview}</pre></div>}</div><p className="hint">Resultado contextual</p><h2>{analysis.detectedTheme}</h2><div className="score">{analysis.score}/100</div><Bar score={analysis.score}/><div className="kpis"><div className="kpi"><small>Riesgo</small><b>{analysis.risk}</b></div><div className="kpi"><small>Confianza</small><b>{analysis.confidence}</b></div><div className="kpi"><small>Entrada</small><b>{analysis.detectedInput}</b></div></div><div className="rings"><Ring label="Lectura" score={analysis.categoryScores?.[0]?.score||0}/><Ring label="Credibilidad" score={analysis.categoryScores?.[1]?.score||0}/><Ring label="Faltante" score={analysis.categoryScores?.[2]?.score||0}/></div><p>{analysis.summary}</p><div className="notice"><b>Conclusión prudente:</b> {analysis.prudentConclusion}</div></div><div className="report"><div className="section wide"><h2>Pregunta central</h2><p>{analysis.centralQuestion}</p><p>{analysis.verdict}</p></div><div className="section wide"><h2>Especialistas activados automáticamente</h2><div className="cards">{analysis.modules.map((c,i)=><Card c={c} key={i}/>)}</div></div><div className="section wide"><h2>Indicadores del informe</h2><div className="cards">{analysis.categoryScores.map((c,i)=><Card c={c} key={i}/>)}</div></div><div className="section"><h2>Alertas</h2><ul>{analysis.issues.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Información faltante</h2><ul>{analysis.missingInformation.map((x,i)=><li key={i}>{x}</li>)}</ul></div><div className="section"><h2>Preguntas para decidir mejor</h2><ul>{analysis.questions.map((x,i)=><li key={i}>{x}</li>)}</ul><h2>Peor escenario razonable</h2><p>{analysis.worstCase}</p></div><div className="section wide legalCompact"><h2>⚖️ Aviso legal</h2><p>{analysis.legalSafeguard}</p></div></div></section>}
  <footer className="footer">ChamuyoCheck V9.1 · Lee el texto real del PDF antes de analizar.</footer>
 </main>
}
