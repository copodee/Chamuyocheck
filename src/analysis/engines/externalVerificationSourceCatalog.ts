export type ExternalVerificationProviderStatus = 'implemented' | 'planned';

export type ExternalVerificationProvider = {
  id: string;
  name: string;
  sourceTypes: string[];
  domains: string[];
  status: ExternalVerificationProviderStatus;
};

/** Planned entries are routing targets only, never available connectors. */
export const EXTERNAL_VERIFICATION_SOURCE_CATALOG: ExternalVerificationProvider[] = [
  { id: 'infoleg', name: 'InfoLEG / Argentina.gob.ar', sourceTypes: ['government-law-repository'], domains: ['legal', 'public-policy'], status: 'implemented' },
  { id: 'boletin-oficial', name: 'Boletín Oficial de la República Argentina', sourceTypes: ['official-gazette'], domains: ['legal', 'public-policy'], status: 'implemented' },
  { id: 'bcra', name: 'Banco Central de la República Argentina', sourceTypes: ['central-bank-data', 'official-market-data'], domains: ['finance', 'economics'], status: 'implemented' },
  { id: 'pubmed', name: 'PubMed', sourceTypes: ['peer-reviewed-medical-research'], domains: ['biology-health', 'science'], status: 'implemented' },
  { id: 'who', name: 'World Health Organization', sourceTypes: ['health-authorities', 'clinical-guidelines'], domains: ['biology-health'], status: 'implemented' },
  { id: 'world-bank', name: 'World Bank', sourceTypes: ['official-statistics'], domains: ['economics', 'public-policy'], status: 'implemented' },
  { id: 'news', name: 'Allowlisted independent news outlets', sourceTypes: ['independent-news'], domains: ['public-claims', 'politics'], status: 'implemented' },
  { id: 'anmat', name: 'ANMAT', sourceTypes: ['drug-regulator-anmat', 'pharmacovigilance'], domains: ['biology-health'], status: 'planned' },
  { id: 'fda', name: 'U.S. Food and Drug Administration', sourceTypes: ['drug-regulator-fda', 'pharmacovigilance'], domains: ['biology-health'], status: 'planned' },
  { id: 'ema', name: 'European Medicines Agency', sourceTypes: ['drug-regulator-ema', 'pharmacovigilance'], domains: ['biology-health'], status: 'planned' },
  { id: 'cnv', name: 'Comisión Nacional de Valores', sourceTypes: ['securities-regulator-cnv', 'regulatory-filings'], domains: ['finance', 'legal'], status: 'planned' },
  { id: 'byma', name: 'Bolsas y Mercados Argentinos', sourceTypes: ['market-operator-byma', 'official-market-data'], domains: ['finance'], status: 'planned' },
  { id: 'crypto-market', name: 'Independent crypto market data', sourceTypes: ['crypto-market-data'], domains: ['finance'], status: 'planned' },
  { id: 'blockchain-explorer', name: 'Network-specific blockchain explorers', sourceTypes: ['blockchain-explorer'], domains: ['finance', 'technology'], status: 'planned' },
  { id: 'protocol-source', name: 'Protocol documentation and verified source code', sourceTypes: ['protocol-documentation'], domains: ['finance', 'technology'], status: 'planned' },
  { id: 'security-audit', name: 'Independent smart-contract security audits', sourceTypes: ['independent-security-audits'], domains: ['finance', 'technology'], status: 'planned' },
];

export function providersForSourceTypes(sourceTypes: string[]): ExternalVerificationProvider[] {
  const requested = new Set(sourceTypes);
  return EXTERNAL_VERIFICATION_SOURCE_CATALOG.filter((provider) =>
    provider.sourceTypes.some((sourceType) => requested.has(sourceType))
  );
}
