export function extractYouTubeMetadata(url: string) {
  const id =
    url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)?.[1] ||
    url.match(/[?&]v=([a-zA-Z0-9_-]+)/)?.[1] ||
    url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/)?.[1] ||
    '';

  return {
    ok: Boolean(id),
    videoId: id,
    note: id
      ? 'Video de YouTube identificado. Para análisis profundo automático falta conectar transcripción.'
      : 'No se pudo identificar el ID del video.'
  };
}
