import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverWikidataEntity, verifyWikidataStructuredClaim } from '../connectors/freeWikidataConnector';

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

test('structured Wikidata comparison contradicts wrong nationality and occupation', async () => {
  let call = 0;
  const result = await verifyWikidataStructuredClaim('Colapinto es un piloto de motos de origen español.', [0], async () => {
    call++;
    if (call === 1) return response([{ id: 'Q2', label: 'Franco Colapinto', concepturi: 'https://www.wikidata.org/entity/Q2' }]);
    if (call === 2) return new Response(JSON.stringify({ entities: { Q2: { claims: { P27: [{ mainsnak: { datavalue: { value: { id: 'Q414' } } } }], P106: [{ mainsnak: { datavalue: { value: { id: 'Q1' } } } }] } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ entities: { Q414: { labels: { es: { value: 'Argentina' } } }, Q1: { labels: { es: { value: 'piloto de automovilismo' } } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.equal(result.assessment, 'contradicted');
  assert.equal(result.records.length, 1);
  assert.match(result.rationale, /Argentina.*piloto de automovilismo/i);
});

test('structured Wikidata comparison distinguishes sibling from asserted child', async () => {
  let call = 0;
  const result = await verifyWikidataStructuredClaim('Nicolás Scioli es hijo de Daniel Scioli.', [0], async () => {
    call++;
    if (call === 1) return response([{ id: 'Q4', label: 'Nicolás Scioli', concepturi: 'https://www.wikidata.org/entity/Q4' }]);
    if (call === 2) return new Response(JSON.stringify({ entities: { Q4: { claims: { P3373: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }] } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ entities: { Q5: { labels: { es: { value: 'Daniel Scioli' } } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.equal(result.assessment, 'contradicted');
  assert.match(result.rationale, /Hermanos: Daniel Scioli/i);
});
