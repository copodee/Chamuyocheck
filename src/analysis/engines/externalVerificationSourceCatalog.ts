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
  { id: 'europe-pmc', name: 'Europe PMC', sourceTypes: ['peer-reviewed-medical-research', 'scientific-journals'], domains: ['biology-health', 'science'], status: 'implemented' },
  { id: 'who', name: 'World Health Organization', sourceTypes: ['health-authorities', 'clinical-guidelines'], domains: ['biology-health'], status: 'implemented' },
  { id: 'world-bank', name: 'World Bank', sourceTypes: ['official-statistics'], domains: ['economics', 'public-policy'], status: 'implemented' },
  { id: 'news', name: 'Allowlisted independent news outlets', sourceTypes: ['independent-news'], domains: ['public-claims', 'politics'], status: 'implemented' },
  { id: 'wikidata', name: 'Wikidata structured entity data', sourceTypes: ['public-records'], domains: ['general', 'culture', 'history-sports', 'public-claims'], status: 'implemented' },
  { id: 'anmat', name: 'ANMAT', sourceTypes: ['drug-regulator-anmat', 'pharmacovigilance'], domains: ['biology-health'], status: 'planned' },
  { id: 'fda', name: 'DailyMed / U.S. Food and Drug Administration', sourceTypes: ['drug-regulator-fda'], domains: ['biology-health'], status: 'implemented' },
  { id: 'ema', name: 'European Medicines Agency', sourceTypes: ['drug-regulator-ema', 'pharmacovigilance'], domains: ['biology-health'], status: 'planned' },
  { id: 'cnv', name: 'Comisión Nacional de Valores', sourceTypes: ['securities-regulator-cnv', 'regulatory-filings'], domains: ['finance', 'legal'], status: 'planned' },
  { id: 'byma', name: 'Bolsas y Mercados Argentinos', sourceTypes: ['market-operator-byma', 'official-market-data'], domains: ['finance'], status: 'planned' },
  { id: 'crypto-market', name: 'Independent crypto market data', sourceTypes: ['crypto-market-data'], domains: ['finance'], status: 'planned' },
  { id: 'blockchain-explorer', name: 'Network-specific blockchain explorers', sourceTypes: ['blockchain-explorer'], domains: ['finance', 'technology'], status: 'planned' },
  { id: 'protocol-source', name: 'Protocol documentation and verified source code', sourceTypes: ['protocol-documentation'], domains: ['finance', 'technology'], status: 'planned' },
  { id: 'security-audit', name: 'Independent smart-contract security audits', sourceTypes: ['independent-security-audits'], domains: ['finance', 'technology'], status: 'planned' },
  { id: 'indec-sectors', name: 'INDEC - estadísticas sectoriales, precios y comercio exterior', sourceTypes: ['official-sector-statistics', 'official-real-estate-data', 'official-trade-statistics'], domains: ['economics', 'finance'], status: 'planned' },
  { id: 'argentina-agriculture', name: 'Secretaría de Agricultura, Ganadería y Pesca', sourceTypes: ['official-agricultural-statistics', 'official-livestock-data', 'official-regional-economy-data'], domains: ['economics', 'finance'], status: 'planned' },
  { id: 'inta', name: 'Instituto Nacional de Tecnología Agropecuaria', sourceTypes: ['official-agricultural-statistics', 'official-regional-economy-data'], domains: ['economics', 'science'], status: 'planned' },
  { id: 'senasa', name: 'Servicio Nacional de Sanidad y Calidad Agroalimentaria', sourceTypes: ['official-livestock-data', 'official-regional-economy-data'], domains: ['economics', 'public-policy'], status: 'planned' },
  { id: 'sio-markets', name: 'SIO-Granos y SIO-Carnes', sourceTypes: ['commodity-market-data', 'official-livestock-data'], domains: ['economics', 'finance'], status: 'planned' },
  { id: 'regional-economies', name: 'INV, INYM y organismos de economías regionales', sourceTypes: ['official-regional-economy-data'], domains: ['economics', 'public-policy'], status: 'planned' },
  { id: 'argentina-customs', name: 'ARCA - Aduana', sourceTypes: ['customs-data', 'official-trade-statistics'], domains: ['economics', 'legal'], status: 'planned' },
  { id: 'international-trade', name: 'UN Comtrade e ITC Trade Map', sourceTypes: ['international-trade-data'], domains: ['economics', 'public-policy'], status: 'planned' },
  { id: 'real-estate-local', name: 'Catastros, municipios, registros y colegios profesionales provinciales', sourceTypes: ['official-real-estate-data'], domains: ['economics', 'legal'], status: 'planned' },
  { id: 'real-estate-comparables', name: 'Comparables inmobiliarios fechados y normalizados', sourceTypes: ['property-market-comparables'], domains: ['economics', 'finance'], status: 'planned' },
];

export function providersForSourceTypes(sourceTypes: string[]): ExternalVerificationProvider[] {
  const requested = new Set(sourceTypes);
  return EXTERNAL_VERIFICATION_SOURCE_CATALOG.filter((provider) =>
    provider.sourceTypes.some((sourceType) => requested.has(sourceType))
  );
}

export type ExternalVerificationSourceAvailability = {
  sourceType: string;
  status: 'implemented' | 'planned' | 'unregistered';
  providerIds: string[];
};

export function sourceAvailabilityForTypes(sourceTypes: string[]): ExternalVerificationSourceAvailability[] {
  return [...new Set(sourceTypes)].map((sourceType) => {
    const providers = EXTERNAL_VERIFICATION_SOURCE_CATALOG.filter((provider) =>
      provider.sourceTypes.includes(sourceType)
    );
    const implemented = providers.filter((provider) => provider.status === 'implemented');
    return {
      sourceType,
      status: implemented.length > 0 ? 'implemented' : providers.length > 0 ? 'planned' : 'unregistered',
      providerIds: providers.map((provider) => provider.id),
    };
  });
}
