/**
 * Legal/Contractual Knowledge Engine
 * Evaluates legal and contractual claims
 * Conservative approach: do not declare legal truth without jurisdiction and sources
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

export function evaluateLegalClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'legal';

  // Check if this is a legal claim
  const legalPatterns = /legal|ley|law|contrato|contract|derecho|right|cláusula|clause|CFT|TEA|ilegal|illegal|obligatorio|mandatory|permitido|allowed|regulación|regulation|estatuto|statute/i;
  if (!legalPatterns.test(claimText)) {
    return {
      domain,
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Not a legal claim',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // CFT (Costo Financiero Total) is legally required in Argentina for financial products
  const cftPatterns = [
    /es.*obligatorio.*especificar.*cft|must.*specify.*CFT|required.*to.*specify.*total.*cost/i,
    /la ley.*(requiere|exige|obliga).*cft|law.*(requires|mandates).*CFT/i,
    /costo.*financiero.*total.*debe.*aparecer|CFT.*en.*créd|especifique.*cft/i
  ];

  for (const pattern of cftPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.85,
        verdict: 'supported',
        recommendedScore: 5,
        reason: 'Financial transparency law: CFT disclosure is legally required in Argentina for credit products',
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // False legal claims
  const falseLegalPatterns = [
    { pattern: /no\s*es\s*legal\s*exigir.*costo|no\s*es\s*legal.*especificar|not.*legal.*to.*disclose.*cost/i, reason: 'Cost disclosure is legally required' },
    { pattern: /no.*se.*puede.*pedir.*cft|cannot.*ask.*for.*CFT|ilegal.*requerir.*cft/i, reason: 'CFT is a legal requirement in financial contracts' }
  ];

  for (const { pattern, reason } of falseLegalPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.8,
        verdict: 'contradicted',
        minimumScore: 75,
        reason: `Legal claim is false: ${reason}`,
        evidenceNeeded: ['statute', 'regulation', 'official legal source'],
        externalVerificationRequired: false
      };
    }
  }

  // Generic legal claims without jurisdiction/context
  if (/ilegal|illegal|violat|contra\s*ley/i.test(claimText)) {
    // Without specific jurisdiction and law, mark as requiring verification
    return {
      domain,
      applicable: true,
      confidence: 0.3,
      verdict: 'unknown',
      reason: 'Legal claim requires jurisdiction, specific law, and legal source',
      evidenceNeeded: ['applicable jurisdiction', 'specific statute or regulation', 'date of claim', 'legal analysis'],
      externalVerificationRequired: true,
      suggestedSourceTypes: ['official statute', 'regulation', 'court decision', 'legal authority']
    };
  }

  // Contractual claims
  if (/contrato|contract|cláusula|clause|términos|terms|condición|condition/i.test(claimText)) {
    // Neutral contractual statements that just describe structure are low chamuyo
    if (/tiene\s*\d+\s*cláusula|tiene\s*\d+\s*término|tiene\s*\d+\s*condición/i.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.6,
        verdict: 'supported',
        recommendedScore: 5,
        reason: 'Contractual fact: neutral statement about contract structure',
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
    return {
      domain,
      applicable: true,
      confidence: 0.4,
      verdict: 'unknown',
      reason: 'Contractual claim requires examination of actual contract and applicable law',
      evidenceNeeded: ['the actual contract', 'applicable jurisdiction and law', 'legal expertise'],
      externalVerificationRequired: true,
      suggestedSourceTypes: ['the contract itself', 'applicable statute', 'legal counsel']
    };
  }

  // Unknown legal claim
  return {
    domain,
    applicable: true,
    confidence: 0.4,
    verdict: 'unknown',
    reason: 'Legal claim requires proper legal analysis and sources',
    evidenceNeeded: ['applicable jurisdiction', 'relevant law', 'legal source'],
    externalVerificationRequired: true,
    suggestedSourceTypes: ['official statute', 'regulation', 'official gazette', 'court decision']
  };
}
