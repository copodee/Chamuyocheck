import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCorporateEvolution, analyzeCorporateFinancials } from '../scoring/corporateFinancialAnalysis';

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
    extractionConfidence: 100,
    missingFields: [],
  });
  assert.equal(result.workingCapital, 20_000_000);
  assert.equal(result.currentRatio, 3);
  assert.equal(result.netMargin, 0.1);
  assert.equal(result.returnOnEquity, 0.4);
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
