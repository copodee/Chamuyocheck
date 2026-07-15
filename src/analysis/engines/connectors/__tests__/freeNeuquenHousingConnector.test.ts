import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverNeuquenHousingEvidence } from '../freeNeuquenHousingConnector';

test('aporta viviendas censales de Añelo sin inventar alquileres ni precios', async () => {
  const csv = 'Año;Departamento;Total de viviendas;Total de viviendas particulares;Viviendas particulares ocupadas;Viviendas particulares desocupadas;Viviendas colectivas\n2022;Añelo;12000;11800;9000;2800;200';
  const records = await discoverNeuquenHousingEvidence('Quiero comprar viviendas para alquilar en Añelo, cerca de Vaca Muerta.', [0], async () => new Response(csv, { status: 200 }));
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceType, 'official-real-estate-data');
  assert.match(records[0].excerpt, /9\.000 particulares ocupadas/i);
  assert.match(records[0].excerpt, /no informa precios actuales/i);
});

test('falla cerrado si el portal de Neuquén no responde', async () => {
  assert.deepEqual(await discoverNeuquenHousingEvidence('Alquileres en Añelo', [0], async () => new Response('', { status: 503 })), []);
});
