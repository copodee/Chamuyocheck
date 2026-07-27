import type { BrowserOcrResult } from './browserOcr';

const MAX_PDF_BYTES = 40 * 1024 * 1024;
const MAX_PDF_PAGES = 180;
const MAX_OCR_PAGES = 60;

export type PdfOcrProgress = {
  page: number;
  totalPages: number;
};

export type BrowserPdfOcrResult = BrowserOcrResult & {
  pages: number;
  nativePages: number;
  ocrPages: number;
  unreadablePages: number[];
  partial: boolean;
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

function rotateCanvasClockwise(source: HTMLCanvasElement): HTMLCanvasElement {
  const rotated = window.document.createElement('canvas');
  rotated.width = source.height;
  rotated.height = source.width;
  const context = rotated.getContext('2d', { alpha: false });
  if (!context) throw new Error('CANVAS_UNAVAILABLE');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, rotated.width, rotated.height);
  context.translate(rotated.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(source, 0, 0);
  return rotated;
}

function financialTextQuality(text: string, confidence: number): number {
  const financialTerms = text.match(
    /activo|pasivo|patrimonio|ventas|resultado|corriente|disponibilidades|cr[eé]ditos|deudas|bienes de cambio/gi,
  )?.length || 0;
  return confidence + Math.min(25, text.length / 80) + Math.min(50, financialTerms * 5);
}

function nativeTextIsReliable(text: string): boolean {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length < 80) return false;
  const usefulCharacters = (compact.match(/[a-záéíóúüñ0-9$%.,:;()/-]/gi) || []).length;
  const usefulRatio = usefulCharacters / Math.max(1, compact.length);
  const accountingTerms = compact.match(
    /activo|pasivo|patrimonio|estado|balance|ventas|resultado|corriente|disponibilidades|cr[eé]ditos|deudas|bienes de cambio|notas?|anexo/gi,
  )?.length || 0;
  return usefulRatio >= 0.68 && (compact.length >= 350 || accountingTerms >= 2);
}

export function reconstructPdfText(items: PdfTextItem[]): string {
  const positioned = items
    .filter((item) => typeof item.str === 'string' && item.str.trim())
    .map((item) => ({
      text: item.str!.trim(),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      height: Math.max(1, Number(item.height || item.transform?.[3] || 10)),
    }))
    .sort((left, right) => right.y - left.y || left.x - right.x);

  const lines: Array<{ y: number; height: number; items: typeof positioned }> = [];
  for (const item of positioned) {
    const line = lines.find((candidate) =>
      Math.abs(candidate.y - item.y) <= Math.max(2, Math.min(candidate.height, item.height) * 0.35)
    );
    if (line) {
      line.items.push(item);
      line.y = (line.y + item.y) / 2;
      line.height = Math.max(line.height, item.height);
    } else {
      lines.push({ y: item.y, height: item.height, items: [item] });
    }
  }

  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => line.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(' '))
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractPdfTextInBrowser(
  file: File,
  onProgress?: (progress: PdfOcrProgress) => void,
): Promise<BrowserPdfOcrResult> {
  if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
    return { ok: false, text: '', confidence: 0, pages: 0, nativePages: 0, ocrPages: 0, unreadablePages: [], partial: false, note: 'El archivo seleccionado no es un PDF.' };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, text: '', confidence: 0, pages: 0, nativePages: 0, ocrPages: 0, unreadablePages: [], partial: false, note: 'El PDF puede pesar como máximo 40 MB.' };
  }

  let document: any = null;
  let worker: any = null;
  let totalPages = 0;
  const texts: string[] = [];
  const confidences: number[] = [];
  const unreadablePages: number[] = [];
  let nativePages = 0;
  let ocrPages = 0;
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    totalPages = document.numPages;
    if (totalPages > MAX_PDF_PAGES) {
      return {
        ok: false,
        text: '',
        confidence: 0,
        pages: totalPages,
        nativePages: 0,
        ocrPages: 0,
        unreadablePages: [],
        partial: false,
        note: `El PDF tiene ${totalPages} páginas. El máximo admitido es ${MAX_PDF_PAGES}.`,
      };
    }
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      onProgress?.({ page: pageNumber, totalPages });
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const nativeText = reconstructPdfText(content.items);
      if (nativeTextIsReliable(nativeText)) {
        texts.push(`[Página ${pageNumber}]\n${nativeText}`);
        confidences.push(100);
        nativePages += 1;
        page.cleanup();
        continue;
      }
      if (ocrPages >= MAX_OCR_PAGES) {
        if (nativeText.length >= 30) {
          texts.push(`[Página ${pageNumber} · texto parcial]\n${nativeText}`);
          confidences.push(45);
        }
        unreadablePages.push(pageNumber);
        page.cleanup();
        continue;
      }
      if (!worker) {
        const { createWorker, OEM, PSM } = await import('tesseract.js');
        worker = await createWorker('spa', OEM.LSTM_ONLY);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
      }
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('CANVAS_UNAVAILABLE');
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      let result = await worker.recognize(canvas, { rotateAuto: true });
      let text = String(result.data.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      let confidence = Number(result.data.confidence || 0);
      if (confidence < 68 || text.length < 180) {
        const rotated = rotateCanvasClockwise(canvas);
        const rotatedResult = await worker.recognize(rotated, { rotateAuto: false });
        const rotatedText = String(rotatedResult.data.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        const rotatedConfidence = Number(rotatedResult.data.confidence || 0);
        if (financialTextQuality(rotatedText, rotatedConfidence) > financialTextQuality(text, confidence)) {
          result = rotatedResult;
          text = rotatedText;
          confidence = rotatedConfidence;
        }
        rotated.width = 1;
        rotated.height = 1;
      }
      if (text) texts.push(`[Página ${pageNumber}]\n${text}`);
      if (text.length >= 30) {
        confidences.push(confidence);
        ocrPages += 1;
      } else {
        unreadablePages.push(pageNumber);
      }
      page.cleanup();
      canvas.width = 1;
      canvas.height = 1;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message.trim() : '';
    return {
      ok: false,
      text: '',
      confidence: 0,
      pages: totalPages,
      nativePages,
      ocrPages,
      unreadablePages,
      partial: true,
      note: detail && detail !== 'Error'
        ? `No se pudo leer el PDF en este dispositivo: ${detail}`
        : 'No se pudo iniciar la lectura del PDF en este navegador. Actualizá el navegador o probá desde una computadora.',
    };
  } finally {
    await worker?.terminate().catch(() => undefined);
    await document?.destroy().catch(() => undefined);
  }

  const text = texts.join('\n\n').trim();
  const confidence = confidences.length
    ? confidences.reduce((total, value) => total + value, 0) / confidences.length
    : 0;
  return {
    ok: text.length >= 20,
    text,
    confidence,
    pages: totalPages,
    nativePages,
    ocrPages,
    unreadablePages,
    partial: unreadablePages.length > 0,
    note: text.length >= 20
      ? unreadablePages.length
        ? `Lectura parcial: ${nativePages} página(s) con texto nativo, ${ocrPages} mediante OCR y ${unreadablePages.length} pendiente(s) de revisión humana (${unreadablePages.join(', ')}).`
        : `PDF leído completo: ${nativePages} página(s) con texto nativo y ${ocrPages} mediante OCR.`
      : 'El PDF no produjo texto suficiente. Puede estar protegido o tener imágenes de muy baja calidad.',
  };
}
