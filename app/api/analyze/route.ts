
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

type Category={name:string;score:number;explanation:string};
type Analysis={score:number;risk:string;confidence:string;detectedTheme:string;detectedInput:string;centralQuestion:string;summary:string;prudentConclusion:string;verdict:string;categoryScores:Category[];modules:Category[];flaggedPhrases:{phrase:string;problem:string;severity:string}[];issues:string[];questions:string[];missingInformation:string[];worstCase:string;improved:string;legalSafeguard:string};

function clamp(n:any,f=50){const x=Number(n);return Number.isFinite(x)?Math.max(0,Math.min(100,Math.round(x))):f}
function money(n:number){return '$'+Math.round(n).toLocaleString('es-AR')}
function financial(text:string){
 const nums=(text.match(/\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]+)/g)||[]).map(x=>Number(x.replace(/[^\d]/g,''))).filter(Boolean);
 const months=Number((text.toLowerCase().match(/(\d{1,3})\s*(cuotas|meses|pagos)/)||[])[1]||0)||null;
 const is=/(pr[eé]stamo|cuota|cft|tea|tna|cr[eé]dito|financiaci[oó]n|inter[eé]s|\$)/i.test(text);
 if(!is)return null;
 const amount=nums.length?Math.max(...nums):null;
 const installment=nums.length>1?Math.min(...nums.filter(n=>n!==amount)):null;
 const total=installment&&months?installment*months:null;
 const hidden=amount&&total?total-amount:null;
 return {amount,installment,months,total,hidden,summary: total&&amount?`Con los datos visibles, devolverías aproximadamente ${money(total)}. Eso implica ${money(hidden||0)} por encima del capital publicado. Falta verificar CFT, TEA, TNA, IVA, comisiones, seguros, mora y contrato.`:'La oferta requiere costo total, CFT, comisiones, seguros, IVA, mora, plazo y contrato completo.'}
}
function local(text:string,input:string):Analysis{
 const lower=text.toLowerCase();
 const fin=financial(text);
 const pyramid=/(referido|referidos|red|multinivel|ingresos pasivos|rentabilidad garantizada|ponzi|pir[aá]mid|invitar)/i.test(text);
 const academic=/(trabajo pr[aá]ctico|facultad|colegio|alumno|ensayo|monograf|tesis|bibliograf|docente)/i.test(text);
 const health=/(salud|m[eé]dico|cura|enfermedad|c[aá]ncer|tratamiento|medicamento|suplemento|dieta)/i.test(text);
 const legal=/(contrato|cl[aá]usula|demanda|derecho|legal|abogado|multa|responsabilidad)/i.test(text);
 const promise=/(garantiz|asegur|sin esfuerzo|millonari|duplic|triplic|100%|riesgo cero|resultado|aprobaci[oó]n inmediata)/i.test(text);
 const evidenceMissing=!/(fuente|estudio|metodolog|contrato|bases|condiciones|cft|tea|tna|bibliograf|doi|reglamento)/i.test(text);
 let theme='Comercial / credibilidad general';
 if(fin) theme='Finanzas / préstamo';
 else if(pyramid) theme='Inversiones / referidos';
 else if(academic) theme='Educación / posible IA o plagio';
 else if(health) theme='Salud / evidencia científica';
 else if(legal) theme='Legal / contractual';
 const score=clamp(22+(promise?25:0)+(evidenceMissing?20:0)+(fin?25:0)+(pyramid?30:0)+(health?15:0));
 const cats=[
  {name:'Credibilidad',score:clamp(100-score),explanation:'Mide respaldo, coherencia y verificabilidad con la información visible.'},
  {name:'Evidencia faltante',score:evidenceMissing?82:30,explanation:'Sube cuando hay cifras, promesas, autoridad o conclusiones sin fuente verificable.'},
  {name:'Transparencia',score:fin?75:(evidenceMissing?64:25),explanation:'Evalúa condiciones, costos, límites, responsables, metodología y letra chica.'},
  {name:'Manipulación emocional',score:promise?65:20,explanation:'Detecta urgencia, deseo aspiracional, miedo, presión o promesas extraordinarias.'},
  {name:'Riesgo financiero',score:fin?88:0,explanation:fin?fin.summary:'No se detectó una oferta financiera principal.'},
  {name:'Riesgo piramidal/Ponzi',score:pyramid?86:0,explanation:pyramid?'Hay señales de referidos, ingresos pasivos o rentabilidad prometida. Requiere verificar negocio real y origen de pagos.':'No se detectaron señales piramidales fuertes.'},
  {name:'IA académica',score:academic?58:0,explanation:academic?'Estimación no concluyente. Requiere defensa oral, borradores, fuentes e historial de trabajo.':'No parece un trabajo académico principal.'},
  {name:'Plagio estimativo',score:academic?42:0,explanation:'Sin búsqueda externa o fuente de comparación, solo puede marcar señales internas.'}
 ];
 return {
  score,risk:score>74?'Alto':score>44?'Medio':'Bajo',confidence:evidenceMissing?'Media':'Alta',
  detectedTheme:theme,detectedInput:input,centralQuestion:fin?'¿Puedo decidir sin ver el costo total y el contrato?':academic?'¿Hay base suficiente para pedir más evidencia sin acusar?':'¿Puedo confiar en esto sin pedir más evidencia?',
  summary:fin?fin.summary:pyramid?'El contenido activa un radar de referidos o rentabilidad prometida. Conviene verificar origen real de ingresos y condiciones.':academic?'El análisis puede orientar una revisión docente, pero no prueba uso de IA ni plagio.':'El contenido presenta señales que conviene contrastar con evidencia, fuentes y condiciones.',
  prudentConclusion:fin?'No decidiría por la cuota hasta ver CFT, contrato, cargos, seguros, IVA y total a pagar.':academic?'No acusaría; pediría explicación oral, borradores y fuentes.':'Pediría evidencia y condiciones antes de decidir.',
  verdict:'Evaluación prudente: son indicadores de riesgo, no una afirmación definitiva sobre veracidad, autoría, legalidad o intención.',
  categoryScores:cats,
  modules:cats.filter(c=>c.score>0).slice(0,6),
  flaggedPhrases: promise?[{phrase:text.slice(0,220),problem:'Promesa fuerte o beneficio presentado con poca incertidumbre visible.',severity:'Media'}]:[],
  issues:[promise?'Promesa o resultado atractivo sin margen claro de incertidumbre.':'',evidenceMissing?'Faltan fuentes o metodología verificable.':'',fin?'Faltan costos financieros completos.':'',pyramid?'Posible estructura basada en referidos o rentabilidad prometida.':''].filter(Boolean),
  questions:['¿Qué fuente independiente respalda la afirmación?','¿Qué condiciones deberían cumplirse?','¿Qué pasa si no se cumple?',fin?'¿Cuál es el CFT efectivo anual con IVA incluido?':'',academic?'¿El autor puede defender oralmente el trabajo y mostrar borradores?':'',pyramid?'¿El ingreso depende de sumar referidos o de vender un producto real?':''].filter(Boolean),
  missingInformation:['fuentes verificables','condiciones completas','metodología o base del dato',fin?'CFT, TEA, TNA, IVA, seguros, comisiones y mora':'',academic?'borradores, fuentes, historial y defensa oral':'',pyramid?'modelo de negocio y origen real de pagos':''].filter(Boolean),
  worstCase:fin?'Aceptar por la cuota y descubrir cargos o un CFT mayor.':pyramid?'Ingresar por una promesa de rentabilidad y que dependa de sumar nuevos participantes.':'Tomar una decisión impulsiva con información incompleta.',
  improved:fin?'Mostrar monto neto, cuota, plazo, CFT con IVA, TEA, TNA, comisiones, seguros, gastos, mora y total a pagar.':'Explicar alcance, límites, requisitos, evidencia, costos, riesgos y condiciones verificables.',
  legalSafeguard:'ChamuyoCheck genera una evaluación automatizada basada exclusivamente en el contenido ingresado. No afirma que una persona o empresa mienta, no determina ilicitud, autoría ni plagio, y no reemplaza asesoramiento legal, financiero, médico, educativo ni profesional.'
 }
}
function normalize(raw:any,text:string,input:string):Analysis{const f=local(text,input);return {...f,...raw,score:clamp(raw?.score,f.score),categoryScores:Array.isArray(raw?.categoryScores)?raw.categoryScores.map((c:any)=>({name:String(c.name||'Categoría'),score:clamp(c.score),explanation:String(c.explanation||'')})).slice(0,8):f.categoryScores,modules:Array.isArray(raw?.modules)?raw.modules.map((c:any)=>({name:String(c.name||'Módulo'),score:clamp(c.score),explanation:String(c.explanation||'')})).slice(0,8):f.modules,legalSafeguard:f.legalSafeguard}}
export async function POST(req:Request){
 try{
  const body=await req.json();
  const text=String(body?.text||'').trim();
  const url=String(body?.url||'').trim();
  const input=String(body?.inputType||'Texto');
  const fileNotes=Array.isArray(body?.files)?body.files.map((f:any)=>`${f.name} (${f.type||'archivo'})`).join(', '):'';
  const full=[text,url?`URL: ${url}`:'',fileNotes?`Archivos: ${fileNotes}`:''].filter(Boolean).join('\n\n');
  if(full.length<20)return NextResponse.json({error:'Ingresá al menos 20 caracteres.'},{status:400});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json(local(full,input));
  const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const prompt=`Actuá como ChamuyoCheck V7. El usuario no elige temática: detectala automáticamente. Analizá cualquier contenido: texto, PDF, imagen, web, YouTube, educación, salud, finanzas, legal, plagio, IA académica, pirámides, publicidad. No acuses. No digas "miente", "estafa", "plagio" o "hecho con IA" salvo admisión literal. Usá lenguaje prudente. Respondé SOLO JSON con: score,risk,confidence,detectedTheme,detectedInput,centralQuestion,summary,prudentConclusion,verdict,categoryScores,modules,flaggedPhrases,issues,questions,missingInformation,worstCase,improved.\nContenido:\n${full.slice(0,15000)}`;
  const completion=await openai.chat.completions.create({model:'gpt-4o-mini',messages:[{role:'system',content:'Respondés solo JSON válido y prudente.'},{role:'user',content:prompt}],response_format:{type:'json_object'}});
  const raw=JSON.parse(completion.choices[0]?.message?.content||'{}');
  return NextResponse.json(normalize(raw,full,input));
 }catch(e){return NextResponse.json({error:'No se pudo analizar.'},{status:500})}
}
