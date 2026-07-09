
'use client';
import {useEffect,useRef,useState} from 'react';

type Cat={name:string;score:number;explanation:string};
type Analysis={
  documentIcon:string;documentType:string;documentFocus:string;extractionStatus:string;extractedChars:number;extractedPreview?:string;
  score:number;risk:string;confidence:string;detectedTheme:string;detectedInput:string;centralQuestion:string;summary:string;prudentConclusion:string;verdict:string;
  categoryScores:Cat[];modules:Cat[];flaggedPhrases:{phrase:string;problem:string;severity:string}[];issues:string[];questions:string[];missingInformation:string[];
  worstCase:string;improved:string;legalSafeguard:string;evidenceFound?:string[];scoreExplanation?:string[];refutationPoints?:string[];improvementPlan?:string[];
};
const FREE_LIMIT=3, FREE_CHARS=250;

function Bar({score}:{score:number}){return <div className="bar"><div className="fill" style={{['--w' as any]:`${Math.max(0,Math.min(100,score||0))}%`}}/></div>}
function detectUrlType(s:string){if(/youtu\.be|youtube\.com/i.test(s))return 'YouTube'; if(/^https?:\/\//i.test(s))return 'Web'; return 'Texto'}
function fmt(bytes:number){if(!bytes)return ''; return bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`}
function inferLocalDoc(text:string,file:any,url:string){
 const source=(text+' '+(file?.name||'')+' '+url).toLowerCase();
 if(file?.type?.includes('pdf')||file?.name?.toLowerCase().endsWith('.pdf')) return {icon:'📄', label:'PDF recibido', focus:'Se leerá el contenido real del PDF antes de responder'};
 if(file?.type?.startsWith('image/')) return {icon:'🖼️', label:'Imagen/captura recibida', focus:'Preparada para análisis visual'};
 if(/youtu\.be|youtube\.com/.test(source)) return {icon:'▶️', label:'Video de YouTube detectado', focus:'Analizando enlace y texto disponible'};
 if(/^https?:\/\//.test(url)) return {icon:'🌐', label:'Página web detectada', focus:'Analizando enlace y texto disponible'};
 if(/facultad|colegio|alumno|tesis|monograf|trabajo|bibliograf|hecha con ia|hecho con ia/.test(source)) return {icon:'🎓', label:'Trabajo académico posible', focus:'IA/plagio solo como estimación'};
 if(/pr[eé]stamo|cuota|cft|tea|tna|\$/.test(source)) return {icon:'💳', label:'Oferta financiera posible', focus:'Costos ocultos y CFT'};
 return {icon:'📝', label:'Texto recibido', focus:'Clasificación automática'};
}
function moduleCard(c:Cat,i:number){return <div className="module" key={i}><b>{c.name}</b><Bar score={c.score}/><p>{c.explanation}</p></div>}

export default function Page(){
 const [plan,setPlan]=useState<'starter'|'pro'>('pro');
 const [used,setUsed]=useState(0);
 const [text,setText]=useState('');
 const [url,setUrl]=useState('');
 const [file,setFile]=useState<File|null>(null);
 const [drag,setDrag]=useState(false);
 const [loading,setLoading]=useState(false);
 const [steps,setSteps]=useState<string[]>([]);
 const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const [tab,setTab]=useState('Resumen');
 const fileRef=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{setUsed(Number(localStorage.getItem('cc_used')||'0'))},[]);
 function setUsage(n:number){setUsed(n);localStorage.setItem('cc_used',String(n))}
 const isPro=plan==='pro';
 const detected=file?(file.type.includes('pdf')||file.name.toLowerCase().endsWith('.pdf')?'PDF':file.type.startsWith('image/')?'Imagen':'Archivo'):url?detectUrlType(url):'Texto';
 const localDoc=inferLocalDoc(text,file,url);
 const locked=!isPro&&used>=FREE_LIMIT, textTooLong=!isPro&&text.length>FREE_CHARS, proInput=!isPro&&detected!=='Texto';
 function onFile(f:File|undefined|null){if(!f)return;setFile(f);setAnalysis(null)}
 function onDrop(e:React.DragEvent){e.preventDefault();setDrag(false);onFile(e.dataTransfer.files?.[0])}
 async function analyze(){
  if(locked||textTooLong||proInput)return;
  setLoading(true);setSteps([]);setAnalysis(null);
  const seq=['Contenido recibido','Extrayendo texto del documento','Detectando tipo de contenido','Activando especialistas','Calculando ChamuyoScore™','Generando informe'];
  for(const s of seq){setSteps(p=>[...p,'✓ '+s]); await new Promise(r=>setTimeout(r,180))}
  try{
    const form=new FormData(); form.append('text',text); form.append('url',url); form.append('inputType',detected); if(file)form.append('file',file);
    const res=await fetch('/api/analyze',{method:'POST',body:form}); const data=await res.json(); if(!res.ok)throw new Error(data.error||'Error');
    setAnalysis(data); if(!isPro)setUsage(used+1);
    setTimeout(()=>document.getElementById('informe')?.scrollIntoView({behavior:'smooth'}),100);
  }catch(e:any){alert(e.message||'No se pudo analizar')}finally{setLoading(false)}
 }
 const score=analysis?.score??81;
 const semaforo=score>=75?{txt:'Podés avanzar con verificación',color:'var(--green)'}:score>=45?{txt:'Verificá antes de decidir',color:'var(--yellow)'}:{txt:'No decidas todavía',color:'var(--red)'};
 return <div className="appShell">
  <input ref={fileRef} type="file" accept=".pdf,image/*,.txt,.doc,.docx" hidden onChange={e=>onFile(e.target.files?.[0])}/>
  <aside className="sidebar">
    <div className="brand"><div className="shield">✓</div><div><div className="logo">CHAMUYO<span>CHECK</span></div><div className="tag">Analizá antes de decidir.</div></div></div>
    <button className="newBtn" onClick={()=>{setAnalysis(null);setText('');setUrl('');setFile(null)}}>＋ Nuevo análisis</button>
    <div className="nav">
      <a className="active">⌂ Inicio</a><a>◴ Historial</a><a>☆ Favoritos</a><a>▤ Plantillas</a><a>⚖ Comparar <small>PRO</small></a><a>↑ Mejorar documento</a><a>⚙ Ajustes</a><a>? Ayuda</a>
    </div>
    <div className="proBox"><b>🔎 CHAMUYOCHECK</b><p>Analizá contenido con una evaluación prudente y más.</p><button onClick={()=>setPlan('pro')}>Ver planes</button></div>
    <div className="userBox"><div className="avatar">N</div><div><b>Usuario invitado</b><div className="hint">{isPro?'Plan gratuito':'Plan Starter'}</div></div></div>
  </aside>
  <main className="main">
    <div className="topbar">
      <div className="status"><div className="check">✓</div><div><b>{analysis?'Análisis finalizado':'Nuevo análisis'}</b><div className="hint">8 de julio de 2026</div></div></div>
      <div className="topActions"><button className="ghost" onClick={()=>setAnalysis(null)}>Analizar otro</button><button className="ghost">Descargar informe⌄</button><button className="iconBtn">⋮</button></div>
    </div>
    {!analysis && <section className="heroGrid">
      <div className="panel inputPanel">
        <div className="tabs">{['Texto','PDF','Imagen','Web','YouTube'].map(x=><button key={x} className={`tab ${detected===x?'active':''}`} onClick={()=>{if(x==='PDF'||x==='Imagen')fileRef.current?.click();}}>{x}</button>)}</div>
        <div className={`drop ${drag?'drag':''}`} onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}>
          <h3>Pegá o arrastrá cualquier contenido</h3>
          <p>Texto · PDF · imágenes · capturas · páginas web · videos de YouTube. La temática se detecta automáticamente.</p>
          {file&&<span className="filePill">{file.name} · {fmt(file.size)}</span>}
        </div>
        <input className="urlInput" value={url} onChange={e=>setUrl(e.target.value)} placeholder="Opcional: pegá URL de web o YouTube"/>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Pegá texto o agregá una pregunta sobre el documento."/>
        {!isPro&&<div className={`counter ${textTooLong?'bad':''}`}>{text.length}/{FREE_CHARS}</div>}
        <div className="ctaRow"><button className="primary" onClick={analyze} disabled={loading||locked||textTooLong||proInput}>{loading?'Analizando':'Analizar'}</button><span className="hint">Entrada: {detected}</span></div>
        {(locked||textTooLong||proInput)&&<div className="paywall">Starter permite 3 análisis de texto de hasta 250 caracteres. Pasá a Pro para todas las funciones.</div>}
        {loading&&<div className="loading">{steps.map((s,i)=><p key={i}>{s}</p>)}</div>}
      </div>
      <div className="scorePanel">
        <div className="panel scoreCard">
          <div className="scoreWrap">
            <div className="circleScore" style={{['--p' as any]:81}}><div><span>81</span><small>/100</small></div></div>
            <div className="scoreText"><h2>ChamuyoScore™</h2><h3>Vista previa del informe</h3><p>Subí un documento o pegá contenido para generar un análisis con evidencia, riesgos, recomendaciones y aviso legal reducido.</p></div>
          </div>
        </div>
        <div className="panel decisionCard"><div className="light"></div><div><h2>Semáforo de decisiones</h2><h3>Verificá antes de decidir</h3><p>ChamuyoCheck no acusa: muestra qué conviene revisar antes de confiar.</p></div></div>
      </div>
    </section>}
    {analysis && <section id="informe">
      <div className="heroGrid">
        <div className="panel scoreCard">
          <div className="scoreWrap">
            <div className="circleScore" style={{['--p' as any]:score}}><div><span>{score}</span><small>/100</small></div></div>
            <div className="scoreText"><h2>ChamuyoScore™</h2><h3>{score>=75?'Buena confiabilidad':score>=45?'Confiabilidad media':'Requiere alta verificación'}</h3><p>{analysis.summary}</p><button className="ghost">Ver explicación del puntaje⌄</button></div>
          </div>
        </div>
        <div className="panel decisionCard"><div className="light" style={{background:semaforo.color}}></div><div><h2>Semáforo de decisiones</h2><h3 style={{color:semaforo.color}}>{semaforo.txt}</h3><p>{analysis.prudentConclusion}</p></div></div>
        <div className="panel metaCard">
          <div className="meta"><small>Tipo</small><b>{analysis.documentType}</b></div>
          <div className="meta"><small>Entrada</small><b>{analysis.detectedInput}</b></div>
          <div className="meta"><small>Caracteres</small><b>{analysis.extractedChars||text.length}</b></div>
          <div className="meta"><small>Idioma</small><b>Español</b></div>
          <div className="meta"><small>Confianza</small><b>{analysis.confidence}</b></div>
        </div>
      </div>
      <div className="reportTabs">{['Resumen','Evidencias','Riesgos','IA y Originalidad','Finanzas','Recomendaciones','Fuentes','Datos extraídos'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}</div>
      <div className="cards">
        <div className="card"><h3>▣ Resumen ejecutivo</h3><p>{analysis.verdict}</p><button className="ghost">Leer resumen completo</button></div>
        <div className="card"><h3 className="ok">✓ Fortalezas</h3><ul>{(analysis.evidenceFound||[]).slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
        <div className="card"><h3 className="warn">! Debilidades</h3><ul>{analysis.missingInformation.slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
        <div className="card"><h3 className="bad">◇ Riesgos principales</h3><ul>{analysis.issues.slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
      </div>
      <div className="verifyBand">
        <div><h3>💡 ¿Qué deberías verificar?</h3><p>Antes de confiar o tomar una decisión basada en este documento, verificá estos puntos clave.</p><button className="ghost">Ver lista completa</button></div>
        <div className="verifyList">{analysis.questions.slice(0,6).map((x,i)=><div key={i}><span className="num">{i+1}</span>{x}</div>)}</div>
        <div><h3>↗ ¿Querés mejorar este documento?</h3><p>Obtené sugerencias específicas para aumentar calidad y confiabilidad.</p><button className="ghost">Mejorar documento</button></div>
      </div>
      <div className="section"><h2>Especialistas activados</h2><div className="moduleGrid">{analysis.modules.map(moduleCard)}</div></div>
      <div className="section"><h2>Por qué obtuvo este puntaje</h2><ul>{(analysis.scoreExplanation||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
      {analysis.extractedPreview&&<div className="section"><h2>Datos extraídos</h2><p>{analysis.extractedPreview}</p></div>}
    </section>}
  </main>
  <div className="legalFooter"><details><summary>🔒 Aviso legal</summary><p>{analysis?.legalSafeguard||'ChamuyoCheck genera una evaluación automatizada y orientativa. No afirma veracidad, falsedad, autoría, plagio, uso de IA ni ilegalidad; no reemplaza asesoramiento profesional.'}</p></details><span>ChamuyoCheck no afirma la veracidad de la información analizada.</span></div>
 </div>
}
