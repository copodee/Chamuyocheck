import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const demo = {
  score: 72,
  risk: 'alto',
  summary: 'El texto usa promesas amplias, poca evidencia concreta y lenguaje de urgencia. No necesariamente es falso, pero necesita respaldo antes de ser creído.',
  emptyPhrases: ['solución revolucionaria', 'resultados garantizados', 'metodología única'],
  unsupportedClaims: ['Promete mejoras sin datos verificables', 'No muestra casos, fuentes ni condiciones'],
  manipulation: ['Usa miedo a quedarse afuera', 'Sugiere urgencia sin explicar por qué'],
  questions: ['¿Qué evidencia concreta respalda la promesa?', '¿Qué pasa si no se cumple?', '¿Hay casos verificables?', '¿Cuáles son los costos ocultos?'],
  rewrite: 'Una versión más honesta debería explicar el alcance, las condiciones, los riesgos y la evidencia disponible sin prometer resultados garantizados.'
};

export async function POST(req: Request) {
  try {
    const { text, mode } = await req.json();
    if (!text || text.trim().length < 40) return NextResponse.json({ error: 'Pegá un texto de al menos 40 caracteres.' }, { status: 400 });
    if (text.length > 2500) return NextResponse.json({ error: 'En la versión gratis el límite es 2.500 caracteres.' }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json(demo);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Analizá el siguiente texto en español rioplatense como ChamuyoCheck. Modo: ${mode}. No afirmes que algo es falso. Marcá riesgos de credibilidad, exageración, falta de evidencia, falacias, manipulación emocional y preguntas para verificar. Devolvé SOLO JSON válido con estas claves: score number 0-100, risk string bajo/medio/alto, summary string, emptyPhrases string[], unsupportedClaims string[], manipulation string[], questions string[], rewrite string. Texto: ${text}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2
    });
    const content = completion.choices[0]?.message?.content || '{}';
    return NextResponse.json(JSON.parse(content));
  } catch (e:any) {
    return NextResponse.json({ error: 'No se pudo analizar. Revisá la configuración de OpenAI.' }, { status: 500 });
  }
}
