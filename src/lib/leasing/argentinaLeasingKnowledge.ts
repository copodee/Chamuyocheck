export type LeasingKnowledgeItem = {
  id: string;
  topic: 'contract' | 'tax' | 'registry' | 'public-sector' | 'market-practice' | 'foreign-exchange';
  statement: string;
  source: string;
  sourceUrl: string;
  effectiveFrom?: string;
  verifiedAt: string;
  requiresCurrentVerification?: boolean;
};

// Versioned facts used by the deterministic answer engine. Volatile rules must
// be rechecked against the current consolidated text before a concrete decision.
export const ARGENTINA_LEASING_KNOWLEDGE: LeasingKnowledgeItem[] = [
  {
    id: 'ccyc-contract', topic: 'contract',
    statement: 'El leasing transfiere la tenencia para uso y goce contra un canon y concede una opción de compra; el régimen contractual está en los artículos 1227 y siguientes del Código Civil y Comercial.',
    source: 'Código Civil y Comercial de la Nación',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion',
    effectiveFrom: '2015-08-01', verifiedAt: '2026-07-18',
  },
  {
    id: 'decree-152-2022', topic: 'tax',
    statement: 'Para los dadores alcanzados, el artículo 2 del Decreto 1038/2000, sustituido por el Decreto 152/2022, exige una duración al menos igual al 50% de la vida útil para bienes muebles o al 10% para inmuebles y un precio de opción cierto y determinado para asimilar el contrato a una operación financiera en Ganancias.',
    source: 'Decreto 152/2022',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/decreto-152-2022-362789/texto',
    effectiveFrom: '2022-03-29', verifiedAt: '2026-07-18',
  },
  {
    id: 'registration', topic: 'registry',
    statement: 'La oponibilidad exige inscripción en el registro correspondiente al bien; inmuebles, buques y aeronaves requieren escritura pública.',
    source: 'Ley 25.248, artículo 8',
    sourceUrl: 'https://www.argentina.gob.ar/normativa/nacional/ley-25248-63283/texto',
    verifiedAt: '2026-07-18',
  },
  {
    id: 'public-sector-bcra', topic: 'public-sector',
    statement: 'El leasing otorgado por una entidad financiera a un ente público integra el financiamiento al sector público no financiero y debe analizarse bajo las autorizaciones, límites de exposición y capacidad de repago del texto ordenado vigente del BCRA.',
    source: 'BCRA, Financiamiento al sector público no financiero',
    sourceUrl: 'https://www.bcra.gob.ar/pdfs/texord/texord_viejos/v-finsec_25-12-18.pdf',
    verifiedAt: '2026-07-18', requiresCurrentVerification: true,
  },
  {
    id: 'revenue-sharing-guarantee', topic: 'public-sector',
    statement: 'La cesión de coparticipación federal es una garantía posible para determinadas financiaciones provinciales o municipales, no un requisito universal de todo leasing público; deben revisarse la autorización local, el presupuesto, el endeudamiento, la garantía ofrecida y la aprobación regulatoria concreta.',
    source: 'BCRA, Financiamiento al sector público no financiero',
    sourceUrl: 'https://www.bcra.gob.ar/pdfs/texord/texord_viejos/v-finsec_25-12-18.pdf',
    verifiedAt: '2026-07-18', requiresCurrentVerification: true,
  },
  {
    id: 'market-capita', topic: 'market-practice',
    statement: 'The Capita Corporation es la marca especializada de TCC Leasing S.A., dador de leasing vinculado a Banco Comafi. Ofrece soluciones para vehículos, tecnología, agro, importaciones, aeronaves y estructuras a medida; son productos comerciales y no categorías legales autónomas.',
    source: 'The Capita Corporation / TCC Leasing S.A. / Banco Comafi',
    sourceUrl: 'https://thecapita.com.ar/',
    verifiedAt: '2026-07-18', requiresCurrentVerification: true,
  },
  {
    id: 'market-ala', topic: 'market-practice',
    statement: 'La Asociación de Leasing de Argentina (ALA) reúne a dadores y publica información sectorial sobre objetos, modalidades y contratación. Sus explicaciones sirven como referencia de práctica del mercado; los beneficios tributarios o financieros que difunde deben validarse para el contrato y contribuyente concretos.',
    source: 'Asociación de Leasing de Argentina (ALA)',
    sourceUrl: 'https://www.leasingargentina.com.ar/',
    verifiedAt: '2026-07-18', requiresCurrentVerification: true,
  },
  {
    id: 'mulc', topic: 'foreign-exchange',
    statement: 'En leasing internacional o importación deben identificarse por separado el importador, el propietario, el deudor del pago exterior, el concepto cambiario, la documentación aduanera y el cronograma de cánones y opción; el acceso al mercado de cambios no debe inferirse sólo del contrato.',
    source: 'BCRA, Exterior y Cambios (texto ordenado vigente)',
    sourceUrl: 'https://www.bcra.gob.ar/MarcoLegalNormativa/TextosOrdenados.asp',
    verifiedAt: '2026-07-18', requiresCurrentVerification: true,
  },
];

export function leasingKnowledge(topic: LeasingKnowledgeItem['topic']) {
  return ARGENTINA_LEASING_KNOWLEDGE.filter((item) => item.topic === topic);
}
