/**
 * History/Sports Knowledge Engine
 * Evaluates historical and sports facts
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

export function evaluateHistorySportsClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'history-sports';

  // Check if this is a history/sports claim
  const historyPatterns = /mundial|world\s*cup|messi|ronaldo|argentina|fútbol|soccer|football|campeón|champion|ganó|won|perdió|lost|año|year|historia|history|guerra|war|victoriano|victorian|época|era|siglo|century/i;
  if (!historyPatterns.test(claimText)) {
    return {
      domain,
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Not a history or sports claim',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Well-known historical and sports facts - stable, documented
  const supportedFactsPatterns = [
    { pattern: /colón.*américa.*1492|columbus.*america.*1492/i, reason: 'Columbus reached the Americas in 1492 (documented historical event)' },
    { pattern: /argentina.*independencia.*1816|argentina.*independence.*1816/i, reason: 'Argentina declared independence on May 25, 1816 (documented)' },
    { pattern: /segunda\s*guerra.*1945|world\s*war\s*2.*1945/i, reason: 'WWII ended in 1945 (documented historical fact)' },
    { pattern: /messi.*mundial.*2022|argentina.*mundial.*2022/i, reason: 'Argentina won the World Cup in 2022' }
  ];

  for (const { pattern, reason } of supportedFactsPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.98,
        verdict: 'supported',
        recommendedScore: 5,
        reason: `Historical fact: ${reason}`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Impossible historical/sports claims
  const impossiblePatterns = [
    { pattern: /napoleón.*conquistó.*marte|napoleon.*conquered.*mars/i, reason: 'Napoleon could not have conquered Mars' },
    { pattern: /argentina\s+nunca\s+ganó.*mundial/i, reason: 'Argentina has won World Cups (1978, 1986, 2022)' }
  ];

  for (const { pattern, reason } of impossiblePatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.9,
        verdict: 'contradicted',
        forceScore: 100,
        reason: `Historical impossibility: ${reason}`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Historical facts requiring verification
  const historicalPatterns = [
    /segundo\s*guerra|world\s*war.*2|1945|segunda\s*guerra\s*mundial/i,
    /revolucion|revolution|independencia|independence|colón|columbus|1492/i
  ];

  for (const pattern of historicalPatterns) {
    if (pattern.test(claimText)) {
      // Major historical events that are well-documented
      if (/segunda\s*guerra.*1945|world\s*war.*1945/i.test(claimText)) {
        return {
          domain,
          applicable: true,
          confidence: 0.95,
          verdict: 'supported',
          recommendedScore: 5,
          reason: 'Historical fact: WWII ended in 1945 (well-documented)',
          evidenceNeeded: [],
          externalVerificationRequired: false
        };
      }

      if (/colón.*1492|columbus.*1492/i.test(claimText)) {
        return {
          domain,
          applicable: true,
          confidence: 0.9,
          verdict: 'supported',
          recommendedScore: 8,
          reason: 'Historical fact: Columbus sailed in 1492 (well-documented)',
          evidenceNeeded: [],
          externalVerificationRequired: false
        };
      }

      // General historical claims need verification
      return {
        domain,
        applicable: true,
        confidence: 0.7,
        verdict: 'unknown',
        reason: 'Historical claim requires source verification',
        evidenceNeeded: ['historical records', 'primary sources', 'academic consensus'],
        externalVerificationRequired: true,
        suggestedSourceTypes: ['historical records', 'academic publications', 'official archives']
      };
    }
  }

  // Unknown claim
  return {
    domain,
    applicable: true,
    confidence: 0.5,
    verdict: 'unknown',
    reason: 'History/sports claim requires verification',
    evidenceNeeded: ['official records', 'historical sources', 'sports federation data'],
    externalVerificationRequired: true,
    suggestedSourceTypes: ['official federation', 'historical records', 'sports archives']
  };
}
