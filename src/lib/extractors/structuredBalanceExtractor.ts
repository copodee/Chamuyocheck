import {
  associateRowsWithAccountingColumns,
  type AccountingColumnType,
  type AccountingDocumentStructure,
  type DetectedAccountingColumn,
} from './accountingPdfStructure';
import type { StructuredPdfDocument, StructuredPdfRow, StructuredPdfToken } from './browserPdfStructure';
import type {
  OrientationNormalizedPdfDocument,
  OrientationNormalizedPdfPage,
} from './pdfOrientationNormalization';

export type BalanceFieldName =
  | 'currentAssets'
  | 'totalAssets'
  | 'currentLiabilities'
  | 'totalLiabilities'
  | 'equity'
  | 'sales'
  | 'operatingResult'
  | 'netResult'
  | 'cash'
  | 'tradeReceivables'
  | 'inventories'
  | 'financialDebt'
  | 'closingDate'
  | 'fiscalYearDuration'
  | 'currency'
  | 'statementUnit';

export type BalanceFieldStatus = 'validated' | 'needs_review' | 'missing';
export type BalanceUnit = 'ars' | 'thousands_ars' | 'millions_ars' | 'unknown';

export type StructuredBalanceField = {
  value: number | null;
  rawValue: string | null;
  status: BalanceFieldStatus;
  page: number | null;
  rowIndex: number | null;
  columnType: 'current_period' | 'previous_period' | 'unknown' | null;
  period: string | null;
  section: string | null;
  source: 'pdfjs' | 'ocr' | null;
  confidence: number | null;
  labelText: string | null;
  unit: BalanceUnit;
  extractionMethod: 'structured' | 'text_fallback' | null;
};

export type StructuredBalanceExtraction = {
  fields: Record<BalanceFieldName, StructuredBalanceField>;
  pageQuality?: Array<{
    page: number;
    orientationStatus: 'original' | 'corrected' | 'uncertain';
    orientationConfidence: number;
  }>;
};

export type LegacyBalanceData = Partial<Record<BalanceFieldName, number | string>>;

type Section =
  | 'statement_of_financial_position'
  | 'assets'
  | 'liabilities'
  | 'equity'
  | 'income_statement'
  | 'notes'
  | 'annexes'
  | null;

type FieldRule = {
  field: BalanceFieldName;
  patterns: RegExp[];
  sections: Section[];
};

type Candidate = {
  field: BalanceFieldName;
  value: number;
  rawValue: string;
  page: OrientationNormalizedPdfPage;
  rowIndex: number;
  column: DetectedAccountingColumn;
  section: Section;
  source: 'pdfjs' | 'ocr';
  confidence: number;
  labelText: string;
  unit: BalanceUnit;
  sameRow: boolean;
};

const VALIDATED_CONFIDENCE = 0.7;

const FIELD_RULES: FieldRule[] = [
  { field: 'currentAssets', patterns: [/^(?:total\s+)?activo\s+corriente$/u], sections: ['assets', 'statement_of_financial_position'] },
  { field: 'totalAssets', patterns: [/^(?:total\s+(?:del?\s+)?)?activo(?:\s+total)?$/u, /^total\s+activos$/u], sections: ['assets', 'statement_of_financial_position'] },
  { field: 'currentLiabilities', patterns: [/^(?:total\s+)?pasivo\s+corriente$/u], sections: ['liabilities', 'statement_of_financial_position'] },
  { field: 'totalLiabilities', patterns: [/^(?:total\s+(?:del?\s+)?)?pasivo(?:\s+total)?$/u, /^total\s+pasivos$/u], sections: ['liabilities', 'statement_of_financial_position'] },
  { field: 'equity', patterns: [/^(?:total\s+)?patrimonio\s+neto$/u], sections: ['equity', 'statement_of_financial_position'] },
  { field: 'sales', patterns: [/^(?:ventas|ingresos\s+por\s+ventas|ingresos\s+ordinarios|ventas\s+netas)$/u], sections: ['income_statement'] },
  { field: 'operatingResult', patterns: [/^resultado\s+(?:operativo|de\s+explotacion)$/u], sections: ['income_statement'] },
  { field: 'netResult', patterns: [/^(?:resultado\s+neto|resultado\s+del\s+ejercicio|ganancia\s+\(?perdida\)?\s+neta)$/u], sections: ['income_statement'] },
  { field: 'cash', patterns: [/^(?:caja\s+y\s+bancos|disponibilidades|efectivo\s+y\s+equivalentes)$/u], sections: ['assets', 'statement_of_financial_position'] },
  { field: 'tradeReceivables', patterns: [/^(?:creditos\s+por\s+ventas|cuentas\s+por\s+cobrar\s+comerciales|deudores\s+por\s+ventas)$/u], sections: ['assets', 'statement_of_financial_position'] },
  { field: 'inventories', patterns: [/^(?:inventarios|bienes\s+de\s+cambio|existencias)$/u], sections: ['assets', 'statement_of_financial_position'] },
  { field: 'financialDebt', patterns: [/^(?:deuda(?:s)?\s+financiera(?:s)?|prestamos\s+financieros|obligaciones\s+financieras)$/u], sections: ['liabilities', 'statement_of_financial_position'] },
];

const FIELD_NAMES = FIELD_RULES.map((rule) => rule.field);

function emptyField(): StructuredBalanceField {
  return {
    value: null, rawValue: null, status: 'missing', page: null, rowIndex: null,
    columnType: null, period: null, section: null, source: null, confidence: null,
    labelText: null, unit: 'unknown', extractionMethod: null,
  };
}

function emptyFields(): Record<BalanceFieldName, StructuredBalanceField> {
  return {
    currentAssets: emptyField(), totalAssets: emptyField(),
    currentLiabilities: emptyField(), totalLiabilities: emptyField(),
    equity: emptyField(), sales: emptyField(), operatingResult: emptyField(),
    netResult: emptyField(), cash: emptyField(), tradeReceivables: emptyField(),
    inventories: emptyField(), financialDebt: emptyField(), closingDate: emptyField(),
    fiscalYearDuration: emptyField(), currency: emptyField(), statementUnit: emptyField(),
  };
}

function normalizeLabel(text: string): string {
  return text.toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.:;]+$/u, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function parseAccountingAmount(rawValue: string): number | null {
  let value = rawValue.trim().replace(/\u00a0/g, ' ');
  const parenthesized = /^\(.*\)$/.test(value);
  value = value.replace(/[()$€£]/g, '').replace(/\s+/g, '');
  const explicitNegative = value.startsWith('-');
  value = value.replace(/^[+-]/, '');
  if (!/^\d[\d.,]*$/.test(value)) return null;
  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    value = value.split(thousands).join('').replace(decimal, '.');
  } else {
    const separator = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
    if (separator) {
      const groups = value.split(separator);
      const thousandsOnly = groups.length > 1 && groups.slice(1).every((group) => group.length === 3);
      value = thousandsOnly ? groups.join('') : `${groups.slice(0, -1).join('')}.${groups.at(-1)}`;
    }
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parenthesized || explicitNegative ? -Math.abs(parsed) : parsed;
}

function detectSection(text: string, current: Section): Section {
  const label = normalizeLabel(text);
  if (/^(?:notas?|notas?\s+a\s+los\s+estados\s+contables)$/u.test(label)) return 'notes';
  if (/^(?:anexos?|informacion\s+complementaria)$/u.test(label)) return 'annexes';
  if (/^(?:estado\s+de\s+resultados|estado\s+del?\s+resultado)/u.test(label)) return 'income_statement';
  if (/^(?:estado\s+de\s+situacion\s+patrimonial|balance\s+general)/u.test(label)) return 'statement_of_financial_position';
  if (/^activo(?:\s+no\s+corriente|\s+corriente)?$/u.test(label)) return 'assets';
  if (/^pasivo(?:\s+no\s+corriente|\s+corriente)?$/u.test(label)) return 'liabilities';
  if (/^patrimonio\s+neto$/u.test(label)) return 'equity';
  return current;
}

function detectUnit(rows: StructuredPdfRow[]): BalanceUnit {
  for (const row of rows) {
    const text = normalizeLabel(row.text);
    if (/\b(?:expresad[oa]s?\s+en\s+)?millones\s+de\s+pesos\b/u.test(text)) return 'millions_ars';
    if (/\b(?:expresad[oa]s?\s+en\s+)?miles\s+de\s+pesos\b/u.test(text)) return 'thousands_ars';
    if (/\b(?:expresad[oa]s?\s+en\s+)?pesos\b/u.test(text) || /\bars\b/u.test(text)) return 'ars';
  }
  return 'unknown';
}

function sourceFor(tokens: StructuredPdfToken[]): 'pdfjs' | 'ocr' {
  return tokens.some((token) => token.origin === 'ocr') ? 'ocr' : 'pdfjs';
}

function confidenceFor(tokens: StructuredPdfToken[], column: DetectedAccountingColumn, page: OrientationNormalizedPdfPage): number {
  const tokenConfidence = tokens.length
    ? tokens.reduce((sum, token) => sum + token.confidence / 100, 0) / tokens.length
    : 0;
  return Math.round(Math.min(tokenConfidence, column.confidence, page.orientationConfidence) * 100) / 100;
}

function matchField(label: string, section: Section): BalanceFieldName | null {
  const normalized = normalizeLabel(label);
  return FIELD_RULES.find((rule) =>
    rule.sections.includes(section) && rule.patterns.some((pattern) => pattern.test(normalized)))?.field ?? null;
}

function reconstructedLabel(
  rows: StructuredPdfRow[],
  rowIndex: number,
  currentLabel: string,
  currentColumn: DetectedAccountingColumn,
  section: Section,
): { text: string; sameRow: boolean } {
  if (matchField(currentLabel, section)) {
    return { text: currentLabel, sameRow: true };
  }
  const previous = rows[rowIndex - 1];
  const current = rows[rowIndex];
  if (!previous || !current) return { text: currentLabel, sameRow: true };
  const previousHasAmount = previous.tokens.some((token) => {
    const center = token.x + token.width / 2;
    return center >= currentColumn.xStart - 0.025 && center <= currentColumn.xEnd + 0.025;
  });
  const previousLabels = previous.tokens.filter((token) => /\p{L}/u.test(token.text));
  const currentLabels = current.tokens.filter((token) => /\p{L}/u.test(token.text));
  if (!previousLabels.length || !currentLabels.length || previousHasAmount) return { text: currentLabel, sameRow: true };
  const gap = current.y - (previous.y + previous.height);
  const aligned = Math.abs(previousLabels[0].x - currentLabels[0].x) <= 0.03;
  if (gap < -0.002 || gap > 0.03 || !aligned) return { text: currentLabel, sameRow: true };
  return {
    text: `${previousLabels.map((token) => token.text).join(' ')} ${currentLabel}`.trim(),
    sameRow: true,
  };
}

function currentOrReviewColumn(columns: DetectedAccountingColumn[]): DetectedAccountingColumn | null {
  const current = columns.filter((column) => column.type === 'current_period' && column.period && column.confidence >= 0.65);
  if (current.length === 1) return current[0];
  const numeric = columns.filter((column) => column.type !== 'label' && column.type !== 'previous_period');
  return numeric.length === 1 ? numeric[0] : null;
}

function candidateToField(candidate: Candidate): StructuredBalanceField {
  const validated = candidate.page.orientationStatus !== 'uncertain'
    && candidate.column.type === 'current_period'
    && candidate.column.period != null
    && candidate.sameRow
    && candidate.unit !== 'unknown'
    && candidate.confidence >= VALIDATED_CONFIDENCE
    && candidate.section !== 'notes'
    && candidate.section !== 'annexes';
  return {
    value: candidate.value,
    rawValue: candidate.rawValue,
    status: validated ? 'validated' : 'needs_review',
    page: candidate.page.page,
    rowIndex: candidate.rowIndex,
    columnType: candidate.column.type as Exclude<AccountingColumnType, 'label'>,
    period: candidate.column.period,
    section: candidate.section,
    source: candidate.source,
    confidence: candidate.confidence,
    labelText: candidate.labelText,
    unit: candidate.unit,
    extractionMethod: 'structured',
  };
}

function extractMetadata(
  fields: Record<BalanceFieldName, StructuredBalanceField>,
  page: OrientationNormalizedPdfPage,
  columns: DetectedAccountingColumn[],
  unit: BalanceUnit,
): void {
  const current = columns.find((column) =>
    column.type === 'current_period' && column.period && column.confidence >= 0.65);
  const metadataConfidence = current
    ? Math.round(Math.min(current.confidence, page.orientationConfidence) * 100) / 100
    : null;
  if (current?.period) {
    fields.closingDate = {
      ...emptyField(), rawValue: current.period,
      status: page.orientationStatus !== 'uncertain' && metadataConfidence! >= VALIDATED_CONFIDENCE
        ? 'validated' : 'needs_review',
      page: page.page, columnType: 'current_period', period: current.period,
      confidence: metadataConfidence, unit, extractionMethod: 'structured',
    };
  }
  const durationRowIndex = page.rows.findIndex((row) => /\b(?:duracion|ejercicio)\b/u.test(normalizeLabel(row.text))
    && /\b\d{1,2}\s+meses?\b/u.test(normalizeLabel(row.text)));
  if (durationRowIndex >= 0) {
    const match = page.rows[durationRowIndex].text.match(/\b(\d{1,2})\s+meses?\b/u);
    fields.fiscalYearDuration = {
      ...emptyField(), value: match ? Number(match[1]) : null, rawValue: match?.[0] ?? null,
      status: page.orientationStatus !== 'uncertain' ? 'needs_review' : 'needs_review',
      page: page.page, rowIndex: durationRowIndex, confidence: page.orientationConfidence,
      source: sourceFor(page.rows[durationRowIndex].tokens), unit, extractionMethod: 'structured',
    };
  }
  const currencyRowIndex = page.rows.findIndex((row) => /\b(?:pesos|ars)\b/u.test(normalizeLabel(row.text)));
  if (currencyRowIndex >= 0) {
    fields.currency = {
      ...emptyField(), rawValue: 'ARS', status: page.orientationStatus !== 'uncertain' ? 'validated' : 'needs_review',
      page: page.page, rowIndex: currencyRowIndex, confidence: page.orientationConfidence,
      source: sourceFor(page.rows[currencyRowIndex].tokens), unit, extractionMethod: 'structured',
    };
  }
  if (unit !== 'unknown') {
    fields.statementUnit = {
      ...emptyField(), rawValue: unit, status: page.orientationStatus !== 'uncertain' ? 'validated' : 'needs_review',
      page: page.page, confidence: page.orientationConfidence, unit, extractionMethod: 'structured',
    };
  }
}

export function extractStructuredBalanceData(
  document: StructuredPdfDocument,
  accountingStructure: AccountingDocumentStructure,
  orientationDocument: OrientationNormalizedPdfDocument,
  fallbackText?: string,
): StructuredBalanceExtraction {
  const fields = emptyFields();
  const candidates = new Map<BalanceFieldName, Candidate[]>();
  const availablePages = new Set(document.pages.map((page) => page.page));

  for (const page of orientationDocument.pages) {
    if (!availablePages.has(page.page)) continue;
    const pageStructure = accountingStructure.pages.find((candidate) => candidate.pageNumber === page.page);
    if (!pageStructure) continue;
    const unit = detectUnit(page.rows);
    extractMetadata(fields, page, pageStructure.detectedColumns, unit);
    const column = currentOrReviewColumn(pageStructure.detectedColumns);
    if (!column) continue;
    const assignments = associateRowsWithAccountingColumns(page, pageStructure.detectedColumns);
    let section: Section = null;
    for (let rowIndex = 0; rowIndex < assignments.length; rowIndex += 1) {
      const assignment = assignments[rowIndex];
      const labelCell = assignment.cells.find((cell) => cell.columnType === 'label');
      section = detectSection(labelCell?.text ?? assignment.row.text, section);
      if (section === 'notes' || section === 'annexes') continue;
      const amountCell = assignment.cells.find((cell) =>
        cell.columnType === column.type && cell.period === column.period);
      if (!labelCell || !amountCell) continue;
      const rawValue = amountCell.text;
      const value = parseAccountingAmount(rawValue);
      if (value == null) continue;
      const rebuilt = reconstructedLabel(page.rows, rowIndex, labelCell.text, column, section);
      const field = matchField(rebuilt.text, section);
      if (!field || !FIELD_NAMES.includes(field)) continue;
      const tokens = [...labelCell.tokens, ...amountCell.tokens];
      const candidate: Candidate = {
        field, value, rawValue, page, rowIndex, column, section,
        source: sourceFor(tokens), confidence: confidenceFor(tokens, column, page),
        labelText: rebuilt.text, unit, sameRow: rebuilt.sameRow,
      };
      const list = candidates.get(field) ?? [];
      list.push(candidate);
      candidates.set(field, list);
    }
  }

  for (const [field, matches] of candidates) {
    const main = matches.filter((candidate) => candidate.section !== 'notes' && candidate.section !== 'annexes')
      .sort((left, right) => right.confidence - left.confidence);
    if (main.length) fields[field] = candidateToField(main[0]);
  }

  if (fallbackText) {
    const fallback = extractBalanceData(fallbackText);
    for (const [field, raw] of Object.entries(fallback) as Array<[BalanceFieldName, number | string]>) {
      if (fields[field].status !== 'missing') continue;
      fields[field] = {
        ...emptyField(),
        value: typeof raw === 'number' ? raw : null,
        rawValue: String(raw),
        status: 'needs_review',
        labelText: field,
        extractionMethod: 'text_fallback',
      };
    }
  }
  return {
    fields,
    pageQuality: orientationDocument.pages.map((page) => ({
      page: page.page,
      orientationStatus: page.orientationStatus,
      orientationConfidence: page.orientationConfidence,
    })),
  };
}

export function extractBalanceData(text: string): LegacyBalanceData {
  const result: LegacyBalanceData = {};
  for (const line of text.split(/\r?\n/)) {
    const separator = line.match(/^(.+?)\s+(\(?[-+]?\s*[$€£]?\s*\d[\d.,\s]*\)?)\s*$/u);
    if (!separator) continue;
    const label = normalizeLabel(separator[1]);
    const value = parseAccountingAmount(separator[2]);
    if (value == null) continue;
    const field = FIELD_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(label)))?.field;
    if (field) result[field] = value;
  }
  return result;
}
