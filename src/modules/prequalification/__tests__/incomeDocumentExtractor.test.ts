import assert from 'node:assert/strict';
import test from 'node:test';
import { extractInvoiceTotal, extractSalaryNetAmount } from '../scoring/incomeDocumentExtractor';

test('extrae el neto a cobrar de un recibo de sueldo', () => {
  assert.equal(extractSalaryNetAmount('Haberes 1.800.000,00\nDescuentos 300.000,00\nNeto a cobrar $ 1.500.000,00'), 1_500_000);
});

test('extrae el importe total de una factura argentina', () => {
  assert.equal(extractInvoiceTotal('Subtotal $ 450.000,00\nImporte total: $ 544.500,00'), 544_500);
});

