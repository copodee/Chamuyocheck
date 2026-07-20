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

  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (document.numPages > MAX_PDF_PAGES) {
    await document.destroy();
    return {
      ok: false,
      text: '',
      confidence: 0,
      pages: document.numPages,
      note: `El PDF tiene ${document.numPages} páginas. El máximo para lectura óptica es ${MAX_PDF_PAGES}.`,
    };
  }

  const worker = await createWorker('spa', OEM.LSTM_ONLY);
  const texts: string[] = [];
  const confidences: number[] = [];
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress?.({ page: pageNumber, totalPages: document.numPages });
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('CANVAS_UNAVAILABLE');
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      const result = await worker.recognize(canvas);
      const text = String(result.data.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      if (text) texts.push(`[Página ${pageNumber}]\n${text}`);
      confidences.push(Number(result.data.confidence || 0));
      page.cleanup();
      canvas.width = 1;
      canvas.height = 1;
    }
  } catch {
    return {
      ok: false,
      text: '',
      confidence: 0,
      pages: document.numPages,
      note: 'No se pudo completar la lectura óptica del PDF en este dispositivo.',
    };
  } finally {
    await worker.terminate().catch(() => undefined);
    await document.destroy().catch(() => undefined);
  }

  const text = texts.join('\n\n').trim();
  const confidence = confidences.length
    ? confidences.reduce((total, value) => total + value, 0) / confidences.length
    : 0;
  return {
    ok: text.length >= 20,
    text,
    confidence,
    pages: document.numPages,
    note: text.length >= 20
      ? `PDF escaneado leído en el dispositivo: ${document.numPages} páginas (${confidence.toFixed(0)}% de confianza óptica estimada).`
      : 'El PDF no produjo texto suficiente. Puede estar protegido o tener imágenes de muy baja calidad.',
  };
}
