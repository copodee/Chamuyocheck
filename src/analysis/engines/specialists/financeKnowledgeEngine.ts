/**
 * Finance Knowledge Engine
 * Evaluates financial claims: interest calculations, returns, scam patterns
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

interface FinancialCalculation {
  principal?: number;
  rate?: number;
  time?: number;
  expected?: number;
  stated?: number;
  timeUnit?: string;
}

function extractFinancialValues(text: string): FinancialCalculation {
  const result: FinancialCalculation = {};

  // Extract principal (capital)
  const principalMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:pesos?|$|al|a|×|%)/i);
  if (principalMatch) {
    result.principal = parseFloat(principalMatch[1].replace(',', '.'));
  }

  // Extract interest rate
  const rateMatch = text.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:anual|yearly|mensual|monthly|diario|daily)?/i);
  if (rateMatch) {
    result.rate = parseFloat(rateMatch[1].replace(',', '.')) / 100;
  }

  // Extract time period
  const timeMatch = text.match(/(\d+)\s*(?:años|years|meses|months|días|days|semanas|weeks)/i);
  if (timeMatch) {
    result.time = parseFloat(timeMatch[1]);
    const unit = timeMatch[0].toLowerCase();
    if (unit.includes('año') || unit.includes('year')) result.timeUnit = 'year';
    else if (unit.includes('mes') || unit.includes('month')) result.timeUnit = 'month';
    else if (unit.includes('día') || unit.includes('day')) result.timeUnit = 'day';
  }

  // Extract expected/stated return
  const returnMatch = text.match(/(?:dan?|da|give|result|convertir|convert|llega?r|reach)\s*(?:a\s+)?(\d+(?:[.,]\d+)?)/i);
  if (returnMatch) {
    result.stated = parseFloat(returnMatch[1].replace(',', '.'));
  }

  // Check for "guaranteed returns" language
  if (/garantiz|certain|assure|promise/i.test(text) && /\d+%/.test(text)) {
    result.stated = undefined; // Mark as unverified promise
  }

  return result;
}

function calculateCompoundInterest(principal: number, rate: number, time: number, timeUnit: string = 'year'): number {
  // Convert time to years if needed
  let timeInYears = time;
  if (timeUnit === 'month') timeInYears = time / 12;
  else if (timeUnit === 'day') timeInYears = time / 365;

  // Simple interest formula: A = P(1 + rt)
  return principal * (1 + rate * timeInYears);
}

export function evaluateFinanceClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'finance';

  // Check if this is a finance claim
  const financePatterns = /pesos?|dólares?|interés|interest|ganancia|return|inversión|investment|capital|gana|earn|renta|yield|%|anual|monthly|guaranteed|garantiz|invierte|invierte|multiplica.*dinero/i;
  if (!financePatterns.test(claimText)) {
    return {
      domain,
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Not a financial claim',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Check for obvious scam patterns (strong indicators of unrealistic promises)
  if (/gana\s*dinero\s*ya|earn\s*money\s*now|gana\s*dinero\s*fácil|easy\s*money|gana\s*dinero\s*rápido|quick\s*money|multiplica\s*tu\s*dinero\s*en\s*\d+\s*(?:días|days)/i.test(claimText)) {
    return {
      domain,
      applicable: true,
      confidence: 0.95,
      verdict: 'extraordinary-unverified',
      minimumScore: 95,
      reason: 'Financial claim uses classic scam language promising easy money or unrealistic multiplication (characteristic of pyramid schemes and financial scams)',
      evidenceNeeded: ['legitimate business model', 'regulatory approval', 'verifiable track record'],
      externalVerificationRequired: true,
      suggestedSourceTypes: ['securities regulator', 'central bank warning', 'official license']
    };
  }

  // Check for advance-fee fraud patterns (Nigerian prince scams, etc.)
  if (/príncipe|prince|heredar|inherit|millones|millions|confirma\s*datos|confirm.*details|transferencia|transfer|urgente|urgent|abogado|lawyer/i.test(claimText) && /dinero|money|dólares?|dollar/i.test(claimText)) {
    return {
      domain,
      applicable: true,
      confidence: 0.98,
      verdict: 'contradicted',
      forceScore: 100,
      reason: 'Classic advance-fee fraud pattern (Nigerian prince scam type) - known deceptive scheme',
      evidenceNeeded: [],
      externalVerificationRequired: false,
      suggestedSourceTypes: ['anti-fraud warnings', 'police reports', 'scam databases']
    };
  }

  // Check for easy money/daily earnings scams
  if (/gana.*pesos|pesos.*diarios|dinero.*diarios|dinero.*sin.*trabaj/i.test(claimText) && /\d+/.test(claimText)) {
    return {
      domain,
      applicable: true,
      confidence: 0.95,
      verdict: 'extraordinary-unverified',
      minimumScore: 95,
      reason: 'Financial claim promises unrealistic daily earnings (characteristic of job scams and pyramid schemes)',
      evidenceNeeded: ['legitimate business model', 'regulatory approval', 'verifiable track record'],
      externalVerificationRequired: true,
      suggestedSourceTypes: ['employment agency', 'business license', 'customer testimonials from legitimate sources']
    };
  }

  // Check for scam/impossible patterns
  const scamPatterns = /sin trabajar|without work|sin esfuerzo|effortless|sin riesgo|no risk|garantiz|100%|diarios|daily|gratis|free.*ganar|earn.*free|solo\s*\d+\s*min|working\s+only\s+\d+\s+min/i;
  if (scamPatterns.test(claimText) && /\d+%|\d+\s*pesos?|gana|earn|ganar|multiplica|multiply/i.test(claimText)) {
    return {
      domain,
      applicable: true,
      confidence: 0.85,
      verdict: 'extraordinary-unverified',
      minimumScore: 95,
      reason: 'Financial claim promises unrealistic returns with minimal effort or no risk (characteristic of scams)',
      evidenceNeeded: ['legitimate business model', 'regulatory approval', 'verifiable track record'],
      externalVerificationRequired: true,
      suggestedSourceTypes: ['securities regulator', 'central bank warning', 'official license']
    };
  }

  // Pyramid schemes
  if (/pirámid|pyramid|reclut|recruit|ganar.*reclut|earn.*recruit/i.test(claimText)) {
    return {
      domain,
      applicable: true,
      confidence: 0.9,
      verdict: 'contradicted',
      forceScore: 100,
      reason: 'Pyramid/MLM scheme detected (illegal in most jurisdictions)',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Extract financial values
  const calc = extractFinancialValues(claimText);

  // If we have enough info to calculate
  if (calc.principal && calc.rate !== undefined && calc.time && calc.timeUnit && calc.stated) {
    const expected = calculateCompoundInterest(calc.principal, calc.rate, calc.time, calc.timeUnit);
    const tolerance = expected * 0.05 + 100; // 5% tolerance or 100 minimum

    if (Math.abs(expected - calc.stated) <= tolerance) {
      return {
        domain,
        applicable: true,
        confidence: 0.9,
        verdict: 'supported',
        recommendedScore: 10,
        reason: `Financial calculation is correct (${calc.principal} at ${calc.rate * 100}% for ${calc.time} ${calc.timeUnit}(s) = ${expected.toLocaleString()})`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    } else if (expected < calc.stated && (calc.stated / expected > 2 || calc.time < 30)) {
      // Unrealistic return or too fast
      return {
        domain,
        applicable: true,
        confidence: 0.9,
        verdict: 'contradicted',
        forceScore: 100,
        reason: `Financial claim is unrealistic (${calc.principal} cannot grow to ${calc.stated} at ${calc.rate * 100}% in ${calc.time} ${calc.timeUnit}(s). Expected: ${expected.toLocaleString()})`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Partial information
  if (calc.principal || calc.rate !== undefined) {
    return {
      domain,
      applicable: true,
      confidence: 0.6,
      verdict: 'unknown',
      reason: 'Financial claim lacks complete information for verification',
      evidenceNeeded: ['interest rate', 'time period', 'full calculation details', 'source of terms'],
      externalVerificationRequired: true,
      suggestedSourceTypes: ['official contract', 'central bank', 'regulated financial institution']
    };
  }

  return {
    domain,
    applicable: true,
    confidence: 0.4,
    verdict: 'unknown',
    reason: 'Financial claim could not be fully analyzed',
    evidenceNeeded: ['complete financial terms', 'principal amount', 'interest rate', 'time period'],
    externalVerificationRequired: true
  };
}
