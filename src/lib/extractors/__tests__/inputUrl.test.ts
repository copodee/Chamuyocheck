import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveUrlInput } from '../inputUrl';

test('detecta una URL pegada en el cuadro de texto', () => {
  const result = resolveUrlInput('https://www.bancoprovincia.com.ar/mvc/productos/creditos/BipPreca/condiciones_bip_preca', '');
  assert.equal(result.detectedFromText, true);
  assert.match(result.url, /bancoprovincia/);
  assert.equal(result.remainingText, '');
});

test('conserva como instrucción el texto que acompaña a la URL', () => {
  const result = resolveUrlInput('Calculá el costo real de https://www.bice.com.ar/productos/leasing/', '');
  assert.equal(result.url, 'https://www.bice.com.ar/productos/leasing/');
  assert.equal(result.remainingText, 'Calculá el costo real de');
});

test('normaliza un dominio sin protocolo pegado como URL explícita', () => {
  const result = resolveUrlInput('Saber si es una estafa', 'Www.Nexo.com');
  assert.equal(result.url, 'https://Www.Nexo.com');
  assert.equal(result.remainingText, 'Saber si es una estafa');
  assert.equal(result.detectedFromText, false);
});

test('detecta un dominio sin protocolo dentro de una consulta', () => {
  const result = resolveUrlInput('¿Nexo.com es una posible estafa?', '');
  assert.equal(result.url, 'https://Nexo.com');
  assert.equal(result.remainingText, '¿ es una posible estafa?');
  assert.equal(result.detectedFromText, true);
});
