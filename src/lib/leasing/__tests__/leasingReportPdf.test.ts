import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { POST } from '../../../../app/api/leasing-report/route';

test('genera un informe PDF de LeasingScoring con membrete y varias secciones', async () => {
  const response = await POST(new Request('http://localhost/api/leasing-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: '26/7/2026',
      category: 'Especialista en Leasing',
      input: 'documento PDF',
      title: 'Resultado financiero del leasing',
      summary: 'Valor neto $ 49.578.512. TIR efectiva anual 70,0985%.',
      score: 76,
      scoreLabel: 'Transparencia alta',
      comparisonTable: {
        columns: ['Ciudad Autónoma de Buenos Aires', 'Buenos Aires'],
        rows: [{ label: 'Ingresos Brutos del dador', values: ['8%', '9%'] }],
      },
      sections: [{ title: 'Resultado financiero', items: ['Capital analizado sin IVA.'] }],
      nextActions: ['Comparar alternativas con el mismo plazo.'],
      limitations: ['Verificar la documentación completa.'],
      disclaimer: 'Resultado automatizado, orientativo y sujeto a revisión humana.',
    }),
  }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.ok(bytes.length > 10_000);
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 1);
  assert.equal(document.getAuthor(), 'LeasingScoring');
});
