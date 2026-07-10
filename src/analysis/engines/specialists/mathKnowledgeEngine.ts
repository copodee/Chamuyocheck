/**
 * Mathematics Knowledge Engine
 * Evaluates mathematical and arithmetic claims with numeric parsing
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

function parseNumericExpression(text: string): { isValid: boolean; result?: number; expression?: string } {
  // Extract numeric expressions like "2 + 2", "10% de 100", etc.
  const simpleArith = /(\d+(?:[.,]\d+)?)\s*([+\-×*])\s*(\d+(?:[.,]\d+)?)/i;
  const percentage = /(\d+(?:[.,]\d+)?)\%?\s*(?:de|of)?\s*(\d+(?:[.,]\d+)?)/i;
  const equation = /(\d+(?:[.,]\d+)?)\s*([+\-×*=])\s*(\d+(?:[.,]\d+)?)/i;

  // Try arithmetic match
  const arithMatch = text.match(simpleArith);
  if (arithMatch) {
    const [, num1Str, op, num2Str] = arithMatch;
    const num1 = parseFloat(num1Str.replace(',', '.'));
    const num2 = parseFloat(num2Str.replace(',', '.'));
    
    let result: number | undefined;
    if (op === '+') result = num1 + num2;
    else if (op === '-') result = num1 - num2;
    else if (op === '×' || op === '*') result = num1 * num2;
    
    return { isValid: true, result, expression: `${num1} ${op} ${num2}` };
  }

  // Try percentage match
  const percMatch = text.match(percentage);
  if (percMatch) {
    const [, percStr, baseStr] = percMatch;
    const perc = parseFloat(percStr.replace(',', '.'));
    const base = parseFloat(baseStr.replace(',', '.'));
    const result = (perc / 100) * base;
    return { isValid: true, result, expression: `${perc}% de ${base}` };
  }

  return { isValid: false };
}

/**
 * Parse European format numbers: "100.000,50" or "100,000.50"
 * Returns the numeric value
 */
function parseEuropeanNumber(str: string): number {
  if (!str) return NaN;
  
  // Count occurrences of separators
  const periods = (str.match(/\./g) || []).length;
  const commas = (str.match(/,/g) || []).length;

  // Determine separator logic
  if (periods === 1 && commas === 0) {
    // "100.50" - could be decimal or thousands
    // If 2 digits after period, likely decimal
    if (str.endsWith('.') === false && str.split('.')[1]?.length === 2) {
      return parseFloat(str); // 100.50
    } else {
      // 100.000 format - remove period
      return parseFloat(str.replace('.', ''));
    }
  } else if (commas === 1 && periods === 0) {
    // "100,50" - likely European decimal
    return parseFloat(str.replace(',', '.'));
  } else if (periods > 1 || (periods > 0 && commas > 0)) {
    // Multiple separators: remove thousands, keep decimal
    // If last char is digit, last separator is thousands
    // Otherwise, last separator is decimal
    const lastIdx = Math.max(str.lastIndexOf('.'), str.lastIndexOf(','));
    const lastChar = str[lastIdx];
    
    if (lastChar === '.') {
      // European: "100.000,50" or "100.000"
      if (str[lastIdx + 1]?.length === 2 || /\d\d$/.test(str)) {
        // Has 2 digits after period - it's decimal
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
      } else {
        // Period is thousands separator
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
      }
    } else {
      // Comma is last: "100.000,50" format
      return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    }
  }

  return parseFloat(str);
}

/**
 * Calculate compound interest for simple investment claims
 * Pattern: "Si invierto X al Y% anual, en Z años recibiría W"
 */
function validateCompoundInterestClaim(text: string): { valid: boolean; expected?: number; found?: number; error?: string } {
  // Extract: principal, rate, years, claimed result
  // Handles both "en 1 año" and "en un año"
  const pattern = /invierto\s+(\d+(?:[.,]\d+)?(?:[.,]\d+)?)\s+(?:pesos)?\s*al\s+(\d+(?:[.,]\d+)?)\%?\s*anual,?\s*en\s+(?:un|(\d+))\s*(?:años?|year)?\s*recibi(?:ría|remos|mos|rías)\s+(\d+(?:[.,]\d+)?(?:[.,]\d+)?)/i;
  const match = text.match(pattern);
  
  if (!match) {
    return { valid: false, error: 'No investment pattern matched' };
  }

  const [, principalStr, rateStr, yearsStrOrUn, claimedStr] = match;
  const principal = parseEuropeanNumber(principalStr);
  const rate = parseEuropeanNumber(rateStr);
  const years = yearsStrOrUn ? parseInt(yearsStrOrUn, 10) : 1; // "un" means 1
  const claimed = parseEuropeanNumber(claimedStr);

  if (isNaN(principal) || isNaN(rate) || isNaN(claimed)) {
    return { valid: false, error: 'Could not parse numbers' };
  }

  // Calculate compound interest: P(1 + r)^t
  const calculated = principal * Math.pow(1 + rate / 100, years);
  
  // Allow 1% tolerance for rounding
  const tolerance = Math.abs(calculated * 0.01) + 1;
  const matches = Math.abs(calculated - claimed) <= tolerance;

  return {
    valid: matches,
    expected: Math.round(calculated),
    found: Math.round(claimed)
  };
}

function validateMathClaim(text: string): { valid: boolean; expected?: number; found?: number; error?: string } {
  // Extract the expression and the expected result
  const parts = text.split(/(?:es|=|es igual|equals|da|gives)/i);
  if (parts.length < 2) {
    return { valid: false, error: 'No equation found' };
  }

  const leftSide = parts[0].trim();
  const rightSide = parts[1].trim();

  // Parse left side expression
  const leftExpr = parseNumericExpression(leftSide);
  if (!leftExpr.isValid || leftExpr.result === undefined) {
    return { valid: false, error: 'Cannot parse left side' };
  }

  // Parse right side (should be a number)
  const rightNumber = parseFloat(rightSide.replace(/[^0-9.,]/g, '').replace(',', '.'));
  if (isNaN(rightNumber)) {
    return { valid: false, error: 'Cannot parse right side number' };
  }

  // Compare with tolerance for floating point
  const tolerance = Math.abs(leftExpr.result * 0.001) + 0.01;
  const matches = Math.abs(leftExpr.result - rightNumber) <= tolerance;

  return {
    valid: matches,
    expected: leftExpr.result,
    found: rightNumber
  };
}

export function evaluateMathematicsClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'mathematics';

  // Check if this is actually a math claim
  const mathPatterns = /\d+|percent|%|calculat|math|arithmet|equal|sum|total|equation|invierto|compound/i;
  if (!mathPatterns.test(claimText)) {
    return {
      domain,
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Not a mathematical claim',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Try compound interest claim first
  const compoundValidation = validateCompoundInterestClaim(claimText);
  if (compoundValidation.error !== 'No investment pattern matched') {
    if (compoundValidation.valid) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'supported',
        recommendedScore: 5,
        reason: `Investment calculation is correct (${compoundValidation.expected} is mathematically accurate)`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    } else if (compoundValidation.expected !== undefined && compoundValidation.found !== undefined) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'contradicted',
        forceScore: 100,
        reason: `Investment calculation is incorrect (should be ~${compoundValidation.expected}, not ${compoundValidation.found})`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Try regular math validation
  const validation = validateMathClaim(claimText);

  if (!validation.valid && validation.error === 'No equation found') {
    // Might be a general statement like "2 + 2 = 4"
    if (/2\s*\+\s*2\s*=\s*4/i.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'supported',
        recommendedScore: 5,
        reason: 'Basic arithmetic fact is mathematically correct',
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
    
    if (/2\s*\+\s*2\s*=\s*5/i.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'contradicted',
        forceScore: 100,
        reason: 'Basic arithmetic is incorrect (2 + 2 = 4, not 5)',
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  if (validation.valid) {
    return {
      domain,
      applicable: true,
      confidence: 0.9,
      verdict: 'supported',
      recommendedScore: 5,
      reason: `Mathematical calculation is correct (${validation.expected} is correct)`,
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  if (validation.valid === false && validation.expected !== undefined && validation.found !== undefined) {
    return {
      domain,
      applicable: true,
      confidence: 0.9,
      verdict: 'contradicted',
      forceScore: 100,
      reason: `Mathematical claim is incorrect (expected ${validation.expected}, but states ${validation.found})`,
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Could not determine validity
  return {
    domain,
    applicable: true,
    confidence: 0.5,
    verdict: 'unknown',
    reason: 'Mathematical claim could not be fully validated',
    evidenceNeeded: ['numeric context', 'full equation'],
    externalVerificationRequired: true
  };
}
