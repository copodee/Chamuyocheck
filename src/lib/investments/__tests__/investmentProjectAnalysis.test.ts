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

test('calcula producción, margen y retorno de un escenario agrícola sin presentarlo como dato observado', () => {
  const result = analyzeInvestmentProject(
    'Proyecto de soja en 600 hectáreas. Inversión inicial USD 500.000, rinde 3,5 toneladas por hectárea, precio por tonelada USD 400 y costo por hectárea USD 900.',
    'Calcular producción, ingresos, costos, margen y retorno anual.'
  );
  assert.equal(result.sector, 'agriculture');
  assert.equal(result.product, 'soja');
  assert.equal(result.inputs.hectares, 600);
  assert.equal(result.inputs.yieldTonsPerHectare, 3.5);
  assert.equal(result.metrics.projectedProductionTons, 2100);
  assert.equal(result.inputs.projectedAnnualRevenue, 840000);
  assert.equal(result.inputs.projectedAnnualCosts, 540000);
  assert.equal(result.metrics.projectedOperatingMargin, 300000);
  assert.equal(result.metrics.projectedReturnOnInvestmentPercent, 60);
  assert.deepEqual(result.scenarios.map((scenario) => scenario.name), ['adverse', 'base', 'favorable']);
  assert.equal(result.scenarios.find((scenario) => scenario.name === 'adverse')?.operatingResult, 51000);
  assert.equal(result.assessment, 'positive-unverified');
  assert.ok(result.assumptions.some((item) => /escenario aritmético/i.test(item)));
});

test('advierte cuando el proyecto sólo es positivo en el escenario base', () => {
  const result = analyzeInvestmentProject(
    'Proyecto de maíz en 100 hectáreas. Inversión inicial USD 300.000, ingresos anuales USD 200.000 y costos anuales USD 170.000.',
    'Evaluar la inversión y su sensibilidad.'
  );
  assert.equal(result.assessment, 'sensitive-to-adverse-case');
  assert.equal(result.scenarios.find((scenario) => scenario.name === 'base')?.operatingResult, 30000);
  assert.ok((result.scenarios.find((scenario) => scenario.name === 'adverse')?.operatingResult || 0) < 0);
});

test('normaliza rindes informados en kilogramos por hectárea', () => {
  const result = analyzeInvestmentProject('Campo de trigo de 100 hectáreas con rinde de 4.500 kg por ha.', 'Analizar la inversión agrícola.');
  assert.equal(result.inputs.yieldTonsPerHectare, 4.5);
  assert.equal(result.metrics.projectedProductionTons, 450);
});

test('prioriza exportaciones cuando la propuesta depende de demanda internacional', () => {
  const result = analyzeInvestmentProject(
    'Proyecto para exportar vino y uva argentina a mercados internacionales con demanda mundial creciente.',
    'Quiero invertir y validar si existe demanda real en el exterior.'
  );
  assert.equal(result.sector, 'exports');
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'official-trade-statistics'));
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'international-trade-data'));
  assert.ok(result.missingInputs.some((item) => /mercado de destino/i.test(item)));
});

test('marca promesas de rendimiento garantizado como riesgo, no como inversión buena', () => {
  const result = analyzeInvestmentProject(
    'Inversión de USD 10.000 con retorno garantizado del 20% mensual y sin riesgo.',
    'Decime si es una buena inversión.'
  );
  assert.ok(result.riskFlags.some((flag) => /garantizada|garantizado|sin riesgo/i.test(flag)));
  assert.match(result.conclusion, /no debe tratarse como una inversión recomendable/i);
});

test('clasifica Vaca Muerta como petróleo y gas y no infiere valores inmobiliarios', () => {
  const result = analyzeInvestmentProject(
    'Proyecto de inversión en Vaca Muerta con viviendas para alquilar en Añelo y tierras cercanas a los yacimientos.',
    'Evaluar rentabilidad petrolera y si los alquileres y terrenos tienen potencial.'
  );
  assert.equal(result.sector, 'oil-gas');
  assert.ok(result.secondarySectors.includes('real-estate'));
  assert.equal(result.product, 'petróleo y gas no convencional');
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'official-hydrocarbon-data'));
  assert.ok(result.assumptions.some((item) => /comparables fechados/i.test(item)));
  assert.ok(result.missingInputs.some((item) => /concesión|derecho de explotación/i.test(item)));
});

test('clasifica proyectos mineros y exige reservas e informe competente', () => {
  const result = analyzeInvestmentProject(
    'Proyecto de inversión minera de litio en Catamarca con rentabilidad proyectada.',
    'Analizar si la inversión es realista.'
  );
  assert.equal(result.sector, 'mining');
  assert.equal(result.product, 'litio');
  assert.ok(result.sourceRequirements.some((source) => source.sourceType === 'official-mining-data'));
  assert.ok(result.missingInputs.some((item) => /recursos y reservas/i.test(item)));
  assert.ok(result.riskFlags.some((item) => /informe técnico competente/i.test(item)));
});
