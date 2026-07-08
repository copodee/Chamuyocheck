export async function extractWebText(url: string) {
  try {
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, text: '', title: '', note: 'URL inválida o incompleta.' };
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChamuyoCheckBot/1.0' },
      cache: 'no-store'
    });

    const html = await res.text();
    const title = (html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || '').replace(/\s+/g, ' ').trim();

    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return {
      ok: cleaned.length > 80,
      text: cleaned.slice(0, 18000),
      title,
      note: cleaned.length > 80 ? 'Texto web extraído automáticamente.' : 'No se pudo extraer suficiente texto de la página.'
    };
  } catch {
    return { ok: false, text: '', title: '', note: 'No se pudo leer la página web. Puede bloquear bots o requerir JavaScript.' };
  }
}
