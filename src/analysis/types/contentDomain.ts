export type ContentDomain =
  | 'academico'
  | 'financiero'
  | 'contrato'
  | 'salud'
  | 'noticia'
  | 'politica'
  | 'ciencia'
  | 'redes'
  | 'inversion'
  | 'publicidad'
  | 'general';

export type DomainDetection = {
  domain: ContentDomain;
  label: string;
  confidence: number;
  reasons: string[];
  recommendedModules: string[];
};
