export type SensitivePersonalClaimKind =
  | 'sexual-orientation'
  | 'intimate-life'
  | 'health'
  | 'criminal-conduct';

const identifiablePublicPerson = /\b(?:presidente|vicepresidente|ministro|senador|diputado|gobernador|intendente|funcionario|pol[ií]tico|juez|fiscal|empresario|ejecutivo|ceo|director|figura\s+p[uú]blica|persona\s+p[uú]blica|personalidad|celebridad|deportista|actor|actriz|artista|influencer)(?:\s+de\s+[a-záéíóúñ]+){0,3}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?\b/i;

const sensitivePredicates: Array<{ kind: SensitivePersonalClaimKind; pattern: RegExp }> = [
  { kind: 'sexual-orientation', pattern: /\b(?:es|ser[ií]a|era|fue)\s+(?:homosexual|gay|lesbiana|bisexual|asexual|pansexual)\b/i },
  { kind: 'intimate-life', pattern: /\b(?:mantiene|tiene|guarda|oculta|esconde|lleva|sostiene|realiza|comete|hace|practica)\s+(?:relaciones?\s+)?(?:sexuales?|intimidad|aventura|affair|encuentro|relaci[oó]n\s+de|romance|v[ií]nculo|infidelidad|amante)\b/i },
  { kind: 'health', pattern: /\b(?:tiene|padece|sufre|es)\s+(?:vih|sida|c[aá]ncer|adicto|adicta|alcoh[oó]lico|alcoh[oó]lica|drogadicto|drogadicta)\b/i },
  { kind: 'criminal-conduct', pattern: /\b(?:es|ser[ií]a|fue)\s+(?:ladr[oó]n|ladrona|corrupto|corrupta|abusador|abusadora|violador|violadora|narcotraficante)\b/i },
];

/** Job-title words are entity context, not the subject-matter domain. */
export function detectSensitivePersonalClaim(text: string): {
  detected: boolean;
  kind: SensitivePersonalClaimKind | null;
} {
  if (!identifiablePublicPerson.test(text)) return { detected: false, kind: null };
  const match = sensitivePredicates.find(({ pattern }) => pattern.test(text));
  return match ? { detected: true, kind: match.kind } : { detected: false, kind: null };
}
