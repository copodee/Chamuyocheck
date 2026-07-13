export type FinancialUrlContext = {
  isFinancial: boolean;
  institution: string | null;
  matchedSignals: string[];
  contextText: string;
};

// Routing registry only. The BCRA registry remains the authoritative source
// for determining whether an entity is currently authorized.
const ARGENTINA_BANKS: Array<{ hosts: string[]; name: string }> = [
  { hosts: ['bancoprovincia.com.ar'], name: 'Banco Provincia' },
  { hosts: ['bice.com.ar'], name: 'BICE' },
  { hosts: ['santander.com.ar'], name: 'Santander Argentina' },
  { hosts: ['icbc.com.ar'], name: 'ICBC Argentina' },
  { hosts: ['bancopatagonia.com.ar'], name: 'Banco Patagonia' },
  { hosts: ['supervielle.com.ar'], name: 'Banco Supervielle' },
  { hosts: ['macro.com.ar'], name: 'Banco Macro' },
  { hosts: ['galicia.ar', 'bancogalicia.com'], name: 'Banco Galicia' },
  { hosts: ['bna.com.ar'], name: 'Banco Nación' },
  { hosts: ['bancosantafe.com.ar'], name: 'Banco Santa Fe' },
  { hosts: ['bancochubut.com.ar'], name: 'Banco del Chubut' },
  { hosts: ['bancosantacruz.com'], name: 'Banco Santa Cruz' },
  { hosts: ['bancotdf.com.ar'], name: 'Banco de Tierra del Fuego' },
  { hosts: ['bind.com.ar'], name: 'BIND Banco Industrial' },
  { hosts: ['bbva.com.ar'], name: 'BBVA Argentina' },
  { hosts: ['bancociudad.com.ar'], name: 'Banco Ciudad' },
  { hosts: ['bancor.com.ar'], name: 'Bancor' },
  { hosts: ['bancocredicoop.coop'], name: 'Banco Credicoop' },
  { hosts: ['bancocorrientes.com.ar'], name: 'Banco de Corrientes' },
  { hosts: ['bancodelapampa.com.ar'], name: 'Banco de La Pampa' },
  { hosts: ['bpn.com.ar'], name: 'Banco Provincia del Neuquén' },
  { hosts: ['nbch.com.ar'], name: 'Nuevo Banco del Chaco' },
  { hosts: ['bancorioja.com.ar'], name: 'Banco Rioja' },
  { hosts: ['bancofor.com.ar', 'bancoformosa.com.ar'], name: 'Banco Formosa' },
  { hosts: ['bancobica.com.ar'], name: 'Banco Bica' },
  { hosts: ['hipotecario.com.ar'], name: 'Banco Hipotecario' },
  { hosts: ['comafi.com.ar'], name: 'Banco Comafi' },
  { hosts: ['brubank.com'], name: 'Brubank' },
  { hosts: ['bancodelsol.com'], name: 'Banco del Sol' },
  { hosts: ['openbank.com.ar'], name: 'Openbank Argentina' },
  { hosts: ['reba.com.ar'], name: 'Reba' },
  { hosts: ['bancocmf.com.ar'], name: 'Banco CMF' },
  { hosts: ['bancojulio.com.ar'], name: 'Banco Julio' },
  { hosts: ['voii.com.ar'], name: 'Banco Voii' },
  { hosts: ['bancopiano.com.ar'], name: 'Banco Piano' },
  { hosts: ['bancomeridian.com.ar'], name: 'Banco Meridian' },
  { hosts: ['bst.com.ar'], name: 'Banco de Servicios y Transacciones' },
  { hosts: ['bancosaenz.com.ar'], name: 'Banco Sáenz' },
  { hosts: ['bancocoinag.com.ar'], name: 'Banco Coinag' },
  { hosts: ['bancodelcomercio.com.ar'], name: 'Banco del Comercio' },
];

const FINANCIAL_PATH_SOURCE = '(?:credito|creditos|cr[eé]dito|cr[eé]ditos|prestamo|prestamos|pr[eé]stamo|pr[eé]stamos|financiacion|financiaci[oó]n|leasing|microcredito|microcr[eé]dito|hipotecario|prendario|cuota|cuotas|tasa|tasas|cft|tea|tna)';

function normalizedHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function institutionForHost(host: string): string | null {
  return ARGENTINA_BANKS.find((bank) => bank.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`)))?.name || null;
}

/** Uses URL identity for routing only; it never claims the page was read. */
export function describeFinancialUrl(rawUrl: string): FinancialUrlContext {
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    const host = normalizedHost(url.hostname);
    const decodedPath = decodeURIComponent(`${url.pathname} ${url.search}`).replace(/[-_+/=]/g, ' ');
    const institution = institutionForHost(host);
    const pathMatches = decodedPath.match(new RegExp(FINANCIAL_PATH_SOURCE, 'ig')) || [];
    const genericBankHost = /(?:^|\.)(?:banco|bank)[a-z0-9-]*\.(?:com\.ar|com|coop|gob\.ar)$/i.test(host);
    const isFinancial = Boolean(institution || genericBankHost || pathMatches.length);
    const matchedSignals = [institution ? `dominio identificado: ${institution}` : '', ...pathMatches.map((value) => `ruta financiera: ${value}`)].filter(Boolean).slice(0, 6);
    return {
      isFinancial,
      institution,
      matchedSignals,
      contextText: isFinancial
        ? `Contexto inferido exclusivamente de la URL: contenido financiero${institution ? ` de ${institution}` : ''}; productos posibles: préstamos, créditos, leasing o microcréditos. Esta inferencia permite clasificar la consulta, pero no demuestra que la página haya sido leída ni valida sus condiciones.`
        : '',
    };
  } catch {
    return { isFinancial: false, institution: null, matchedSignals: [], contextText: '' };
  }
}

export const argentinaBankHosts = ARGENTINA_BANKS.flatMap((bank) => bank.hosts);
