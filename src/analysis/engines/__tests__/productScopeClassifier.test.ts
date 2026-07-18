import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProductScope } from '../productScopeClassifier';

test('acepta créditos y costos financieros', () => {
  const result = classifyProductScope('Me ofrecen un crédito de $500.000 en 12 cuotas con TNA del 90%.');
  assert.equal(result.supported, true);
  assert.equal(result.primaryArea, 'finance-credit');
});

test('acepta URLs de créditos, leasing y microcréditos', () => {
  assert.equal(classifyProductScope('https://www.bancoprovincia.com.ar/mvc/productos/creditos/BipPreca/condiciones_bip_preca').primaryArea, 'finance-credit');
  assert.equal(classifyProductScope('https://www.bice.com.ar/productos/leasing/').primaryArea, 'finance-credit');
  assert.equal(classifyProductScope('https://banco.example/productos/microcreditos').primaryArea, 'finance-credit');
});

test('acepta posibles estafas e inversiones engañosas', () => {
  const result = classifyProductScope('Me prometen rentabilidad garantizada si incorporo referidos. ¿Puede ser una estafa?');
  assert.equal(result.supported, true);
  assert.equal(result.primaryArea, 'scam-risk');
});

test('acepta una URL desconocida cuando la instrucción pide verificar un scam de autotrading', () => {
  const result = classifyProductScope(
    'https://lpa.web-crewsstats.com/ifwv_v_3_es_lp_wcs/?title=La+IA+que+hace+dinero&campaign_id=48799180',
    'Quiero saber si esa página es real o scam y si el autotrader es confiable.',
  );
  assert.equal(result.supported, true);
  assert.equal(result.primaryArea, 'scam-risk');
});

test('acepta cursos que prometen éxito comercial', () => {
  const result = classifyProductScope('Curso para tener éxito en los negocios y aumentar la facturación.');
  assert.equal(result.supported, true);
  assert.equal(result.primaryArea, 'scam-risk');
});

test('acepta proyectos inmobiliarios, agropecuarios y exportadores', () => {
  assert.equal(classifyProductScope('Quiero invertir en un departamento para alquilar y calcular su rentabilidad.').primaryArea, 'investment-project');
  assert.equal(classifyProductScope('Analizar la viabilidad de una inversión agropecuaria en soja.').primaryArea, 'investment-project');
  assert.equal(classifyProductScope('Proyecto de exportación de vino: demanda internacional y retorno esperado.').primaryArea, 'investment-project');
});

test('acepta inversiones mineras, petroleras e inmobiliarias vinculadas con Vaca Muerta', () => {
  assert.equal(classifyProductScope('Proyecto de inversión minera de litio en Catamarca.').primaryArea, 'investment-project');
  assert.equal(classifyProductScope('Analizar una inversión de petróleo y gas en Vaca Muerta.').primaryArea, 'investment-project');
  assert.equal(classifyProductScope('Quiero comprar terrenos y alquilar viviendas en Añelo, cerca de Vaca Muerta.').primaryArea, 'investment-project');
});

test('acepta derecho argentino, delitos y familia', () => {
  assert.equal(classifyProductScope('¿Qué pena establece el Código Penal argentino para el hurto?').primaryArea, 'argentina-legal-documents');
  assert.equal(classifyProductScope('Necesito revisar un convenio de divorcio y cuota alimentaria.').primaryArea, 'argentina-legal-documents');
});

test('acepta lenguaje cotidiano sobre penas por delitos sexuales', () => {
  const result = classifyProductScope('¿Cuántos años de cárcel le dan a un violador?');
  assert.equal(result.supported, true);
  assert.equal(result.primaryArea, 'argentina-legal-documents');
});

test('no confunde cargos económicos con una consulta financiera', () => {
  const result = classifyProductScope('El ministro de economía es homosexual.');
  assert.equal(result.supported, false);
});

test('rechaza temas generales y detección concluyente de IA', () => {
  assert.equal(classifyProductScope('Colapinto es un piloto español.').supported, false);
  assert.equal(classifyProductScope('¿Este trabajo de un alumno fue escrito con IA?').supported, false);
});
