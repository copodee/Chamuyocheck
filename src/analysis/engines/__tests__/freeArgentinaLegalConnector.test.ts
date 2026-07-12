import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyArgentinaCriminalLaw } from '../connectors/freeArgentinaLegalConnector';

const officialHtml = `<html><body><strong>ARTICULO 162.-</strong> El que se apoderare ilegítimamente de una cosa mueble, total o parcialmente ajena, será reprimido con prisión de un mes a dos años.</body></html>`;

test('Argentine criminal-law connector contradicts a death-penalty claim with article 162', async () => {
  const result = await verifyArgentinaCriminalLaw('Según las leyes, si alguien roba un caramelo en Argentina es enviado a la horca.', [0], async (input) => new Response(officialHtml, { status: 200, headers: { 'content-type': 'text/html' } }));
  assert.equal(result.assessment, 'contradicted');
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].official, true);
  assert.match(result.rationale, /artículo 162.*prisión de un mes a dos años.*no pena de muerte/i);
});

test('Argentine criminal-law connector does not run without jurisdiction and conduct', async () => {
  const result = await verifyArgentinaCriminalLaw('Las penas son injustas.', [0], async () => { throw new Error('network must not run'); });
  assert.equal(result.records.length, 0);
  assert.equal(result.assessment, 'inconclusive');
});
