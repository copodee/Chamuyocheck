import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFImage, PDFFont, rgb } from 'pdf-lib';

export const runtime = 'nodejs';

type ReportSection = { title: string; items: string[] };
type ComparisonTable = { columns: string[]; rows: Array<{ label: string; values: string[] }> };
type LeasingReportPayload = {
  date: string;
  category: string;
  input: string;
  title: string;
  summary: string;
  score: number;
  scoreLabel: string;
  comparisonTable?: ComparisonTable;
  sections?: ReportSection[];
  findings?: string[];
  nextActions?: string[];
  limitations?: string[];
  disclaimer: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 54;
const RIGHT = 54;
const TOP = 92;
const BOTTOM = 70;
const TEXT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const BODY_SIZE = 11;
const DISCLAIMER_SIZE = 9;
const BODY_LEADING = 15;

function sanitize(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : fallback;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }
    let fragment = '';
    for (const character of word) {
      const next = fragment + character;
      if (font.widthOfTextAtSize(next, size) > maxWidth && fragment) {
        lines.push(fragment);
        fragment = character;
      } else {
        fragment = next;
      }
    }
    line = fragment;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawHeader(page: ReturnType<PDFDocument['addPage']>, logo: PDFImage) {
  const width = 220;
  const height = width * (logo.height / logo.width);
  page.drawImage(logo, { x: LEFT, y: PAGE_HEIGHT - 54, width, height });
  page.drawLine({
    start: { x: LEFT, y: PAGE_HEIGHT - 66 },
    end: { x: PAGE_WIDTH - RIGHT, y: PAGE_HEIGHT - 66 },
    thickness: 0.8,
    color: rgb(0.08, 0.47, 0.52),
  });
}

function drawFooter(page: ReturnType<PDFDocument['addPage']>, font: PDFFont, pageNumber: number) {
  page.drawLine({
    start: { x: LEFT, y: 48 },
    end: { x: PAGE_WIDTH - RIGHT, y: 48 },
    thickness: 0.7,
    color: rgb(0.65, 0.72, 0.75),
  });
  const site = 'www.leasingscoring.com';
  const siteWidth = font.widthOfTextAtSize(site, 9);
  page.drawText(site, {
    x: (PAGE_WIDTH - siteWidth) / 2,
    y: 31,
    size: 9,
    font,
    color: rgb(0.12, 0.30, 0.35),
  });
  page.drawText(String(pageNumber), {
    x: PAGE_WIDTH - RIGHT - font.widthOfTextAtSize(String(pageNumber), 9),
    y: 31,
    size: 9,
    font,
    color: rgb(0.38, 0.46, 0.49),
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LeasingReportPayload;
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const [regularBytes, boldBytes, logoBytes] = await Promise.all([
      readFile(path.join(process.cwd(), 'public', 'fonts', 'Arial-compatible-Regular.ttf')),
      readFile(path.join(process.cwd(), 'public', 'fonts', 'Arial-compatible-Bold.ttf')),
      readFile(path.join(process.cwd(), 'public', 'brand', 'leasing-scoring-report-logo.png')),
    ]);
    const regular = await pdf.embedFont(regularBytes, { subset: true });
    const bold = await pdf.embedFont(boldBytes, { subset: true });
    const logo = await pdf.embedPng(logoBytes);
    let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let pageNumber = 1;
    let y = PAGE_HEIGHT - TOP;
    drawHeader(page, logo);

    const newPage = () => {
      drawFooter(page, regular, pageNumber);
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNumber += 1;
      y = PAGE_HEIGHT - TOP;
      drawHeader(page, logo);
    };
    const ensure = (height: number) => {
      if (y - height < BOTTOM) newPage();
    };
    const paragraph = (
      value: string,
      options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {},
    ) => {
      const font = options.font || regular;
      const size = options.size || BODY_SIZE;
      const indent = options.indent || 0;
      const leading = size + 4;
      const lines = wrapText(sanitize(value), font, size, TEXT_WIDTH - indent);
      ensure(lines.length * leading + (options.gap ?? 7));
      for (const line of lines) {
        page.drawText(line, {
          x: LEFT + indent,
          y,
          size,
          font,
          color: options.color || rgb(0.08, 0.18, 0.22),
        });
        y -= leading;
      }
      y -= options.gap ?? 7;
    };
    const heading = (value: string) => {
      ensure(30);
      y -= 3;
      paragraph(value.toUpperCase(), { font: bold, size: 12, color: rgb(0.32, 0.12, 0.68), gap: 8 });
    };
    const bulletList = (items: string[]) => {
      items.map((item) => sanitize(item)).filter(Boolean).forEach((item) => paragraph(`• ${item}`, { indent: 10, gap: 4 }));
      y -= 3;
    };

    paragraph(sanitize(payload.title, 'Resultado financiero del leasing'), {
      font: bold,
      size: 17,
      color: rgb(0.05, 0.24, 0.29),
      gap: 10,
    });
    paragraph(`Fecha: ${sanitize(payload.date)} | Categoría: ${sanitize(payload.category)} | Entrada: ${sanitize(payload.input)}`, {
      size: 9,
      color: rgb(0.35, 0.44, 0.47),
      gap: 10,
    });
    paragraph(sanitize(payload.summary), { gap: 10 });
    paragraph(`LeasingScoring: ${Number(payload.score) || 0}/100 - ${sanitize(payload.scoreLabel)}`, {
      font: bold,
      size: 12,
      color: rgb(0.04, 0.48, 0.53),
      gap: 12,
    });

    if (payload.comparisonTable?.rows?.length) {
      heading('Comparación');
      payload.comparisonTable.rows.forEach((row) => {
        paragraph(sanitize(row.label), { font: bold, gap: 2 });
        row.values.forEach((value, index) => {
          const column = sanitize(payload.comparisonTable?.columns?.[index], `Alternativa ${index + 1}`);
          paragraph(`${column}: ${sanitize(value)}`, { indent: 12, gap: 3 });
        });
        y -= 3;
      });
    }
    (payload.sections || []).forEach((section) => {
      heading(sanitize(section.title));
      bulletList(section.items || []);
    });
    if (!payload.sections?.length && payload.findings?.length) {
      heading('Datos y hallazgos');
      bulletList(payload.findings);
    }
    if (payload.nextActions?.length) {
      heading('Qué conviene hacer ahora');
      bulletList(payload.nextActions);
    }
    if (payload.limitations?.length) {
      heading('Datos que deben verificarse');
      bulletList(payload.limitations);
    }
    heading('Aviso legal');
    paragraph(sanitize(payload.disclaimer, 'Resultado automatizado, orientativo y sujeto a revisión humana.'), {
      size: DISCLAIMER_SIZE,
      color: rgb(0.34, 0.40, 0.43),
      gap: 0,
    });
    drawFooter(page, regular, pageNumber);
    pdf.setTitle(sanitize(payload.title, 'Informe LeasingScoring'));
    pdf.setAuthor('LeasingScoring');
    pdf.setSubject('Informe financiero de leasing');
    const bytes = await pdf.save();
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="informe-leasingscoring-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('leasing-report', error);
    return Response.json({ error: 'No se pudo generar el informe PDF.' }, { status: 500 });
  }
}
