import type {
  StructuredPdfDocument,
  StructuredPdfPage,
  StructuredPdfRow,
  StructuredPdfToken,
} from './browserPdfStructure';

export type AccountingColumnType = 'label' | 'current_period' | 'previous_period' | 'unknown';
export type AccountingColumnDetectionStatus = 'detected' | 'partial' | 'uncertain';

export type DetectedAccountingColumn = {
  type: AccountingColumnType;
  xStart: number;
  xEnd: number;
  headerText: string | null;
  period: string | null;
  confidence: number;
};

export type AccountingPageStructure = {
  pageNumber: number;
  detectedColumns: DetectedAccountingColumn[];
  detectionStatus: AccountingColumnDetectionStatus;
};

export type AccountingDocumentStructure = {
  pages: AccountingPageStructure[];
};

export type AccountingRowCell = {
  columnType: AccountingColumnType;
  period: string | null;
  text: string;
  tokens: StructuredPdfToken[];
};

export type AccountingRowAssignment = {
  row: StructuredPdfRow;
  cells: AccountingRowCell[];
};

type NumericCluster = {
  tokens: StructuredPdfToken[];
  rowIndexes: Set<number>;
  rightEdge: number;
};

type HeaderEvidence = {
  text: string;
  period: string | null;
  timestamp: number | null;
  explicitType: 'current_period' | 'previous_period' | null;
  confidence: number;
};

const COLUMN_TOLERANCE = 0.025;
const HEADER_X_MARGIN = 0.08;

const clampConfidence = (value: number): number =>
  Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;

function isNumericAmountToken(text: string): boolean {
  const compact = text.trim().replace(/\u00a0/g, ' ');
  return /^\(?[-+]?\s*(?:[$â‚¬Â£]\s*)?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[,.]\d{1,2})?\s*\)?$/.test(compact);
}

function hasLetters(text: string): boolean {
  return /\p{L}/u.test(text);
}

function normalizeHeaderText(text: string): string {
  return text.replace(/[ \t]+/g, ' ').trim();
}

function extractPeriod(text: string): { period: string; timestamp: number } | null {
  const numericDate = text.match(/\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-]((?:19|20)\d{2})\b/);
  if (numericDate) {
    const [, day, month, year] = numericDate;
    return {
      period: numericDate[0],
      timestamp: Date.UTC(Number(year), Number(month) - 1, Number(day)),
    };
  }

  const monthNames: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
    noviembre: 10, diciembre: 11,
  };
  const namedDate = text.toLocaleLowerCase('es').match(
    /\b(0?[1-9]|[12]\d|3[01])\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de)?\s+((?:19|20)\d{2})\b/,
  );
  if (namedDate) {
    const [, day, month, year] = namedDate;
    return {
      period: normalizeHeaderText(namedDate[0]),
      timestamp: Date.UTC(Number(year), monthNames[month], Number(day)),
    };
  }

  const year = text.match(/\b((?:19|20)\d{2})\b/);
  return year
    ? { period: year[1], timestamp: Date.UTC(Number(year[1]), 11, 31) }
    : null;
}

function explicitPeriodType(text: string): HeaderEvidence['explicitType'] {
  const normalized = text.toLocaleLowerCase('es');
  if (/\b(actual|corriente|presente)\b/u.test(normalized)) return 'current_period';
  if (/\b(anterior|comparativo|precedente)\b/u.test(normalized)) return 'previous_period';
  return null;
}

function clusterNumericTokens(page: StructuredPdfPage): NumericCluster[] {
  const clusters: NumericCluster[] = [];
  page.rows.forEach((row, rowIndex) => {
    row.tokens.filter((token) => isNumericAmountToken(token.text) && token.x >= 0.25)
      .forEach((token) => {
        const rightEdge = token.x + token.width;
        let cluster = clusters.find((candidate) => Math.abs(candidate.rightEdge - rightEdge) <= COLUMN_TOLERANCE);
        if (!cluster) {
          cluster = { tokens: [], rowIndexes: new Set<number>(), rightEdge };
          clusters.push(cluster);
        }
        cluster.tokens.push(token);
        cluster.rowIndexes.add(rowIndex);
        cluster.rightEdge = cluster.tokens.reduce((sum, item) => sum + item.x + item.width, 0) / cluster.tokens.length;
      });
  });
  return clusters
    .filter((cluster) => cluster.rowIndexes.size >= 3)
    .sort((left, right) => left.rightEdge - right.rightEdge);
}

function findHeaderEvidence(
  page: StructuredPdfPage,
  cluster: NumericCluster,
): HeaderEvidence | null {
  const firstDataY = Math.min(...cluster.tokens.map((token) => token.y));
  const xStart = Math.min(...cluster.tokens.map((token) => token.x));
  const xEnd = Math.max(...cluster.tokens.map((token) => token.x + token.width));
  let best: HeaderEvidence | null = null;

  for (const row of page.rows) {
    if (row.y > firstDataY + 0.001) continue;
    if (
      Math.abs(row.y - firstDataY) <= 0.001
      && row.tokens.some((token) => hasLetters(token.text) && token.x < xStart)
    ) continue;
    const localTokens = row.tokens.filter((token) => {
      const center = token.x + token.width / 2;
      return center >= xStart - HEADER_X_MARGIN && center <= xEnd + HEADER_X_MARGIN;
    });
    if (!localTokens.length) continue;
    const segments: StructuredPdfToken[][] = [];
    [...localTokens].sort((left, right) => left.x - right.x).forEach((token) => {
      const segment = segments[segments.length - 1];
      const previous = segment?.[segment.length - 1];
      if (!previous || token.x - (previous.x + previous.width) > 0.045) segments.push([token]);
      else segment.push(token);
    });
    const candidates = segments.map((tokens) => {
      const text = normalizeHeaderText(tokens.map((token) => token.text).join(' '));
      const period = extractPeriod(text);
      const type = explicitPeriodType(text);
      const right = Math.max(...tokens.map((token) => token.x + token.width));
      return { text, period, type, distance: Math.abs(right - cluster.rightEdge) };
    }).filter((candidate) => candidate.period || candidate.type)
      .sort((left, right) => left.distance - right.distance);
    const candidate = candidates[0];
    if (!candidate) continue;
    const { text, period, type } = candidate;
    const proximity = Math.max(0, 1 - (firstDataY - row.y));
    const confidence = clampConfidence((period ? 0.72 : 0.58) + (type ? 0.12 : 0) + proximity * 0.1);
    const evidence: HeaderEvidence = {
      text,
      period: period?.period ?? null,
      timestamp: period?.timestamp ?? null,
      explicitType: type,
      confidence,
    };
    if (!best || evidence.confidence > best.confidence) best = evidence;
  }
  return best;
}

function isNotesPage(page: StructuredPdfPage): boolean {
  const topText = page.rows
    .filter((row) => row.y <= 0.25)
    .map((row) => row.text)
    .join(' ')
    .toLocaleLowerCase('es');
  const notesHeading = /\bnotas?\s+(?:a|de|sobre)\s+los?\s+estados?\b/u.test(topText)
    || /\bnotas?\s+contables\b/u.test(topText);
  const mainStatementHeading = /\b(balance\s+general|estado\s+de\s+situaci[oÃ³]n|estado\s+de\s+resultados|estado\s+de\s+evoluci[oÃ³]n)\b/u.test(topText);
  return notesHeading && !mainStatementHeading;
}

function buildLabelColumn(
  page: StructuredPdfPage,
  numericColumns: DetectedAccountingColumn[],
): DetectedAccountingColumn | null {
  if (!numericColumns.length) return null;
  const firstNumericX = Math.min(...numericColumns.map((column) => column.xStart));
  const labelTokens = page.rows.flatMap((row) => {
    const hasNumericCell = row.tokens.some((token) =>
      isNumericAmountToken(token.text) && token.x >= firstNumericX - COLUMN_TOLERANCE);
    return hasNumericCell
      ? row.tokens.filter((token) => hasLetters(token.text) && token.x < firstNumericX)
      : [];
  });
  if (labelTokens.length < 3) return null;
  return {
    type: 'label',
    xStart: Math.min(...labelTokens.map((token) => token.x)),
    xEnd: Math.max(...labelTokens.map((token) => token.x + token.width)),
    headerText: null,
    period: null,
    confidence: clampConfidence(0.55 + Math.min(0.35, labelTokens.length * 0.04)),
  };
}

export function detectAccountingColumns(
  document: StructuredPdfDocument,
): AccountingDocumentStructure {
  return {
    pages: document.pages.map((page) => {
      if (isNotesPage(page)) {
        return { pageNumber: page.page, detectedColumns: [], detectionStatus: 'uncertain' };
      }

      const clusters = clusterNumericTokens(page);
      if (!clusters.length) {
        return { pageNumber: page.page, detectedColumns: [], detectionStatus: 'uncertain' };
      }

      const evidences = clusters.map((cluster) => findHeaderEvidence(page, cluster));
      const datedIndexes = evidences
        .map((evidence, index) => ({ evidence, index }))
        .filter((item): item is { evidence: HeaderEvidence & { timestamp: number }; index: number } =>
          item.evidence?.timestamp != null)
        .sort((left, right) => right.evidence.timestamp - left.evidence.timestamp);
      const chronologicalTypes = new Map<number, AccountingColumnType>();
      const timestamps = [...new Set(datedIndexes.map((item) => item.evidence.timestamp))];
      if (timestamps.length >= 2) {
        const current = datedIndexes.filter((item) => item.evidence.timestamp === timestamps[0]);
        const previous = datedIndexes.filter((item) => item.evidence.timestamp === timestamps[1]);
        if (current.length === 1 && previous.length === 1) {
          chronologicalTypes.set(current[0].index, 'current_period');
          chronologicalTypes.set(previous[0].index, 'previous_period');
        }
      }

      const numericColumns: DetectedAccountingColumn[] = clusters.map((cluster, index) => {
        const evidence = evidences[index];
        const repeatedRows = cluster.rowIndexes.size;
        const alignmentConfidence = clampConfidence(0.5 + Math.min(0.35, repeatedRows * 0.05));
        return {
          type: evidence?.explicitType ?? chronologicalTypes.get(index) ?? 'unknown',
          xStart: Math.min(...cluster.tokens.map((token) => token.x)),
          xEnd: Math.max(...cluster.tokens.map((token) => token.x + token.width)),
          headerText: evidence?.text ?? null,
          period: evidence?.period ?? null,
          confidence: clampConfidence((alignmentConfidence + (evidence?.confidence ?? 0.45)) / 2),
        };
      });
      const labelColumn = buildLabelColumn(page, numericColumns);
      const detectedColumns = labelColumn ? [labelColumn, ...numericColumns] : numericColumns;
      const hasCurrent = numericColumns.some((column) => column.type === 'current_period');
      const hasPrevious = numericColumns.some((column) => column.type === 'previous_period');
      const detectionStatus: AccountingColumnDetectionStatus =
        labelColumn && hasCurrent && hasPrevious ? 'detected' : labelColumn ? 'partial' : 'uncertain';
      return { pageNumber: page.page, detectedColumns, detectionStatus };
    }),
  };
}

export function associateRowsWithAccountingColumns(
  page: StructuredPdfPage,
  columns: DetectedAccountingColumn[],
): AccountingRowAssignment[] {
  return page.rows.map((row) => ({
    row,
    cells: columns.map((column) => {
      const tokens = row.tokens.filter((token) => {
        const center = token.x + token.width / 2;
        return center >= column.xStart - COLUMN_TOLERANCE && center <= column.xEnd + COLUMN_TOLERANCE;
      });
      return {
        columnType: column.type,
        period: column.period,
        text: normalizeHeaderText(tokens.map((token) => token.text).join(' ')),
        tokens,
      };
    }).filter((cell) => cell.tokens.length > 0),
  }));
}

