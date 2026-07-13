export type YoutubeTranscriptResult = {
  ok: boolean;
  videoId: string | null;
  title: string;
  text: string;
  language: string | null;
  note: string;
};

function videoIdFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname.toLowerCase())) return null;
    const id = url.hostname.toLowerCase() === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v') || url.pathname.match(/^\/shorts\/([\w-]{11})/)?.[1] || null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function extractJsonObject(source: string, marker: string): any | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = source.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) {
      try { return JSON.parse(source.slice(start, index + 1)); } catch { return null; }
    }
  }
  return null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ').trim();
}

export async function extractYoutubeTranscript(rawUrl: string, fetcher: typeof fetch = fetch): Promise<YoutubeTranscriptResult> {
  const videoId = videoIdFromUrl(rawUrl);
  if (!videoId) return { ok: false, videoId: null, title: '', text: '', language: null, note: 'La URL de YouTube no es válida o no identifica un video.' };
  try {
    const watch = await fetcher(`https://www.youtube.com/watch?v=${videoId}`, { redirect: 'error', headers: { 'accept-language': 'es-AR,es;q=0.9,en;q=0.6' } });
    if (!watch.ok) throw new Error('watch');
    const html = await watch.text();
    if (html.length > 5_000_000) throw new Error('size');
    const player = extractJsonObject(html, 'ytInitialPlayerResponse =') || extractJsonObject(html, 'ytInitialPlayerResponse');
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const track = tracks.find((item: any) => /^es(?:-|$)/i.test(String(item.languageCode || ''))) || tracks[0];
    if (!track?.baseUrl) {
      return { ok: false, videoId, title: String(player?.videoDetails?.title || ''), text: '', language: null, note: 'El video no ofrece subtítulos públicos accesibles. No se analizó su contenido.' };
    }
    const captions = await fetcher(String(track.baseUrl), { redirect: 'error' });
    if (!captions.ok) throw new Error('captions');
    const raw = await captions.text();
    if (raw.length > 3_000_000) throw new Error('size');
    const text = Array.from(raw.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)).map((match) => decodeXml(match[1])).filter(Boolean).join(' ').trim();
    if (text.length < 40) return { ok: false, videoId, title: String(player?.videoDetails?.title || ''), text: '', language: String(track.languageCode || ''), note: 'Los subtítulos públicos no contienen texto suficiente. No se analizó el video.' };
    return { ok: true, videoId, title: String(player?.videoDetails?.title || ''), text, language: String(track.languageCode || ''), note: `Transcripción pública extraída (${track.languageCode || 'idioma no informado'}, ${text.length} caracteres).` };
  } catch {
    return { ok: false, videoId, title: '', text: '', language: null, note: 'No se pudo obtener una transcripción pública verificable. No se analizó el contenido del video.' };
  }
}
