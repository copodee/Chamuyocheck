/**
 * Technology Knowledge Engine
 * Evaluates technology and computing claims
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

export function evaluateTechnologyClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'technology';

  // Check if this is a technology claim
  const techPatterns = /celular|smartphone|teléfono|phone|computadora|computer|aplicación|app|software|hardware|internet|wifi|carga|charge|batería|battery|telepatía|telepathy|holografía|hologram|versión|version|IA|AI|programación|programming/i;
  if (!techPatterns.test(claimText)) {
    return {
      domain,
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Not a technology claim',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Impossible technology claims
  const impossiblePatterns = [
    { pattern: /celular.*carga.*telepatía/i, reason: 'Smartphones cannot be charged by telepathy' },
    { pattern: /celular.*carga.*por.*luz|charger.*by.*light.*alone/i, reason: 'Current smartphones cannot charge solely from ambient light' },
    { pattern: /holografía\s*perfecta.*en.*casa|perfect.*holography.*home/i, reason: 'Perfect holography is not yet available for home use' }
  ];

  for (const { pattern, reason } of impossiblePatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.85,
        verdict: 'contradicted',
        forceScore: 100,
        reason: `Technological impossibility: ${reason}`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Supported technology facts - well-established knowledge
  const supportedPatterns = [
    { pattern: /lenguaje\s*de\s*programación|programming\s*language|python|java|javascript/i, reason: 'Programming languages are documented technical systems' },
    { pattern: /chip.*silicio|silicon|processor.*made.*silicon/i, reason: 'Microprocessors use silicon as a primary material' },
    { pattern: /smartphone.*wifi|celular.*internet/i, reason: 'Smartphones can connect via WiFi/internet' },
    { pattern: /internet.*protocolo|communication\s*protocol/i, reason: 'Internet uses communication protocols' },
    { pattern: /smartphone.*bluetooth|celular.*bluetooth/i, reason: 'Most smartphones support Bluetooth' }
  ];

  for (const { pattern, reason } of supportedPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'supported',
        recommendedScore: 5,
        reason: `Established technical fact: ${reason}`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Recent technology claims that need verification
  const recentPatterns = [
    /versión\s*más\s*nueva|newest\s*version|latest.*version/i,
    /hoy|today|esta\s*semana|this\s*week|último|recent/i
  ];

  let isRecentClaim = false;
  for (const pattern of recentPatterns) {
    if (pattern.test(claimText)) {
      isRecentClaim = true;
      break;
    }
  }

  if (isRecentClaim) {
    return {
      domain,
      applicable: true,
      confidence: 0.6,
      verdict: 'unknown',
      reason: 'Recent technology claim requires current verification',
      evidenceNeeded: ['official documentation', 'current version information', 'technical specifications'],
      externalVerificationRequired: true,
      suggestedSourceTypes: ['official documentation', 'vendor release notes', 'technical specifications']
    };
  }

  // Unknown technology claim
  return {
    domain,
    applicable: true,
    confidence: 0.5,
    verdict: 'unknown',
    reason: 'Technology claim requires technical verification',
    evidenceNeeded: ['technical documentation', 'specifications', 'vendor information'],
    externalVerificationRequired: true,
    suggestedSourceTypes: ['official documentation', 'technical specifications']
  };
}
