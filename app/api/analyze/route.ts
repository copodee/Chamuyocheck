
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
export const runtime='nodejs';

function clamp(n:any,f=50){const x=Number(n);return Number.isFinite(x)?Math.max(0,Math.min(100,Math.round(x))):f}
function inferDoc(text:string,input:string,fileName:string){
 const t=(text+' '+fileName).toLowerCase();
 if(/tesis|monograf|trabajo pr|facultad|universidad|colegio|alumno|docente|bibliograf|ensayo|conclusi[oó]n|introducci[oó]n|marco te[oó]rico/.test(t)) return {icon:'🎓', documentType:'Trabajo académico', focus:'Posible uso de IA / calidad académica'};
 if(/contrato|cl[aá]usula|locaci[oó]n|compraventa|mutuo|leasing|t[eé]rminos|condiciones/.test(t)) return {icon:'📑', documentType:'Contrato o documento legal', focus:'Cláusulas, riesgos y faltantes'};
 if(/pr[eé]stamo|cuota|cft|tea|tna|cr[eé]dito|financiaci[oó]n|inter[eé]s|\$/.test(t)) return {icon:'💳', documentType:'Oferta financiera', focus:'Costo real, CFT y cargos omitidos'};
 if(/referido|referidos|multinivel|ponzi|pir[aá]mid|ingresos pasivos|rentabilidad garantizada/.test(t)) return {icon:'🕸️', documentType:'Oferta de inversión o referidos', focus:'Riesgo piramidal / promesas'};
 if(/medicamento|salud|m[eé]dico|cura|tratamiento|suplemento|c[aá]ncer|dolor/.test(t)) return {icon:'⚕️', documentType:'Contenido de salud', focus:'Respaldo médico y advertencias'};
 if(input==='PDF') return {icon:'📄', documentType:'Documento PDF', focus:'Clasificación documental preliminar'};
 if(input==='Imagen') return {icon:'🖼️', documentType:'Imagen o captura', focus:'Texto visible y señales de manipulación'};
 if(input==='Web') return {icon:'🌐', documentType:'Página web', focus:'Credibilidad online'};
 if(input==='YouTube') return {icon:'▶️', documentType:'Video de YouTube', focus:'Promesas y evidencia del contenido'};
 return {icon:'📝', documentType:'Texto libre', focus:'Credibilidad general'};
}
function local(text:string,input:string,fileName:string){
 const doc=inferDoc(text,input,fileName);
 const fin=/(pr[eé]stamo|cuota|cft|tea|tna|cr[eé]dito|financiaci[oó]n|inter[eé]s|\$)/i.test(text+' '+fileName);
 const pyramid=/(referido|referidos|red|multinivel|ingresos pasivos|rentabilidad garantizada|ponzi|pir[aá]mid|invitar)/i.test(text+' '+fileName);
 const academic=/trabajo acad[eé]mico|facultad|colegio|alumno|ensayo|monograf|tesis|bibliograf|docente|hecha con ia|hecho con ia|ia/i.test(text+' '+fileName);
 const health=/(medicamento|salud|m[eé]dico|tratamiento|suplemento|dieta|cura|dolor|c[aá]ncer)/i.test(text);
 const promise=/(garantiz|asegur|sin esfuerzo|millonari|duplic|triplic|100%|riesgo cero|resultado|aprobaci[oó]n inmediata)/i.test(text);
 const missing=!/(fuente|estudio|metodolog|contrato|bases|condiciones|cft|tea|tna|bibliograf|reglamento)/i.test(text);
 const aiStyle=academic || /(seg[uú]n diversos autores|en conclusi[oó]n|es importante destacar|cabe mencionar|por otro lado|en este sentido|de manera integral)/i.test(text);
 const score=clamp(18+(promise?24:0)+(missing?16:0)+(fin?22:0)+(pyramid?28:0)+(health?22:0)+(aiStyle?18:0));
 const categoryScores=[
  {name:'Comprensión del documento',score:75,explanation:'Primero identifica el tipo de pieza antes de calificarla.'},
  {name:'Credibilidad',score:clamp(100-score),explanation:'Mide respaldo, coherencia y verificabilidad con la información visible.'},
  {name:'Evidencia faltante',score:missing?82:30,explanation:'Sube cuando hay cifras, promesas o conclusiones sin fuente verificable.'},
  {name:'Transparencia',score:fin?75:(missing?64:25),explanation:'Evalúa condiciones, costos, límites y letra chica.'},
  {name:'Manipulación emocional',score:promise?65:20,explanation:'Detecta urgencia, deseo aspiracional, miedo o promesas extraordinarias.'},
  {name:'Riesgo financiero',score:fin?88:0,explanation:fin?'Faltan CFT, TEA, TNA, IVA, comisiones, seguros y costo total.':'No se detectó oferta financiera principal.'},
  {name:'Riesgo piramidal/Ponzi',score:pyramid?86:0,explanation:pyramid?'Hay señales de referidos, ingresos pasivos o rentabilidad prometida.':'No se detectaron señales piramidales fuertes.'},
  {name:'Posible IA académica',score:academic||aiStyle?72:0,explanation:academic||aiStyle?'Estimación no concluyente: revisar estilo, fuentes, borradores y defensa oral.':'No se activó como eje principal.'},
  {name:'Salud sensible',score:health?78:0,explanation:health?'Requiere fuente médica y no reemplaza consulta profesional.':'No se detectó afirmación de salud principal.'}
 ];
 const theme=doc.documentType;
 return {documentIcon:doc.icon,documentType:doc.documentType,documentFocus:doc.focus,score,risk:score>74?'Alto':score>44?'Medio':'Bajo',confidence:missing?'Media':'Alta',detectedTheme:theme,detectedInput:input,centralQuestion:academic?'¿Hay indicios suficientes para pedir verificación académica sin acusar?':fin?'¿Puedo decidir sin ver el costo total y el contrato?':health?'¿La afirmación tiene respaldo médico verificable?':'¿Puedo confiar en esto sin pedir más evidencia?',summary:academic?'El documento se trata como posible trabajo académico. La respuesta debe resaltar indicios, no afirmar autoría ni uso de IA como certeza.':fin?'El contenido activa análisis financiero. La prioridad es costo total, CFT y cargos omitidos.':'El contenido requiere contrastar evidencia, fuentes y condiciones.',prudentConclusion:academic?'No concluiría que fue hecho con IA; pediría defensa oral, borradores, fuentes y coherencia metodológica.':fin?'No decidiría por la cuota hasta ver CFT, contrato y cargos.':'Pediría evidencia y condiciones antes de decidir.',verdict:'Evaluación prudente: indicadores de riesgo, no afirmación definitiva sobre veracidad, autoría, legalidad, plagio, uso de IA o intención.',categoryScores,modules:categoryScores.filter((c:any)=>c.score>0).slice(0,8),flaggedPhrases:promise||aiStyle?[{phrase:text.slice(0,220)||fileName,problem:academic?'Puede requerir revisión académica: estilo, fuentes o trazabilidad.':'Promesa fuerte o beneficio presentado con poca incertidumbre visible.',severity:'Media'}]:[],issues:[academic?'Posible análisis académico: no prueba uso de IA; requiere verificación docente.':'',promise?'Promesa o resultado atractivo sin margen claro de incertidumbre.':'',missing?'Faltan fuentes o metodología verificable.':'',fin?'Faltan costos financieros completos.':'',pyramid?'Posible estructura basada en referidos o rentabilidad prometida.':'',health?'Tema de salud: requiere respaldo profesional.':''].filter(Boolean),questions:['¿Qué fuente independiente respalda la afirmación?','¿Qué condiciones deberían cumplirse?','¿Qué pasa si no se cumple?',academic?'¿El autor puede defender oralmente el trabajo y mostrar borradores?':'',academic?'¿Las fuentes citadas existen y fueron realmente usadas?':'',fin?'¿Cuál es el CFT efectivo anual con IVA incluido?':'',pyramid?'¿El ingreso depende de sumar referidos o de vender un producto real?':''].filter(Boolean),missingInformation:['fuentes verificables','condiciones completas','metodología o base del dato',academic?'borradores, historial de edición, fuentes y defensa oral':'',fin?'CFT, TEA, TNA, IVA, seguros, comisiones y mora':'',pyramid?'modelo de negocio y origen real de pagos':''].filter(Boolean),worstCase:academic?'Acusar erróneamente a un alumno sin evidencia concluyente.':fin?'Aceptar por la cuota y descubrir cargos o un CFT mayor.':'Tomar una decisión impulsiva con información incompleta.',improved:academic?'Pedir al alumno una breve defensa oral, fuentes usadas, borradores y explicación del proceso.':'Explicar alcance, límites, requisitos, evidencia, costos, riesgos y condiciones verificables.',legalSafeguard:'ChamuyoCheck genera una evaluación automatizada basada exclusivamente en el contenido ingresado. No afirma que una persona o empresa mienta, no determina ilicitud, autoría, plagio, uso de IA ni diagnóstico, y no reemplaza asesoramiento legal, financiero, médico, educativo ni profesional.'}
}
function norm(raw:any,text:string,input:string,fileName:string){const f=local(text,input,fileName);return {...f,...raw,documentIcon:String(raw?.documentIcon||f.documentIcon),documentType:String(raw?.documentType||f.documentType),documentFocus:String(raw?.documentFocus||f.documentFocus),score:clamp(raw?.score,f.score),categoryScores:Array.isArray(raw?.categoryScores)?raw.categoryScores.map((c:any)=>({name:String(c.name||'Categoría'),score:clamp(c.score),explanation:String(c.explanation||'')})).slice(0,9):f.categoryScores,modules:Array.isArray(raw?.modules)?raw.modules.map((c:any)=>({name:String(c.name||'Módulo'),score:clamp(c.score),explanation:String(c.explanation||'')})).slice(0,8):f.modules,legalSafeguard:f.legalSafeguard}}
export async function POST(req:Request){
 try{
  const form=await req.formData();
  const text=String(form.get('text')||'').trim();
  const input=String(form.get('inputType')||'Automático');
  const url=String(form.get('url')||'').trim();
  const file=form.get('file') as File | null;
  let fileName='';
  let extracted='';
  if(file){
    fileName=file.name || '';
    if(file.type==='application/pdf' || fileName.toLowerCase().endsWith('.pdf')){
      // V9: identifica documento por archivo y metadatos; lectura profunda queda preparada para V9.1/V10.
      extracted=`Archivo PDF recibido: ${fileName}. Tamaño aproximado: ${file.size} bytes.`;
    } else if(file.type?.startsWith('image/')){
      extracted=`Imagen/captura recibida: ${fileName}. Tamaño aproximado: ${file.size} bytes.`;
    } else {
      extracted=`Archivo recibido: ${fileName}. Tamaño aproximado: ${file.size} bytes.`;
    }
  }
  const full=[extracted,text,url?`URL indicada: ${url}`:''].filter(Boolean).join('\\n\\n');
  if(full.length<20)return NextResponse.json({error:'Ingresá texto, URL o cargá un archivo.'},{status:400});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json(local(full,input,fileName));
  const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const prompt=`Actuá como ChamuyoCheck V9, auditor documental. Primero identificá el tipo de documento/contenido ANTES del score. Si se subió un archivo y no hay texto extraído completo, indicá que la clasificación es preliminar basada en archivo, nombre, notas y metadatos. Si el usuario pregunta si un trabajo fue hecho con IA, respondé como estimación no concluyente: nunca acuses ni afirmes uso de IA/plagio. Detectá si corresponde académico, financiero, salud, contrato, inversión, web, YouTube, imagen, publicidad, política o noticia. Respondé SOLO JSON con: documentIcon, documentType, documentFocus, score,risk,confidence,detectedTheme,detectedInput,centralQuestion,summary,prudentConclusion,verdict,categoryScores,modules,flaggedPhrases,issues,questions,missingInformation,worstCase,improved.\\nContenido:\\n${full.slice(0,14000)}`;
  const completion=await openai.chat.completions.create({model:'gpt-4o-mini',messages:[{role:'system',content:'Respondés solo JSON válido y prudente. Nunca afirmes mentira, estafa, plagio, IA o ilegalidad como certeza.'},{role:'user',content:prompt}],response_format:{type:'json_object'}});
  return NextResponse.json(norm(JSON.parse(completion.choices[0]?.message?.content||'{}'),full,input,fileName));
 }catch(e){return NextResponse.json({error:'No se pudo analizar.'},{status:500})}
}
