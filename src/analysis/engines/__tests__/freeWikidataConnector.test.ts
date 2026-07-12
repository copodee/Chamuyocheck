import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverWikidataEntity } from '../connectors/freeWikidataConnector';

function response(search: unknown[]) {
  return new Response(JSON.stringify({ search }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('Wikidata entity discovery requires the concrete predicate to be covered', async () => {
  const records = await discoverWikidataEntity('Milei es presidente argentino.', [0], 'public-records', async () => response([
    { id: 'Q1', label: 'Javier Milei', description: 'economista y político argentino, presidente de la Nación Argentina', concepturi: 'https://www.wikidata.org/entity/Q1' },
  ]));
  assert.equal(records.length, 1);
});

test('Wikidata does not validate a false profession and nationality by entity existence', async () => {
  const records = await discoverWikidataEntity('Colapinto es un piloto de motos de origen español.', [0], 'public-records', async () => response([
    { id: 'Q2', label: 'Franco Colapinto', description: 'piloto de automovilismo argentino', concepturi: 'https://www.wikidata.org/entity/Q2' },
  ]));
  assert.equal(records.length, 0);
});

test('Wikidata does not confuse a bird entity with an animated character', async () => {
  const records = await discoverWikidataEntity('El pájaro carpintero era un dibujo animado.', [0], 'public-records', async () => response([
    { id: 'Q3', label: 'Pájaro carpintero', description: 'familia de aves', concepturi: 'https://www.wikidata.org/entity/Q3' },
  ]));
  assert.equal(records.length, 0);
});

test('Wikidata requires the asserted relationship word, not just both names', async () => {
  const records = await discoverWikidataEntity('Nicolás Scioli es hijo de Daniel Scioli.', [0], 'public-records', async () => response([
    { id: 'Q4', label: 'Nicolás Scioli', description: 'político argentino, hermano de Daniel Scioli', concepturi: 'https://www.wikidata.org/entity/Q4' },
  ]));
  assert.equal(records.length, 0);
});
