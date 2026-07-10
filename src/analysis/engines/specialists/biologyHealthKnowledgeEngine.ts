/**
 * Biology/Health Knowledge Engine
 * Evaluates biological, medical, and health claims
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

export function evaluateBiologyHealthClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'biology-health';

  // Check if this is a biology/health claim
  const bioPatterns = /biología|biology|salud|health|médico|medical|embaraz|pregnancy|reprodu|reproduce|gen|genetic|célula|cell|virus|bacteria|antibiótico|antibiotic|vacuna|vaccine|enfermedad|disease|cura|cure|síntoma|symptom|órgano|organ|sangre|blood|corazón|heart|cuerpo|body|energía|energy|peso|weight|kg|pierde|lose|dieta|diet|adelgaz|slim/i;
  if (!bioPatterns.test(claimText)) {
    return {
      domain,
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Not a biological or health claim',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Obvious medical scams (miracle/universal cures, extreme weight loss claims)
  if (/cura.*milagrosa|cura\s*todas\s*las\s*enfermedades|cure.*all.*disease|producto\s*milagroso|miracle\s*product|cure.*miracl|cura\s*garantizada|guaranteed\s*cure|pierde.*\d+\s*kg\s*en\s*(?:una\s+)?semana|lose\s+\d+\s*kg\s*in\s*a\s*week/i.test(claimText)) {
    return {
      domain,
      applicable: true,
      confidence: 0.95,
      verdict: 'extraordinary-unverified',
      minimumScore: 95,
      reason: 'Medical/health claim promises unrealistic results (miracle cure or extreme weight loss - characteristic of health fraud)',
      evidenceNeeded: ['clinical trial results', 'regulatory approval', 'peer-reviewed studies'],
      externalVerificationRequired: true,
      suggestedSourceTypes: ['FDA approval', 'clinical trial', 'medical journal', 'health authority']
    };
  }

  // Impossible biological claims
  const impossiblePatterns = [
    { pattern: /híbrido\s*humano\s*perro|human\s*dog\s*hybrid|hijo.*perro|child.*dog/i, reason: 'Humans and dogs have incompatible reproductive biology' },
    { pattern: /varón.*embarazado|male.*pregnant|hombre.*gestación/i, reason: 'Biological males cannot become pregnant naturally' },
    { pattern: /reproducción\s*entre\s*especies\s*distintas(?!\s*posible)|reproduction\s*between\s*different\s*species(?!\s*possible)/i, reason: 'Different species cannot produce viable offspring (except very rare cases)' },
    { pattern: /cuerpo\s*produce\s*energía\s*sin\s*comer|body.*energy.*without.*food|energía.*ilimitada/i, reason: 'Biological systems require energy intake' }
  ];

  for (const { pattern, reason } of impossiblePatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'contradicted',
        forceScore: 100,
        reason: `Biological impossibility: ${reason}`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Medical misconceptions
  const misconceptionPatterns = [
    { pattern: /antibiótico.*cura.*virus/i, reason: 'Antibiotics treat bacterial infections, not viral infections' },
    { pattern: /vacuna.*causa.*autismo/i, reason: 'Vaccines do not cause autism (extensively studied)' }
  ];

  for (const { pattern, reason } of misconceptionPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.85,
        verdict: 'contradicted',
        minimumScore: 85,
        reason: `Medical misconception: ${reason}`,
        evidenceNeeded: ['peer-reviewed medical studies', 'WHO guidance', 'national health authority data'],
        externalVerificationRequired: false,
        suggestedSourceTypes: ['WHO', 'NIH', 'PubMed', 'medical journals']
      };
    }
  }

  // Extraordinary medical claims
  const extraordinaryPatterns = [
    /cura\s*milagrosa|miracle\s*cure|cura\s*todo|cure.*all|remedio.*toda.*enfermedad|universal.*cure/i,
    /recuperarse\s*(?:instant|inmediata|súbita)|instant\s*recovery|spontaneous.*recovery/i,
    /enfermedad.*terminal.*instant|terminal.*disease.*instant|cura.*instant/i
  ];

  for (const pattern of extraordinaryPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.85,
        verdict: 'extraordinary-unverified',
        minimumScore: 95,
        reason: 'Extraordinary medical claim (universal cure) without strong evidence',
        evidenceNeeded: ['clinical trials', 'peer-reviewed publication', 'regulatory approval', 'medical authority verification'],
        externalVerificationRequired: true,
        suggestedSourceTypes: ['FDA/regulatory approval', 'peer-reviewed medical journals', 'NIH clinical trials database']
      };
    }
  }

  // Supported health facts
  const supportedPatterns = [
    { pattern: /el\s*corazón\s*bombea\s*sangre/i, reason: 'The heart circulates blood' },
    { pattern: /respiración|breathing|pulmones|lungs/i, reason: 'Basic respiratory biology' }
  ];

  for (const { pattern, reason } of supportedPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.9,
        verdict: 'supported',
        recommendedScore: 5,
        reason: `Basic biological fact: ${reason}`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Unknown health claim
  return {
    domain,
    applicable: true,
    confidence: 0.5,
    verdict: 'unknown',
    reason: 'Health claim requires medical expert verification',
    evidenceNeeded: ['medical sources', 'clinical evidence', 'professional medical assessment'],
    externalVerificationRequired: true,
    suggestedSourceTypes: ['WHO', 'NIH', 'national health authority', 'peer-reviewed medical journals']
  };
}
