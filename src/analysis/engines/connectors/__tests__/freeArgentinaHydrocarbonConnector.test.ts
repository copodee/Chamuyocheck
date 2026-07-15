import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverArgentinaHydrocarbonEvidence } from '../freeArgentinaHydrocarbonConnector';

test('resume producción oficial de Vaca Muerta sin inferir tierras ni alquileres', async () => {
  const csv = [
    'formacion,yacimiento,provincia,anio,mes,prod_pet,prod_gas',
    'VACA MUERTA,LA AMARGA CHICA,Neuquén,2026,6,1250,870',
    'VACA MUERTA,LOMA CAMPANA,Neuquén,2026,6,2100,990',
    'AGRIO,OTRO,Neuquén,2026,6,500,400',
  ].join('\n');
  const records = await discoverArgentinaHydrocarbonEvidence(
    'Invertir en Vaca Muerta y comprar viviendas para alquilar en Añelo.', [0],
    async () => new Response(csv, { status: 200, headers: { 'content-type': 'text/csv' } })
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceType, 'official-hydrocarbon-data');
  assert.match(records[0].excerpt || '', /2 yacimientos/);
  assert.match(records[0].excerpt || '', /no prueba.*valor de tierras/i);
});

test('no registra verificación si no obtiene el archivo', async () => {
  const records = await discoverArgentinaHydrocarbonEvidence('Proyecto en Vaca Muerta.', [0], async () => new Response('', { status: 404 }));
  assert.deepEqual(records, []);
});
