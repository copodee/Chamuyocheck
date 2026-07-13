import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../../../app/api/analyze/route';
import { TERMS_VERSION } from '../../../lib/legal/terms';

function formRequest(url: string) {
  const form = new FormData();
  form.set('url', url);
  form.set('text', 'Analizá la coherencia de la propuesta comercial.');
  form.set('termsAccepted', 'true');
  form.set('termsVersion', TERMS_VERSION);
  return new Request('http://localhost/api/analyze', { method: 'POST', body: form });
}

test('YouTube analiza un curso solo desde subtítulos públicos', async () => {
  const originalFetch = globalThis.fetch;
  const player = { videoDetails: { title: 'Curso para negocios exitosos' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'es', baseUrl: 'https://www.youtube.com/api/timedtext?id=x' }] } } };
  globalThis.fetch = (async (input: any) => String(input).includes('/watch?')
    ? new Response(`<script>ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`, { status: 200 })
    : String(input).includes('/api/timedtext')
      ? new Response('<transcript><text>Este curso te enseña a facturar un millón por mes sin experiencia. Casos de éxito garantizados. Cuesta 500000 pesos.</text></transcript>', { status: 200 })
      : new Response('', { status: 404 })) as typeof fetch;
  try {
    const response = await POST(formRequest('https://youtu.be/abcdefghijk'));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.commercialCourseAnalysis.applicable, true);
    assert.ok(body.commercialCourseAnalysis.coherenceIssues.length > 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('YouTube sin subtítulos se detiene sin fingir análisis', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('<script>ytInitialPlayerResponse = {"videoDetails":{"title":"Curso"}};</script>', { status: 200 })) as typeof fetch;
  try {
    const response = await POST(formRequest('https://youtu.be/abcdefghijk'));
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.extractionStatus, 'not-analyzed');
    assert.match(body.error, /No se analizó/);
  } finally { globalThis.fetch = originalFetch; }
});
