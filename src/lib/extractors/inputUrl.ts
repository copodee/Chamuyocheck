export type ResolvedUrlInput = { url: string; remainingText: string; detectedFromText: boolean };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

function validProtocol(value: string) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

/** Accepts a URL pasted into the text box, with or without a short instruction. */
export function resolveUrlInput(text: string, explicitUrl: string): ResolvedUrlInput {
  const explicit = explicitUrl.trim();
  if (explicit && validProtocol(explicit)) return { url: explicit, remainingText: text.trim(), detectedFromText: false };
  const match = text.match(URL_PATTERN);
  const candidate = (match?.[0] || '').replace(/[),.;!?]+$/, '');
  if (!candidate || !validProtocol(candidate)) return { url: explicit, remainingText: text.trim(), detectedFromText: false };
  return {
    url: candidate,
    remainingText: text.replace(match?.[0] || '', ' ').replace(/\s+/g, ' ').trim(),
    detectedFromText: true,
  };
}
