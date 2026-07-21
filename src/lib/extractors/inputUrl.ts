export type ResolvedUrlInput = { url: string; remainingText: string; detectedFromText: boolean };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
const BARE_DOMAIN_PATTERN = /\b(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com\.ar|com|net|org|io|app|finance|money)(?:\/[^\s<>"']*)?/i;

function validProtocol(value: string) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

function normalizedPublicUrl(value: string): string {
  const cleaned = value.trim().replace(/[),.;!?]+$/, '');
  if (validProtocol(cleaned)) return cleaned;
  return BARE_DOMAIN_PATTERN.exec(cleaned)?.[0] === cleaned ? `https://${cleaned}` : '';
}

/** Accepts a URL pasted into the text box, with or without a short instruction. */
export function resolveUrlInput(text: string, explicitUrl: string): ResolvedUrlInput {
  const explicit = explicitUrl.trim();
  const normalizedExplicit = normalizedPublicUrl(explicit);
  if (normalizedExplicit) return { url: normalizedExplicit, remainingText: text.trim(), detectedFromText: false };
  const match = text.match(URL_PATTERN) || text.match(BARE_DOMAIN_PATTERN);
  const candidate = normalizedPublicUrl(match?.[0] || '');
  if (!candidate) return { url: '', remainingText: text.trim(), detectedFromText: false };
  return {
    url: candidate,
    remainingText: text.replace(match?.[0] || '', ' ').replace(/\s+/g, ' ').trim(),
    detectedFromText: true,
  };
}
