
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
export const runtime='nodejs';

function clamp(n:any,f=50){const x=Number(n);return Number.isFinite(x)?Math.max(0,Math.min(100,Math.round(x))):f}
async function extractPdfText(file: File){
  try{
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    const text = String(data.text || '').replace(/\s+\n/g,'\n').trim();
    return { ok: true, text: text.slice(0, 18000), pages: data.numpages || null, chars: text.length, note: text.length ? 'Texto extraído del PDF.' : 'PDF recibido, pero no se pudo extraer texto visible. Puede ser escaneado o imagen.' };
  }catch(e){
    return { ok: false, text: '', pages: null, chars: 0, note: 'No se pudo extraer texto del PDF. Puede requerir OCR.' };
  }
}
function inferDoc(text:string,input:string,fileName:string){
 const t=(text+' '+fileName).toLowerCase();
 if(/tesis|monograf|trabajo pr|facultad|universidad|colegio|alumno|docente|bibliograf|ensayo|conclusi[oó]n|introducci[oó]n|marco te[oó]rico|abstract|referencias/.test(t)) return {icon:'🎓', documentType:'Trabajo académico', focus:'Posible uso de IA / calidad académica'};
 if(/nota|comunicado|period[ií]stic|diario|fuentes cercanas|redacci[oó]n|entrevist/.test(t)) return {icon:'📰', documentType:'Nota o artículo periodístico', focus:'Veracidad, fuentes y posible redacción asistida'};
 if(/contrato|cl[aá]usula|locaci[oó]n|compraventa|mutuo|leasing|t[eé]rminos|condiciones/.test(t)) return {icon:'📑', documentType:'Contrato o documento legal', focus:'Cláusulas, riesgos y faltantes'};
 if(/pr[eé]stamo|cuota|cft|tea|tna|cr[eé]dito|financiaci[oó]n|inter[eé]s|\$/.test(t)) return {icon:'💳', documentType:'Oferta financiera', focus:'Costo real, CFT y cargos omitidos'};
 if(/referido|referidos|multinivel|ponzi|pir[aá]mid|ingresos pasivos|rentabilidad garantizada/.test(t)) return {icon:'🕸️', documentType:'Oferta de inversión o referidos', focus:'Riesgo piramidal / promesas'};
 if(/medicamento|salud|m[eé]dico|cura|tratamiento|suplemento|c[aá]ncer|dolor/.test(t)) return {icon:'⚕️', documentType:'Contenido de salud', focus:'Respaldo médico y advertencias'};
 if(input==='PDF') return {icon:'📄', documentType:'Documento PDF', focus:'Clasificación documental basada en texto extraído'};
 if(input==='Imagen') return {icon:'🖼️', documentType:'Imagen o captura', focus:'Texto visible y señales de manipulación'};
 if(input==='Web') return {icon:'🌐', documentType:'Página web', focus:'Credibilidad online'};
 if(input==='YouTube') return {icon:'▶️', documentType:'Video de YouTube', focus:'Promesas y evidencia del contenido'};
 return {icon:'📝', documentType:'Texto libre', focus:'Credibilidad general'};
}
function local(text:string,input:string,fileName:string, extraction:any){
 const doc=inferDoc(text,input,fileName);
 const all=text+' '+fileName;
 const fin=/(pr[eé]stamo|cuota|cft|tea|tna|cr[eé]dito|financiaci[oó]n|inter[eé]s|\$)/i.test(all);
 const pyramid=/(referido|referidos|red|multinivel|ingresos pasivos|rentabilidad garantizada|ponzi|pir[aá]mid|invitar)/i.test(all);
 const academic=/trabajo acad[eé]mico|facultad|colegio|alumno|ensayo|monograf|tesis|bibliograf|docente|hecha con ia|hecho con ia|ia/i.test(all);
 const article=/nota|art[ií]culo|period[ií]stic|comunicado|fuente|redacci[oó]n/i.test(all);
 const health=/(medicamento|salud|m[eé]dico|tratamiento|suplemento|dieta|cura|dolor|c[aá]ncer)/i.test(all);
 const promise=/(garantiz|asegur|sin esfuerzo|millonari|duplic|triplic|100%|riesgo cero|resultado|aprobaci[oó]n inmediata)/i.test(all);
 const missing=!/(fuente|estudio|metodolog|contrato|bases|condiciones|cft|tea|tna|bibliograf|reglamento)/i.test(all);
 const aiStyle=academic || /(seg[uú]n diversos autores|en conclusi[oó]n|es importante destacar|cabe mencionar|por otro lado|en este sentido|de manera integral)/i.test(all);
 const score=clamp(16+(promise?24:0)+(missing?16:0)+(fin?22:0)+(pyramid?28:0)+(health?22:0)+(aiStyle?18:0)+(article?8:0));
 const categoryScores=[
  {name:'Lectura del documento',score:extraction?.chars?90:35,explanation:extraction?.chars?`Se extrajeron ${extraction.chars} caracteres del PDF${extraction.pages?` en ${extraction.pages} páginas`:''}.`:'El archivo fue recibido, pero no se extrajo texto suficiente.'},
  {name:'Credibilidad',score:clamp(100-score),explanation:'Mide respaldo, coherencia y verificabilidad con la información visible.'},
  {name:'Evidencia faltante',score:missing?82:30,explanation:'Sube cuando hay cifras, promesas o conclusiones sin fuente verificable.'},
  {name:'Transparencia',score:fin?75:(missing?64:25),explanation:'Evalúa condiciones, costos, límites y letra chica.'},
  {name:'Manipulación emocional',score:promise?65:20,explanation:'Detecta urgencia, deseo aspiracional, miedo o promesas extraordinarias.'},
  {name:'Riesgo financiero',score:fin?88:0,explanation:fin?'Faltan CFT, TEA, TNA, IVA, comisiones, seguros y costo total.':'No se detectó oferta financiera principal.'},
  {name:'Riesgo piramidal/Ponzi',score:pyramid?86:0,explanation:pyramid?'Hay señales de referidos, ingresos pasivos o rentabilidad prometida.':'No se detectaron señales piramidales fuertes.'},
  {name:'Posible IA académica',score:academic||aiStyle?72:0,explanation:academic||aiStyle?'Estimación no concluyente: revisar estilo, fuentes, borradores y defensa oral.':'No se activó como eje principal.'},
  {name:'Redacción asistida por IA',score:(article&&/ia|chatgpt|hecha con ia|hecho con ia/i.test(all))?62:0,explanation:'Solo estima patrones; no prueba autoría ni uso de IA.'}
 ];
 return {documentIcon:doc.icon,documentType:doc.documentType,documentFocus:doc.focus,extractionStatus:extraction?.note||'Contenido recibido.',extractedChars:extraction?.chars||text.length,extractedPreview:(extraction?.text||text||'').slice(0,1200),score,risk:score>74?'Alto':score>44?'Medio':'Bajo',confidence:extraction?.chars?'Media/Alta':'Media',detectedTheme:doc.documentType,detectedInput:input,centralQuestion:academic?'¿Hay indicios suficientes para pedir verificación académica sin acusar?':article?'¿La nota tiene señales que convenga verificar antes de tomarla como confiable?':fin?'¿Puedo decidir sin ver el costo total y el contrato?':'¿Puedo confiar en esto sin pedir más evidencia?',summary:academic?'El documento se analiza como posible trabajo académico. La respuesta debe resaltar indicios, no afirmar autoría ni uso de IA como certeza.':article?'El PDF se analiza como nota o pieza periodística/comunicacional. Se revisan fuentes, estilo, respaldo y señales de redacción asistida.':fin?'El contenido activa análisis financiero. La prioridad es costo total, CFT y cargos omitidos.':'El contenido requiere contrastar evidencia, fuentes y condiciones.',prudentConclusion:academic?'No concluiría que fue hecho con IA; pediría defensa oral, borradores, fuentes y coherencia metodológica.':article?'No afirmaría que sea falsa ni hecha con IA; verificaría fuente, autor, fecha, citas y trazabilidad.':fin?'No decidiría por la cuota hasta ver CFT, contrato y cargos.':'Pediría evidencia y condiciones antes de decidir.',verdict:'Evaluación prudente: indicadores de riesgo, no afirmación definitiva sobre veracidad, autoría, legalidad, plagio, uso de IA o intención.',categoryScores,modules:categoryScores.filter((c:any)=>c.score>0).slice(0,8),flaggedPhrases:(promise||aiStyle)?[{phrase:all.slice(0,220)||fileName,problem:academic?'Puede requerir revisión académica: estilo, fuentes o trazabilidad.':'Frase o estructura que requiere respaldo, fuente o contexto.',severity:'Media'}]:[],issues:[extraction?.chars?'El análisis usa texto extraído del archivo.':'No se pudo leer texto completo del archivo; análisis preliminar.',academic?'Posible análisis académico: no prueba uso de IA; requiere verificación docente.':'',article?'Conviene verificar autor, fuente, fecha, citas y origen de la nota.':'',promise?'Promesa o resultado atractivo sin margen claro de incertidumbre.':'',missing?'Faltan fuentes o metodología verificable.':'',fin?'Faltan costos financieros completos.':'',pyramid?'Posible estructura basada en referidos o rentabilidad prometida.':''].filter(Boolean),questions:['¿Qué fuente independiente respalda la afirmación?','¿Quién es el autor y cuál es la fecha?','¿Qué evidencia verificable aparece dentro del documento?',academic?'¿El autor puede defender oralmente el trabajo y mostrar borradores?':'',article?'¿La nota cita fuentes, documentos o testimonios comprobables?':'',fin?'¿Cuál es el CFT efectivo anual con IVA incluido?':''].filter(Boolean),missingInformation:['fuentes verificables','autor, fecha y origen del documento','metodología o base del dato',academic?'borradores, historial de edición, fuentes y defensa oral':'',fin?'CFT, TEA, TNA, IVA, seguros, comisiones y mora':''].filter(Boolean),worstCase:academic?'Acusar erróneamente a un alumno sin evidencia concluyente.':article?'Dar por real o falsa una nota sin confirmar origen, autor y fuentes.':fin?'Aceptar por la cuota y descubrir cargos o un CFT mayor.':'Tomar una decisión impulsiva con información incompleta.',improved:academic?'Pedir al alumno una breve defensa oral, fuentes usadas, borradores y explicación del proceso.':article?'Incluir autor, fecha, fuentes documentales, citas verificables y enlace al origen.':'Explicar alcance, límites, requisitos, evidencia, costos, riesgos y condiciones verificables.',legalSafeguard:'ChamuyoCheck genera una evaluación automatizada basada exclusivamente en el contenido ingresado o extraído del archivo. No afirma que una persona o empresa mienta, no determina ilicitud, autoría, plagio, uso de IA ni diagnóstico, y no reemplaza asesoramiento legal, financiero, médico, educativo ni profesional.'}
}
function norm(raw:any,text:string,input:string,fileName:string,extraction:any){const f=local(text,input,fileName,extraction);return {...f,...raw,documentIcon:String(raw?.documentIcon||f.documentIcon),documentType:String(raw?.documentType||f.documentType),documentFocus:String(raw?.documentFocus||f.documentFocus),extractionStatus:String(raw?.extractionStatus||f.extractionStatus),extractedChars:Number(raw?.extractedChars||f.extractedChars),extractedPreview:String(raw?.extractedPreview||f.extractedPreview||''),score:clamp(raw?.score,f.score),categoryScores:Array.isArray(raw?.categoryScores)?raw.categoryScores.map((c:any)=>({name:String(c.name||'Categoría'),score:clamp(c.score),explanation:String(c.explanation||'')})).slice(0,9):f.categoryScores,modules:Array.isArray(raw?.modules)?raw.modules.map((c:any)=>({name:String(c.name||'Módulo'),score:clamp(c.score),explanation:String(c.explanation||'')})).slice(0,8):f.modules,legalSafeguard:f.legalSafeguard}}
export async function POST(req:Request){
 try{
  const form=await req.formData();
  const text=String(form.get('text')||'').trim();
  const input=String(form.get('inputType')||'Automático');
  const url=String(form.get('url')||'').trim();
  const file=form.get('file') as File | null;
  let fileName='';
  let extracted='';
  let extraction:any={ok:true,text:'',pages:null,chars:0,note:'Sin archivo.'};
  if(file){
    fileName=file.name || '';
    if(file.type==='application/pdf' || fileName.toLowerCase().endsWith('.pdf')){
      extraction = await extractPdfText(file);
      extracted = extraction.text ? `TEXTO EXTRAÍDO DEL PDF ${fileName}:\n${extraction.text}` : `Archivo PDF recibido: ${fileName}. ${extraction.note}`;
    } else if(file.type?.startsWith('image/')){
      extraction={ok:false,text:'',pages:null,chars:0,note:'Imagen recibida. OCR real queda para próxima versión.'};
      extracted=`Imagen/captura recibida: ${fileName}. Tamaño aproximado: ${file.size} bytes.`;
    } else {
      extraction={ok:false,text:'',pages:null,chars:0,note:'Archivo recibido; extracción profunda no disponible.'};
      extracted=`Archivo recibido: ${fileName}. Tamaño aproximado: ${file.size} bytes.`;
    }
  }
  const full=[extracted,text?`PREGUNTA O CONTEXTO DEL USUARIO:\n${text}`:'',url?`URL indicada: ${url}`:''].filter(Boolean).join('\\n\\n');
  if(full.length<20)return NextResponse.json({error:'Ingresá texto, URL o cargá un archivo.'},{status:400});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json(local(full,input,fileName,extraction));
  const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const prompt=`Actuá como ChamuyoCheck V9.1, auditor documental. Ahora SÍ debés priorizar el contenido extraído del PDF por encima de la pregunta del usuario. Primero identificá el tipo de documento/contenido antes del score. Si el PDF no tiene texto extraíble, decí que necesita OCR. Si el usuario pregunta si fue hecho con IA, respondé como estimación no concluyente: nunca acuses ni afirmes uso de IA/plagio. Detectá si corresponde académico, financiero, salud, contrato, inversión, web, YouTube, imagen, publicidad, política, noticia o nota. Respondé SOLO JSON con: documentIcon, documentType, documentFocus, extractionStatus, extractedChars, extractedPreview, score,risk,confidence,detectedTheme,detectedInput,centralQuestion,summary,prudentConclusion,verdict,categoryScores,modules,flaggedPhrases,issues,questions,missingInformation,worstCase,improved.\\nContenido:\\n${full.slice(0,18000)}`;
  const completion=await openai.chat.completions.create({model:'gpt-4o-mini',messages:[{role:'system',content:'Respondés solo JSON válido y prudente. Nunca afirmes mentira, estafa, plagio, IA o ilegalidad como certeza.'},{role:'user',content:prompt}],response_format:{type:'json_object'}});
  return NextResponse.json(norm(JSON.parse(completion.choices[0]?.message?.content||'{}'),full,input,fileName,extraction));
 }catch(e){return NextResponse.json({error:'No se pudo analizar el documento.'},{status:500})}
}
