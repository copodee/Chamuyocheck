import { createWorker, OEM, PSM } from 'tesseract.js';
import spanishData from '@tesseract.js-data/spa';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function extractImageText(file: File) {
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type) || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, text: '', confidence: 0, note: 'La imagen debe ser PNG, JPG o WebP y pesar como máximo 10 MB.' };
  }
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await createWorker('spa', OEM.LSTM_ONLY, {
      langPath: spanishData.langPath,
      gzip: spanishData.gzip,
      cacheMethod: 'none',
    });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await worker.recognize(buffer);
    const text = String(result.data.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const confidence = Number(result.data.confidence || 0);
    return {
      ok: text.length >= 20,
      text,
      confidence,
      note: text.length >= 20
        ? `OCR local completado (${confidence.toFixed(0)}% de confianza estimada de lectura).`
        : 'La captura no produjo texto suficiente. Probá con una imagen más nítida y sin recortes.',
    };
  } catch {
    return { ok: false, text: '', confidence: 0, note: 'No se pudo leer la captura mediante OCR local.' };
  } finally {
    await worker?.terminate().catch(() => undefined);
  }
}
