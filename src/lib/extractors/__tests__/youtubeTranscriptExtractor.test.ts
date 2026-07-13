import test from 'node:test';
import assert from 'node:assert/strict';
import { extractYoutubeTranscript } from '../youtubeTranscriptExtractor';

test('extrae subtítulos públicos y conserva idioma y título', async () => {
  const player = { videoDetails: { title: 'Curso de negocios' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'es', baseUrl: 'https://www.youtube.com/api/timedtext?id=x' }] } } };
  const fetcher = async (url: string | URL | Request) => String(url).includes('/watch?')
    ? new Response(`<script>ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`, { status: 200 })
    : new Response('<transcript><text start="0">Ganancia &amp; negocios exitosos con evidencia real.</text></transcript>', { status: 200 });
  const result = await extractYoutubeTranscript('https://youtu.be/abcdefghijk', fetcher as typeof fetch);
  assert.equal(result.ok, true);
  assert.equal(result.title, 'Curso de negocios');
  assert.match(result.text, /Ganancia & negocios/);
});

test('no finge análisis cuando no hay subtítulos', async () => {
  const player = { videoDetails: { title: 'Sin subtítulos' } };
  const result = await extractYoutubeTranscript('https://www.youtube.com/watch?v=abcdefghijk', async () => new Response(`<script>ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`, { status: 200 }) as any);
  assert.equal(result.ok, false);
  assert.match(result.note, /No se analizó/);
});
