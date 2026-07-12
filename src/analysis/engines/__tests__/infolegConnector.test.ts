import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchInfolegLawByOfficialUrl,
  parseInfolegLegislationMetadata,
} from '../connectors/infolegConnector';

const officialHtml = `<!doctype html><html><head>
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "Legislation",
  "legislationIdentifier": "Ley 27275 / 2016",
  "name": "DERECHO DE ACCESO A LA INFORMACION PUBLICA",
  "alternateName": "OBJETO. EXCEPCIONES. ALCANCES.",
  "abstract": "Garantiza el acceso a la información pública.",
  "url": "https://www.argentina.gob.ar/normativa/nacional/norma-265949",
  "legislationDate": "2016-09-14",
  "datePublished": "2016-09-29"
}</script></head></html>`;
const officialUrl = 'https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949';

function response(body = officialHtml, init: ResponseInit = {}, url = 'https://www.argentina.gob.ar/normativa/nacional/ley-27275-265949') {
  const result = new Response(body, { status: 200, ...init });
  Object.defineProperty(result, 'url', { value: url });
  return result;
}

test('parses official InfoLEG Legislation structured data', () => {
  const metadata = parseInfolegLegislationMetadata(officialHtml);
  assert.equal(metadata?.legislationIdentifier, 'Ley 27275 / 2016');
  assert.equal(metadata?.datePublished, '2016-09-29');
});

test('fetches a law into an auditable official source record', async () => {
  let requestedUrl = '';
  const result = await fetchInfolegLawByOfficialUrl(officialUrl, '27.275', [1, 1], async (input) => {
    requestedUrl = String(input);
    return response();
  });

  assert.equal(requestedUrl, officialUrl);
  assert.equal(result.ok, true);
  assert.equal(result.records[0].official, true);
  assert.equal(result.records[0].sourceType, 'government-law-repository');
  assert.equal(result.records[0].sourceDate, '2016-09-29');
  assert.deepEqual(result.records[0].claimIndexes, [1]);
});

test('rejects invalid law numbers before any network request', async () => {
  let called = false;
  const result = await fetchInfolegLawByOfficialUrl(officialUrl, '27A75', [0], async () => {
    called = true;
    return response();
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test('rejects redirects outside the official allowlisted host', async () => {
  const result = await fetchInfolegLawByOfficialUrl(officialUrl, '27275', [0], async () =>
    response(officialHtml, {}, 'https://evil.example/norma')
  );
  assert.equal(result.ok, false);
  assert.match(result.error || '', /dominio oficial/);
});

test('rejects a law whose official identifier does not match the request', async () => {
  const mismatched = officialHtml.replace('Ley 27275 / 2016', 'Ley 24946 / 1998');
  const result = await fetchInfolegLawByOfficialUrl(officialUrl, '27275', [0], async () => response(mismatched));
  assert.equal(result.ok, false);
  assert.match(result.error || '', /no coincide/);
});

test('rejects missing structured legislative metadata', async () => {
  const result = await fetchInfolegLawByOfficialUrl(officialUrl, '27275', [0], async () => response('<html></html>'));
  assert.equal(result.ok, false);
  assert.match(result.error || '', /metadata legislativa/);
});

test('rejects non-normative official paths before any network request', async () => {
  let called = false;
  const result = await fetchInfolegLawByOfficialUrl(
    'https://www.argentina.gob.ar/otra-pagina',
    '27275',
    [0],
    async () => {
      called = true;
      return response();
    }
  );
  assert.equal(result.ok, false);
  assert.equal(called, false);
});
