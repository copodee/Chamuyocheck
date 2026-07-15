import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverArgentinaMiningEvidence } from '../freeArgentinaMiningConnector';

test('encuentra proyectos mineros oficiales sin certificar reservas ni rentabilidad', async () => {
  const csv = [
    'Proyecto,Provincia,Mineral principal,Estado',
    'Proyecto Salar Norte,Catamarca,Litio,Factibilidad',
    'Proyecto Cobre Sur,San Juan,Cobre,Exploración avanzada',
  ].join('\n');
  const records = await discoverArgentinaMiningEvidence(
    'Analizar una inversión minera de litio en Catamarca.', [0],
    async () => new Response(csv, { status: 200, headers: { 'content-type': 'text/csv' } })
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceType, 'official-mining-data');
  assert.match(records[0].excerpt || '', /Proyecto Salar Norte/);
  assert.match(records[0].excerpt || '', /No acredita por sí sola reservas/i);
});

test('no inventa evidencia cuando la fuente oficial no responde', async () => {
  const records = await discoverArgentinaMiningEvidence('Proyecto minero de litio.', [0], async () => new Response('', { status: 503 }));
  assert.deepEqual(records, []);
});
