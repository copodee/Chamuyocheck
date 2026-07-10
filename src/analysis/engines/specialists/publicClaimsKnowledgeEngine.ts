/**
 * Public Claims/News Knowledge Engine
 * Evaluates recent public events and news-like claims
 */

import type { SpecialistResult, KnowledgeDomain } from '../../types/knowledgeRouter';

export function evaluatePublicClaimsClaim(claimText: string): SpecialistResult {
  const domain: KnowledgeDomain = 'public-claims';

  // Check if this is a public claim
  const publicPatterns = /ayer|yesterday|hoy|today|hace|ago|pasado|past|reciente|recent|noticia|news|gobierno|government|país|country|económico|economic|anuncio|announcement|congreso|congress|montaje|staged|conspiración|conspiracy|pruebas|evidence/i;
  if (!publicPatterns.test(claimText)) {
    return {
      domain,
      applicable: false,
      confidence: 0,
      verdict: 'unknown',
      reason: 'Not a public claim',
      evidenceNeeded: [],
      externalVerificationRequired: false
    };
  }

  // Supported public facts (established events)
  const supportedPublicPatterns = [
    { pattern: /argentina\s+ganó\s+(?:el\s+)?mundial\s+2022/i, claim: 'Argentina won World Cup 2022', fact: true },
    { pattern: /messi.*mundial.*2022/i, claim: 'Messi played in World Cup 2022', fact: true }
  ];

  for (const { pattern, claim, fact } of supportedPublicPatterns) {
    if (pattern.test(claimText) && fact) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'supported',
        recommendedScore: 10,
        reason: `Public fact: ${claim} (verified public event)`,
        evidenceNeeded: [],
        externalVerificationRequired: false
      };
    }
  }

  // Conspiracy theories and impossible public claims
  const conspiracyjPatterns = [
    { pattern: /chemtrails|gobierno.*controlando.*clima|government.*controlling.*weather/i, reason: 'Chemtrails conspiracy theory (not supported by evidence)' },
    { pattern: /ataques.*septiembre.*montaje|9.*11.*staged|world.*trade.*center.*fake/i, reason: 'False claim about 9/11 being staged' },
    { pattern: /tierra.*plana|flat.*earth.*government/i, reason: 'Flat earth conspiracy theory' },
    { pattern: /vacunas.*microchips|vaccines.*tracking/i, reason: 'Vaccine tracking conspiracy theory (not supported)' }
  ];

  for (const { pattern, reason } of conspiracyjPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.95,
        verdict: 'extraordinary-unverified',
        minimumScore: 95,
        reason: `Conspiracy theory: ${reason}`,
        evidenceNeeded: ['credible scientific evidence', 'multiple independent sources', 'expert verification'],
        externalVerificationRequired: true,
        suggestedSourceTypes: ['scientific journals', 'government health agencies', 'meteorological authorities']
      };
    }
  }

  // Government cover-up claims and extraordinary public events
  const extraordinaryPatterns = [
    /gobierno.*oculta|government.*hides|gobierno.*secreto|secret.*government/i,
    /conspiración.*gobierno|government.*conspiracy|encubrimiento|cover.?up/i,
    /gobierno\s+(?:está\s+)?(?:ocultando|hiding|conspirando|conspiring).*(?:evidencia|evidence|verdad|truth)/i,
    /pruebas\s+(?:de\s+)?que.*fue.*montaje|proof.*was.*staged|demostración.*fake/i,
    // Extraordinary sightings with recent/location context
    /(?:extraterrestre|alien|ovni|ufo|criatura|milagro).{0,100}(?:ayer|hoy|hace\s*\d+|ayer|hoy|argentina|buenos aires|córdoba|rosa rio|mendoza|salta|santiago|ciudad|provincia)/i,
    /(?:ayer|hoy|hace\s*\d+).{0,100}(?:extraterrestre|alien|ovni|ufo|milagro|evento sobrenatural)/i
  ];

  for (const pattern of extraordinaryPatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.85,
        verdict: 'extraordinary-unverified',
        minimumScore: 90,
        reason: 'Government conspiracy claim without credible evidence',
        evidenceNeeded: ['primary sources', 'multiple independent corroboration', 'credible whistleblower evidence'],
        externalVerificationRequired: true,
        suggestedSourceTypes: ['investigative journalism', 'government documents', 'court records', 'credible sources']
      };
    }
  }

  // Recent news-like claims require verification
  const recentTimePatterns = [
    /ayer|yesterday|hace\s*(?:\d+\s*)?(?:horas|días|semanas)/i,
    /hoy|today|pasado|last\s*(?:week|day|month)/i
  ];

  for (const pattern of recentTimePatterns) {
    if (pattern.test(claimText)) {
      return {
        domain,
        applicable: true,
        confidence: 0.5,
        verdict: 'unknown',
        reason: 'Recent public claim requires current news verification',
        evidenceNeeded: ['news sources', 'official statements', 'primary evidence'],
        externalVerificationRequired: true,
        suggestedSourceTypes: ['reputable news media', 'official government statements', 'official sources']
      };
    }
  }

  // General public claim
  return {
    domain,
    applicable: true,
    confidence: 0.5,
    verdict: 'unknown',
    reason: 'Public claim requires verification from reliable sources',
    evidenceNeeded: ['news sources', 'official statements', 'corroborating evidence'],
    externalVerificationRequired: true,
    suggestedSourceTypes: ['official sources', 'reputable news organizations', 'government statements']
  };
}
