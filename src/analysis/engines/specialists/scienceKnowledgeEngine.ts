/**
 * Science Knowledge Engine
 * Evaluates scientific and physical claims
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

export function evaluateScienceClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'science';

  // Check if this is a science claim
  const sciencePatterns = /física|physics|química|chemistry|atmósfera|atmosphere|gravedad|gravity|tierra|earth|agua|water|aire|air|luz|light|energía|energy|temperatura|temperature|calor|heat|hielo|ice|vapor|steam|evaporar|boil|freeze|congelar|vuelo|volar|fly|flying|moléculas|molecules|cuerpo|body|energía|energy|extraterrestre|alien|ovni|ufo|milagro|miracle|sobrenatural|supernatural/i;
  if (!sciencePatterns.test(claimText)) {
    return {
      domain,
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Not a scientific claim',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Impossible science claims - definitively false
  const impossiblePatterns = [
    { pattern: /tierra\s*plana|flat\s*earth/i, reason: 'Earth is spherical (not flat)' },
    { pattern: /humanos?\s*pueden\s*respirar\s*bajo\s*el\s*agua(?!\s*con)/i, reason: 'Humans cannot breathe underwater without equipment' },
    { pattern: /humanos?\s*pueden\s*volar\s*sin\s*tecnología|humans?\s*fly\s*without\s*technology/i, reason: 'Humans cannot fly naturally' },
    { pattern: /agua\s*no\s*tiene\s*moléculas/i, reason: 'Water is composed of molecules (H₂O)' },
    { pattern: /el\s*hielo\s*es\s*más\s*pesado\s*que\s*el\s*agua/i, reason: 'Ice floats (less dense than water)' },
    { pattern: /cuerpo\s*produce\s*energía.*sin\s*comer|body.*produce.*energy.*without.*eating|energía.*ilimitada/i, reason: 'Biological systems require energy intake' }
  ];

  for (const { pattern, reason } of impossiblePatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'contradicted',
        forceScore: 100,
        reason: `Scientific impossibility: ${reason}`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Supported science facts
  const supportedPatterns = [
    { pattern: /agua\s*hierve\s*(?:a\s+)?100\s*°?c/i, reason: 'Water boils at 100°C at sea level' },
    { pattern: /tierra\s*(?:es\s+)?redonda|earth\s*(?:is\s+)?spherical/i, reason: 'Earth is spherical' },
    { pattern: /luz\s*viaja\s*más\s*rápido\s*que\s*el\s*sonido/i, reason: 'Light travels faster than sound' },
    { pattern: /la\s*gravedad\s*atrae\s*los\s*objetos|gravity\s*pulls\s*objects/i, reason: 'Gravity is a fundamental force' },
    { pattern: /aire\s*está\s*compuesto\s*de\s*(?:nitrógeno|oxígeno)/i, reason: 'Air contains nitrogen and oxygen' }
  ];

  for (const { pattern, reason } of supportedPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.9,
        verdict: 'supported',
        recommendedScore: 5,
        reason: `Scientific fact: ${reason}`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Extraordinary claims (not impossible, but extraordinary)
  const extraordinaryPatterns = [
    /extraterrestre|alien|ovni|ufo|milagro|miracle|sobrenatural|supernatural|gobierno\s*oculta|government\s*hides/i
  ];

  for (const pattern of extraordinaryPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.85,
        verdict: 'extraordinary-unverified',
        minimumScore: 90,
        reason: 'Extraordinary scientific claim without strong evidence',
        evidenceNeeded: ['peer-reviewed evidence', 'multiple independent sources', 'official verification'],
        externalVerificationRequired: true,
        suggestedSourceTypes: ['peer-reviewed journals', 'scientific institutions', 'government official statements']
      };
    }
  }

  // Unknown science claim
  return {
    domain,
    applicable: true,
    confidence: 0.5,
    verdict: 'unknown',
    reason: 'Scientific claim requires expert verification',
    evidenceNeeded: ['scientific sources', 'peer-reviewed literature', 'expert testimony'],
    externalVerificationRequired: true,
    suggestedSourceTypes: ['peer-reviewed journals', 'university research', 'scientific societies']
  };
}
