export type UserDecisionIntent =
  | 'identity-legitimacy'
  | 'feasibility'
  | 'economics-calculation'
  | 'comparison'
  | 'risk-review'
  | 'general';

export type UserDecisionIntentResult = {
  primary: UserDecisionIntent;
  confidence: number;
  scores: Record<UserDecisionIntent, number>;
  signals: string[];
};

type Rule = { intent: UserDecisionIntent; weight: number; label: string; pattern: RegExp };

const rules: Rule[] = [
  { intent: 'identity-legitimacy', weight: 5, label: 'veracidad o legitimidad', pattern: /\b(?:real(?:es)?|leg[ií]tim[oa]s?|confiable(?:s)?|aut[eé]ntic[oa]s?|habilitad[oa]s?|autorizad[oa]s?|registrad[oa]s?)\b/i },
  { intent: 'identity-legitimacy', weight: 6, label: 'posible fraude', pattern: /\b(?:estafa(?:s)?|fraude(?:s)?|scam|enga[ñn]o|truch[oa]s?|fantasma)\b/i },
  { intent: 'identity-legitimacy', weight: 4, label: 'existencia u operación', pattern: /\b(?:existe(?:n)?|opera(?:n)?|funciona(?:n)?|est[aá]n?\s+activ[oa]s?|qui[eé]n\s+est[aá]\s+detr[aá]s)\b/i },
  { intent: 'identity-legitimacy', weight: 3, label: 'entidad identificable', pattern: /\b(?:empresa(?:s)?|entidad(?:es)?|fintech|proptech|plataforma(?:s)?|broker|exchange|sitio|dominio|marca(?:s)?)\b|\b(?:www\.)?[a-z0-9-]+\.(?:com(?:\.ar)?|net|org|io|app|finance|money)\b/i },
  { intent: 'feasibility', weight: 5, label: 'posibilidad o factibilidad', pattern: /\b(?:es|ser[ií]a|resulta|parece)\s+(?:legalmente\s+|t[eé]cnicamente\s+|econ[oó]micamente\s+)?(?:posible|viable|factible)|\b(?:se\s+puede|podr[ií]a\s+hacerse|puede\s+funcionar|tiene\s+sentido)\b/i },
  { intent: 'feasibility', weight: 3, label: 'estructura de inversión', pattern: /\b(?:tokenizaci[oó]n|crowdfunding|crowdinvesting|fideicomiso|veh[ií]culo\s+de\s+inversi[oó]n|participaciones?|derechos?\s+sobre\s+el\s+activo)\b/i },
  { intent: 'economics-calculation', weight: 5, label: 'cálculo económico', pattern: /\b(?:cu[aá]nto\s+(?:rinde|gano|pago|cuesta)|rentabilidad|rendimiento|retorno|tir|van|flujo\s+de\s+fondos|precio\s+por\s+m2|tasa|costo\s+total)\b/i },
  { intent: 'economics-calculation', weight: 2, label: 'datos cuantitativos', pattern: /(?:\$|usd|ars)\s*\d|\b\d+(?:[.,]\d+)?\s*%\b/i },
  { intent: 'comparison', weight: 5, label: 'comparación explícita', pattern: /\b(?:compar(?:ar|ame|ación)|versus|vs\.?|diferencia(?:s)?|cu[aá]l\s+conviene|mejor\s+que|peor\s+que|alternativa)\b/i },
  { intent: 'risk-review', weight: 4, label: 'riesgo o seguridad', pattern: /\b(?:riesgo(?:s)?|segur[oa]s?|alerta(?:s)?|señal(?:es)?|peligro(?:s)?|antes\s+de\s+(?:pagar|invertir)|perder\s+(?:dinero|fondos))\b/i },
  { intent: 'risk-review', weight: 3, label: 'control documental', pattern: /\b(?:revisar|analizar|auditar|controlar|validar|verificar|comprobar|confirmar)\b/i },
];

const intents: UserDecisionIntent[] = ['identity-legitimacy', 'feasibility', 'economics-calculation', 'comparison', 'risk-review', 'general'];

export function classifyUserDecisionIntent(instruction: string, content = ''): UserDecisionIntentResult {
  const question = instruction.trim() || content.slice(0, 1200);
  const contextual = `${question}\n${content.slice(0, 4000)}`;
  const scores = Object.fromEntries(intents.map((intent) => [intent, 0])) as Record<UserDecisionIntent, number>;
  const signals: string[] = [];
  for (const rule of rules) {
    const source = rule.intent === 'feasibility' && rule.label === 'estructura de inversión' ? contextual : question;
    if (!rule.pattern.test(source)) continue;
    scores[rule.intent] += rule.weight;
    signals.push(rule.label);
  }

  // An identifiable counterparty plus a truth, registration or fraud question is
  // an identity check. A bare “is this possible?” about an instrument remains a
  // feasibility question instead of being mistaken for fraud or profitability.
  if (scores['identity-legitimacy'] >= 7) scores['identity-legitimacy'] += 3;
  if (scores.feasibility >= 5 && scores['identity-legitimacy'] < 7) scores.feasibility += 2;

  const ranked = intents
    .filter((intent) => intent !== 'general')
    .map((intent) => ({ intent, score: scores[intent] }))
    .sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  const primary = winner?.score > 0 ? winner.intent : 'general';
  const total = ranked.reduce((sum, item) => sum + item.score, 0);
  return { primary, confidence: total ? Math.round((winner.score / total) * 100) : 0, scores, signals: [...new Set(signals)] };
}
