import { test } from 'node:test';
import assert from 'node:assert/strict';
import { argentinaBankHosts, describeFinancialUrl } from '../financialUrlContext';

test('identifica Banco Provincia sin afirmar que leyó la página', () => {
  const result = describeFinancialUrl('https://www.bancoprovincia.com.ar/mvc/productos/creditos/BipPreca/condiciones_bip_preca');
  assert.equal(result.isFinancial, true);
  assert.equal(result.institution, 'Banco Provincia');
  assert.match(result.contextText, /no demuestra que la página haya sido leída/i);
});

test('cubre bancos solicitados y productos de leasing y microcrédito', () => {
  for (const host of ['bice.com.ar', 'santander.com.ar', 'icbc.com.ar', 'bancopatagonia.com.ar', 'supervielle.com.ar', 'macro.com.ar', 'galicia.ar', 'bna.com.ar', 'bancosantafe.com.ar', 'bancochubut.com.ar', 'bancosantacruz.com', 'bancotdf.com.ar', 'bind.com.ar']) {
    assert.ok(argentinaBankHosts.includes(host), `Falta ${host}`);
    assert.equal(describeFinancialUrl(`https://${host}/productos/leasing`).isFinancial, true);
  }
  assert.equal(describeFinancialUrl('https://financiera.example.com/productos/microcreditos').isFinancial, true);
});
