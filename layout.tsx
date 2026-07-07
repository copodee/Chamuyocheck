import { NextResponse } from 'next/server';
import OpenAI from 'openai';

function demo(text:string){
  return {score:72,risk:'Medio/Alto',summary:'El texto tiene señales de promesa inflada y necesita evidencia concreta antes de ser creído.',issues:['Usa beneficios amplios sin datos verificables.','No explica metodología, plazos ni condiciones.','Puede generar urgencia o expectativa exagerada.'],questions:['¿Qué evidencia independiente respalda esta afirmación?','¿Cuál es el costo total y qué condiciones aplican?','¿Qué pasa si el resultado prometido no ocurre?'],improved:'Una versión más honesta debería explicar el alcance real, las condiciones, los límites y las pruebas disponibles.'}
}

export async function POST(req:Request){
  try{
    const {text}=await req.json();
    if(!text || typeof text!=='string' || text.trim().length<20) return NextResponse.json({error:'Pegá un texto de al menos 20 caracteres.'},{status:400});
    if(!process.env.OPENAI_API_KEY) return NextResponse.json(demo(text));
    const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const prompt=`Analizá el siguiente texto como ChamuyoCheck. No digas que algo es falso salvo que sea evidente. Evaluá humo, exageración, promesas sin sustento, manipulación emocional, falacias, datos no comprobados y riesgo reputacional. Respondé SOLO JSON válido con: score number 0-100, risk string, summary string, issues array de 4 strings, questions array de 4 strings, improved string. Texto:\n${text.slice(0,12000)}`;
    const completion=await openai.chat.completions.create({model:'gpt-4o-mini',messages:[{role:'system',content:'Sos un auditor de credibilidad en español argentino. Sos claro, firme y legalmente prudente.'},{role:'user',content:prompt}],response_format:{type:'json_object'}});
    const raw=completion.choices[0]?.message?.content || '{}';
    return NextResponse.json(JSON.parse(raw));
  }catch(e:any){return NextResponse.json({error:'Error analizando el texto.'},{status:500})}
}
