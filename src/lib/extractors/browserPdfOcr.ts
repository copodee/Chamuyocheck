import type { BrowserOcrResult } from './browserOcr';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 30;

export type PdfOcrProgress = {
  page: number;
  totalPages: number;
};

export type BrowserPdfOcrResult = BrowserOcrResult & {
  pages: number;
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

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
    return { ok: false, text: '', confidence: 0, pages: 0, note: 'El archivo seleccionado no es un PDF.' };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, text: '', confidence: 0, pages: 0, note: 'El PDF puede pesar como máximo 20 MB.' };
  }

  let document: any = null;
  let worker: any = null;
  let totalPages = 0;
  const texts: string[] = [];
  const confidences: number[] = [];
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
        note: `El PDF tiene ${totalPages} páginas. El máximo para lectura óptica es ${MAX_PDF_PAGES}.`,
      };
    }
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      onProgress?.({ page: pageNumber, totalPages });
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const nativeText = reconstructPdfText(content.items);
      if (nativeText.length >= 30) {
        texts.push(`[Página ${pageNumber}]\n${nativeText}`);
        confidences.push(100);
        page.cleanup();
        continue;
      }
      if (!worker) {
        const { createWorker, OEM, PSM } = await import('tesseract.js');
        worker = await createWorker('spa', OEM.LSTM_ONLY);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
      }
      const viewport = page.getViewport({ scale: 1.65 });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('CANVAS_UNAVAILABLE');
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      const result = await worker.recognize(canvas, { rotateAuto: true });
      const text = String(result.data.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (text) texts.push(`[Página ${pageNumber}]\n${text}`);
      confidences.push(Number(result.data.confidence || 0));
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
    note: text.length >= 20
      ? `PDF leído en el dispositivo: ${totalPages} páginas. Se usó texto nativo cuando estaba disponible y lectura óptica sólo como respaldo.`
      : 'El PDF no produjo texto suficiente. Puede estar protegido o tener imágenes de muy baja calidad.',
  };
}
