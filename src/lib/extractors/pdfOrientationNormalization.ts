import {
  groupPdfTokensIntoRows,
  type StructuredPdfDocument,
  type StructuredPdfPage,
  type StructuredPdfToken,
} from './browserPdfStructure';

export type PageRotation = 0 | 90 | 180 | 270;
export type OrientationStatus = 'original' | 'corrected' | 'uncertain';

export type OrientationNormalizedPdfPage = StructuredPdfPage & {
  detectedRotation: PageRotation;
  orientationConfidence: number;
  orientationStatus: OrientationStatus;
  deskewAngle: number;
  normalizedWidth: number;
  normalizedHeight: number;
};

export type OrientationNormalizedPdfDocument = {
  pages: OrientationNormalizedPdfPage[];
};

type OrientationCandidate = {
  rotation: PageRotation;
  tokens: StructuredPdfToken[];
  rows: ReturnType<typeof groupPdfTokensIntoRows>;
  score: number;
};

const ROTATIONS: PageRotation[] = [0, 90, 180, 270];
const MIN_ORIENTATION_SCORE = 0.4;
const MIN_SCORE_MARGIN = 0.06;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function rotateNormalizedToken(
  token: StructuredPdfToken,
  rotation: PageRotation,
): StructuredPdfToken {
  if (rotation === 0) return { ...token };
  if (rotation === 90) {
    return {
      ...token,
      x: clamp01(1 - token.y - token.height),
      y: clamp01(token.x),
      width: clamp01(token.height),
      height: clamp01(token.width),
    };
  }
  if (rotation === 180) {
    return {
      ...token,
      x: clamp01(1 - token.x - token.width),
      y: clamp01(1 - token.y - token.height),
    };
  }
  return {
    ...token,
    x: clamp01(token.y),
    y: clamp01(1 - token.x - token.width),
    width: clamp01(token.height),
    height: clamp01(token.width),
  };
}

function normalizedText(text: string): string {
  return text.toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function usefulTextScore(tokens: StructuredPdfToken[]): number {
  const useful = tokens.filter((token) => /[\p{L}\p{N}]/u.test(token.text)).length;
  const confidence = tokens.length
    ? tokens.reduce((sum, token) => sum + clamp01(token.confidence / 100), 0) / tokens.length
    : 0;
  return clamp01(useful / 30) * 0.45 + confidence * 0.55;
}

function reconstructedLinesScore(
  tokens: StructuredPdfToken[],
  rows: ReturnType<typeof groupPdfTokensIntoRows>,
): number {
  if (!tokens.length) return 0;
  const horizontalTokens = tokens.filter((token) => token.width >= token.height * 1.15).length / tokens.length;
  const usefulRows = rows.filter((row) => row.tokens.length >= 2 && row.text.length >= 4).length;
  const rowDensity = clamp01(usefulRows / Math.max(3, Math.sqrt(tokens.length)));
  return horizontalTokens * 0.65 + rowDensity * 0.35;
}

function numericAlignmentScore(rows: ReturnType<typeof groupPdfTokensIntoRows>): number {
  const rightEdges: Array<{ edge: number; row: number }> = [];
  rows.forEach((row, rowIndex) => {
    row.tokens.filter((token) =>
      /^\(?[-+]?\s*(?:[$â‚¬Â£]\s*)?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[,.]\d{1,2})?\s*\)?$/.test(token.text.trim()))
      .forEach((token) => rightEdges.push({ edge: token.x + token.width, row: rowIndex }));
  });
  if (rightEdges.length < 3) return 0;
  const repeated = rightEdges.filter((item) => {
    const matchingRows = new Set(rightEdges
      .filter((candidate) => Math.abs(candidate.edge - item.edge) <= 0.025)
      .map((candidate) => candidate.row));
    return matchingRows.size >= 3;
  }).length;
  return repeated / rightEdges.length;
}

function accountingTermsScore(rows: ReturnType<typeof groupPdfTokensIntoRows>): number {
  const orderedText = normalizedText(rows.map((row) => row.text).join('\n'));
  const phrases = [
    'estado de situacion patrimonial',
    'balance general',
    'estado de resultados',
    'activo corriente',
    'activo no corriente',
    'pasivo corriente',
    'pasivo no corriente',
    'patrimonio neto',
    'total activo',
    'total pasivo',
  ];
  const singleTerms = ['activo', 'pasivo', 'patrimonio', 'resultados', 'ejercicio'];
  const phraseHits = phrases.filter((term) => orderedText.includes(term)).length;
  const termHits = singleTerms.filter((term) => new RegExp(`\\b${term}\\b`, 'u').test(orderedText)).length;
  return clamp01(phraseHits * 0.28 + termHits * 0.08);
}

function scoreCandidate(tokens: StructuredPdfToken[], rows: ReturnType<typeof groupPdfTokensIntoRows>): number {
  return clamp01(
    usefulTextScore(tokens) * 0.2
    + reconstructedLinesScore(tokens, rows) * 0.35
    + numericAlignmentScore(rows) * 0.2
    + accountingTermsScore(rows) * 0.25,
  );
}

function buildCandidate(page: StructuredPdfPage, rotation: PageRotation): OrientationCandidate {
  const tokens = page.tokens.map((token) => rotateNormalizedToken(token, rotation));
  const rows = groupPdfTokensIntoRows(tokens);
  return { rotation, tokens, rows, score: scoreCandidate(tokens, rows) };
}

export function normalizePdfPageOrientation(page: StructuredPdfPage): OrientationNormalizedPdfPage {
  const candidates = ROTATIONS.map((rotation) => buildCandidate(page, rotation))
    .sort((left, right) => right.score - left.score || left.rotation - right.rotation);
  const best = candidates[0];
  const runnerUp = candidates[1];
  const margin = best.score - runnerUp.score;
  const certain = best.score >= MIN_ORIENTATION_SCORE && margin >= MIN_SCORE_MARGIN;
  const selected = certain ? best : candidates.find((candidate) => candidate.rotation === 0) ?? best;
  const orientationConfidence = certain
    ? clamp01(0.55 + margin * 2 + best.score * 0.25)
    : clamp01(Math.max(0.05, margin + best.score * 0.25));
  const swapsDimensions = selected.rotation === 90 || selected.rotation === 270;

  return {
    ...page,
    tokens: selected.tokens,
    rows: selected.rows,
    detectedRotation: selected.rotation,
    orientationConfidence: Math.round(orientationConfidence * 100) / 100,
    orientationStatus: certain
      ? selected.rotation === 0 ? 'original' : 'corrected'
      : 'uncertain',
    deskewAngle: 0,
    normalizedWidth: swapsDimensions ? page.height : page.width,
    normalizedHeight: swapsDimensions ? page.width : page.height,
  };
}

export function normalizePdfDocumentOrientation(
  document: StructuredPdfDocument,
): OrientationNormalizedPdfDocument {
  return { pages: document.pages.map(normalizePdfPageOrientation) };
}

export function canUsePageForValidatedExtraction(page: OrientationNormalizedPdfPage): boolean {
  return page.orientationStatus !== 'uncertain';
}

