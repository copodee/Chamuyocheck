import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverFreeNewsRss } from '../connectors/freeNewsRssConnector';

test('free RSS discovery accepts a relevant publisher item with auditable metadata', async () => {
  const xml = `<?xml version="1.0"?><rss><channel><item><title>Ibuprofeno y agua de mar: autoridades desmienten el caso viral</title><link>https://www.lanacion.com.ar/sociedad/caso-viral-nid1/</link><pubDate>Sun, 12 Jul 2026 12:00:00 GMT</pubDate><description>No existen registros del supuesto episodio difundido en redes.</description></item></channel></rss>`;
  const fetchImpl = async () => new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } });
  const records = await discoverFreeNewsRss('El ibuprofeno mezclado con agua de mar causó un caso viral', [0], fetchImpl);
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceType, 'independent-news');
  assert.match(records[0].url, /lanacion\.com\.ar/);
  assert.equal(records[0].official, false);
});

test('free RSS discovery rejects irrelevant items and foreign hosts', async () => {
  const xml = `<rss><channel><item><title>Partido de fútbol</title><link>https://example.com/deportes</link><pubDate>Sun, 12 Jul 2026 12:00:00 GMT</pubDate><description>Resultado deportivo.</description></item></channel></rss>`;
  const records = await discoverFreeNewsRss('Una ley argentina cambió el impuesto a las ganancias', [0], async () => new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } }));
  assert.deepEqual(records, []);
});
