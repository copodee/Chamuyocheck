export type ExtinctSpeciesResult = {
  detected: boolean;
  speciesName: string | null;
  speciesLabel: string | null;
  hasAliveAssertion: boolean;
  hasMoneyRequest: boolean;
  moneyAmount: number | null;
  moneyCurrency: string | null;
};

// Known extinct species
const EXTINCT_SPECIES = /\b(dinosauri[ao]s?|dino(?=saurio)|t[- ]?rex|velociraptor|mamuts?|pterod[aá]ctilos?|diplodocus|triceratops|megalo[dó]n|estegosaurios?|brontosaurios?|pterosaurios?|mosasaurios?|plesiosaurios?|dodo|quagga|tilacino|alosaurio|saurópodo[s]?|ictiosaurio|ammonite[s]?)\b/i;

const EXTINCT_LABELS: Record<string, string> = {
  dinosaurios: 'dinosaurios (extintos hace ~66 millones de años)',
  dinosaurio: 'dinosaurio (extinto hace ~66 millones de años)',
  'dinosauria': 'dinosaurio (extinto hace ~66 millones de años)',
  dinosaurias: 'dinosaurios (extintos hace ~66 millones de años)',
  't-rex': 'Tyrannosaurus rex (extinto hace ~66 millones de años)',
  'trex': 'Tyrannosaurus rex (extinto hace ~66 millones de años)',
  velociraptor: 'velociraptor (extinto hace ~66 millones de años)',
  mamut: 'mamut (extinto hace ~10.000 años)',
  mamuts: 'mamuts (extintos hace ~10.000 años)',
  megalodon: 'megalodón (extinto hace ~3.6 millones de años)',
  megalodón: 'megalodón (extinto hace ~3.6 millones de años)',
  pterodáctilo: 'pterodáctilo (extinto hace ~66 millones de años)',
  pterodactilo: 'pterodáctilo (extinto hace ~66 millones de años)',
  dodo: 'dodo (extinto hace ~350 años)',
  tilacino: 'tilacino (extinto en 1936)',
  triceratops: 'triceratops (extinto hace ~66 millones de años)',
};

// Assertions that something exists/is alive NOW
const ALIVE_NOW = /\b(viv[oa]s?|todav[ií]a|todavía|aún|ahi|all[aá]|quedan|sobreviv[eié]n?|siguen|siguen existiendo|los hay|se encuentran|se ven|existen|hay)\b/i;

// Money request in any currency
const MONEY_PATTERN = /\b(\d[\d.,]*)\s*(d[oó]lares?|usd|euros?|pesos?|dlls?|\$)\b|\$\s*(\d[\d.,]*)/i;

export function extractClaims(text: string): ExtinctSpeciesResult {
  const lower = text.toLowerCase();

  // Detect extinct species
  const extinctMatch = EXTINCT_SPECIES.exec(lower);
  if (!extinctMatch) {
    return {
      detected: false,
      speciesName: null,
      speciesLabel: null,
      hasAliveAssertion: false,
      hasMoneyRequest: false,
      moneyAmount: null,
      moneyCurrency: null
    };
  }

  const rawName = extinctMatch[0].toLowerCase();
  const speciesLabel = EXTINCT_LABELS[rawName] ?? `${rawName} (especie extinta)`;

  // Check alive assertion within contextual window around the species mention
  const idx = extinctMatch.index;
  const contextWindow = lower.substring(Math.max(0, idx - 100), idx + 200);
  const hasAliveAssertion = ALIVE_NOW.test(contextWindow);

  // Check money request
  const moneyMatch = MONEY_PATTERN.exec(text);
  const hasMoneyRequest = moneyMatch !== null;
  let moneyAmount: number | null = null;
  let moneyCurrency: string | null = null;
  if (moneyMatch) {
    const numStr = (moneyMatch[1] || moneyMatch[3] || '').replace(/\./g, '').replace(/,/g, '.');
    moneyAmount = parseFloat(numStr) || null;
    moneyCurrency = moneyMatch[2] || 'pesos';
  }

  return {
    detected: true,
    speciesName: rawName,
    speciesLabel,
    hasAliveAssertion,
    hasMoneyRequest,
    moneyAmount,
    moneyCurrency
  };
}
