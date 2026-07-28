export type PdfTokenOrigin = 'pdfjs' | 'ocr';

export type StructuredPdfToken = {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  origin: PdfTokenOrigin;
  confidence: number;
};

export type StructuredPdfRow = {
  page: number;
  y: number;
  height: number;
  tokens: StructuredPdfToken[];
  text: string;
};

export type StructuredPdfPage = {
  page: number;
  width: number;
  height: number;
  tokens: StructuredPdfToken[];
  rows: StructuredPdfRow[];
};

export type StructuredPdfDocument = {
  pages: StructuredPdfPage[];
};

export type AbsolutePdfToken = Omit<StructuredPdfToken, 'x' | 'y' | 'width' | 'height'> & {
  x: number;
  y: number;
  width: number;
  height: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function normalizePdfToken(
  token: AbsolutePdfToken,
  pageWidth: number,
  pageHeight: number,
): StructuredPdfToken {
  const safeWidth = pageWidth > 0 ? pageWidth : 1;
  const safeHeight = pageHeight > 0 ? pageHeight : 1;
  return {
    ...token,
    x: clamp01(token.x / safeWidth),
    y: clamp01(token.y / safeHeight),
    width: clamp01(token.width / safeWidth),
    height: clamp01(token.height / safeHeight),
  };
}

export function groupPdfTokensIntoRows(tokens: StructuredPdfToken[]): StructuredPdfRow[] {
  const rows: StructuredPdfToken[][] = [];
  const sorted = [...tokens].sort((left, right) =>
    left.page - right.page || left.y - right.y || left.x - right.x);

  for (const token of sorted) {
    const center = token.y + token.height / 2;
    const matchingRow = rows.find((row) => {
      if (row[0]?.page !== token.page) return false;
      const rowCenter = row.reduce((sum, item) => sum + item.y + item.height / 2, 0) / row.length;
      const tolerance = Math.max(token.height, ...row.map((item) => item.height)) * 0.6;
      return Math.abs(center - rowCenter) <= tolerance;
    });
    if (matchingRow) matchingRow.push(token);
    else rows.push([token]);
  }

  return rows.map((row) => {
    const ordered = row.sort((left, right) => left.x - right.x);
    const top = Math.min(...ordered.map((token) => token.y));
    const bottom = Math.max(...ordered.map((token) => token.y + token.height));
    return {
      page: ordered[0].page,
      y: top,
      height: bottom - top,
      tokens: ordered,
      text: ordered.map((token) => token.text).join(' ').replace(/[ \t]+/g, ' ').trim(),
    };
  });
}

