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
    const { createWorker, OEM, PSM } = await import('tesseract.js');
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
    worker = await createWorker('spa', OEM.LSTM_ONLY);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      onProgress?.({ page: pageNumber, totalPages });
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.35 });
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
      ? `PDF escaneado leído en el dispositivo: ${totalPages} páginas (${confidence.toFixed(0)}% de confianza óptica estimada).`
      : 'El PDF no produjo texto suficiente. Puede estar protegido o tener imágenes de muy baja calidad.',
  };
}
