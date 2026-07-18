export type LeasingJurisdictionProfile = {
  id: 'argentina' | 'united-states' | 'european-union' | 'united-kingdom';
  label: string;
  contractLaw: string;
  accounting: string;
  tax: string;
  practicalDifference: string;
  sources: Array<{ label: string; url: string; verifiedAt: string }>;
};

export const LEASING_JURISDICTION_PROFILES: LeasingJurisdictionProfile[] = [
  {
    id: 'argentina', label: 'Argentina',
    contractLaw: 'Contrato nominado en los artículos 1227 y siguientes del Código Civil y Comercial, con canon y opción de compra; la oponibilidad depende del registro correspondiente al bien.',
    accounting: 'La contabilización debe determinarse según las normas aplicables al ente; no se deduce automáticamente del nombre comercial del producto.',
    tax: 'El Decreto 1038/2000, actualizado por el Decreto 152/2022, contiene reglas específicas para Ganancias y distingue contratos asimilados a operaciones financieras.',
    practicalDifference: 'La opción de compra es parte estructural de la figura legal argentina y conviven reglas contractuales, tributarias, registrales, bancarias y cambiarias.',
    sources: [
      { label: 'Código Civil y Comercial actualizado', url: 'https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion', verifiedAt: '2026-07-18' },
      { label: 'Decreto 152/2022', url: 'https://www.argentina.gob.ar/normativa/nacional/decreto-152-2022-362789/texto', verifiedAt: '2026-07-18' },
    ],
  },
  {
    id: 'united-states', label: 'Estados Unidos',
    contractLaw: 'Los leases de bienes se regulan principalmente por la versión de UCC Article 2A adoptada en cada estado. Debe distinguirse un true lease de una operación que en sustancia crea un security interest.',
    accounting: 'US GAAP utiliza ASC Topic 842 y mantiene categorías y presentación propias; no debe equipararse automáticamente con IFRS 16.',
    tax: 'La calificación fiscal federal atiende a los beneficios y cargas de la propiedad económica. Un contrato llamado lease puede ser recalificado como venta o financiación.',
    practicalDifference: 'Son frecuentes los equipment leases, operating leases, finance leases y estructuras de sale-leaseback; contrato estatal, contabilidad y fiscalidad federal pueden dar calificaciones diferentes.',
    sources: [
      { label: 'UCC Article 2A', url: 'https://www.law.cornell.edu/ucc/2A', verifiedAt: '2026-07-18' },
      { label: 'FASB Topic 842', url: 'https://fasb.org/standards/accounting-standard-updates', verifiedAt: '2026-07-18' },
      { label: 'IRS, benefits and burdens of ownership', url: 'https://www.irs.gov/pub/irs-pdf/p5712.pdf', verifiedAt: '2026-07-18' },
    ],
  },
  {
    id: 'european-union', label: 'Unión Europea',
    contractLaw: 'No existe un contrato civil único de leasing para toda la Unión: forma, propiedad, garantías, insolvencia, registro y remedios dependen del derecho del Estado miembro.',
    accounting: 'Para entidades alcanzadas, IFRS 16 fue incorporada al marco europeo y lleva, con excepciones, los leases del arrendatario al balance mediante activo por derecho de uso y pasivo.',
    tax: 'IVA, deducciones, depreciación y titularidad fiscal no están uniformados por IFRS 16 y deben analizarse país por país.',
    practicalDifference: 'Una comparación “Argentina vs. Europa” sólo puede ser preliminar; debe elegirse al menos el Estado miembro, el activo, las partes y el estándar contable aplicable.',
    sources: [
      { label: 'Reglamento UE 2017/1986 - IFRS 16', url: 'https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32017R1986', verifiedAt: '2026-07-18' },
      { label: 'Reglamento UE 2023/2579 - sale and leaseback', url: 'https://eur-lex.europa.eu/eli/reg/2023/2579/oj/eng/pdf', verifiedAt: '2026-07-18' },
    ],
  },
  {
    id: 'united-kingdom', label: 'Reino Unido',
    contractLaw: 'El contrato y la asignación de riesgos se analizan bajo el derecho británico aplicable y sus términos; el tratamiento fiscal no sigue necesariamente la clasificación contable.',
    accounting: 'Puede corresponder IFRS 16 o FRS 102 según la entidad y el marco de reporte.',
    tax: 'HMRC distingue, entre otros, finance leases, operating leases y long funding leases. Fuera de estos últimos, normalmente el lessor conserva las capital allowances y el lessee deduce rentals según las reglas aplicables.',
    practicalDifference: 'Es un buen ejemplo de por qué “contablemente financiero” no significa que fiscalmente se trate igual que un préstamo.',
    sources: [
      { label: 'HMRC Business Leasing Manual', url: 'https://www.gov.uk/hmrc-internal-manuals/business-leasing-manual/blm00305', verifiedAt: '2026-07-18' },
      { label: 'HMRC finance leases', url: 'https://www.gov.uk/hmrc-internal-manuals/business-leasing-manual/blm00525', verifiedAt: '2026-07-18' },
    ],
  },
];

export function buildInternationalLeasingFindings(question: string): string[] {
  const wantsUs = /estados unidos|ee\.?\s*uu\.?|usa|united states|norteam[eé]rica/i.test(question);
  const wantsUk = /reino unido|inglaterra|uk|brit[aá]nic/i.test(question);
  const wantsEurope = /europa|uni[oó]n europea|ue\b|europe/i.test(question);
  const selected = LEASING_JURISDICTION_PROFILES.filter((profile) =>
    profile.id === 'argentina'
    || (profile.id === 'united-states' && wantsUs)
    || (profile.id === 'united-kingdom' && wantsUk)
    || (profile.id === 'european-union' && wantsEurope)
  );
  if (selected.length === 1) return [];
  return selected.flatMap((profile) => [
    `${profile.label} — contrato: ${profile.contractLaw}`,
    `${profile.label} — contabilidad: ${profile.accounting}`,
    `${profile.label} — impuestos y diferencia práctica: ${profile.tax} ${profile.practicalDifference}`,
  ]);
}
