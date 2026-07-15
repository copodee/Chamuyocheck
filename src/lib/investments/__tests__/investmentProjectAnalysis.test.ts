import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeInvestmentProject } from '../investmentProjectAnalysis';

test('calcula precio por metro y rendimiento inmobiliario sin inventar datos externos', () => {
  const result = analyzeInvestmentProject(
    'Departamento en Córdoba, precio de compra USD 100.000, 50 m2, alquiler mensual USD 700, gastos mensuales USD 100 y vacancia 5%.',
    'Quiero saber si esta inversión inmobiliaria es rentable y si será fácil alquilarla.'
  );
  assert.equal(result.applicable, true);
  assert.equal(result.sector, 'real-estate');
  assert.equal(result.location, 'Córdoba');
  assert.equal(result.inputs.purchasePrice, 100000);
  assert.equal(result.metrics.pricePerSquareMeter, 2000);
  assert.equal(result.metrics.grossAnnualYieldPercent, 8.4);
  assert.equal(result.metrics.netAnnualYieldPercent, 6.78);
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'property-market-comparables'));
  assert.match(result.conclusion, /contrastar precios, demanda, costos y escenarios/i);
});

test('rutea inversiones agropecuarias a estadísticas y mercados sectoriales', () => {
  const result = analyzeInvestmentProject(
    'Proyecto de inversión agrícola de soja y maíz en 600 hectáreas de Santa Fe con rindes proyectados.',
    'Analizar viabilidad, costos y retorno.'
  );
  assert.equal(result.sector, 'agriculture');
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'official-agricultural-statistics'));
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'commodity-market-data'));
  assert.ok(result.riskFlags.some((flag) => /proyección/i.test(flag)));
});

test('prioriza exportaciones cuando la propuesta depende de demanda internacional', () => {
  const result = analyzeInvestmentProject(
    'Proyecto para exportar vino y uva argentina a mercados internacionales con demanda mundial creciente.',
    'Quiero invertir y validar si existe demanda real en el exterior.'
  );
  assert.equal(result.sector, 'exports');
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'official-trade-statistics'));
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'international-trade-data'));
});

test('marca promesas de rendimiento garantizado como riesgo, no como inversión buena', () => {
  const result = analyzeInvestmentProject(
    'Inversión de USD 10.000 con retorno garantizado del 20% mensual y sin riesgo.',
    'Decime si es una buena inversión.'
  );
  assert.ok(result.riskFlags.some((flag) => /garantizada|garantizado|sin riesgo/i.test(flag)));
  assert.match(result.conclusion, /no debe tratarse como una inversión recomendable/i);
});
