import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCorporateEvolution, analyzeCorporateFinancials } from '../scoring/corporateFinancialAnalysis';

const sectorBase = {
  closingDate: '31/12/2025', currentAssets: 300, nonCurrentAssets: 700,
  currentLiabilities: 200, nonCurrentLiabilities: 200, equity: 600,
  sales: 1_200, grossProfit: 400, operatingProfit: 180, netProfit: 120,
  financialDebt: 100, cash: 80, extractionConfidence: 100, missingFields: [],
};

test('calcula liquidez, capital de trabajo, endeudamiento y rentabilidad empresarial', () => {
  const result = analyzeCorporateFinancials({
    closingDate: '30/06/2025',
    currentAssets: 30_000_000,
    nonCurrentAssets: 50_000_000,
    currentLiabilities: 10_000_000,
    nonCurrentLiabilities: 10_000_000,
    equity: 60_000_000,
    sales: 240_000_000,
    grossProfit: 60_000_000,
    operatingProfit: 36_000_000,
    netProfit: 24_000_000,
    financialDebt: 10_000_000,
    cash: 8_000_000,
    inventory: 5_000_000,
    tradeReceivables: 12_000_000,
    costOfSales: 180_000_000,
    interestExpense: 6_000_000,
    extractionConfidence: 100,
    missingFields: [],
  });
  assert.equal(result.workingCapital, 20_000_000);
  assert.equal(result.currentRatio, 3);
  assert.equal(result.quickRatio, 2.5);
  assert.equal(result.netMargin, 0.1);
  assert.equal(result.returnOnEquity, 0.4);
  assert.equal(result.assetTurnover, 3);
  assert.equal(result.inventoryTurnover, 36);
  assert.equal(result.receivablesTurnover, 20);
  assert.equal(result.interestCoverage, 6);
  assert.equal(result.status, 'strong');
});

test('no inventa ratios cuando faltan sus bases', () => {
  const result = analyzeCorporateFinancials({
    closingDate: null,
    currentAssets: null,
    nonCurrentAssets: null,
    currentLiabilities: null,
    nonCurrentLiabilities: null,
    equity: 10_000_000,
    sales: null,
    grossProfit: null,
    operatingProfit: null,
    netProfit: null,
    financialDebt: null,
    cash: null,
    extractionConfidence: 20,
    missingFields: ['currentAssets', 'currentLiabilities', 'sales', 'netProfit'],
  });
  assert.equal(result.currentRatio, null);
  assert.equal(result.netMargin, null);
  assert.equal(result.score, null);
  assert.equal(result.status, 'insufficient-data');
});

test('compara dos ejercicios sin mezclar sus importes', () => {
  const base = {
    closingDate: '30/06/2024', currentAssets: 20_000_000, nonCurrentAssets: 40_000_000,
    currentLiabilities: 10_000_000, nonCurrentLiabilities: 15_000_000, equity: 35_000_000,
    sales: 180_000_000, grossProfit: 40_000_000, operatingProfit: 18_000_000,
    netProfit: 9_000_000, financialDebt: 15_000_000, cash: 4_000_000,
    extractionConfidence: 100, missingFields: [],
  };
  const result = analyzeCorporateEvolution({
    ...base, closingDate: '30/06/2025', currentAssets: 30_000_000,
    currentLiabilities: 10_000_000, equity: 50_000_000, sales: 225_000_000,
    netProfit: 15_000_000, financialDebt: 12_000_000,
  }, base);
  assert.equal(result.salesChange, 0.25);
  assert.equal(result.equityChange, 15_000_000 / 35_000_000);
  assert.equal(result.trend, 'improving');
});

test('envía a revisión una extracción que no concilia contablemente', () => {
  const result = analyzeCorporateFinancials({
    closingDate: '31/12/2025', currentAssets: 80, nonCurrentAssets: 20,
    currentLiabilities: 20, nonCurrentLiabilities: 10, equity: 20,
    sales: 100, grossProfit: 70, operatingProfit: 20, netProfit: 10,
    financialDebt: 10, cash: 5, inventory: 10, costOfSales: -40,
    totalAssets: 100, totalLiabilities: 30, extractionConfidence: 100, missingFields: [],
  });
  assert.ok((result.score ?? 100) <= 50);
  assert.equal(result.status, 'review');
  assert.ok(result.observations.some(item => item.includes('no concilian')));
});

test('interpreta la liquidez de una ganadera según su ciclo productivo', () => {
  const balance = {
    ...sectorBase,
    activity: 'Ganadería de cría',
    currentAssets: 1_500_000_000,
    inventory: 1_300_000_000,
    currentLiabilities: 400_000_000,
    totalAssets: 1_900_000_000,
    totalLiabilities: 500_000_000,
    equity: 1_400_000_000,
  };
  const result = analyzeCorporateFinancials(balance);
  assert.equal(result.sector, 'agriculture-livestock');
  assert.equal(result.sectorLabel, 'Agropecuario y ganadero');
  assert.ok(result.sectorObservations.some(item => item.includes('ciclo productivo')));
});

test('no interpreta la falta de inventarios como debilidad de una empresa de servicios', () => {
  const result = analyzeCorporateFinancials({ ...sectorBase, inventory: 0 }, undefined, 'Servicios profesionales de consultoría');
  assert.equal(result.sector, 'professional-services');
  assert.ok(result.sectorObservations.some(item => item.includes('ausencia de inventarios no es una debilidad')));
});

test('anualiza sólo flujos de un trimestre y conserva los saldos de cierre', () => {
  const result = analyzeCorporateFinancials({
    closingDate: '31/12/2025', periodStartDate: '01/10/2025', periodMonths: 3, statementKind: 'interim',
    currentAssets: 57_259_985_278.54, nonCurrentAssets: 105_113_275_307.64,
    currentLiabilities: 59_223_887_474.94, nonCurrentLiabilities: 13_111_588_113.36,
    equity: 90_037_784_997.88, sales: 19_383_612_571.76,
    grossProfit: 8_214_470_889.22, operatingProfit: 2_528_078_444.78,
    netProfit: 810_369_272.49, financialDebt: 33_230_073_039.35,
    cash: 444_995_751.80, extractionConfidence: 100, missingFields: [],
  });
  assert.equal(result.workingCapital, 57_259_985_278.54 - 59_223_887_474.94);
  assert.ok(Math.abs((result.returnOnAssets || 0) - ((810_369_272.49 * 4) / 162_373_260_586.18)) < 1e-10);
  assert.ok(result.observations.some(item => item.includes('flujos del período intermedio de 3 meses')));
});

test('normaliza períodos distintos al comparar evolución sin anualizar patrimonio', () => {
  const annual = { ...sectorBase, statementKind: 'annual' as const, periodMonths: 12, sales: 1_200, netProfit: 120, equity: 600 };
  const quarter = { ...sectorBase, statementKind: 'interim' as const, periodMonths: 3, sales: 330, netProfit: 33, equity: 630 };
  const result = analyzeCorporateEvolution(quarter, annual);
  assert.equal(result.salesChange, 0.1);
  assert.equal(result.equityChange, 0.05);
  assert.ok(result.observations.some(item => item.includes('períodos diferentes')));
});

test('no compara un estado consolidado con uno separado', () => {
  const consolidated = { ...sectorBase, statementScope: 'consolidated' as const };
  const separate = { ...sectorBase, statementScope: 'separate' as const };
  const result = analyzeCorporateEvolution(consolidated, separate);
  assert.equal(result.trend, 'insufficient-data');
  assert.equal(result.salesChange, null);
  assert.ok(result.observations.some(item => item.includes('No se comparan estados consolidados')));
});

test('no sobrecalifica una utilidad explicada principalmente por resultados financieros', () => {
  const result = analyzeCorporateFinancials({
    ...sectorBase, sales: 8_897_999_523, operatingProfit: 373_543_150,
    netProfit: 5_777_993_778, financialDebt: 27_440_629_674,
  });
  assert.ok(result.observations.some(item => item.includes('resultado final supera ampliamente al operativo')));
  assert.ok((result.operatingMargin || 0) < 0.05);
});
