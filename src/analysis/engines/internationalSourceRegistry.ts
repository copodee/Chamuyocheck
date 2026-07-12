export type InternationalSourceProvider = {
  id: string;
  domains: Array<'science' | 'biology-health' | 'economics'>;
  scope: 'global' | 'country-specific';
  sourceType: string;
  official: boolean;
};

const PROVIDERS: InternationalSourceProvider[] = [
  { id: 'who-gho', domains: ['biology-health'], scope: 'global', sourceType: 'health-authorities', official: true },
  { id: 'pubmed', domains: ['science', 'biology-health'], scope: 'global', sourceType: 'scientific-journals', official: false },
  { id: 'world-bank', domains: ['economics'], scope: 'global', sourceType: 'official-statistics', official: true },
];

export function internationalProvidersFor(domain: InternationalSourceProvider['domains'][number]) {
  return PROVIDERS.filter((provider) => provider.domains.includes(domain));
}
